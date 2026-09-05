import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Mediana, nao media: uma homologacao que travou seis meses esperando o
// fornecedor puxaria a media para cima e faria o processo inteiro parecer
// lento. A mediana mostra o ciclo tipico.
function mediana(valores: number[]) {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const valor =
    ordenados.length % 2
      ? ordenados[meio]
      : (ordenados[meio - 1] + ordenados[meio]) / 2;
  return Math.round(valor * 10) / 10;
}

function percentual(parte: number, total: number) {
  return total ? Math.round((parte / total) * 1000) / 10 : 0;
}

const CLASSES = ['A', 'B', 'C', 'D'] as const;

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

    // A distribuicao A/B/C/D e um retrato da base ativa de HOJE, nao uma fatia
    // do periodo: o filtro de datas em cima do painel nao mexe nela. A classe
    // sai do cadastro do fornecedor (a que a Qualidade define e que manda na
    // periodicidade de inspecao), nao da apuracao trimestral.
    const [homologacoes, porClasse, fornecedoresAtivos] = await Promise.all([
      this.prisma.homologacaoFornecedor.findMany({
        where,
        select: {
          resultado: true,
          statusHomologacao: true,
          statusPlanoAcao: true,
          tempoTotalDiasUteis: true,
        },
      }),
      this.prisma.fornecedor.groupBy({
        by: ['classificacaoFornecimento'],
        where: { ativo: true },
        _count: { _all: true },
      }),
      this.prisma.fornecedor.count({ where: { ativo: true } }),
    ]);

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

    // Ciclo completo: da abertura ate o fechamento da homologacao, em dias
    // uteis (o calendario de feriados ja entra no calculo que gravou o campo).
    const totais = homologacoes
      .map((h) => h.tempoTotalDiasUteis)
      .filter((v): v is number => v != null);

    const contaPorClasse = new Map(
      porClasse.map((c) => [c.classificacaoFornecimento, c._count._all]),
    );

    return {
      total,
      avaliadas: avaliadas.length,
      aguardandoFornecedor: homologacoes.filter(
        (h) => h.resultado == null && h.statusHomologacao === 'EM_ANDAMENTO',
      ).length,
      aprovados,
      condicionais,
      reprovados,
      // 02 - Aprovacao de fornecedores homologados. "Aprovado" + "Aprovado
      // Condicionalmente", como na planilha: os dois passaram.
      pctAprovacao: percentual(aprovados + condicionais, avaliadas.length),
      // Aprovacao Condicional de fornecedores: quanto da aprovacao acima veio
      // com ressalva, ou seja, devendo plano de acao.
      pctAprovacaoCondicional: percentual(condicionais, avaliadas.length),
      // 03 - Tempo de homologacao de fornecedores, em dias uteis.
      medianaCicloDiasUteis: mediana(totais),
      ciclosMedidos: totais.length,
      // 05 - Distribuicao da classificacao de fornecedores.
      fornecedoresAtivos,
      distribuicaoClasses: CLASSES.map((classe) => {
        const qtd = contaPorClasse.get(classe) ?? 0;
        return { classe, qtd, pct: percentual(qtd, fornecedoresAtivos) };
      }),
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
        // Rascunho nao conta como tentativa no indicador: o relatorio pela
        // metade nao e uma rodada de amostras que o fornecedor perdeu.
        _count: { select: { relatorios: { where: { rascunho: false } } } },
      },
    });

    const total = registros.length;
    // So entram na conta de aprovacao os que ja foram inspecionados.
    const analisados = registros.filter(
      (h) => h.resultado != null && h.resultado !== 'CANCELADO',
    );
    const aprovados = analisados.filter((h) => h.resultado === 'APROVADO');
    const reprovados = analisados.filter((h) => h.resultado === 'REPROVADO');

    // Robustez do processo: aprovado com um unico relatorio de inspecao. O
    // denominador e o item SUBMETIDO, nao o aprovado: item que reprovou e
    // nunca voltou tambem nao passou de primeira, e precisa pesar contra.
    const primeiraSubmissao = aprovados.filter(
      (h) => h._count.relatorios <= 1,
    ).length;

    return {
      total,
      analisados: analisados.length,
      aguardandoAmostras: registros.filter(
        (h) => h.resultado == null && h.statusHomologacao === 'EM_ANDAMENTO',
      ).length,
      aprovados: aprovados.length,
      reprovados: reprovados.length,
      // 01 - Aprovacao de itens homologados.
      pctAprovacao: percentual(aprovados.length, analisados.length),
      // 04 - Aprovacao de itens na primeira submissao.
      pctPrimeiraSubmissao: percentual(primeiraSubmissao, analisados.length),
      aprovadosPrimeiraSubmissao: primeiraSubmissao,
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

  // KPIs da auditoria de fornecedores. Alem da nota e do resultado, o painel
  // precisa mostrar o relogio das reavaliacoes: quantas ja venceram e quantas
  // vencem nos proximos 15 dias.
  async kpisAuditorias(de?: string, ate?: string) {
    const where =
      de || ate
        ? {
            dataAuditoria: {
              gte: de ? new Date(`${de}T00:00:00.000Z`) : undefined,
              lte: ate ? new Date(`${ate}T23:59:59.999Z`) : undefined,
            },
          }
        : {};

    const registros = await this.prisma.auditoriaFornecedor.findMany({
      where,
      select: {
        resultado: true,
        statusAuditoria: true,
        dataLimiteReavaliacao: true,
        _count: { select: { rodadas: true } },
      },
    });

    const total = registros.length;
    // So entram na conta de aprovacao as que ja tem checklist lancado.
    const avaliadas = registros.filter(
      (a) => a.resultado != null && a.resultado !== 'CANCELADO',
    );
    const aprovados = avaliadas.filter((a) => a.resultado === 'APROVADO').length;
    const condicionais = avaliadas.filter(
      (a) => a.resultado === 'APROVADO_CONDICIONALMENTE',
    ).length;
    const reprovados = avaliadas.filter(
      (a) => a.resultado === 'REPROVADO',
    ).length;

    // Reavaliacoes: so contam enquanto a auditoria esta aberta.
    const hoje = new Date();
    const emReavaliacao = registros.filter(
      (a) =>
        a.statusAuditoria === 'EM_ANDAMENTO' && a.dataLimiteReavaliacao != null,
    );
    const dias = (limite: Date) =>
      Math.round(
        (Date.UTC(
          limite.getUTCFullYear(),
          limite.getUTCMonth(),
          limite.getUTCDate(),
        ) -
          Date.UTC(
            hoje.getUTCFullYear(),
            hoje.getUTCMonth(),
            hoje.getUTCDate(),
          )) /
          86400000,
      );

    return {
      total,
      avaliadas: avaliadas.length,
      aguardandoChecklist: registros.filter(
        (a) => a.resultado == null && a.statusAuditoria === 'EM_ANDAMENTO',
      ).length,
      aprovados,
      condicionais,
      reprovados,
      // Quantas precisaram de mais de uma rodada para chegar ao resultado.
      reavaliadas: registros.filter((a) => a._count.rodadas > 1).length,
      emReavaliacao: emReavaliacao.length,
      reavaliacoesVencidas: emReavaliacao.filter(
        (a) => dias(a.dataLimiteReavaliacao!) < 0,
      ).length,
      reavaliacoesAVencer: emReavaliacao.filter((a) => {
        const d = dias(a.dataLimiteReavaliacao!);
        return d >= 0 && d <= 15;
      }).length,
      emAndamento: registros.filter((a) => a.statusAuditoria === 'EM_ANDAMENTO')
        .length,
      finalizadas: registros.filter((a) => a.statusAuditoria === 'FINALIZADO')
        .length,
      canceladas: registros.filter((a) => a.statusAuditoria === 'CANCELADO')
        .length,
    };
  }

  async ultimasAuditorias() {
    const registros = await this.prisma.auditoriaFornecedor.findMany({
      orderBy: [{ ano: 'desc' }, { sequencial: 'desc' }],
      take: 10,
      select: {
        id: true,
        numero: true,
        fornecedorNome: true,
        dataAuditoria: true,
        nota: true,
        resultado: true,
        statusAuditoria: true,
        dataLimiteReavaliacao: true,
        _count: { select: { rodadas: true } },
      },
    });
    return registros.map((a) => ({ ...a, rodadasLancadas: a._count.rodadas }));
  }
}
