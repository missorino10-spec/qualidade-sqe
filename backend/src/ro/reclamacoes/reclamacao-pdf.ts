import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { nomeCurto } from '../../comum/nome';
import { BLOCOS_RO, rotuloRo } from '../../comum/ro';

// R.O — espelha a planilha "Gestão Reclamações Qualidade - R.O": os quatro
// blocos na mesma ordem, com o flag de concluido de cada um. A planilha nao
// tem codigo BDBR.QUA.FMR: o cabecalho imprime so o titulo.

const LARANJA = '#E8792B';
const PRETO = '#000000';
const CINZA = '#555555';
const CINZA_CLARO = '#BBBBBB';
const VERDE = '#237804';
const FUNDO = '#F2F2F2';
const LOGO_PATH = join(process.cwd(), 'assets', 'logo-big-dutchman.png');

const M = 34;
const X0 = M;
const X1 = 561;
const W = X1 - X0;
const RODAPE = 46;

// Datas puras gravadas como meia-noite UTC: formatar no fuso do servidor faria
// 28/07 virar 27/07 a oeste de Greenwich.
function fmtData(d?: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function fmtDataHora(d?: Date | string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function hojeNoBrasil(): string {
  return new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

function txt(v: any): string {
  return v == null || v === '' ? '' : String(v);
}

function fmtNumero(v: any, casas = 2): string {
  if (v == null || v === '') return '';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function fmtMoeda(v: any): string {
  if (v == null || v === '') return '';
  return `R$ ${fmtNumero(v, 2)}`;
}

export type FotosRo = Buffer[];

export function gerarPdfReclamacao(
  reg: any,
  fotos: FotosRo = [],
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  let y = 0;

  const fim = () => doc.page.height - RODAPE;

  const quebrar = () => {
    doc.addPage();
    y = M;
  };

  const espaco = (altura: number) => {
    if (y + altura > fim()) quebrar();
  };

  const alturaTexto = (
    valor: string,
    largura: number,
    tamanho: number,
    fonte = 'Helvetica',
  ) => {
    if (!valor) return 0;
    doc.font(fonte).fontSize(tamanho);
    return doc.heightOfString(valor, { width: largura });
  };

  // A faixa do bloco carrega o flag de concluido a direita: e o que o usuario
  // pediu para "facilitar a gestao".
  const faixa = (titulo: string, flag?: string) => {
    espaco(34);
    doc.rect(X0, y, W, 17).fill(LARANJA);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#FFFFFF')
      .text(titulo, X0 + 6, y + 4.5, { width: W - 160, lineBreak: false });
    if (flag) {
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor('#FFFFFF')
        .text(flag, X1 - 156, y + 5.5, {
          width: 150,
          align: 'right',
          lineBreak: false,
        });
    }
    y += 17;
  };

  const linha = (
    campos: { w: number; label: string; valor: string }[],
    minima = 26,
  ) => {
    const altura = Math.max(
      minima,
      ...campos.map((c) => 15 + alturaTexto(c.valor, c.w - 8, 8) + 4),
    );
    espaco(altura);
    let x = X0;
    for (const c of campos) {
      doc.lineWidth(0.7).strokeColor(PRETO).rect(x, y, c.w, altura).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(6)
        .fillColor(CINZA)
        .text(c.label, x + 4, y + 3, { width: c.w - 8, lineBreak: false });
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(PRETO)
        .text(c.valor, x + 4, y + 12, { width: c.w - 8 });
      x += c.w;
    }
    y += altura;
  };

  const bloco = (titulo: string, valor: string, minima = 28) => {
    const texto = valor || '-';
    const altura = Math.max(minima, alturaTexto(texto, W - 12, 8.5) + 10);
    espaco(altura + 14);
    doc.rect(X0, y, W, 13).fill(FUNDO);
    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y, W, 13).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(PRETO)
      .text(titulo, X0 + 5, y + 3.5, { width: W - 10, lineBreak: false });
    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y + 13, W, altura).stroke();
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(PRETO)
      .text(texto, X0 + 6, y + 18, { width: W - 12 });
    y += 13 + altura;
  };

  const quadroFotos = (titulo: string, imagens: Buffer[] = []) => {
    const validas = imagens.slice(0, 4);
    if (!validas.length) return;

    const colunas = validas.length === 1 ? 1 : 2;
    const linhas = Math.ceil(validas.length / colunas);
    const celulaH = validas.length === 1 ? 190 : 130;
    const altura = linhas * celulaH + (linhas + 1) * 6;
    espaco(altura + 15);

    doc.rect(X0, y, W, 13).fill(FUNDO);
    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y, W, 13).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(PRETO)
      .text(titulo, X0 + 5, y + 3.5, { width: W - 10, lineBreak: false });
    y += 13;

    doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y, W, altura).stroke();
    const celulaW = (W - (colunas + 1) * 6) / colunas;
    validas.forEach((foto, i) => {
      const col = i % colunas;
      const lin = Math.floor(i / colunas);
      try {
        doc.image(
          foto,
          X0 + 6 + col * (celulaW + 6),
          y + 6 + lin * (celulaH + 6),
          { fit: [celulaW, celulaH], align: 'center', valign: 'center' },
        );
      } catch {
        /* imagem invalida (formato nao suportado): ignora */
      }
    });
    y += altura;
  };

  type Coluna = { titulo: string; w: number; campo: string };
  const tabela = (colunas: Coluna[], linhas: any[], vazioTexto: string) => {
    const cabecalho = () => {
      const altura = Math.max(
        14,
        ...colunas.map(
          (c) => alturaTexto(c.titulo, c.w - 6, 6.5, 'Helvetica-Bold') + 6,
        ),
      );
      espaco(altura + 16);
      doc.rect(X0, y, W, altura).fill(FUNDO);
      let x = X0;
      for (const c of colunas) {
        doc.lineWidth(0.6).strokeColor(PRETO).rect(x, y, c.w, altura).stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor(PRETO)
          .text(c.titulo, x + 3, y + 3, { width: c.w - 6 });
        x += c.w;
      }
      y += altura;
    };

    cabecalho();
    if (!linhas.length) {
      espaco(18);
      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(CINZA)
        .text(vazioTexto, X0 + 5, y + 4, { width: W - 10 });
      y += 17;
      return;
    }
    for (const l of linhas) {
      const altura = Math.max(
        15,
        ...colunas.map((c) => alturaTexto(txt(l[c.campo]), c.w - 6, 7) + 7),
      );
      if (y + altura > fim()) {
        quebrar();
        cabecalho();
      }
      let x = X0;
      for (const c of colunas) {
        doc
          .lineWidth(0.5)
          .strokeColor(CINZA_CLARO)
          .rect(x, y, c.w, altura)
          .stroke();
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(PRETO)
          .text(txt(l[c.campo]), x + 3, y + 3.5, { width: c.w - 6 });
        x += c.w;
      }
      y += altura;
    }
  };

  // ---------------------------------------------------------- cabecalho
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, X0, 30, { width: 112 });
  } else {
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(LARANJA)
      .text('Big Dutchman', X0, 36);
  }

  const cbX = 406;
  const cbW = X1 - cbX;
  const cbLinhas = [
    { rotulo: 'Formulário', valor: 'Gestão Reclamações Qualidade - R.O' },
    { rotulo: 'Registro Nº', valor: txt(reg.numero) || '-' },
    { rotulo: 'Emissão', valor: hojeNoBrasil() },
  ];
  const cbH = cbLinhas.length * 17;
  doc.lineWidth(0.7).strokeColor(PRETO).rect(cbX, 30, cbW, cbH).stroke();
  cbLinhas.forEach((l, i) => {
    const cbY = 30 + i * 17;
    if (i > 0) doc.lineWidth(0.5).moveTo(cbX, cbY).lineTo(X1, cbY).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(5.5)
      .fillColor(CINZA)
      .text(`${l.rotulo}:`, cbX + 3, cbY + 2, {
        width: cbW - 6,
        lineBreak: false,
      });
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor(PRETO)
      .text(l.valor, cbX + 3, cbY + 8, {
        width: cbW - 6,
        lineBreak: false,
        ellipsis: true,
      });
  });

  const tituloX = 156;
  const tituloW = cbX - 10 - tituloX;
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PRETO)
    .text('R.O — Gestão de Reclamações da Qualidade', tituloX, 34, {
      width: tituloW,
      align: 'center',
    });
  doc
    .font('Helvetica-Oblique')
    .fontSize(7.5)
    .fillColor(CINZA)
    .text(
      'Controle interno da Qualidade sobre o R.O recebido da Sala de Controle — não substitui o formulário do SAC',
      tituloX,
      doc.y + 2,
      { width: tituloW, align: 'center' },
    );

  y = 30 + cbH + 6;

  // ------------------------------------------------ situacao dos blocos
  const blocos: any[] = reg.blocos ?? [];
  const flagDoBloco = (n: number) => blocos.find((b) => b.numero === n);
  const rotuloFlag = (n: number) => {
    const b = flagDoBloco(n);
    return b ? `CONCLUÍDO EM ${fmtDataHora(b.concluidoEm)}` : 'EM ABERTO';
  };

  const painelH = 24;
  espaco(painelH + 6);
  doc.lineWidth(0.7).strokeColor(PRETO).rect(X0, y, W, painelH).stroke();
  const celW = W / BLOCOS_RO.length;
  BLOCOS_RO.forEach((b, i) => {
    const x = X0 + i * celW;
    if (i > 0) {
      doc
        .lineWidth(0.5)
        .strokeColor(PRETO)
        .moveTo(x, y)
        .lineTo(x, y + painelH)
        .stroke();
    }
    const feito = !!flagDoBloco(b.numero);
    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .fillColor(CINZA)
      .text(`BLOCO ${b.numero}`, x + 4, y + 3, {
        width: celW - 8,
        lineBreak: false,
      });
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(feito ? VERDE : CINZA)
      .text(feito ? 'Concluído' : 'Em aberto', x + 4, y + 12, {
        width: celW - 8,
        lineBreak: false,
      });
  });
  y += painelH + 5;

  // ----------------------------------------------------- 1. Dados recebidos
  faixa('1. DADOS RECEBIDOS', rotuloFlag(1));
  linha([
    { w: 110, label: 'Nº FORMULÁRIO R.O.', valor: txt(reg.numero) },
    { w: W - 110 - 160, label: 'CLIENTE / REPRESENTANTE', valor: txt(reg.cliente) },
    {
      w: 160,
      label: 'DATA/HORA RECEBIMENTO QUALIDADE',
      valor: fmtDataHora(reg.recebidoEm),
    },
  ]);
  linha([
    { w: 110, label: 'CÓDIGO DO PRODUTO', valor: txt(reg.produtoCodigo) },
    {
      w: W - 110 - 90 - 90,
      label: 'DESCRIÇÃO DO ITEM',
      valor: txt(reg.produtoDescricao),
    },
    {
      w: 90,
      label: 'QUANTIDADE AFETADA',
      valor: fmtNumero(reg.quantidadeAfetada, 0),
    },
    { w: 90, label: 'VALOR UNITÁRIO', valor: fmtMoeda(reg.valorUnitario) },
  ]);
  linha([
    {
      w: 175,
      label: 'TIPO INFORMADO PELA SALA DE CONTROLE',
      valor: txt(reg.tipoInformado),
    },
    {
      w: 190,
      label: 'RESULTADO DA ANÁLISE DA SALA DE CONTROLE',
      valor: txt(reg.resultadoAnaliseSac),
    },
    {
      w: W - 175 - 190,
      label: 'ORIGEM INDICADA',
      valor: txt(reg.origemIndicada),
    },
  ]);

  // ------------------------------------------------------------ 2. Triagem
  y += 5;
  faixa('2. TRIAGEM E DIRECIONAMENTO DA QUALIDADE', rotuloFlag(2));
  linha([
    {
      w: 175,
      label: 'DADOS DA SALA DE CONTROLE COMPLETOS?',
      valor: rotuloRo('dadosCompletos', reg.dadosCompletos),
    },
    {
      w: 175,
      label: 'RECLAMAÇÃO ACEITA PARA TRATATIVA?',
      valor: rotuloRo('aceita', reg.aceita),
    },
    {
      w: W - 350,
      label: 'CLASSIFICAÇÃO QUALIDADE',
      valor: rotuloRo('classificacao', reg.classificacao),
    },
  ]);
  linha([
    {
      w: 175,
      label: 'PROCEDÊNCIA PARA TRATAMENTO',
      valor: rotuloRo('procedencia', reg.procedencia),
    },
    {
      w: 100,
      label: 'PRIORIDADE',
      valor: rotuloRo('prioridade', reg.prioridade),
    },
    {
      w: W - 175 - 100,
      label: 'ÁREA RESPONSÁVEL QUALIDADE',
      valor: rotuloRo('areaResponsavel', reg.areaResponsavel),
    },
  ]);
  linha([
    {
      w: 175,
      label: 'RESPONSÁVEL INTERNO',
      valor: reg.responsavel ? nomeCurto(reg.responsavel.nome) : '',
    },
    {
      w: 175,
      label: 'PRAZO DE CONCLUSÃO (5 DIAS ÚTEIS)',
      valor: fmtData(reg.prazoConclusao),
    },
    {
      w: W - 350,
      label: 'CUSTO TOTAL R.O (PEÇAS)',
      valor: fmtMoeda(reg.custoTotal),
    },
  ]);
  bloco('Pendências para a Sala de Controle', txt(reg.pendenciasSac));

  // -------------------------------------------------- 3. Tratativa interna
  y += 5;
  faixa('3. TRATATIVA INTERNA', rotuloFlag(3));
  linha([
    {
      w: 175,
      label: 'NECESSIDADE DE CONTENÇÃO',
      valor: rotuloRo('necessidadeContencao', reg.necessidadeContencao),
    },
    {
      w: 175,
      label: 'MÉTODO DE ANÁLISE DE CAUSA',
      valor: rotuloRo('metodoAnalise', reg.metodoAnalise),
    },
    {
      w: W - 350,
      label: 'VERIFICAÇÃO DE EFICÁCIA',
      valor: rotuloRo('verificacaoEficacia', reg.verificacaoEficacia),
    },
  ]);
  bloco('Causa imediata', txt(reg.causaImediata));
  bloco('Causa sistêmica', txt(reg.causaSistemica));

  const tarefas: any[] = reg.tarefas ?? [];
  const linhasTarefa = (tipo: string) =>
    tarefas
      .filter((t) => t.tipo === tipo)
      .map((t) => ({
        _n: String(t.ordem),
        descricao: t.descricao,
        responsavel: t.responsavel,
        _prazo: fmtData(t.prazo),
        _status: rotuloRo('statusAcoes', t.status),
      }));

  const colunasTarefa: Coluna[] = [
    { titulo: 'Nº', w: 20, campo: '_n' },
    { titulo: 'Tarefa', w: W - 20 - 110 - 60 - 70, campo: 'descricao' },
    { titulo: 'Responsável', w: 110, campo: 'responsavel' },
    { titulo: 'Prazo', w: 60, campo: '_prazo' },
    { titulo: 'Status', w: 70, campo: '_status' },
  ];

  y += 4;
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(PRETO)
    .text('Plano de contenção', X0, y);
  y += 11;
  tabela(
    colunasTarefa,
    linhasTarefa('CONTENCAO'),
    reg.necessidadeContencao === 'SIM'
      ? 'Contenção necessária, sem tarefas lançadas.'
      : 'Sem necessidade de contenção.',
  );

  y += 6;
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(PRETO)
    .text(
      `Ações corretivas — status geral: ${rotuloRo('statusAcoes', reg.statusAcoes) || 'sem ações'}`,
      X0,
      y,
    );
  y += 11;
  tabela(
    colunasTarefa,
    linhasTarefa('ACAO_CORRETIVA'),
    'Nenhuma ação corretiva lançada.',
  );

  bloco('Evidências', txt(reg.evidencias));

  // ------------------------------------- 4. Retorno ao SAC e encerramento
  y += 5;
  faixa('4. RETORNO AO SAC E ENCERRAMENTO', rotuloFlag(4));
  bloco(
    'Resumo da conclusão para a Sala de Controle',
    txt(reg.resumoConclusao),
    36,
  );
  linha([
    {
      w: 190,
      label: 'DATA DO RETORNO PARA A SALA DE CONTROLE',
      valor: fmtData(reg.dataRetornoSac),
    },
    {
      w: 175,
      label: 'MOTIVO DE ENCERRAMENTO',
      valor: rotuloRo('motivoEncerramento', reg.motivoEncerramento),
    },
    {
      w: W - 190 - 175,
      label: 'STATUS DA RECLAMAÇÃO',
      valor: rotuloRo('status', reg.status),
    },
  ]);

  // ------------------------------------------------------------- anexos
  if (fotos.length) {
    y += 5;
    faixa('ANEXOS — FOTOS / EVIDÊNCIAS');
    quadroFotos('Fotos do R.O', fotos);
  }

  // ---------------------------------------------------------------- rodape
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(paginas.start + i);
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(CINZA)
      .text(
        `Big Dutchman Brasil — Sistema de Qualidade · R.O ${txt(reg.numero)} · Página ${i + 1} de ${paginas.count}`,
        X0,
        doc.page.height - 34,
        { width: W, align: 'center' },
      );
  }

  return doc;
}
