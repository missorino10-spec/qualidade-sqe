import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  CadastroImport,
  ColunaImport,
  TipoColuna,
} from './importacao.definicoes';

// ---------------------------------------------------------------------------
// Importacao de cadastro por planilha.
//
// O caminho e sempre o mesmo, nos cinco cadastros:
//
//   1. a tela baixa a planilha JA PREENCHIDA com o cadastro de hoje;
//   2. a pessoa edita no Excel (corrige, acrescenta linha, apaga linha);
//   3. sobe o arquivo e ve a PREVIA: quantas entram, quantas mudam, quantas
//      foram recusadas e por que;
//   4. so entao confirma, e ai o sistema grava.
//
// A previa e a gravacao leem o MESMO arquivo com a MESMA funcao (analisar). O
// arquivo e postado de novo na confirmacao: assim o servidor nao guarda estado
// entre os dois passos e nao existe o risco de confirmar uma previa velha.
//
// Uma linha ruim nunca derruba o arquivo: ela sai da lista com o numero da
// linha e o motivo, e as boas seguem.
// ---------------------------------------------------------------------------

const ABA_DADOS = 'Cadastro';
const ABA_AJUDA = 'Como preencher';
const LARANJA = 'FFE8792B';
const CINZA = 'FFF2F2F2';

// Comparacao de cabecalho e de opcao: sem acento, sem caixa, sem espaco sobrando.
function chaveTexto(v: any): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function vazio(v: any): boolean {
  return v === null || v === undefined || String(v).trim() === '';
}

// O ExcelJS devolve a celula ja convertida quase sempre, mas formula, hyperlink
// e texto rico chegam como objeto. Aqui tudo vira um valor simples.
function valorCru(celula: ExcelJS.Cell | undefined): any {
  const v = celula?.value as any;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('text' in v) return v.text;
    if ('result' in v) return v.result;
    if ('richText' in v) return v.richText.map((r: any) => r.text).join('');
    if ('hyperlink' in v) return v.text ?? v.hyperlink;
  }
  return v;
}

function lerData(v: any): Date | null {
  if (v instanceof Date) {
    // A data vem do Excel em UTC; o sistema guarda a meia-noite UTC do dia.
    return new Date(
      Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()),
    );
  }
  const texto = String(v).trim();
  const br = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) {
    return new Date(Date.UTC(+br[3], +br[2] - 1, +br[1]));
  }
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  }
  return null;
}

function lerNumero(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  // "1.234,56" (jeito brasileiro) e "1234.56" (jeito do Excel em ingles).
  const texto = String(v).trim().replace(/[R$\s]/g, '');
  const normal = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte a celula para o tipo da coluna. Devolve o valor ou o motivo da
 * recusa - nunca os dois.
 */
function converter(
  coluna: ColunaImport,
  bruto: any,
): { valor?: any; erro?: string } {
  const tipo: TipoColuna = coluna.tipo;

  if (tipo === 'escolha' || tipo === 'sim-nao') {
    const alvo = chaveTexto(bruto);
    const achou = coluna.opcoes?.find(
      (o) => chaveTexto(o.texto) === alvo || chaveTexto(o.valor) === alvo,
    );
    if (!achou) {
      const aceitos = (coluna.opcoes ?? []).map((o) => o.texto).join(', ');
      return {
        erro: `"${coluna.titulo}" só aceita ${aceitos} (veio "${bruto}")`,
      };
    }
    return { valor: achou.valor };
  }

  if (tipo === 'data') {
    const d = lerData(bruto);
    if (!d) return { erro: `"${coluna.titulo}" não é uma data (veio "${bruto}")` };
    return { valor: d };
  }

  if (tipo === 'inteiro' || tipo === 'moeda') {
    const n = lerNumero(bruto);
    if (n === null)
      return { erro: `"${coluna.titulo}" não é um número (veio "${bruto}")` };
    if (n < 0) return { erro: `"${coluna.titulo}" não pode ser negativo` };
    if (tipo === 'inteiro' && !Number.isInteger(n))
      return { erro: `"${coluna.titulo}" tem que ser um número inteiro` };
    // Dinheiro fechado no centavo, como o resto do sistema.
    return { valor: tipo === 'moeda' ? Math.round(n * 100) / 100 : n };
  }

  return { valor: String(bruto).trim() };
}

export type AcaoLinha = 'NOVA' | 'ATUALIZA' | 'IGUAL' | 'RECUSADA';

export interface LinhaAnalisada {
  linha: number;
  chave: string;
  resumo: string;
  acao: AcaoLinha;
  motivo?: string;
  mudancas?: string[];
  /** Interno: o que gravar. Nao vai para a tela. */
  dados?: Record<string, any>;
  idExistente?: number;
}

export interface Previa {
  cadastro: string;
  titulo: string;
  rotuloChave: string;
  podeInativar: boolean;
  colunasIgnoradas: string[];
  colunasAusentes: string[];
  novas: LinhaAnalisada[];
  atualizam: LinhaAnalisada[];
  iguais: number;
  recusadas: LinhaAnalisada[];
  inativar: { chave: string; resumo: string; id: number }[];
}

@Injectable()
export class ImportacaoService {
  constructor(private prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Cadastro de hoje, achatado no formato das colunas da planilha.
  // -------------------------------------------------------------------------
  private async carregarAtuais(cad: CadastroImport): Promise<any[]> {
    switch (cad.chave) {
      case 'fornecedores':
        return this.prisma.fornecedor.findMany({ orderBy: { codigo: 'asc' } });
      case 'itens': {
        const itens = await this.prisma.item.findMany({
          orderBy: { codigo: 'asc' },
          include: { fornecedor: { select: { codigo: true } } },
        });
        return itens.map((i) => ({
          ...i,
          fornecedorCodigo: i.fornecedor?.codigo ?? null,
        }));
      }
      case 'maquinas':
        return this.prisma.maquina.findMany({ orderBy: { codigo: 'asc' } });
      case 'instrumentos':
        return this.prisma.instrumento.findMany({
          orderBy: [{ codigo: 'asc' }, { equipamento: 'asc' }],
        });
      case 'colaboradores': {
        const usuarios = await this.prisma.usuario.findMany({
          orderBy: { nome: 'asc' },
          include: { acessos: { select: { modulo: true, nivel: true } } },
        });
        return usuarios.map((u) => {
          const linha: any = { ...u };
          for (const a of u.acessos) linha[`acesso:${a.modulo}`] = a.nivel;
          return linha;
        });
      }
      default:
        return [];
    }
  }

  // -------------------------------------------------------------------------
  // 1) A planilha que o usuario baixa: ja preenchida com o cadastro atual.
  // -------------------------------------------------------------------------
  async montarModelo(cad: CadastroImport): Promise<Buffer> {
    const atuais = await this.carregarAtuais(cad);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Big Dutchman Brasil — Sistema de Qualidade';
    wb.created = new Date();

    const ws = wb.addWorksheet(ABA_DADOS);
    const cabecalho = ws.addRow(
      cad.colunas.map((c) => (c.obrigatorio ? `${c.titulo} *` : c.titulo)),
    );
    cabecalho.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cabecalho.alignment = { vertical: 'middle', wrapText: true };
    cabecalho.height = 28;
    cabecalho.eachCell((celula) => {
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
    });

    for (const reg of atuais) {
      const linha = ws.addRow(
        cad.colunas.map((c) => {
          const v = reg[c.campo];
          if (v === null || v === undefined) {
            // "Sem acesso" e um valor de verdade, nao um branco.
            return c.campo.startsWith('acesso:') ? 'Sem acesso' : null;
          }
          if (c.tipo === 'sim-nao' || c.tipo === 'escolha') {
            const achou = c.opcoes?.find((o) => o.valor === v);
            return achou ? achou.texto : String(v);
          }
          if (c.tipo === 'data') return v instanceof Date ? v : new Date(v);
          return v;
        }),
      );
      cad.colunas.forEach((c, i) => {
        const celula = linha.getCell(i + 1);
        if (c.tipo === 'data') celula.numFmt = 'dd/mm/yyyy';
        if (c.tipo === 'moeda') celula.numFmt = '#,##0.00';
      });
    }

    cad.colunas.forEach((c, i) => {
      const maior = atuais.reduce(
        (max, r) => Math.max(max, String(r[c.campo] ?? '').length),
        c.titulo.length,
      );
      ws.getColumn(i + 1).width = Math.min(Math.max(maior + 2, 12), 40);
      // Lista suspensa nas colunas de escolha: evita o erro de digitacao que
      // faria a linha ser recusada sem necessidade.
      if (c.opcoes?.length) {
        const letra = ws.getColumn(i + 1).letter;
        // dataValidations existe no exceljs mas ficou de fora do .d.ts dele.
        (ws as any).dataValidations.add(`${letra}2:${letra}5000`, {
          type: 'list',
          allowBlank: true,
          formulae: [`"${c.opcoes.map((o) => o.texto).join(',')}"`],
        });
      }
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: cad.colunas.length },
    };

    this.abaDeAjuda(wb, cad);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private abaDeAjuda(wb: ExcelJS.Workbook, cad: CadastroImport) {
    const ws = wb.addWorksheet(ABA_AJUDA);
    const titulo = ws.addRow([`Importação de ${cad.titulo}`]);
    titulo.font = { bold: true, size: 14 };
    ws.addRow([]);

    const regras = [
      `A aba "${ABA_DADOS}" já vem com o cadastro de hoje. Corrija em cima dela, acrescente as linhas novas no fim e devolva o arquivo.`,
      `A coluna "${cad.rotuloChave}" é o que liga a linha ao registro que já existe: igual, atualiza; diferente, cadastra.`,
      'Coluna marcada com * é obrigatória. Se ficar em branco, a linha é recusada e as outras seguem normalmente.',
      'Coluna de escolha em branco mantém o que já está no sistema.',
      'Demais colunas em branco deixam o campo vazio: nessa planilha, o que está escrito manda.',
      'Coluna que você apagar da planilha não é mexida pelo sistema.',
      cad.podeInativar
        ? 'Apagar uma linha só tem efeito se você marcar "esta planilha é a lista completa" na hora de confirmar. Nesse caso quem sumiu é INATIVADO, nunca excluído: os documentos que apontam para ele continuam inteiros.'
        : 'Apagar uma linha não faz nada neste cadastro. Para tirar um instrumento de circulação, escreva "Não" na coluna Ativo.',
      'Nada é gravado antes de você ver a prévia e confirmar.',
    ];
    if (cad.chave === 'colaboradores') {
      regras.push(
        'A planilha NÃO tem coluna de senha. Cada colaborador novo recebe uma senha provisória gerada pelo sistema, que aparece uma única vez na tela ao final, para você entregar. No primeiro acesso a pessoa troca.',
      );
    }
    for (const r of regras) {
      const linha = ws.addRow([r]);
      linha.alignment = { wrapText: true, vertical: 'top' };
    }

    ws.addRow([]);
    const cab = ws.addRow(['Coluna', 'Obrigatória', 'O que aceita']);
    cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cab.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LARANJA } };
    });

    for (const c of cad.colunas) {
      const aceita = c.opcoes?.length
        ? c.opcoes.map((o) => o.texto).join(' / ')
        : c.tipo === 'data'
          ? 'Data (DD/MM/AAAA)'
          : c.tipo === 'moeda'
            ? 'Valor em reais'
            : c.tipo === 'inteiro'
              ? 'Número inteiro'
              : 'Texto';
      const linha = ws.addRow([
        c.titulo,
        c.obrigatorio ? 'Sim' : 'Não',
        c.ajuda ? `${aceita}. ${c.ajuda}` : aceita,
      ]);
      linha.alignment = { wrapText: true, vertical: 'top' };
      linha.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: CINZA },
      };
    }
    ws.getColumn(1).width = 34;
    ws.getColumn(2).width = 12;
    ws.getColumn(3).width = 90;
  }

  // -------------------------------------------------------------------------
  // 2) Leitura e conferencia do arquivo que voltou.
  // -------------------------------------------------------------------------
  async analisar(
    cad: CadastroImport,
    arquivo: Buffer,
    listaCompleta: boolean,
  ): Promise<Previa> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(arquivo as any);
    } catch {
      throw new BadRequestException(
        'Não foi possível abrir o arquivo. Envie a planilha .xlsx que o sistema gerou.',
      );
    }
    const ws =
      wb.getWorksheet(ABA_DADOS) ??
      wb.worksheets.find((w) => w.name !== ABA_AJUDA) ??
      wb.worksheets[0];
    if (!ws) throw new BadRequestException('A planilha está vazia.');

    // --- cabecalho -> coluna ---
    const porTitulo = new Map<string, ColunaImport>();
    for (const c of cad.colunas) porTitulo.set(chaveTexto(c.titulo), c);

    const posicao = new Map<ColunaImport, number>();
    const colunasIgnoradas: string[] = [];
    const cabecalho = ws.getRow(1);
    cabecalho.eachCell({ includeEmpty: false }, (celula, n) => {
      const texto = String(valorCru(celula) ?? '').replace(/\s*\*\s*$/, '');
      if (!texto.trim()) return;
      const coluna = porTitulo.get(chaveTexto(texto));
      if (coluna) posicao.set(coluna, n);
      else colunasIgnoradas.push(texto.trim());
    });

    const faltamObrigatorias = cad.colunas.filter(
      (c) => c.obrigatorio && !posicao.has(c),
    );
    if (faltamObrigatorias.length) {
      throw new BadRequestException(
        'A planilha não tem as colunas obrigatórias: ' +
          faltamObrigatorias.map((c) => c.titulo).join(', ') +
          '. Baixe o modelo pelo botão da tela e preencha em cima dele.',
      );
    }
    const colunasAusentes = cad.colunas
      .filter((c) => !posicao.has(c))
      .map((c) => c.titulo);

    // --- cadastro de hoje, indexado pela chave ---
    const atuais = await this.carregarAtuais(cad);
    const porChave = new Map<string, any>();
    const chaveRepetidaNoBanco = new Set<string>();
    for (const reg of atuais) {
      const k = chaveTexto(reg[cad.campoChave]);
      if (!k) continue;
      if (porChave.has(k)) chaveRepetidaNoBanco.add(k);
      else porChave.set(k, reg);
    }
    const porId = new Map<number, any>(atuais.map((r) => [r.id, r]));

    // Itens apontam para fornecedor pelo codigo: o de-para e montado uma vez.
    const fornecedorPorCodigo = new Map<string, number>();
    if (cad.chave === 'itens') {
      const fs = await this.prisma.fornecedor.findMany({
        select: { id: true, codigo: true },
      });
      for (const f of fs) fornecedorPorCodigo.set(chaveTexto(f.codigo), f.id);
    }

    const novas: LinhaAnalisada[] = [];
    const atualizam: LinhaAnalisada[] = [];
    const recusadas: LinhaAnalisada[] = [];
    let iguais = 0;
    const vistos = new Map<string, number>();
    // Registro do sistema -> linha que ja o reivindicou. Duas linhas apontando
    // para o mesmo cadastro (uma pelo "Nº do sistema", outra pelo codigo)
    // gravariam uma por cima da outra sem ninguem perceber.
    const tocados = new Map<number, number>();

    const colunaResumo =
      cad.colunas.find((c) => c.campo === 'nome') ??
      cad.colunas.find((c) => c.campo === 'descricao') ??
      cad.colunas.find((c) => c.campo === 'equipamento') ??
      cad.colunas[0];

    for (let n = 2; n <= ws.rowCount; n++) {
      const linhaExcel = ws.getRow(n);
      const bruto = new Map<ColunaImport, any>();
      let temAlgo = false;
      for (const [coluna, col] of posicao) {
        const v = valorCru(linhaExcel.getCell(col));
        bruto.set(coluna, v);
        if (!vazio(v)) temAlgo = true;
      }
      if (!temAlgo) continue; // linha em branco no meio da planilha

      const chaveBruta = bruto.get(
        cad.colunas.find((c) => c.campo === cad.campoChave)!,
      );
      const rotulo = String(chaveBruta ?? '').trim() || `linha ${n}`;
      const resumoTexto = String(bruto.get(colunaResumo) ?? '').trim();
      const base: LinhaAnalisada = {
        linha: n,
        chave: rotulo,
        resumo: resumoTexto,
        acao: 'RECUSADA',
      };
      const recusar = (motivo: string) => {
        recusadas.push({ ...base, motivo });
      };

      // --- converte celula por celula ---
      const dados: Record<string, any> = {};
      let erro: string | null = null;
      for (const [coluna, col] of posicao) {
        const v = linhaExcel.getCell(col) ? bruto.get(coluna) : null;
        if (vazio(v)) {
          if (coluna.obrigatorio) {
            erro = `"${coluna.titulo}" está em branco e é obrigatória`;
            break;
          }
          // Escolha em branco mantem o que ja esta; texto em branco limpa.
          if (coluna.tipo !== 'escolha' && coluna.tipo !== 'sim-nao') {
            dados[coluna.campo] = null;
          }
          continue;
        }
        const r = converter(coluna, v);
        if (r.erro) {
          erro = r.erro;
          break;
        }
        dados[coluna.campo] = r.valor;
      }
      if (erro) {
        recusar(erro);
        continue;
      }

      // --- acha o registro que ja existe ---
      const k = chaveTexto(dados[cad.campoChave]);
      let existente: any = null;

      if (dados.id != null) {
        existente = porId.get(Number(dados.id));
        if (!existente) {
          recusar(
            `Nº do sistema ${dados.id} não existe neste cadastro. Deixe a coluna em branco para cadastrar como novo.`,
          );
          continue;
        }
      } else if (k) {
        const repetida = vistos.get(k);
        if (repetida) {
          recusar(
            `${cad.rotuloChave} repetido: já apareceu na linha ${repetida} desta planilha`,
          );
          continue;
        }
        vistos.set(k, n);
        if (chaveRepetidaNoBanco.has(k)) {
          // Instrumentos: tres codigos se repetem no inventario. Sem saber a
          // qual dos dois a linha se refere, o sistema nao chuta.
          recusar(
            `${cad.rotuloChave} "${dados[cad.campoChave]}" está repetido no cadastro atual. Use a coluna "Nº do sistema" para dizer qual deles esta linha é.`,
          );
          continue;
        }
        existente = porChave.get(k) ?? null;
      } else if (cad.campoChave !== 'id' && !cad.podeInativar) {
        // Instrumento sem codigo e sem Nº do sistema: entra como novo.
        existente = null;
      }

      // --- regras proprias de cada cadastro ---
      if (cad.chave === 'colaboradores') {
        const email = String(dados.email ?? '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          recusar(`"${dados.email}" não é um e-mail válido`);
          continue;
        }
        dados.email = email;
      }
      if (cad.chave === 'itens' && !vazio(dados.fornecedorCodigo)) {
        const id = fornecedorPorCodigo.get(chaveTexto(dados.fornecedorCodigo));
        if (!id) {
          recusar(
            `Fornecedor "${dados.fornecedorCodigo}" não está cadastrado`,
          );
          continue;
        }
        dados.fornecedorId = id;
      }

      if (existente) {
        const antes = tocados.get(existente.id);
        if (antes) {
          recusar(
            `Esta linha aponta para o mesmo cadastro da linha ${antes} desta planilha`,
          );
          continue;
        }
        tocados.set(existente.id, n);
        const mudancas = this.diferencas(cad, posicao, dados, existente);
        if (!mudancas.length) {
          iguais++;
          continue;
        }
        atualizam.push({
          ...base,
          acao: 'ATUALIZA',
          mudancas,
          dados,
          idExistente: existente.id,
        });
      } else {
        novas.push({ ...base, acao: 'NOVA', dados });
      }
    }

    // --- quem sumiu da planilha ---
    const inativar =
      listaCompleta && cad.podeInativar
        ? atuais
            .filter((r) => !tocados.has(r.id) && r[cad.campoAtivo] !== false)
            .map((r) => ({
              id: r.id,
              chave: String(r[cad.campoChave] ?? ''),
              resumo: String(r[colunaResumo.campo] ?? ''),
            }))
        : [];

    return {
      cadastro: cad.chave,
      titulo: cad.titulo,
      rotuloChave: cad.rotuloChave,
      podeInativar: cad.podeInativar,
      colunasIgnoradas,
      colunasAusentes,
      novas,
      atualizam,
      iguais,
      recusadas,
      inativar,
    };
  }

  /**
   * O que muda de fato nesta linha. Serve para a tela nao dizer "50 atualizam"
   * quando o usuario so reenviou a mesma planilha sem tocar em nada.
   */
  private diferencas(
    cad: CadastroImport,
    posicao: Map<ColunaImport, number>,
    dados: Record<string, any>,
    atual: any,
  ): string[] {
    const mudou: string[] = [];
    for (const coluna of posicao.keys()) {
      if (coluna.campo === 'id') continue;
      if (!(coluna.campo in dados)) continue; // escolha em branco: mantem
      const novo = dados[coluna.campo];
      const velho = atual[coluna.campo] ?? null;
      // Comparacao com trim dos DOIS lados. Varios textos do cadastro foram
      // digitados com espaco ou quebra de linha no fim ("Metalurgia "); sem
      // isto a planilha voltaria dizendo que 11 dos 16 fornecedores mudaram
      // quando ninguem tocou em nada.
      const igual =
        novo instanceof Date || velho instanceof Date
          ? new Date(novo ?? 0).getTime() === new Date(velho ?? 0).getTime()
          : (novo ?? null) === (velho ?? null) ||
            String(novo ?? '').trim() === String(velho ?? '').trim();
      if (!igual) mudou.push(coluna.titulo);
    }
    // O fornecedor do item e comparado pelo codigo, que ja esta na lista acima;
    // o fornecedorId derivado nao vira uma segunda linha de mudanca.
    return mudou;
  }

  // -------------------------------------------------------------------------
  // 3) Gravacao. Linha a linha: se uma falhar, as outras ja gravadas ficam e a
  //    que falhou volta com o numero da linha e o motivo.
  // -------------------------------------------------------------------------
  async aplicar(
    cad: CadastroImport,
    arquivo: Buffer,
    listaCompleta: boolean,
    usuarioId: number,
  ) {
    const previa = await this.analisar(cad, arquivo, listaCompleta);

    const falhas: { linha: number; chave: string; motivo: string }[] = [];
    const senhas: { nome: string; email: string; senha: string }[] = [];
    let criadas = 0;
    let atualizadas = 0;

    for (const l of previa.novas) {
      try {
        const extra = await this.criar(cad, l.dados!, usuarioId);
        if (extra) senhas.push(extra);
        criadas++;
      } catch (e: any) {
        falhas.push({ linha: l.linha, chave: l.chave, motivo: motivoDoBanco(e) });
      }
    }
    for (const l of previa.atualizam) {
      try {
        await this.atualizar(cad, l.idExistente!, l.dados!);
        atualizadas++;
      } catch (e: any) {
        falhas.push({ linha: l.linha, chave: l.chave, motivo: motivoDoBanco(e) });
      }
    }

    let inativadas = 0;
    for (const alvo of previa.inativar) {
      try {
        await this.inativar(cad, alvo.id);
        inativadas++;
      } catch (e: any) {
        falhas.push({ linha: 0, chave: alvo.chave, motivo: motivoDoBanco(e) });
      }
    }

    return {
      criadas,
      atualizadas,
      inativadas,
      iguais: previa.iguais,
      recusadas: previa.recusadas,
      falhas,
      senhas,
    };
  }

  /** Separa as colunas "acesso:MODULO" das colunas do proprio Usuario. */
  private separarAcessos(dados: Record<string, any>) {
    const campos: Record<string, any> = {};
    const acessos: { modulo: any; nivel: any }[] = [];
    let mexeuNosAcessos = false;
    for (const [campo, valor] of Object.entries(dados)) {
      if (campo.startsWith('acesso:')) {
        mexeuNosAcessos = true;
        if (valor) acessos.push({ modulo: campo.slice(7), nivel: valor });
      } else {
        campos[campo] = valor;
      }
    }
    return { campos, acessos, mexeuNosAcessos };
  }

  private async criar(
    cad: CadastroImport,
    dados: Record<string, any>,
    usuarioId: number,
  ): Promise<{ nome: string; email: string; senha: string } | null> {
    const { id, fornecedorCodigo, ...campos } = dados;

    switch (cad.chave) {
      case 'fornecedores':
        await this.prisma.fornecedor.create({ data: campos as any });
        return null;
      case 'itens':
        await this.prisma.item.create({ data: campos as any });
        return null;
      case 'maquinas':
        await this.prisma.maquina.create({ data: campos as any });
        return null;
      case 'instrumentos':
        await this.prisma.instrumento.create({
          data: {
            ...(campos as any),
            proximaCalibracao:
              campos.proximaCalibracao ??
              proximaSugerida(campos.dataCalibracao, campos.periodoAnos),
            criadoPorId: usuarioId,
          },
        });
        return null;
      case 'colaboradores': {
        const { campos: ficha, acessos } = this.separarAcessos(campos);
        const senha = senhaProvisoria();
        const criado = await this.prisma.usuario.create({
          data: {
            nome: String(ficha.nome).trim(),
            email: ficha.email,
            senhaHash: await bcrypt.hash(senha, 10),
            papel: ficha.papel ?? 'QUALIDADE',
            precisaTrocarSenha: true,
            ativo: ficha.ativo ?? true,
            matricula: ficha.matricula ?? null,
            cargo: ficha.cargo ?? null,
            setor: ficha.setor ?? null,
            telefone: ficha.telefone ?? null,
            dataAdmissao: ficha.dataAdmissao ?? null,
            acessos: acessos.length ? { create: acessos } : undefined,
          },
        });
        return { nome: criado.nome, email: criado.email, senha };
      }
      default:
        return null;
    }
  }

  private async atualizar(
    cad: CadastroImport,
    id: number,
    dados: Record<string, any>,
  ) {
    const { id: _ignorado, fornecedorCodigo, ...campos } = dados;

    switch (cad.chave) {
      case 'fornecedores':
        await this.prisma.fornecedor.update({ where: { id }, data: campos as any });
        return;
      case 'itens':
        await this.prisma.item.update({ where: { id }, data: campos as any });
        return;
      case 'maquinas':
        await this.prisma.maquina.update({ where: { id }, data: campos as any });
        return;
      case 'instrumentos': {
        // Mesma regra da tela: a data escrita vence a conta, e a sugestao so
        // entra quando a proxima calibracao veio em branco.
        const atual = await this.prisma.instrumento.findUnique({ where: { id } });
        const dataCalibracao =
          'dataCalibracao' in campos ? campos.dataCalibracao : atual?.dataCalibracao;
        const periodoAnos =
          'periodoAnos' in campos ? campos.periodoAnos : atual?.periodoAnos;
        await this.prisma.instrumento.update({
          where: { id },
          data: {
            ...(campos as any),
            proximaCalibracao:
              campos.proximaCalibracao ??
              proximaSugerida(dataCalibracao, periodoAnos),
          },
        });
        return;
      }
      case 'colaboradores': {
        const { campos: ficha, acessos, mexeuNosAcessos } =
          this.separarAcessos(campos);
        await this.prisma.usuario.update({
          where: { id },
          data: {
            nome: ficha.nome ? String(ficha.nome).trim() : undefined,
            email: ficha.email,
            papel: ficha.papel,
            ativo: ficha.ativo,
            matricula: ficha.matricula,
            cargo: ficha.cargo,
            setor: ficha.setor,
            telefone: ficha.telefone,
            dataAdmissao: ficha.dataAdmissao,
          },
        });
        // Acessos so sao reescritos se alguma coluna de acesso veio no arquivo;
        // senao uma planilha sem essas colunas tiraria o acesso de todo mundo.
        if (mexeuNosAcessos) {
          await this.prisma.$transaction([
            this.prisma.acessoModulo.deleteMany({ where: { usuarioId: id } }),
            this.prisma.acessoModulo.createMany({
              data: acessos.map((a) => ({ usuarioId: id, ...(a as any) })),
            }),
          ]);
        }
        return;
      }
    }
  }

  // Nunca apaga: desliga o campo "ativo"/"ativa". Os documentos que apontam
  // para o cadastro continuam inteiros.
  private async inativar(cad: CadastroImport, id: number) {
    switch (cad.chave) {
      case 'fornecedores':
        await this.prisma.fornecedor.update({ where: { id }, data: { ativo: false } });
        return;
      case 'itens':
        await this.prisma.item.update({ where: { id }, data: { ativo: false } });
        return;
      case 'maquinas':
        await this.prisma.maquina.update({ where: { id }, data: { ativa: false } });
        return;
      case 'colaboradores':
        await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
        return;
    }
  }
}

// Sem 0/O/1/l: a senha e ditada ou anotada num papel. Mesmo alfabeto do
// usuarios.service.ts, onde o admin cadastra um colaborador de cada vez.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function senhaProvisoria(): string {
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return s;
}

function proximaSugerida(data?: Date | null, anos?: number | null) {
  if (!data || !anos) return null;
  const d = new Date(data);
  d.setUTCFullYear(d.getUTCFullYear() + anos);
  return d;
}

// O erro do Prisma nao serve para o usuario ler. Os dois que acontecem de
// verdade aqui viram frase.
function motivoDoBanco(e: any): string {
  if (e?.code === 'P2002') return 'Já existe outro registro com este código.';
  if (e?.code === 'P2003') return 'Aponta para um registro que não existe.';
  return String(e?.message ?? e).slice(0, 200);
}
