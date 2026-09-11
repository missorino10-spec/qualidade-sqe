import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { acoesPendentes, planoAcaoNormalizado } from '../../comum/oitod';
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

// Campos gravaveis do 8D, na ordem da planilha. Esta lista tem de cobrir TODOS
// os campos do DTO: um campo que fica de fora e aceito pela API e descartado em
// silencio - foi assim que a data de abertura deixou de salvar.
const CAMPOS = [
  // Cabecalho
  'produtoItem',
  'codigoDesenho',
  'origem',
  'origemOutros',
  'documentoReferencia',
  'local',
  'processoOperacao',
  'equipamento',
  'turno',
  'qtdAfetada',
  'responsavel',
  'equipe',
  'departamento',
  'areaAplicacao',
  'status',
  // Passo 1
  'descricaoProblema',
  'objetivos',
  'perdaAtacada',
  'perdaValorAno',
  'descricao5W1H',
  'situacaoAtual',
  'estratificacao',
  // Passo 2
  'efeito',
  'causas6M',
  'causasPotenciais',
  'causaRaiz',
  // Passo 3
  'planoAcao',
  'padronizacao',
  // Passo 4
  'verificacaoResultados',
  'verificacaoEficacia',
  // Conclusao
  'custosInvestimentos',
  'beneficiosGanhos',
  'resultadosIndices',
  'verificacaoGerente',
  'aprovacaoProducao',
] as const;

// Campos de data: chegam como "AAAA-MM-DD" e precisam virar Date.
const CAMPOS_DATA = ['dataAbertura', 'dataTermino'] as const;

@Injectable()
export class OitoDService {
  constructor(private prisma: PrismaService) {}

  listar(status?: string, de?: string, ate?: string) {
    return this.prisma.oitoD.findMany({
      where: {
        status: status ? (status as any) : undefined,
        // "Ate" vale o dia inteiro: a data de abertura guarda hora e parar na
        // meia-noite deixaria de fora tudo que foi aberto no ultimo dia.
        dataAbertura:
          de || ate
            ? {
                gte: de ? new Date(de) : undefined,
                lte: ate ? new Date(`${ate}T23:59:59.999Z`) : undefined,
              }
            : undefined,
      },
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
    for (const campo of CAMPOS_DATA) {
      if (dto[campo] === undefined) continue;
      data[campo] = dto[campo] ? new Date(dto[campo]) : null;
    }
    return data;
  }

  // O 8D so fecha quando nao ha acao em aberto no plano: com acao pendente o
  // registro nao pode ser marcado como concluido nem aprovado.
  private exigirPlanoConcluido(atual: any, dto: any = {}) {
    // O plano passa pelo normalizador para que um 8D do formato antigo, com
    // acao ainda em aberto, tambem seja barrado.
    const planoAcao = planoAcaoNormalizado(dto.planoAcao ?? atual.planoAcao);
    const pendentes = acoesPendentes(planoAcao);
    if (pendentes.length) {
      throw new BadRequestException(
        `Ainda há ${pendentes.length} ação(ões) em aberto no plano. Conclua ou cancele cada uma antes de fechar o 8D.`,
      );
    }
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
    const atual = await this.detalhe(id);
    if (dto.status === 'CONCLUIDO') this.exigirPlanoConcluido(atual, dto);
    await this.prisma.oitoD.update({
      where: { id },
      data: this.dadosDoDto(dto),
    });
    return this.detalhe(id);
  }

  // Quem aprova no sistema e a Qualidade; o campo de Producao continua no PDF
  // para o documento sair igual ao formulario em papel.
  async aprovar(id: number, usuarioId: number) {
    const atual = await this.detalhe(id);
    this.exigirPlanoConcluido(atual);
    await this.prisma.oitoD.update({
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
    await this.prisma.oitoD.delete({ where: { id } });
    return { ok: true };
  }
}
