import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DOC_RO, FOTO_RO } from '../../comum/ro';
import {
  blocosCompletosRo,
  camposFaltandoRo,
  custoTotalRo,
  derivarStatusAcoes,
  numeroRo,
  somarDiasUteis,
} from './ro-utils';

const includeRo = {
  responsavel: { select: { id: true, nome: true } },
  criadoPor: { select: { id: true, nome: true } },
  tarefas: { orderBy: [{ tipo: 'asc' as const }, { ordem: 'asc' as const }] },
  blocos: {
    orderBy: { numero: 'asc' as const },
    include: { concluidoPor: { select: { id: true, nome: true } } },
  },
};

function texto(v: any): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

function numero(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function data(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Campo de lista: string vazia vira null para o Postgres nao reclamar do enum.
function opcao(v: any): any {
  return texto(v);
}

@Injectable()
export class ReclamacoesService {
  constructor(private prisma: PrismaService) {}

  listar(de?: string, ate?: string, status?: string) {
    return this.prisma.reclamacao.findMany({
      where: {
        status: (status as any) ?? undefined,
        recebidoEm:
          de || ate
            ? {
                gte: de ? new Date(de) : undefined,
                lte: ate ? new Date(`${ate}T23:59:59.999Z`) : undefined,
              }
            : undefined,
      },
      orderBy: { recebidoEm: 'desc' },
      include: includeRo,
    });
  }

  async detalhe(id: number) {
    const reg = await this.prisma.reclamacao.findUnique({
      where: { id },
      include: includeRo,
    });
    if (!reg) throw new NotFoundException('R.O não encontrado');
    // O que ainda falta em cada bloco vai junto: a tela mostra o motivo de o
    // flag nao ter acendido, em vez de deixar a pessoa procurando.
    return { ...reg, camposFaltando: camposFaltandoRo(reg) };
  }

  // Os campos dos quatro blocos, comuns a criacao e edicao. Tudo e opcional:
  // o R.O nasce com o bloco 1 e vai sendo completado ao longo da tratativa.
  private campos(dto: any) {
    return {
      // 1. Dados recebidos
      cliente: texto(dto.cliente),
      produtoCodigo: texto(dto.produtoCodigo),
      produtoDescricao: texto(dto.produtoDescricao),
      quantidadeAfetada: numero(dto.quantidadeAfetada),
      valorUnitario: numero(dto.valorUnitario),
      tipoInformado: texto(dto.tipoInformado),
      resultadoAnaliseSac: texto(dto.resultadoAnaliseSac),
      origemIndicada: texto(dto.origemIndicada),

      // 2. Triagem
      dadosCompletos: opcao(dto.dadosCompletos),
      aceita: opcao(dto.aceita),
      classificacao: opcao(dto.classificacao),
      procedencia: opcao(dto.procedencia),
      prioridade: opcao(dto.prioridade),
      areaResponsavel: opcao(dto.areaResponsavel),
      responsavelId: numero(dto.responsavelId),
      pendenciasSac: texto(dto.pendenciasSac),

      // 3. Tratativa interna
      necessidadeContencao: opcao(dto.necessidadeContencao),
      metodoAnalise: opcao(dto.metodoAnalise),
      causaImediata: texto(dto.causaImediata),
      causaSistemica: texto(dto.causaSistemica),
      verificacaoEficacia: opcao(dto.verificacaoEficacia),
      evidencias: texto(dto.evidencias),

      // 4. Retorno ao SAC e encerramento
      resumoConclusao: texto(dto.resumoConclusao),
      dataRetornoSac: data(dto.dataRetornoSac),
      motivoEncerramento: opcao(dto.motivoEncerramento),
      status: opcao(dto.status) ?? 'RECEBIDA_SAC',
    };
  }

  // Plano de contencao e acoes corretivas sao tabelas de linhas (decisao 5).
  // As duas chegam na mesma lista, separadas pelo tipo.
  private tarefas(dto: any) {
    const linhas = Array.isArray(dto.tarefas) ? dto.tarefas : [];
    const contadores: Record<string, number> = {
      CONTENCAO: 0,
      ACAO_CORRETIVA: 0,
    };
    return linhas
      .map((t: any) => {
        const tipo = t?.tipo === 'CONTENCAO' ? 'CONTENCAO' : 'ACAO_CORRETIVA';
        const descricao = texto(t?.descricao);
        if (!descricao) return null;
        return {
          tipo: tipo as any,
          ordem: ++contadores[tipo],
          descricao,
          responsavel: texto(t?.responsavel),
          prazo: data(t?.prazo),
          status: (texto(t?.status) ?? 'NAO_INICIADA') as any,
        };
      })
      .filter(Boolean) as any[];
  }

  async criar(dto: any, usuarioId: number) {
    const campos = this.campos(dto);
    // "Data/hora Recebimento Qualidade" e automatica: e a abertura do registro.
    const recebidoEm = new Date();
    const ano = recebidoEm.getFullYear();
    const tarefas = this.tarefas(dto);

    // Retry: dois R.O abertos no mesmo instante cairiam no mesmo sequencial.
    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.reclamacao.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.reclamacao.create({
          data: {
            numero: numeroRo(sequencial, ano),
            ano,
            sequencial,
            ...campos,
            recebidoEm,
            prazoConclusao: somarDiasUteis(recebidoEm, 5),
            custoTotal: custoTotalRo(
              campos.quantidadeAfetada,
              campos.valorUnitario,
            ),
            statusAcoes: derivarStatusAcoes(tarefas) as any,
            criadoPorId: usuarioId,
            tarefas: { create: tarefas },
          },
        });
        await this.recalcularBlocos(criado.id, usuarioId);
        return this.detalhe(criado.id);
      } catch (e: any) {
        // Numero tomado por outra pessoa no mesmo instante: tenta o proximo.
        if (e?.code !== 'P2002') throw e;
      }
    }
    throw new ConflictException(
      'Não foi possível numerar o R.O. Tente salvar novamente.',
    );
  }

  async atualizar(id: number, dto: any, usuarioId: number) {
    const atual = await this.prisma.reclamacao.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('R.O não encontrado');

    const campos = this.campos(dto);
    const tarefas = this.tarefas(dto);

    await this.prisma.$transaction([
      // As linhas nao carregam anexo nem historico: trocar o conjunto inteiro
      // e mais simples e mais seguro do que casar linha a linha.
      this.prisma.tarefaReclamacao.deleteMany({ where: { reclamacaoId: id } }),
      this.prisma.reclamacao.update({
        where: { id },
        data: {
          ...campos,
          prazoConclusao: somarDiasUteis(atual.recebidoEm, 5),
          custoTotal: custoTotalRo(
            campos.quantidadeAfetada,
            campos.valorUnitario,
          ),
          statusAcoes: derivarStatusAcoes(tarefas) as any,
          tarefas: { create: tarefas },
        },
      }),
    ]);

    await this.recalcularBlocos(id, usuarioId);
    return this.detalhe(id);
  }

  /**
   * Flag de concluido por bloco (decisao 4): a existencia da linha e o flag.
   * O sistema cria a linha quando o bloco fica completo e apaga se alguem
   * esvaziar um campo dele depois — assim o flag nunca mente.
   */
  private async recalcularBlocos(id: number, usuarioId: number) {
    const reg = await this.prisma.reclamacao.findUnique({
      where: { id },
      include: { tarefas: true, blocos: true },
    });
    if (!reg) return;

    const completos = blocosCompletosRo(reg);
    const marcados = reg.blocos.map((b) => b.numero);

    const criar = completos.filter((n) => !marcados.includes(n));
    const apagar = marcados.filter((n) => !completos.includes(n));

    if (criar.length) {
      await this.prisma.blocoReclamacao.createMany({
        data: criar.map((n) => ({
          reclamacaoId: id,
          numero: n,
          concluidoPorId: usuarioId,
        })),
        skipDuplicates: true,
      });
    }
    if (apagar.length) {
      await this.prisma.blocoReclamacao.deleteMany({
        where: { reclamacaoId: id, numero: { in: apagar } },
      });
    }
  }

  async remover(id: number) {
    await this.prisma.reclamacao.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('R.O não encontrado');
    });
    // Anexo e uma tabela generica: o documento e as fotos ficariam soltos se
    // nao forem apagados aqui.
    await this.prisma.anexo.deleteMany({
      where: { entidadeTipo: { in: [DOC_RO, FOTO_RO] }, entidadeId: id },
    });
    await this.prisma.reclamacao.delete({ where: { id } });
    return { ok: true };
  }
}
