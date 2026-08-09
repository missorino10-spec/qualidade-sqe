import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SLA_HOMOLOGACAO_DIAS,
  SLA_RESPOSTA_FORNECEDOR_DIAS,
} from '../sqd-utils';
import {
  SLA_HOMOLOGACAO_ITEM_DIAS,
  SLA_RESPOSTA_FORNECEDOR_ITEM_DIAS,
} from '../homologacoes-itens/itens-utils';

// Media com uma casa decimal; devolve 0 quando nao ha o que medir.
function media(valores: number[]) {
  if (!valores.length) return 0;
  return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10;
}

function percentual(parte: number, total: number) {
  return total ? Math.round((parte / total) * 1000) / 10 : 0;
}

@Injectable()
export class PainelSqdService {
  constructor(private prisma: PrismaService) {}

  // KPIs do processo SQD (aba "KPI's" do FMR.029.01 + slide do fluxo):
  // % de aprovacao, lead time medio e % dentro do SLA de 3 dias uteis, mais os
  // dois relogios novos: a resposta do fornecedor e o tempo total do ciclo.
  async kpis(de?: string, ate?: string) {
    const where =
      de || ate
        ? {
            dataSolicitacao: {
              gte: de ? new Date(`${de}T00:00:00.000Z`) : undefined,
              lte: ate ? new Date(`${ate}T23:59:59.999Z`) : undefined,
            },
          }
        : {};

    const homologacoes = await this.prisma.homologacaoFornecedor.findMany({
      where,
      select: {
        resultado: true,
        statusHomologacao: true,
        statusPlanoAcao: true,
        nota: true,
        leadTimeDiasUteis: true,
        tempoRespostaDiasUteis: true,
        tempoTotalDiasUteis: true,
      },
    });

    const total = homologacoes.length;
    // So entram na conta de aprovacao as que ja foram avaliadas.
    const avaliadas = homologacoes.filter((h) => h.resultado != null);
    const aprovados = avaliadas.filter((h) => h.resultado === 'APROVADO').length;
    const condicionais = avaliadas.filter(
      (h) => h.resultado === 'APROVADO_CONDICIONALMENTE',
    ).length;
    const reprovados = avaliadas.filter(
      (h) => h.resultado === 'REPROVADO',
    ).length;

    // Lead time da planilha: da solicitacao ate o envio do relatorio.
    const leadTimes = homologacoes
      .map((h) => h.leadTimeDiasUteis)
      .filter((v): v is number => v != null);
    const noPrazo = leadTimes.filter((v) => v <= SLA_HOMOLOGACAO_DIAS).length;

    // Resposta do fornecedor: da abertura do registro ate o retorno.
    const respostas = homologacoes
      .map((h) => h.tempoRespostaDiasUteis)
      .filter((v): v is number => v != null);
    const respondeuNoPrazo = respostas.filter(
      (v) => v <= SLA_RESPOSTA_FORNECEDOR_DIAS,
    ).length;

    // Ciclo completo: da abertura ate o fechamento da homologacao.
    const totais = homologacoes
      .map((h) => h.tempoTotalDiasUteis)
      .filter((v): v is number => v != null);

    return {
      total,
      avaliadas: avaliadas.length,
      aguardandoFornecedor: homologacoes.filter(
        (h) => h.resultado == null && h.statusHomologacao === 'EM_ANDAMENTO',
      ).length,
      aprovados,
      condicionais,
      reprovados,
      // A planilha conta "Aprovado" + "Aprovado Condicionalmente" como aprovacao.
      pctAprovacao: percentual(aprovados + condicionais, avaliadas.length),
      notaMedia: media(avaliadas.map((h) => h.nota ?? 0)),
      leadTimeMedio: media(leadTimes),
      pctNoPrazo: percentual(noPrazo, leadTimes.length),
      slaDias: SLA_HOMOLOGACAO_DIAS,
      tempoRespostaMedio: media(respostas),
      pctRespostaNoPrazo: percentual(respondeuNoPrazo, respostas.length),
      slaRespostaDias: SLA_RESPOSTA_FORNECEDOR_DIAS,
      tempoTotalMedio: media(totais),
      emAndamento: homologacoes.filter(
        (h) => h.statusHomologacao === 'EM_ANDAMENTO',
      ).length,
      finalizadas: homologacoes.filter(
        (h) => h.statusHomologacao === 'FINALIZADO',
      ).length,
      canceladas: homologacoes.filter(
        (h) => h.statusHomologacao === 'CANCELADO',
      ).length,
      planosEmAndamento: homologacoes.filter(
        (h) => h.statusPlanoAcao === 'EM_ANDAMENTO',
      ).length,
    };
  }

  // Ultimas homologacoes, para o painel abrir direto no registro.
  ultimas() {
    return this.prisma.homologacaoFornecedor.findMany({
      orderBy: [{ ano: 'desc' }, { sequencial: 'desc' }],
      take: 10,
      select: {
        id: true,
        numero: true,
        fornecedorNome: true,
        dataSolicitacao: true,
        nota: true,
        resultado: true,
        statusHomologacao: true,
      },
    });
  }

  // KPIs da homologacao de itens (aba "KPI's" do FMR.025.01): lead time,
  // % de aprovacao, % dentro do SLA, % aprovado na primeira tentativa e o
  // savings acumulado.
  async kpisItens(de?: string, ate?: string) {
    const where =
      de || ate
        ? {
            dataSolicitacao: {
              gte: de ? new Date(`${de}T00:00:00.000Z`) : undefined,
              lte: ate ? new Date(`${ate}T23:59:59.999Z`) : undefined,
            },
          }
        : {};

    const registros = await this.prisma.homologacaoItem.findMany({
      where,
      select: {
        resultado: true,
        statusHomologacao: true,
        statusPlanoAcao: true,
        custoEvitado: true,
        leadTimeDiasUteis: true,
        tempoRespostaDiasUteis: true,
        tempoTotalDiasUteis: true,
        _count: { select: { relatorios: true } },
      },
    });

    const total = registros.length;
    // So entram na conta de aprovacao os que ja foram inspecionados.
    const analisados = registros.filter(
      (h) => h.resultado != null && h.resultado !== 'CANCELADO',
    );
    const aprovados = analisados.filter((h) => h.resultado === 'APROVADO');
    const reprovados = analisados.filter((h) => h.resultado === 'REPROVADO');

    const leadTimes = registros
      .map((h) => h.leadTimeDiasUteis)
      .filter((v): v is number => v != null);
    const noPrazo = leadTimes.filter(
      (v) => v <= SLA_HOMOLOGACAO_ITEM_DIAS,
    ).length;

    const respostas = registros
      .map((h) => h.tempoRespostaDiasUteis)
      .filter((v): v is number => v != null);
    const respondeuNoPrazo = respostas.filter(
      (v) => v <= SLA_RESPOSTA_FORNECEDOR_ITEM_DIAS,
    ).length;

    const totais = registros
      .map((h) => h.tempoTotalDiasUteis)
      .filter((v): v is number => v != null);

    // Robustez do processo: aprovado com um unico relatorio de inspecao.
    const primeiraTentativa = aprovados.filter(
      (h) => h._count.relatorios <= 1,
    ).length;

    // Savings: so conta o que ja foi validado, ou seja, o ciclo encerrado.
    const savings = registros
      .filter((h) => h.statusHomologacao === 'FINALIZADO')
      .reduce((s, h) => s + (h.custoEvitado ?? 0), 0);

    return {
      total,
      analisados: analisados.length,
      aguardandoAmostras: registros.filter(
        (h) => h.resultado == null && h.statusHomologacao === 'EM_ANDAMENTO',
      ).length,
      aprovados: aprovados.length,
      reprovados: reprovados.length,
      pctAprovacao: percentual(aprovados.length, analisados.length),
      pctPrimeiraTentativa: percentual(primeiraTentativa, aprovados.length),
      leadTimeMedio: media(leadTimes),
      pctNoPrazo: percentual(noPrazo, leadTimes.length),
      slaDias: SLA_HOMOLOGACAO_ITEM_DIAS,
      tempoRespostaMedio: media(respostas),
      pctRespostaNoPrazo: percentual(respondeuNoPrazo, respostas.length),
      slaRespostaDias: SLA_RESPOSTA_FORNECEDOR_ITEM_DIAS,
      tempoTotalMedio: media(totais),
      savings: Math.round(savings * 100) / 100,
      emAndamento: registros.filter(
        (h) => h.statusHomologacao === 'EM_ANDAMENTO',
      ).length,
      finalizadas: registros.filter(
        (h) => h.statusHomologacao === 'FINALIZADO',
      ).length,
      canceladas: registros.filter((h) => h.statusHomologacao === 'CANCELADO')
        .length,
      planosEmAndamento: registros.filter(
        (h) => h.statusPlanoAcao === 'EM_ANDAMENTO',
      ).length,
    };
  }

  async ultimasItens() {
    const registros = await this.prisma.homologacaoItem.findMany({
      orderBy: [{ ano: 'desc' }, { sequencial: 'desc' }],
      take: 10,
      select: {
        id: true,
        numero: true,
        fornecedorNome: true,
        itemCodigo: true,
        itemDescricao: true,
        dataSolicitacao: true,
        resultado: true,
        statusHomologacao: true,
        _count: { select: { relatorios: true } },
      },
    });
    return registros.map((h) => ({ ...h, tentativas: h._count.relatorios }));
  }
}
