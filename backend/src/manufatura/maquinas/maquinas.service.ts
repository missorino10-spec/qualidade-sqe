import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularPpm } from '../manufatura-utils';

@Injectable()
export class MaquinasService {
  constructor(private prisma: PrismaService) {}

  async listar(area?: string, incluirInativas?: boolean) {
    const maquinas = await this.prisma.maquina.findMany({
      where: {
        area: area ? (area as any) : undefined,
        ativa: incluirInativas ? undefined : true,
      },
      orderBy: [{ area: 'asc' }, { nome: 'asc' }],
    });
    // PPM acumulado de cada maquina, calculado a partir da producao diaria.
    const totais = await this.prisma.producaoDiaria.groupBy({
      by: ['maquinaId'],
      _sum: { qtdProduzida: true, qtdDefeito: true },
    });
    const porMaquina = new Map(totais.map((t) => [t.maquinaId, t]));
    return maquinas.map((m) => {
      const t = porMaquina.get(m.id);
      const produzidas = t?._sum.qtdProduzida ?? 0;
      const defeitos = t?._sum.qtdDefeito ?? 0;
      return {
        ...m,
        pecasProduzidas: produzidas,
        pecasComDefeito: defeitos,
        ppm: calcularPpm(produzidas, defeitos),
      };
    });
  }

  async detalhe(id: number) {
    const m = await this.prisma.maquina.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Máquina não encontrada');
    const agregado = await this.prisma.producaoDiaria.aggregate({
      where: { maquinaId: id },
      _sum: { qtdProduzida: true, qtdDefeito: true },
    });
    const cnq = await this.prisma.cnq.aggregate({
      where: { maquinaId: id },
      _sum: { valorTotal: true },
    });
    const produzidas = agregado._sum.qtdProduzida ?? 0;
    const defeitos = agregado._sum.qtdDefeito ?? 0;
    return {
      ...m,
      pecasProduzidas: produzidas,
      pecasComDefeito: defeitos,
      ppm: calcularPpm(produzidas, defeitos),
      cnqTotal: cnq._sum.valorTotal ?? 0,
    };
  }

  criar(dto: any) {
    return this.prisma.maquina.create({
      data: {
        codigo: dto.codigo,
        nome: dto.nome,
        area: dto.area ?? 'FABRICACAO',
        descricao: dto.descricao,
        ativa: dto.ativa ?? true,
      },
    });
  }

  async atualizar(id: number, dto: any) {
    await this.detalhe(id);
    return this.prisma.maquina.update({ where: { id }, data: dto });
  }

  // ------------------------------------------------- grade de producao diaria

  // Resumo do mes, uma linha por maquina. E por onde a tela abre: primeiro se
  // ve o mes inteiro de todas as maquinas e so depois se entra numa delas para
  // apontar dia a dia. "Dias apontados" mostra o que ainda falta lancar.
  async resumoMensal(ano: number, mes: number) {
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 0));
    const [maquinas, dias] = await Promise.all([
      this.prisma.maquina.findMany({
        where: { ativa: true },
        orderBy: [{ area: 'asc' }, { nome: 'asc' }],
      }),
      this.prisma.producaoDiaria.groupBy({
        by: ['maquinaId'],
        where: { data: { gte: inicio, lte: fim } },
        _sum: { qtdProduzida: true, qtdDefeito: true },
        _count: { _all: true },
      }),
    ]);
    const porMaquina = new Map(dias.map((d) => [d.maquinaId, d]));

    const linhas = maquinas.map((m) => {
      const t = porMaquina.get(m.id);
      const produzidas = t?._sum.qtdProduzida ?? 0;
      const defeitos = t?._sum.qtdDefeito ?? 0;
      return {
        maquinaId: m.id,
        codigo: m.codigo,
        nome: m.nome,
        area: m.area,
        pecasProduzidas: produzidas,
        pecasComDefeito: defeitos,
        ppm: calcularPpm(produzidas, defeitos),
        diasApontados: t?._count._all ?? 0,
      };
    });

    const produzidas = linhas.reduce((s, l) => s + l.pecasProduzidas, 0);
    const defeitos = linhas.reduce((s, l) => s + l.pecasComDefeito, 0);
    return {
      ano,
      mes,
      diasNoMes: fim.getUTCDate(),
      linhas,
      pecasProduzidas: produzidas,
      pecasComDefeito: defeitos,
      ppm: calcularPpm(produzidas, defeitos),
    };
  }

  // A grade e a mesma da planilha: uma linha por dia do mes, com quantidade
  // produzida e quantidade com defeito digitadas pela Qualidade.
  async producaoDoMes(maquinaId: number, ano: number, mes: number) {
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 0));
    const dias = await this.prisma.producaoDiaria.findMany({
      where: { maquinaId, data: { gte: inicio, lte: fim } },
      orderBy: { data: 'asc' },
    });
    const produzidas = dias.reduce((s, d) => s + d.qtdProduzida, 0);
    const defeitos = dias.reduce((s, d) => s + d.qtdDefeito, 0);
    return {
      ano,
      mes,
      dias,
      pecasProduzidas: produzidas,
      pecasComDefeito: defeitos,
      ppm: calcularPpm(produzidas, defeitos),
    };
  }

  async salvarProducao(maquinaId: number, dto: any, usuarioId?: number) {
    await this.detalhe(maquinaId);
    // Guardamos so a data (sem hora) para o par maquina+dia ser unico.
    const d = new Date(dto.data);
    const data = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    const valores = {
      qtdProduzida: dto.qtdProduzida ?? 0,
      qtdDefeito: dto.qtdDefeito ?? 0,
      registradoPorId: usuarioId,
    };
    return this.prisma.producaoDiaria.upsert({
      where: { maquinaId_data: { maquinaId, data } },
      create: { maquinaId, data, ...valores },
      update: valores,
    });
  }

  async removerProducao(maquinaId: number, id: number) {
    const linha = await this.prisma.producaoDiaria.findUnique({
      where: { id },
    });
    if (!linha || linha.maquinaId !== maquinaId)
      throw new NotFoundException('Apontamento não encontrado');
    await this.prisma.producaoDiaria.delete({ where: { id } });
    return { ok: true };
  }
}
