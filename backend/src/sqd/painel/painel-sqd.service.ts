import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SLA_HOMOLOGACAO_DIAS } from '../sqd-utils';

@Injectable()
export class PainelSqdService {
  constructor(private prisma: PrismaService) {}

  // KPIs do processo SQD (aba "KPI's" do FMR.029.01 + slide do fluxo):
  // % de aprovacao, lead time medio e % dentro do SLA de 3 dias uteis.
  async kpis(de?: string, ate?: string) {
    const where =
      de || ate
        ? {
            dataAvaliacao: {
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
      },
    });

    const total = homologacoes.length;
    const aprovados = homologacoes.filter(
      (h) => h.resultado === 'APROVADO',
    ).length;
    const condicionais = homologacoes.filter(
      (h) => h.resultado === 'APROVADO_CONDICIONALMENTE',
    ).length;
    const reprovados = homologacoes.filter(
      (h) => h.resultado === 'REPROVADO',
    ).length;

    // A planilha conta "Aprovado" + "Aprovado Condicionalmente" como aprovacao.
    const pctAprovacao = total
      ? Math.round(((aprovados + condicionais) / total) * 1000) / 10
      : 0;

    const comLeadTime = homologacoes.filter((h) => h.leadTimeDiasUteis != null);
    const leadTimeMedio = comLeadTime.length
      ? Math.round(
          (comLeadTime.reduce((s, h) => s + (h.leadTimeDiasUteis ?? 0), 0) /
            comLeadTime.length) *
            10,
        ) / 10
      : 0;

    const noPrazo = comLeadTime.filter(
      (h) => (h.leadTimeDiasUteis ?? 0) <= SLA_HOMOLOGACAO_DIAS,
    ).length;
    const pctNoPrazo = comLeadTime.length
      ? Math.round((noPrazo / comLeadTime.length) * 1000) / 10
      : 0;

    const notaMedia = total
      ? Math.round((homologacoes.reduce((s, h) => s + h.nota, 0) / total) * 10) /
        10
      : 0;

    return {
      total,
      aprovados,
      condicionais,
      reprovados,
      pctAprovacao,
      notaMedia,
      leadTimeMedio,
      pctNoPrazo,
      slaDias: SLA_HOMOLOGACAO_DIAS,
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
        dataAvaliacao: true,
        nota: true,
        resultado: true,
        statusHomologacao: true,
      },
    });
  }
}
