import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { semanaAno } from '../../sqe/sqe-utils';
import { numeroManufatura } from '../manufatura-utils';

// INSPECAO VISUAL DA MANUFATURA - documento proprio, sem cotas e sem
// reinspecao: e o registro do que o inspetor observou naquele momento, com o
// mesmo cabecalho do formulario dimensional.
//
// Nao mexe nos contadores da maquina (setupsRealizados / producoesRealizadas /
// inspecoesReprovadas): esses indicadores medem a inspecao dimensional, que e
// quem tem resultado de aprovacao. O visual e um registro descritivo.

const includeVisual = {
  maquina: { select: { id: true, codigo: true, nome: true, area: true } },
  inspetor: { select: { id: true, nome: true } },
};

@Injectable()
export class InspecaoVisualManufaturaService {
  constructor(private prisma: PrismaService) {}

  listar(tipo?: string, maquinaId?: number) {
    return this.prisma.inspecaoVisualManufatura.findMany({
      where: {
        tipo: tipo ? (tipo as any) : undefined,
        maquinaId: maquinaId ?? undefined,
      },
      orderBy: { dataInspecao: 'desc' },
      include: includeVisual,
    });
  }

  async detalhe(id: number) {
    const insp = await this.prisma.inspecaoVisualManufatura.findUnique({
      where: { id },
      include: includeVisual,
    });
    if (!insp) throw new NotFoundException('Inspeção visual não encontrada');
    return insp;
  }

  // Numera na serie propria do visual (SETV0001/2026 ou PRODV0001/2026).
  // O retry existe porque dois inspetores podem salvar ao mesmo tempo e cair
  // no mesmo sequencial; sem ele, um deles perderia o formulario preenchido.
  async criar(tipo: 'SETUP' | 'PRODUCAO', dto: any, usuarioId: number) {
    const maquina = await this.prisma.maquina.findUnique({
      where: { id: dto.maquinaId },
    });
    if (!maquina) throw new NotFoundException('Máquina não encontrada');

    const data = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const ano = data.getFullYear();
    const { semana } = semanaAno(data);
    const prefixo = tipo === 'SETUP' ? 'SETV' : 'PRODV';

    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.inspecaoVisualManufatura.findFirst({
        where: { tipo, ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criada = await this.prisma.inspecaoVisualManufatura.create({
          data: {
            tipo,
            numero: numeroManufatura(prefixo, sequencial, ano),
            ano,
            sequencial,
            maquinaId: dto.maquinaId,
            revisao: dto.revisao ?? '01',
            dataInspecao: data,
            semana,
            origem: dto.origem ?? 'LIBERACAO_SETUP',
            origemOutros: dto.origemOutros ?? null,
            itemCodigo: dto.itemCodigo ?? null,
            itemDescricao: dto.itemDescricao ?? null,
            desenho: dto.desenho ?? null,
            desenhoRevisao: dto.desenhoRevisao ?? null,
            po: dto.po ?? null,
            qtdInspecionada: dto.qtdInspecionada ?? null,
            qtdTotal: dto.qtdTotal ?? null,
            observacoes: dto.observacoes ?? null,
            // Quem assina e o usuario logado (inspetorId); os campos digitados
            // sairam do formulario.
            inspetorId: usuarioId,
          },
        });
        return this.detalhe(criada.id);
      } catch {
        // Numero tomado por outro inspetor no mesmo instante: tenta o proximo.
      }
    }
    throw new ConflictException(
      'Não foi possível numerar a inspeção visual. Tente salvar novamente.',
    );
  }

  async remover(id: number) {
    await this.detalhe(id);
    await this.prisma.inspecaoVisualManufatura.delete({ where: { id } });
    return { ok: true };
  }
}
