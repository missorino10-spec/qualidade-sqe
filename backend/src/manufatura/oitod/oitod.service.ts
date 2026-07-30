import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { numeroManufatura } from '../manufatura-utils';

const includeOitoD = {
  inspecao: {
    select: {
      id: true,
      numero: true,
      tipo: true,
      maquina: { select: { id: true, nome: true } },
    },
  },
  cnq: { select: { id: true, numero: true, itemCodigo: true } },
  criadoPor: { select: { id: true, nome: true } },
  aprovadoPor: { select: { id: true, nome: true } },
};

// Campos das secoes 1 a 7 do formulario BDBR.QUA.FMR.007.01, na ordem do papel.
const CAMPOS = [
  'produtoItem',
  'codigoDesenho',
  'origem',
  'local',
  'processoOperacao',
  'equipamento',
  'turno',
  'qtdAfetada',
  'responsavel',
  'equipe',
  'descricaoProblema',
  'efeito',
  'causas6M',
  'porques',
  'causaRaiz',
  'planoAcao',
  'padronizacao',
  'verificacaoEficacia',
  'status',
  'aprovacaoProducao',
] as const;

@Injectable()
export class OitoDService {
  constructor(private prisma: PrismaService) {}

  listar(status?: string) {
    return this.prisma.oitoD.findMany({
      where: { status: status ? (status as any) : undefined },
      orderBy: { dataAbertura: 'desc' },
      include: includeOitoD,
    });
  }

  async detalhe(id: number) {
    const d = await this.prisma.oitoD.findUnique({
      where: { id },
      include: includeOitoD,
    });
    if (!d) throw new NotFoundException('8D não encontrado');
    return d;
  }

  private dadosDoDto(dto: any) {
    const data: any = {};
    for (const campo of CAMPOS) {
      if (dto[campo] !== undefined) data[campo] = dto[campo];
    }
    return data;
  }

  async criar(dto: any, usuarioId: number) {
    const data = dto.dataAbertura ? new Date(dto.dataAbertura) : new Date();
    const ano = data.getFullYear();

    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.oitoD.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.oitoD.create({
          data: {
            numero: numeroManufatura('8D', sequencial, ano),
            ano,
            sequencial,
            dataAbertura: data,
            inspecaoId: dto.inspecaoId ?? null,
            cnqId: dto.cnqId ?? null,
            criadoPorId: usuarioId,
            ...this.dadosDoDto(dto),
          },
        });
        return this.detalhe(criado.id);
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }
    throw new ConflictException(
      'Não foi possível numerar o 8D. Tente salvar novamente.',
    );
  }

  async atualizar(id: number, dto: any) {
    await this.detalhe(id);
    await this.prisma.oitoD.update({
      where: { id },
      data: this.dadosDoDto(dto),
    });
    return this.detalhe(id);
  }

  // Quem aprova no sistema e a Qualidade; o campo de Producao continua no PDF
  // para o documento sair igual ao formulario em papel.
  async aprovar(id: number, usuarioId: number) {
    await this.detalhe(id);
    await this.prisma.oitoD.update({
      where: { id },
      data: {
        aprovadoPorId: usuarioId,
        aprovadoEm: new Date(),
        status: 'CONCLUIDO',
      },
    });
    return this.detalhe(id);
  }

  async remover(id: number) {
    await this.detalhe(id);
    await this.prisma.oitoD.delete({ where: { id } });
    return { ok: true };
  }
}
