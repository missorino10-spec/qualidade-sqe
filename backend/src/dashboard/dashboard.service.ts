import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeriadosService } from '../feriados/feriados.service';
import { Feriados, somarDiasUteis } from '../comum/dias-uteis';
import {
  classificarPorConformidade,
  pctConformidade,
  trimestreFiscal,
} from '../sqe/sqe-utils';

function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

// Prazos dos indicadores de tempestividade, todos em DIAS UTEIS (o calendario
// de feriados entra na conta). Ficam aqui, num lugar so, porque sao numeros de
// politica da Qualidade - mudar o prazo e mudar estas tres linhas.
const PRAZO_ABERTURA_RNC_DIAS = 1; // da identificacao do desvio ate abrir a RNC
const PRAZO_PLANO_RNC_DIAS = 5; // do recebimento da notificacao pelo fornecedor
const PRAZO_ENCERRAMENTO_RNC_DIAS = 7; // da abertura ate encerrar

// Diferenca em dias corridos entre duas datas (usada so no tempo de resposta,
// que e um tempo medido, nao um prazo cobrado).
function diasCorridos(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / 86400000);
}

// Mediana: o valor do meio da lista ordenada. Com quantidade par, a media dos
// dois centrais. Diferente da media, nao se desloca por uma RNC que ficou meses
// parada - e por isso que o indicador 03 pede a mediana.
function mediana(valores: number[]): number {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const v =
    ordenados.length % 2 === 1
      ? ordenados[meio]
      : (ordenados[meio - 1] + ordenados[meio]) / 2;
  return Math.round(v * 10) / 10;
}

// Cumpriu o prazo? "fim" precisa existir e cair ate N dias uteis depois do
// inicio. Sem data de inicio ou sem data de fim, nao cumpriu: o indicador de
// prazo cobra o que aconteceu, e o que nao aconteceu conta contra.
function dentroDoPrazo(
  inicio: Date | null,
  fim: Date | null,
  dias: number,
  feriados: Feriados,
): boolean {
  if (!inicio || !fim) return false;
  const limite = somarDiasUteis(inicio, dias, feriados);
  limite.setUTCHours(23, 59, 59, 999);
  return fim.getTime() <= limite.getTime();
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private feriados: FeriadosService,
  ) {}

  /**
   * Os 9 indicadores do painel do SQE.
   *
   * "Lote" aqui e a CARGA (EntregaPortaria), como no resto do sistema: uma
   * entrega com formulario Visual e de Lote continua sendo um lote so.
   *
   * Rascunho nao conta em lugar nenhum - enquanto o formulario nao e lancado, o
   * recebimento ainda esta por inspecionar.
   *
   * RNC cancelada sai de todos os indicadores: e um documento que nao existiu.
   */
  async kpisSqe(de?: string, ate?: string) {
    const periodoData: any = {};
    if (de) periodoData.gte = new Date(de);
    if (ate) periodoData.lte = new Date(ate);
    const temPeriodo = de || ate;

    const entregaWhere = temPeriodo ? { dataEntrega: periodoData } : {};
    const rncWhere: any = { status: { not: 'CANCELADA' } };
    if (temPeriodo) rncWhere.dataAbertura = periodoData;

    // O indicador 08 e o unico que olha para a data de ENCERRAMENTO: "RNCs
    // encerradas no periodo" nao e a mesma lista de "RNCs abertas no periodo".
    const encerradasWhere: any = {
      status: 'FINALIZADA',
      dataEncerramento: temPeriodo ? periodoData : { not: null },
    };

    const [entregas, rncs, encerradas, instrumentos, feriados] =
      await Promise.all([
        this.prisma.entregaPortaria.findMany({
          where: entregaWhere,
          include: {
            inspecoesVisual: {
              where: { rascunho: false },
              select: { resultado: true, dataInspecao: true },
            },
            inspecoesLote: {
              where: { rascunho: false },
              select: { resultado: true, dataInspecao: true },
            },
            // A RNC da carga vem junto para o indicador 06: sem data de
            // abertura nao da para saber se a RNC saiu no prazo. Cancelada
            // fica de fora, como no resto do painel.
            rncs: {
              where: { status: { not: 'CANCELADA' as const } },
              select: { dataAbertura: true },
              orderBy: { dataAbertura: 'asc' as const },
            },
          },
        }),
        this.prisma.rnc.findMany({ where: rncWhere }),
        this.prisma.rnc.findMany({ where: encerradasWhere }),
        // O indicador 11 e uma FOTO do inventario, nao um recorte do periodo:
        // o que interessa e quantos instrumentos estao com a calibracao valida
        // hoje. Instrumento inativo saiu do controle e nao entra na conta.
        this.prisma.instrumento.findMany({
          where: { ativo: true },
          select: { proximaCalibracao: true },
        }),
        this.feriados.conjunto(),
      ]);

    const foiInspecionada = (e: any) =>
      e.inspecoesVisual.length > 0 || e.inspecoesLote.length > 0;
    const formularios = (e: any) => [...e.inspecoesVisual, ...e.inspecoesLote];
    const foiReprovada = (e: any) =>
      formularios(e).some((i: any) => i.resultado === 'REPROVADO');

    const cargasInspecionadas = entregas.filter(foiInspecionada);
    const recebimentosSemInspecao = entregas.length - cargasInspecionadas.length;
    // Inspecoes fora do plano de periodicidade (fornecedor eventual ou pedido
    // pontual da Qualidade). Contam nos demais indicadores como qualquer outra.
    const inspecoesExtra = cargasInspecionadas.filter(
      (e) => e.inspecaoExtra,
    ).length;

    // 01 - Aprovacao de lotes no recebimento
    // Lotes aprovados / lotes INSPECIONADOS. Carga que nao foi inspecionada
    // fica fora dos dois lados: nao ha o que aprovar nem o que reprovar.
    const lotesInspecionados = cargasInspecionadas.length;
    const lotesReprovados = cargasInspecionadas.filter(foiReprovada).length;
    const lotesAprovados = lotesInspecionados - lotesReprovados;

    const totalRnc = rncs.length;

    // 03 - Tempo medio de resposta a RNC (mediana)
    // Dias entre a emissao (abertura) e a resposta do fornecedor. So entram as
    // RNCs que ja tiveram resposta - as que ainda esperam nao tem tempo.
    const temposResposta = rncs
      .filter((r) => r.dataRetorno)
      .map((r) => diasCorridos(r.dataAbertura, r.dataRetorno as Date))
      .filter((d) => d >= 0);
    const medianaResposta = mediana(temposResposta);

    // 04 - Savings por bloqueio de lotes com RNC
    // Uma RNC e um bloqueio: o valor evitado e o Valor Total do lote bloqueado.
    const savings = rncs.reduce((acc, r) => acc + (r.valorTotal ?? 0), 0);

    // 06 - Abertura tempestiva de RNCs
    // Desvio que exige RNC = carga reprovada. O relogio comeca na data da
    // inspecao que reprovou (a mais antiga, quando Visual e Lote reprovaram) e
    // a RNC tem 1 dia util para ser aberta. Carga reprovada sem RNC conta como
    // fora do prazo.
    const cargasComDesvio = cargasInspecionadas.filter(foiReprovada);
    const aberturasNoPrazo = cargasComDesvio.filter((e: any) => {
      const identificacao = formularios(e)
        .filter((i: any) => i.resultado === 'REPROVADO')
        .map((i: any) => i.dataInspecao as Date)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const rnc = e.rncs[0];
      return dentroDoPrazo(
        identificacao ?? null,
        rnc?.dataAbertura ?? null,
        PRAZO_ABERTURA_RNC_DIAS,
        feriados,
      );
    }).length;

    // 07 - Planos de acao de RNC no prazo
    // O relogio comeca quando o fornecedor recebe a notificacao (data de envio
    // do documento) e ele tem 5 dias uteis para devolver o plano. RNC sem envio
    // registrado ou sem retorno conta como fora do prazo.
    const planosNoPrazo = rncs.filter((r) =>
      dentroDoPrazo(
        r.dataEnvioFornecedor,
        r.dataRetorno,
        PRAZO_PLANO_RNC_DIAS,
        feriados,
      ),
    ).length;

    // 08 - Encerramento de RNCs no prazo
    // 7 dias uteis da abertura ate o encerramento, sobre as RNCs encerradas
    // dentro do periodo.
    const encerramentosNoPrazo = encerradas.filter((r) =>
      dentroDoPrazo(
        r.dataAbertura,
        r.dataEncerramento,
        PRAZO_ENCERRAMENTO_RNC_DIAS,
        feriados,
      ),
    ).length;

    // 09 - Eficacia das acoes de RNC
    // So entram as acoes que ja foram VERIFICADAS: eficacia pendente ainda nao
    // e resultado, e "nao aplicavel" nao e acao que se cobre.
    const verificadas = rncs.filter(
      (r) =>
        r.verificacaoEficacia === 'APROVADO' ||
        r.verificacaoEficacia === 'REPROVADO',
    );
    const eficazes = verificadas.filter(
      (r) => r.verificacaoEficacia === 'APROVADO',
    ).length;

    // 10 - Reincidencia de RNCs no recebimento
    const reincidentes = rncs.filter((r) => r.reincidencia).length;

    // 11 - Conformidade de calibracao
    // Previsto = instrumento ativo com proxima calibracao definida. Sem data de
    // vencimento nao ha o que controlar, e o instrumento fica fora dos dois
    // lados da conta.
    const hoje = new Date();
    const previstos = instrumentos.filter((i) => i.proximaCalibracao);
    const calibradosEmDia = previstos.filter(
      (i) => (i.proximaCalibracao as Date).getTime() >= hoje.getTime(),
    ).length;

    return {
      periodo: { de: de ?? null, ate: ate ?? null },
      prazos: {
        aberturaRncDiasUteis: PRAZO_ABERTURA_RNC_DIAS,
        planoRncDiasUteis: PRAZO_PLANO_RNC_DIAS,
        encerramentoRncDiasUteis: PRAZO_ENCERRAMENTO_RNC_DIAS,
      },
      indicadores: {
        pctAprovacaoLotes: pct(lotesAprovados, lotesInspecionados),
        medianaRespostaRncDias: medianaResposta,
        savingsBloqueioReais: Math.round(savings * 100) / 100,
        pctAberturaTempestiva: pct(aberturasNoPrazo, cargasComDesvio.length),
        pctPlanosNoPrazo: pct(planosNoPrazo, totalRnc),
        pctEncerramentoNoPrazo: pct(encerramentosNoPrazo, encerradas.length),
        pctEficaciaAcoes: pct(eficazes, verificadas.length),
        pctReincidencia: pct(reincidentes, totalRnc),
        pctConformidadeCalibracao: pct(calibradosEmDia, previstos.length),
      },
      // Os numeros crus por tras de cada percentual: o painel mostra "x de y"
      // embaixo do card, senao 100% de uma RNC so parece o mesmo que 100% de
      // cinquenta.
      bases: {
        lotesInspecionados,
        lotesAprovados,
        rncsComResposta: temposResposta.length,
        rncsTotal: totalRnc,
        cargasComDesvio: cargasComDesvio.length,
        aberturasNoPrazo,
        planosNoPrazo,
        rncsEncerradasPeriodo: encerradas.length,
        encerramentosNoPrazo,
        acoesVerificadas: verificadas.length,
        acoesEficazes: eficazes,
        rncsReincidentes: reincidentes,
        instrumentosPrevistos: previstos.length,
        instrumentosEmDia: calibradosEmDia,
      },
      contadores: {
        entregas: entregas.length,
        inspecoes: cargasInspecionadas.length,
        inspecoesExtra,
        recebimentosSemInspecao,
        rncsTotal: totalRnc,
        rncsAbertas: rncs.filter((r) => r.status === 'EM_ANDAMENTO').length,
        rncsEncerradas: rncs.filter((r) => r.status === 'FINALIZADA').length,
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
