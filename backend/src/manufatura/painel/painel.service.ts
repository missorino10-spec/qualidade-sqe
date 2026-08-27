import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { trimestreFiscal } from '../../sqe/sqe-utils';
import { calcularPpm, contaComoAprovado } from '../manufatura-utils';

function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

@Injectable()
export class PainelManufaturaService {
  constructor(private prisma: PrismaService) {}

  async kpis(de?: string, ate?: string) {
    const periodo: any = {};
    if (de) periodo.gte = new Date(de);
    if (ate) periodo.lte = new Date(ate);
    const temPeriodo = !!(de || ate);

    // prettier-ignore
    const [producao, inspecoes, cnqs, oitoDs, cincoGs, maquinas, icaqs] = await Promise.all([
      this.prisma.producaoDiaria.findMany({
        where: temPeriodo ? { data: periodo } : {},
        include: { maquina: { select: { id: true, nome: true, area: true } } },
      }),
      this.prisma.inspecaoManufatura.findMany({
        where: temPeriodo ? { dataInspecao: periodo } : {},
        include: {
          relatorios: {
            orderBy: { tentativa: 'desc' },
            select: { resultado: true },
          },
        },
      }),
      this.prisma.cnq.findMany({
        where: temPeriodo ? { data: periodo } : {},
        include: { tipoDefeito: { select: { id: true, nome: true } } },
      }),
      this.prisma.oitoD.findMany({
        where: temPeriodo ? { dataAbertura: periodo } : {},
        select: { status: true },
      }),
      this.prisma.cincoG.findMany({
        where: temPeriodo ? { dataAbertura: periodo } : {},
        select: { status: true },
      }),
      this.prisma.maquina.findMany({ where: { ativa: true } }),
      this.prisma.controleAutonomo.findMany({
        where: temPeriodo ? { dataAuditoria: periodo } : {},
        select: {
          nota: true,
          classificacao: true,
          operador: true,
          maquina: { select: { id: true, codigo: true, nome: true } },
        },
      }),
    ]);

    const pecasProduzidas = producao.reduce((s, p) => s + p.qtdProduzida, 0);
    const pecasComDefeito = producao.reduce((s, p) => s + p.qtdDefeito, 0);
    const cnqTotal = cnqs.reduce((s, c) => s + c.valorTotal, 0);

    // A inspecao entra nos indicadores pelo resultado da ULTIMA tentativa:
    // enquanto estiver reprovada ela ainda esta pendente de reinspecao.
    const comResultado = inspecoes.filter((i) => i.relatorios.length > 0);
    const aprovadas = comResultado.filter((i) =>
      contaComoAprovado(i.relatorios[0].resultado),
    ).length;
    const setups = inspecoes.filter((i) => i.tipo === 'SETUP');
    const producoes = inspecoes.filter((i) => i.tipo === 'PRODUCAO');

    // TOP defeitos: quantidade e custo, como na aba "Coleta - Qualidade".
    const porDefeito = new Map<string, { nome: string; qtd: number; cnq: number }>();
    for (const c of cnqs) {
      const chave = c.tipoDefeito.nome;
      const atual = porDefeito.get(chave) ?? { nome: chave, qtd: 0, cnq: 0 };
      atual.qtd += c.quantidade;
      atual.cnq += c.valorTotal;
      porDefeito.set(chave, atual);
    }
    const topDefeitos = [...porDefeito.values()]
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);

    // PPM por maquina no periodo.
    const porMaquina = new Map<number, any>();
    for (const p of producao) {
      const atual = porMaquina.get(p.maquinaId) ?? {
        id: p.maquinaId,
        nome: p.maquina.nome,
        area: p.maquina.area,
        produzidas: 0,
        defeitos: 0,
        cnq: 0,
      };
      atual.produzidas += p.qtdProduzida;
      atual.defeitos += p.qtdDefeito;
      porMaquina.set(p.maquinaId, atual);
    }
    for (const c of cnqs) {
      const atual = porMaquina.get(c.maquinaId);
      if (atual) atual.cnq += c.valorTotal;
    }
    const ppmPorMaquina = [...porMaquina.values()]
      .map((m) => ({ ...m, ppm: calcularPpm(m.produzidas, m.defeitos) }))
      .sort((a, b) => b.ppm - a.ppm);

    // ICAQ: como esta o programa de controle autonomo no periodo. O ranking sai
    // da PIOR nota para a melhor: quem precisa de atencao aparece primeiro.
    const somaIcaq = icaqs.reduce((s, a) => s + a.nota, 0);
    const conformes = icaqs.filter((a) => a.classificacao === 'CONFORME').length;
    const atencao = icaqs.filter((a) => a.classificacao === 'ATENCAO').length;
    const naoConformes = icaqs.filter(
      (a) => a.classificacao === 'NAO_CONFORME',
    ).length;

    const agrupar = (chave: (a: (typeof icaqs)[number]) => string) => {
      const mapa = new Map<string, { nome: string; auditorias: number; soma: number; conformes: number }>();
      for (const a of icaqs) {
        const nome = chave(a);
        const atual = mapa.get(nome) ?? { nome, auditorias: 0, soma: 0, conformes: 0 };
        atual.auditorias++;
        atual.soma += a.nota;
        if (a.classificacao === 'CONFORME') atual.conformes++;
        mapa.set(nome, atual);
      }
      return [...mapa.values()]
        .map((g) => ({
          nome: g.nome,
          auditorias: g.auditorias,
          notaMedia: Math.round((g.soma / g.auditorias) * 10) / 10,
          pctConforme: pct(g.conformes, g.auditorias),
        }))
        .sort((a, b) => a.notaMedia - b.notaMedia);
    };

    return {
      icaq: {
        auditorias: icaqs.length,
        notaMedia: icaqs.length
          ? Math.round((somaIcaq / icaqs.length) * 10) / 10
          : 0,
        conformes,
        atencao,
        naoConformes,
        pctConforme: pct(conformes, icaqs.length),
        pctForaDoPadrao: pct(atencao + naoConformes, icaqs.length),
        porOperador: agrupar((a) => a.operador || '(sem operador)'),
        porEquipamento: agrupar((a) =>
          a.maquina ? `${a.maquina.codigo} — ${a.maquina.nome}` : '(sem equipamento)',
        ),
      },
      indicadores: {
        ppm: calcularPpm(pecasProduzidas, pecasComDefeito),
        pecasProduzidas,
        pecasComDefeito,
        cnqTotal: Math.round(cnqTotal * 100) / 100,
        pctAprovacao: pct(aprovadas, comResultado.length),
        pctDefeito: pct(pecasComDefeito, pecasProduzidas),
      },
      contadores: {
        maquinas: maquinas.length,
        inspecoesSetup: setups.length,
        inspecoesProducao: producoes.length,
        inspecoesPendentes: inspecoes.filter((i) => i.status === 'PENDENTE')
          .length,
        // Cada relatorio alem do primeiro e uma reinspecao.
        reinspecoes: inspecoes.reduce(
          (s, i) => s + Math.max(0, i.relatorios.length - 1),
          0,
        ),
        lancamentosCnq: cnqs.length,
        // O 8D e o 5G sao documentos distintos, mas o painel conta os dois
        // juntos: o que interessa e quantas analises seguem em aberto.
        oitoDsAbertos:
          oitoDs.filter((d) => d.status !== 'CONCLUIDO').length +
          cincoGs.filter((g) => g.status !== 'CONCLUIDO').length,
        oitoDsConcluidos:
          oitoDs.filter((d) => d.status === 'CONCLUIDO').length +
          cincoGs.filter((g) => g.status === 'CONCLUIDO').length,
      },
      topDefeitos,
      ppmPorMaquina,
    };
  }

  // Situacao atual de cada maquina, no mesmo espirito da evolucao do SQE.
  async evolucaoMaquinas() {
    const maquinas = await this.prisma.maquina.findMany({
      where: { ativa: true },
      orderBy: [{ area: 'asc' }, { nome: 'asc' }],
    });
    const producao = await this.prisma.producaoDiaria.groupBy({
      by: ['maquinaId'],
      _sum: { qtdProduzida: true, qtdDefeito: true },
    });
    const cnq = await this.prisma.cnq.groupBy({
      by: ['maquinaId'],
      _sum: { valorTotal: true },
    });
    const prodPorId = new Map(producao.map((p) => [p.maquinaId, p]));
    const cnqPorId = new Map(cnq.map((c) => [c.maquinaId, c]));

    return maquinas.map((m) => {
      const p = prodPorId.get(m.id);
      const produzidas = p?._sum.qtdProduzida ?? 0;
      const defeitos = p?._sum.qtdDefeito ?? 0;
      return {
        id: m.id,
        codigo: m.codigo,
        nome: m.nome,
        area: m.area,
        setupsRealizados: m.setupsRealizados,
        producoesRealizadas: m.producoesRealizadas,
        inspecoesReprovadas: m.inspecoesReprovadas,
        pecasProduzidas: produzidas,
        pecasComDefeito: defeitos,
        ppm: calcularPpm(produzidas, defeitos),
        cnqTotal: Math.round((cnqPorId.get(m.id)?._sum.valorTotal ?? 0) * 100) / 100,
      };
    });
  }

  // Fecha o trimestre fiscal: guarda o retrato do periodo por maquina e zera
  // os contadores.
  async fecharTrimestre() {
    const { label, inicio, fim } = trimestreFiscal(new Date());
    const maquinas = await this.prisma.maquina.findMany({
      where: { ativa: true },
    });
    let processadas = 0;
    for (const m of maquinas) {
      const producao = await this.prisma.producaoDiaria.aggregate({
        where: { maquinaId: m.id, data: { gte: inicio, lte: fim } },
        _sum: { qtdProduzida: true, qtdDefeito: true },
      });
      const cnq = await this.prisma.cnq.aggregate({
        where: { maquinaId: m.id, data: { gte: inicio, lte: fim } },
        _sum: { valorTotal: true },
      });
      const produzidas = producao._sum.qtdProduzida ?? 0;
      const defeitos = producao._sum.qtdDefeito ?? 0;

      await this.prisma.historicoMaquina.create({
        data: {
          maquinaId: m.id,
          trimestreFiscal: label,
          periodoInicio: inicio,
          periodoFim: fim,
          pecasProduzidas: produzidas,
          pecasComDefeito: defeitos,
          ppm: calcularPpm(produzidas, defeitos),
          cnqTotal: cnq._sum.valorTotal ?? 0,
          setupsRealizados: m.setupsRealizados,
          producoesRealizadas: m.producoesRealizadas,
          inspecoesReprovadas: m.inspecoesReprovadas,
        },
      });

      await this.prisma.maquina.update({
        where: { id: m.id },
        data: {
          setupsRealizados: 0,
          producoesRealizadas: 0,
          inspecoesReprovadas: 0,
        },
      });
      processadas++;
    }
    return { trimestre: label, maquinasProcessadas: processadas };
  }
}
