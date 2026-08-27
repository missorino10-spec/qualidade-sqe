import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { checklist5G, restauracoesPendentes } from '../../comum/cincog';
import { numeroManufatura } from '../manufatura-utils';

const includeCincoG = {
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

// Campos gravaveis do 5G. Esta lista tem de cobrir TODOS os campos do DTO: um
// campo que fica de fora e aceito pela API e descartado em silencio, porque o
// ValidationPipe global roda com whitelist.
const CAMPOS = [
  'status',
  'origem',
  'origemOutros',
  'documentoReferencia',
  'turno',
  'produtoItem',
  'codigoDesenho',
  'local',
  'processoOperacao',
  'equipamento',
  'responsavel',
  'equipe',
  'departamento',
  'areaAplicacao',
  'descricaoProblema',
  'avaliacoes',
  'conclusao',
  'verificacaoGerente',
] as const;

const CAMPOS_DATA = ['dataAbertura', 'dataTermino'] as const;

@Injectable()
export class CincoGService {
  constructor(private prisma: PrismaService) {}

  listar(status?: string) {
    return this.prisma.cincoG.findMany({
      where: { status: status ? (status as any) : undefined },
      orderBy: { dataAbertura: 'desc' },
      include: includeCincoG,
    });
  }

  async detalhe(id: number) {
    const d = await this.prisma.cincoG.findUnique({
      where: { id },
      include: includeCincoG,
    });
    if (!d) throw new NotFoundException('5G não encontrado');
    // As 9 avaliacoes sao fixas: o registro sempre volta com o checklist
    // completo, mesmo que tenha sido gravado pela metade.
    return { ...d, avaliacoes: checklist5G(d.avaliacoes) };
  }

  private dadosDoDto(dto: any) {
    const data: any = {};
    for (const campo of CAMPOS) {
      if (dto[campo] !== undefined) data[campo] = dto[campo];
    }
    for (const campo of CAMPOS_DATA) {
      if (dto[campo] === undefined) continue;
      data[campo] = dto[campo] ? new Date(dto[campo]) : null;
    }
    return data;
  }

  // O 5G so fecha quando nao ha restauracao em aberto: uma avaliacao marcada
  // como "necessita restauracao" e sem baixa impede concluir e aprovar.
  private exigirRestauracoesConcluidas(atual: any, dto: any = {}) {
    const avaliacoes = checklist5G(dto.avaliacoes ?? atual.avaliacoes);
    const pendentes = restauracoesPendentes(avaliacoes);
    if (pendentes.length) {
      throw new BadRequestException(
        `Ainda há ${pendentes.length} restauração(ões) em aberto no checklist. Conclua ou cancele cada uma antes de fechar o 5G.`,
      );
    }
  }

  async criar(dto: any, usuarioId: number) {
    const data = dto.dataAbertura ? new Date(dto.dataAbertura) : new Date();
    const ano = data.getFullYear();

    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.cincoG.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.cincoG.create({
          data: {
            numero: numeroManufatura('5G', sequencial, ano),
            ano,
            sequencial,
            dataAbertura: data,
            inspecaoId: dto.inspecaoId ?? null,
            cnqId: dto.cnqId ?? null,
            criadoPorId: usuarioId,
            ...this.dadosDoDto(dto),
            // O checklist ja nasce com as 9 avaliacoes da planilha.
            avaliacoes: checklist5G(dto.avaliacoes),
          },
        });
        return this.detalhe(criado.id);
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }
    throw new ConflictException(
      'Não foi possível numerar o 5G. Tente salvar novamente.',
    );
  }

  async atualizar(id: number, dto: any) {
    const atual = await this.detalhe(id);
    if (dto.status === 'CONCLUIDO') this.exigirRestauracoesConcluidas(atual, dto);
    await this.prisma.cincoG.update({
      where: { id },
      data: this.dadosDoDto(dto),
    });
    return this.detalhe(id);
  }

  async aprovar(id: number, usuarioId: number) {
    const atual = await this.detalhe(id);
    this.exigirRestauracoesConcluidas(atual);
    await this.prisma.cincoG.update({
      where: { id },
      data: {
        aprovadoPorId: usuarioId,
        aprovadoEm: new Date(),
        status: 'CONCLUIDO',
        dataTermino: atual.dataTermino ?? new Date(),
      },
    });
    return this.detalhe(id);
  }

  async remover(id: number) {
    await this.detalhe(id);
    await this.prisma.cincoG.delete({ where: { id } });
    return { ok: true };
  }
}
