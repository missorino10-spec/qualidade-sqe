import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoricoService {
  constructor(private prisma: PrismaService) {}

  registrar(params: {
    entidadeTipo: string;
    entidadeId: number;
    statusAnterior?: string | null;
    statusNovo: string;
    comentario?: string | null;
    usuarioId?: number | null;
  }) {
    return this.prisma.historicoStatus.create({
      data: {
        entidadeTipo: params.entidadeTipo,
        entidadeId: params.entidadeId,
        statusAnterior: params.statusAnterior ?? null,
        statusNovo: params.statusNovo,
        comentario: params.comentario ?? null,
        usuarioId: params.usuarioId ?? null,
      },
    });
  }

  listar(entidadeTipo: string, entidadeId: number) {
    return this.prisma.historicoStatus.findMany({
      where: { entidadeTipo, entidadeId },
      include: { usuario: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  remover(entidadeTipo: string, entidadeId: number) {
    return this.prisma.historicoStatus.deleteMany({
      where: { entidadeTipo, entidadeId },
    });
  }
}
