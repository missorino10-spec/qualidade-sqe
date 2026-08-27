import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { numeroManufatura } from '../manufatura-utils';
import { FOTO_ICAQ } from '../../comum/icaq';
import { montarItensIcaq } from './icaq-utils';

const includeIcaq = {
  maquina: { select: { id: true, codigo: true, nome: true, area: true } },
  item: { select: { id: true, codigo: true, descricao: true } },
  auditor: { select: { id: true, nome: true } },
  criadoPor: { select: { id: true, nome: true } },
  itens: { orderBy: { numero: 'asc' as const } },
};

@Injectable()
export class ControleAutonomoService {
  constructor(private prisma: PrismaService) {}

  listar(de?: string, ate?: string, maquinaId?: number) {
    return this.prisma.controleAutonomo.findMany({
      where: {
        maquinaId: maquinaId ?? undefined,
        dataAuditoria:
          de || ate
            ? {
                gte: de ? new Date(de) : undefined,
                lte: ate ? new Date(ate) : undefined,
              }
            : undefined,
      },
      orderBy: { dataAuditoria: 'desc' },
      include: includeIcaq,
    });
  }

  async detalhe(id: number) {
    const reg = await this.prisma.controleAutonomo.findUnique({
      where: { id },
      include: includeIcaq,
    });
    if (!reg) throw new NotFoundException('Auditoria ICAQ não encontrada');
    return reg;
  }

  // Campos do cabecalho, comuns a criacao e edicao.
  private cabecalho(dto: any) {
    return {
      dataAuditoria: dto.dataAuditoria
        ? new Date(dto.dataAuditoria)
        : new Date(),
      turno: dto.turno ?? 'COMERCIAL',
      maquinaId: dto.maquinaId,
      itemId: dto.itemId ?? null,
      ordemLote: String(dto.ordemLote ?? '').trim() || null,
      operador: String(dto.operador ?? '').trim(),
      observacoesIniciais:
        String(dto.observacoesIniciais ?? '').trim() || null,
    };
  }

  // A auditoria e lancada e fechada de uma vez: as dez linhas chegam juntas e
  // a nota ja sai calculada. O auditor e quem esta logado, como em todo campo
  // de assinatura do sistema.
  async criar(dto: any, usuarioId: number) {
    const cabecalho = this.cabecalho(dto);
    const ano = cabecalho.dataAuditoria.getFullYear();
    const { itens, nota, classificacao } = montarItensIcaq(dto.itens);

    // Retry: duas auditorias simultaneas podem cair no mesmo sequencial.
    for (let i = 0; i < 5; i++) {
      const ultima = await this.prisma.controleAutonomo.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultima?.sequencial ?? 0) + 1;
      try {
        const criada = await this.prisma.controleAutonomo.create({
          data: {
            numero: numeroManufatura('ICAQ', sequencial, ano),
            ano,
            sequencial,
            ...cabecalho,
            auditorId: usuarioId,
            nota,
            classificacao,
            criadoPorId: usuarioId,
            itens: { create: itens },
          },
        });
        return this.detalhe(criada.id);
      } catch (e: any) {
        // Numero tomado por outra pessoa no mesmo instante: tenta o proximo.
        if (e?.code !== 'P2002') throw e;
      }
    }
    throw new ConflictException(
      'Não foi possível numerar a auditoria. Tente salvar novamente.',
    );
  }

  // As linhas sao atualizadas no lugar, uma a uma pelo numero, e nunca
  // apagadas e recriadas: assim o id de cada verificacao continua o mesmo ao
  // longo das correcoes da auditoria.
  async atualizar(id: number, dto: any) {
    await this.detalhe(id);
    const { itens, nota, classificacao } = montarItensIcaq(dto.itens);
    await this.prisma.$transaction([
      this.prisma.controleAutonomo.update({
        where: { id },
        data: { ...this.cabecalho(dto), nota, classificacao },
      }),
      ...itens.map((item) => {
        const { numero, ...campos } = item;
        return this.prisma.itemControleAutonomo.upsert({
          where: { controleId_numero: { controleId: id, numero } },
          create: { controleId: id, numero, ...campos },
          update: campos,
        });
      }),
    ]);
    return this.detalhe(id);
  }

  async remover(id: number) {
    await this.detalhe(id);
    // O anexo e uma tabela generica: as fotos da auditoria ficariam soltas se
    // nao forem apagadas aqui.
    await this.prisma.anexo.deleteMany({
      where: { entidadeTipo: FOTO_ICAQ, entidadeId: id },
    });
    await this.prisma.controleAutonomo.delete({ where: { id } });
    return { ok: true };
  }
}
