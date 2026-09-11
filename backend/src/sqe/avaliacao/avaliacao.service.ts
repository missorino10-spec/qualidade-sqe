import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { pctConformidade } from '../sqe-utils';
import {
  arredondar,
  calcularIdf,
  classificarPorIdf,
  competencia,
  competenciaDe,
  media,
  mesesDoTrimestre,
  notaConformidade,
  notaPlanoAcao,
  notaTempoResposta,
} from './idf';

// Numeros de um criterio dentro da competencia, antes de qualquer nota manual.
type Apuracao = {
  lotesInspecionados: number;
  lotesReprovados: number;
  pctConformidade: number;
  notaC1Auto: number | null;
  rncsConsideradas: number;
  horasRespostaMedia: number | null;
  notaC2Auto: number | null;
  notaC3Auto: number | null;
};

const ZERADA: Apuracao = {
  lotesInspecionados: 0,
  lotesReprovados: 0,
  pctConformidade: 0,
  notaC1Auto: null,
  rncsConsideradas: 0,
  horasRespostaMedia: null,
  notaC2Auto: null,
  notaC3Auto: null,
};

@Injectable()
export class AvaliacaoService {
  constructor(private prisma: PrismaService) {}

  // Competencia corrente pela regra do dia 26.
  competenciaAtual() {
    const { ano, mes } = competenciaDe(new Date());
    return { ano, mes, ...competencia(ano, mes) };
  }

  // Apura C1, C2 e C3 de todos os fornecedores na janela da competencia.
  // Uma passada so no banco: a tela mostra a base inteira de uma vez.
  private async apurar(inicio: Date, fim: Date): Promise<Map<number, Apuracao>> {
    const janela = { gte: inicio, lte: fim };
    const [visuais, lotes, rncs] = await Promise.all([
      this.prisma.inspecaoVisual.findMany({
        where: { rascunho: false, dataInspecao: janela },
        select: {
          id: true,
          fornecedorId: true,
          entregaId: true,
          resultado: true,
        },
      }),
      this.prisma.inspecaoLote.findMany({
        where: { rascunho: false, dataInspecao: janela },
        select: {
          id: true,
          fornecedorId: true,
          entregaId: true,
          resultado: true,
        },
      }),
      this.prisma.rnc.findMany({
        where: { status: { not: 'CANCELADA' }, dataAbertura: janela },
        select: {
          fornecedorId: true,
          dataAbertura: true,
          dataRetorno: true,
          nivelPlano: true,
        },
      }),
    ]);

    // C1 - a unidade e o RECEBIMENTO, nao o formulario: um recebimento com
    // Visual + Lote conta um lote so e reprova uma vez so.
    const recebimentos = new Map<number, Map<string, boolean>>();
    const somar = (
      fornecedorId: number,
      chave: string,
      reprovou: boolean,
    ) => {
      let doFornecedor = recebimentos.get(fornecedorId);
      if (!doFornecedor) {
        doFornecedor = new Map();
        recebimentos.set(fornecedorId, doFornecedor);
      }
      doFornecedor.set(chave, (doFornecedor.get(chave) ?? false) || reprovou);
    };
    for (const v of visuais)
      somar(
        v.fornecedorId,
        v.entregaId ? `e${v.entregaId}` : `v${v.id}`,
        v.resultado === 'REPROVADO',
      );
    for (const l of lotes)
      somar(
        l.fornecedorId,
        l.entregaId ? `e${l.entregaId}` : `l${l.id}`,
        l.resultado === 'REPROVADO',
      );

    // C2 e C3 - uma nota por RNC, depois a media do mes.
    const porFornecedor = new Map<
      number,
      { horas: number[]; notasC2: number[]; notasC3: number[] }
    >();
    for (const r of rncs) {
      let acc = porFornecedor.get(r.fornecedorId);
      if (!acc) {
        acc = { horas: [], notasC2: [], notasC3: [] };
        porFornecedor.set(r.fornecedorId, acc);
      }
      if (r.dataRetorno) {
        const h =
          (r.dataRetorno.getTime() - r.dataAbertura.getTime()) / 3600000;
        acc.horas.push(Math.max(0, h));
        acc.notasC2.push(notaTempoResposta(Math.max(0, h)));
      } else {
        // Sem resposta ate o fechamento: perde o indicador do mes.
        acc.notasC2.push(0);
      }
      const nota = notaPlanoAcao(r.nivelPlano);
      if (nota !== null) acc.notasC3.push(nota);
    }

    const ids = new Set<number>([
      ...recebimentos.keys(),
      ...porFornecedor.keys(),
    ]);
    const resultado = new Map<number, Apuracao>();
    for (const id of ids) {
      const rec = recebimentos.get(id);
      const inspecionados = rec ? rec.size : 0;
      const reprovados = rec
        ? [...rec.values()].filter(Boolean).length
        : 0;
      const pct = inspecionados ? pctConformidade(inspecionados, reprovados) : 0;

      const rnc = porFornecedor.get(id);
      const temRnc = !!rnc && rnc.notasC2.length > 0;
      // Recebeu no mes e nao gerou RNC: nota maxima automatica nos dois
      // criterios que dependem dela.
      const semRncComRecebimento = !temRnc && inspecionados > 0;

      resultado.set(id, {
        lotesInspecionados: inspecionados,
        lotesReprovados: reprovados,
        pctConformidade: pct,
        notaC1Auto: notaConformidade(inspecionados ? pct : null),
        rncsConsideradas: rnc ? rnc.notasC2.length : 0,
        horasRespostaMedia: rnc && rnc.horas.length ? media(rnc.horas) : null,
        notaC2Auto: temRnc
          ? media(rnc!.notasC2)
          : semRncComRecebimento
            ? 10
            : null,
        notaC3Auto: temRnc
          ? // Todas as RNCs do mes marcadas como "nao aplicavel": o criterio
            // nao tem como julgar e nao pode punir.
            (media(rnc!.notasC3) ?? 10)
          : semRncComRecebimento
            ? 10
            : null,
      });
    }
    return resultado;
  }

  // Junta a apuracao com o que esta gravado. Competencia fechada devolve o que
  // foi congelado; competencia aberta recalcula o automatico na hora e so
  // preserva o que foi digitado a mao.
  private montar(fornecedor: any, gravado: any, apurado: Apuracao) {
    if (gravado?.fechada) {
      return {
        fornecedorId: fornecedor.id,
        codigo: fornecedor.codigo,
        nome: fornecedor.nome,
        classificacaoFornecimento: fornecedor.classificacaoFornecimento,
        lotesInspecionados: gravado.lotesInspecionados,
        lotesReprovados: gravado.lotesReprovados,
        pctConformidade: gravado.pctConformidade,
        notaC1Auto: gravado.notaC1Auto,
        rncsConsideradas: gravado.rncsConsideradas,
        horasRespostaMedia: gravado.horasRespostaMedia,
        notaC2Auto: gravado.notaC2Auto,
        notaC3Auto: gravado.notaC3Auto,
        notaC1Manual: gravado.notaC1Manual,
        notaC2Manual: gravado.notaC2Manual,
        notaC3Manual: gravado.notaC3Manual,
        justificativa: gravado.justificativa,
        notaC1: gravado.notaC1Manual ?? gravado.notaC1Auto,
        notaC2: gravado.notaC2Manual ?? gravado.notaC2Auto,
        notaC3: gravado.notaC3Manual ?? gravado.notaC3Auto,
        idf: gravado.idf,
        classificacao: gravado.classificacao,
        fechada: true,
        fechadaEm: gravado.fechadaEm,
      };
    }

    const c1 = gravado?.notaC1Manual ?? apurado.notaC1Auto;
    const c2 = gravado?.notaC2Manual ?? apurado.notaC2Auto;
    const c3 = gravado?.notaC3Manual ?? apurado.notaC3Auto;
    const idf = calcularIdf(c1, c2, c3);
    return {
      fornecedorId: fornecedor.id,
      codigo: fornecedor.codigo,
      nome: fornecedor.nome,
      classificacaoFornecimento: fornecedor.classificacaoFornecimento,
      ...apurado,
      notaC1Manual: gravado?.notaC1Manual ?? null,
      notaC2Manual: gravado?.notaC2Manual ?? null,
      notaC3Manual: gravado?.notaC3Manual ?? null,
      justificativa: gravado?.justificativa ?? null,
      notaC1: c1,
      notaC2: c2,
      notaC3: c3,
      idf,
      classificacao: classificarPorIdf(idf),
      fechada: false,
      fechadaEm: null,
    };
  }

  // Avaliacao de todos os fornecedores ativos numa competencia.
  async listar(ano: number, mes: number) {
    const { inicio, fim, label } = competencia(ano, mes);
    const [fornecedores, gravados, apuracao] = await Promise.all([
      this.prisma.fornecedor.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          codigo: true,
          nome: true,
          classificacaoFornecimento: true,
        },
      }),
      this.prisma.avaliacaoFornecedor.findMany({ where: { ano, mes } }),
      this.apurar(inicio, fim),
    ]);
    const porId = new Map(gravados.map((g) => [g.fornecedorId, g]));
    const linhas = fornecedores.map((f) =>
      this.montar(f, porId.get(f.id), apuracao.get(f.id) ?? ZERADA),
    );
    return {
      ano,
      mes,
      label,
      periodoInicio: inicio,
      periodoFim: fim,
      fechada: gravados.some((g) => g.fechada),
      atual: this.competenciaAtual().label === label,
      linhas,
    };
  }

  // Nota digitada a mao. Limpar o campo (null) devolve o criterio ao automatico.
  async salvarNotas(
    fornecedorId: number,
    ano: number,
    mes: number,
    dto: {
      notaC1Manual?: number | null;
      notaC2Manual?: number | null;
      notaC3Manual?: number | null;
      justificativa?: string | null;
    },
    usuarioId?: number,
  ) {
    const existente = await this.prisma.avaliacaoFornecedor.findUnique({
      where: { fornecedorId_ano_mes: { fornecedorId, ano, mes } },
    });
    if (existente?.fechada)
      throw new BadRequestException(
        'Competência já fechada. Reabra antes de alterar as notas.',
      );

    const { inicio, fim } = competencia(ano, mes);
    const dados = {
      notaC1Manual: dto.notaC1Manual ?? null,
      notaC2Manual: dto.notaC2Manual ?? null,
      notaC3Manual: dto.notaC3Manual ?? null,
      justificativa: dto.justificativa?.trim() || null,
      atualizadoPorId: usuarioId ?? null,
    };
    await this.prisma.avaliacaoFornecedor.upsert({
      where: { fornecedorId_ano_mes: { fornecedorId, ano, mes } },
      create: {
        fornecedorId,
        ano,
        mes,
        periodoInicio: inicio,
        periodoFim: fim,
        ...dados,
      },
      update: dados,
    });
    return { ok: true };
  }

  // Fecha a competencia: congela os numeros, aplica a classe do IDF no
  // fornecedor (e e ela que passa a comandar a periodicidade de inspecao),
  // registra no historico e zera os contadores do periodo.
  async fechar(ano: number, mes: number, usuarioId?: number) {
    const atual = this.competenciaAtual();
    if (ano > atual.ano || (ano === atual.ano && mes > atual.mes))
      throw new BadRequestException(
        'Não é possível fechar uma competência futura.',
      );

    const { inicio, fim } = competencia(ano, mes);
    const [fornecedores, gravados, apuracao] = await Promise.all([
      this.prisma.fornecedor.findMany({ where: { ativo: true } }),
      this.prisma.avaliacaoFornecedor.findMany({ where: { ano, mes } }),
      this.apurar(inicio, fim),
    ]);
    const porId = new Map(gravados.map((g) => [g.fornecedorId, g]));

    let fechados = 0;
    let reclassificados = 0;
    for (const f of fornecedores) {
      const gravado = porId.get(f.id);
      if (gravado?.fechada) continue;
      const linha = this.montar(f, gravado, apuracao.get(f.id) ?? ZERADA);

      await this.prisma.avaliacaoFornecedor.upsert({
        where: { fornecedorId_ano_mes: { fornecedorId: f.id, ano, mes } },
        create: {
          fornecedorId: f.id,
          ano,
          mes,
          periodoInicio: inicio,
          periodoFim: fim,
          lotesInspecionados: linha.lotesInspecionados,
          lotesReprovados: linha.lotesReprovados,
          pctConformidade: linha.pctConformidade,
          notaC1Auto: linha.notaC1Auto,
          rncsConsideradas: linha.rncsConsideradas,
          horasRespostaMedia: linha.horasRespostaMedia,
          notaC2Auto: linha.notaC2Auto,
          notaC3Auto: linha.notaC3Auto,
          idf: linha.idf,
          classificacao: linha.classificacao,
          fechada: true,
          fechadaEm: new Date(),
          atualizadoPorId: usuarioId ?? null,
        },
        update: {
          lotesInspecionados: linha.lotesInspecionados,
          lotesReprovados: linha.lotesReprovados,
          pctConformidade: linha.pctConformidade,
          notaC1Auto: linha.notaC1Auto,
          rncsConsideradas: linha.rncsConsideradas,
          horasRespostaMedia: linha.horasRespostaMedia,
          notaC2Auto: linha.notaC2Auto,
          notaC3Auto: linha.notaC3Auto,
          idf: linha.idf,
          classificacao: linha.classificacao,
          fechada: true,
          fechadaEm: new Date(),
          atualizadoPorId: usuarioId ?? null,
        },
      });
      fechados++;

      // Sem IDF no mes a classe fica como esta: o fornecedor nao foi avaliado.
      if (linha.classificacao) {
        await this.prisma.historicoClassificacao.create({
          data: {
            fornecedorId: f.id,
            trimestreFiscal: `${ano}-${String(mes).padStart(2, '0')}`,
            periodoInicio: inicio,
            periodoFim: fim,
            classificacaoInicial: f.classificacaoFornecimento,
            lotesInspecionados: linha.lotesInspecionados,
            lotesReprovados: linha.lotesReprovados,
            pctConformidade: linha.pctConformidade,
            classificacaoApurada: linha.classificacao,
          },
        });
        if (linha.classificacao !== f.classificacaoFornecimento)
          reclassificados++;
      }

      await this.prisma.fornecedor.update({
        where: { id: f.id },
        data: {
          classificacaoFornecimento:
            linha.classificacao ?? f.classificacaoFornecimento,
          lotesInspecionados: 0,
          lotesReprovados: 0,
        },
      });
    }
    return { competencia: `${ano}-${String(mes).padStart(2, '0')}`, fechados, reclassificados };
  }

  // Reabre a competencia para corrigir. Nao mexe na classe ja aplicada no
  // fornecedor: quem corrige a nota fecha de novo.
  async reabrir(ano: number, mes: number) {
    const { count } = await this.prisma.avaliacaoFornecedor.updateMany({
      where: { ano, mes, fechada: true },
      data: { fechada: false, fechadaEm: null },
    });
    if (!count)
      throw new BadRequestException('Esta competência não está fechada.');
    return { reabertas: count };
  }

  // Consolidado do ano: os 12 meses, os 4 trimestres calendario e o anual.
  // Cada media so considera os periodos que tem nota.
  async consolidado(ano: number) {
    const [fornecedores, avaliacoes] = await Promise.all([
      this.prisma.fornecedor.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: { id: true, codigo: true, nome: true },
      }),
      this.prisma.avaliacaoFornecedor.findMany({
        where: { ano, fechada: true },
        select: { fornecedorId: true, mes: true, idf: true },
      }),
    ]);

    const porFornecedor = new Map<number, Map<number, number>>();
    for (const a of avaliacoes) {
      if (a.idf === null) continue;
      let meses = porFornecedor.get(a.fornecedorId);
      if (!meses) {
        meses = new Map();
        porFornecedor.set(a.fornecedorId, meses);
      }
      meses.set(a.mes, a.idf);
    }

    const linhas = fornecedores.map((f) => {
      const meses = porFornecedor.get(f.id) ?? new Map<number, number>();
      const trimestres = [1, 2, 3, 4].map((t) =>
        media(
          mesesDoTrimestre(t)
            .map((m) => meses.get(m))
            .filter((v): v is number => v !== undefined),
        ),
      );
      const anual = media(trimestres.filter((v): v is number => v !== null));
      return {
        fornecedorId: f.id,
        codigo: f.codigo,
        nome: f.nome,
        meses: Array.from({ length: 12 }, (_, i) => meses.get(i + 1) ?? null),
        trimestres,
        classesTrimestre: trimestres.map(classificarPorIdf),
        anual,
        classificacaoAnual: classificarPorIdf(anual),
      };
    });

    const comNota = linhas.filter((l) => l.anual !== null);
    return {
      ano,
      linhas,
      resumo: {
        avaliados: comNota.length,
        mediaGeral: media(comNota.map((l) => l.anual as number)),
        porClasse: {
          A: comNota.filter((l) => l.classificacaoAnual === 'A').length,
          B: comNota.filter((l) => l.classificacaoAnual === 'B').length,
          C: comNota.filter((l) => l.classificacaoAnual === 'C').length,
          D: comNota.filter((l) => l.classificacaoAnual === 'D').length,
        },
      },
    };
  }

  // Ficha de um fornecedor: todas as competencias fechadas, da mais nova para
  // a mais antiga.
  async historico(fornecedorId: number) {
    const registros = await this.prisma.avaliacaoFornecedor.findMany({
      where: { fornecedorId, fechada: true },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    });
    return registros.map((r) => ({
      ...r,
      notaC1: r.notaC1Manual ?? r.notaC1Auto,
      notaC2: r.notaC2Manual ?? r.notaC2Auto,
      notaC3: r.notaC3Manual ?? r.notaC3Auto,
      pctConformidade: arredondar(r.pctConformidade, 1),
    }));
  }
}
