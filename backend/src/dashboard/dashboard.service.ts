import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  classificarPorConformidade,
  pctConformidade,
  trimestreFiscal,
} from '../sqe/sqe-utils';

function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async kpisSqe(de?: string, ate?: string) {
    const periodoData: any = {};
    if (de) periodoData.gte = new Date(de);
    if (ate) periodoData.lte = new Date(ate);
    const temPeriodo = de || ate;

    const entregaWhere = temPeriodo ? { dataEntrega: periodoData } : {};
    // RNCs canceladas saem dos KPIs.
    const rncWhere: any = { status: { not: 'CANCELADA' } };
    if (temPeriodo) rncWhere.dataAbertura = periodoData;

    // Universo dos KPIs = todas as cargas recebidas (EntregaPortaria).
    // Cada inspecao gera 1 carga; Visual+Lote da mesma entrega = 1 carga.
    // Todos os percentuais sao calculados sobre esse total de cargas recebidas.
    const [entregas, rncs] = await Promise.all([
      this.prisma.entregaPortaria.findMany({
        where: entregaWhere,
        include: {
          // Rascunho fica de fora dos KPIs: enquanto o formulario nao e
          // lancado, o recebimento ainda conta como NAO inspecionado - e e
          // exatamente isso que a Qualidade precisa enxergar no painel.
          inspecoesVisual: { where: { rascunho: false }, select: { resultado: true } },
          inspecoesLote: { where: { rascunho: false }, select: { resultado: true } },
        },
      }),
      this.prisma.rnc.findMany({ where: rncWhere }),
    ]);

    const foiInspecionada = (e: any) =>
      e.inspecoesVisual.length > 0 || e.inspecoesLote.length > 0;
    const foiReprovada = (e: any) =>
      e.inspecoesVisual.some((i: any) => i.resultado === 'REPROVADO') ||
      e.inspecoesLote.some((i: any) => i.resultado === 'REPROVADO');

    const cargasInspecionadas = entregas.filter(foiInspecionada);
    const recebimentosSemInspecao = entregas.length - cargasInspecionadas.length;
    // Inspecoes fora do plano de periodicidade (fornecedor eventual ou pedido
    // pontual da Qualidade). Contam nos demais indicadores como qualquer outra.
    const inspecoesExtra = cargasInspecionadas.filter(
      (e) => e.inspecaoExtra,
    ).length;

    // 1 e 2 - fornecedores/itens inspecionados x recebidos (sobre o total recebido)
    const fornRecebidos = new Set(entregas.map((e) => e.fornecedorId));
    const itensRecebidos = new Set(
      entregas.filter((e) => e.itemId).map((e) => e.itemId),
    );
    const fornInspecionados = new Set(
      cargasInspecionadas.map((e) => e.fornecedorId),
    );
    const itensInspecionados = new Set(
      cargasInspecionadas.filter((e) => e.itemId).map((e) => e.itemId),
    );

    // 3 - aprovacao no recebimento (Opcao B: sobre o TOTAL de cargas recebidas;
    // carga nao inspecionada conta como aceita no recebimento).
    const totalCargas = entregas.length;
    const cargasReprovadas = entregas.filter(foiReprovada).length;
    const cargasAprovadas = totalCargas - cargasReprovadas;

    // 4 - % resposta a RNC (RNCs com retorno do fornecedor / total)
    const totalRnc = rncs.length;
    const rncComResposta = rncs.filter((r) => r.houveRetorno === true).length;

    // 5 e 7 - eficacia (RNCs finalizadas com eficacia aprovada)
    const rncFinalizadas = rncs.filter((r) => r.status === 'FINALIZADA');
    const rncEficazes = rncFinalizadas.filter(
      (r) => r.verificacaoEficacia === 'APROVADO',
    ).length;

    // 6 - tempo medio de retorno (dias)
    const tempos = rncs
      .filter((r) => r.tempoRetornoDias != null)
      .map((r) => r.tempoRetornoDias as number);
    const tempoMedio = tempos.length
      ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length) * 10) / 10
      : 0;

    // 8 - custos evitados = soma do Valor Total das RNCs
    const custosEvitados = rncs.reduce(
      (acc, r) => acc + (r.valorTotal ?? 0),
      0,
    );

    return {
      periodo: { de: de ?? null, ate: ate ?? null },
      indicadores: {
        pctFornecedoresInspecionados: pct(
          fornInspecionados.size,
          fornRecebidos.size,
        ),
        pctItensInspecionados: pct(itensInspecionados.size, itensRecebidos.size),
        pctAprovacaoRecebimento: pct(cargasAprovadas, totalCargas),
        pctRespostaRnc: pct(rncComResposta, totalRnc),
        pctEficaciaResposta: pct(rncEficazes, rncFinalizadas.length),
        tempoMedioRespostaRncDias: tempoMedio,
        pctEficaciaEncerramento: pct(rncEficazes, rncFinalizadas.length),
        custosEvitadosReais: Math.round(custosEvitados * 100) / 100,
      },
      contadores: {
        entregas: totalCargas,
        inspecoes: cargasInspecionadas.length,
        inspecoesExtra,
        recebimentosSemInspecao,
        rncsTotal: totalRnc,
        rncsAbertas: rncs.filter((r) => r.status === 'EM_ANDAMENTO').length,
        rncsEncerradas: rncFinalizadas.length,
      },
    };
  }

  // Evolucao/historico de classificacao dos fornecedores (para o painel)
  async evolucaoFornecedores() {
    const fornecedores = await this.prisma.fornecedor.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });

    return fornecedores.map((f) => {
      const conformidade = pctConformidade(
        f.lotesInspecionados,
        f.lotesReprovados,
      );
      const classificacaoAtual =
        f.lotesInspecionados > 0
          ? classificarPorConformidade(conformidade)
          : f.classificacaoFornecimento;
      const ordem = { A: 1, B: 2, C: 3, D: 4 } as Record<string, number>;
      let tendencia: 'UPGRADE' | 'DOWNGRADE' | 'IGUAL' = 'IGUAL';
      if (ordem[classificacaoAtual] < ordem[f.classificacaoFornecimento])
        tendencia = 'UPGRADE';
      else if (ordem[classificacaoAtual] > ordem[f.classificacaoFornecimento])
        tendencia = 'DOWNGRADE';

      return {
        id: f.id,
        codigo: f.codigo,
        nome: f.nome,
        classificacaoFornecimento: f.classificacaoFornecimento,
        classificacaoAtual,
        pctConformidade: conformidade,
        lotesInspecionados: f.lotesInspecionados,
        lotesReprovados: f.lotesReprovados,
        totalEntregas: f.totalEntregas,
        totalInspecoes: f.totalInspecoes,
        tendencia,
      };
    });
  }

  // Historico de classificacao por trimestre fiscal
  async historicoClassificacao(fornecedorId?: number) {
    return this.prisma.historicoClassificacao.findMany({
      where: fornecedorId ? { fornecedorId } : undefined,
      include: { fornecedor: { select: { nome: true, codigo: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Fecha o trimestre fiscal: snapshot no historico + atualiza classificacao + zera contadores.
  // Chamado automaticamente na virada do trimestre (ou manualmente pela Qualidade/Admin).
  async fecharTrimestre() {
    const { label, inicio, fim } = trimestreFiscal(new Date());
    const fornecedores = await this.prisma.fornecedor.findMany({
      where: { ativo: true },
    });
    const resultados: any[] = [];
    for (const f of fornecedores) {
      const conformidade = pctConformidade(
        f.lotesInspecionados,
        f.lotesReprovados,
      );
      const apurada =
        f.lotesInspecionados > 0
          ? classificarPorConformidade(conformidade)
          : f.classificacaoFornecimento;

      const snapshot = await this.prisma.historicoClassificacao.create({
        data: {
          fornecedorId: f.id,
          trimestreFiscal: label,
          periodoInicio: inicio,
          periodoFim: fim,
          classificacaoInicial: f.classificacaoFornecimento,
          lotesInspecionados: f.lotesInspecionados,
          lotesReprovados: f.lotesReprovados,
          pctConformidade: conformidade,
          classificacaoApurada: apurada,
        },
      });

      // Nova classificacao de fornecimento = apurada; zera contadores do periodo
      await this.prisma.fornecedor.update({
        where: { id: f.id },
        data: {
          classificacaoFornecimento: apurada,
          lotesInspecionados: 0,
          lotesReprovados: 0,
        },
      });
      resultados.push(snapshot);
    }
    return { trimestre: label, fornecedoresProcessados: resultados.length };
  }
}
