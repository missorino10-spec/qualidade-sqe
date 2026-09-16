import { fraseFaltas } from '../../comum/pendencias';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { semanaAno } from '../../sqe/sqe-utils';
import { numeroSqd } from '../sqd-utils';
import {
  BLOCOS_AUDITORIA,
  RespostaAuditoria,
  calcularAuditoria,
  diasCorridosEntre,
  prazoReavaliacaoDias,
  semaforoReavaliacao,
  somarDiasCorridos,
} from './auditorias-utils';

const includeAuditoria = {
  criadoPor: { select: { id: true, nome: true } },
  // A rodada traz o autor junto: e ele que assina "Auditores responsáveis" no
  // checklist impresso.
  rodadas: {
    orderBy: { rodada: 'asc' } as const,
    include: { criadoPor: { select: { id: true, nome: true } } },
  },
};

export const TIPO_ANEXO_RELATORIO_AUDITORIA = 'AUDITORIA_RELATORIO';
export const TIPO_ANEXO_PLANO_ACAO_AUDITORIA = 'AUDITORIA_PLANO_ACAO';

// Data "pura" (sem hora): o formulario manda "2026-08-08" e o registro precisa
// guardar meia-noite UTC, senao o fuso do servidor joga o dia para tras.
function dataPura(v?: string | null): Date | null {
  if (!v) return null;
  return new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`);
}

function texto(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length ? s : null;
}

@Injectable()
export class AuditoriasService {
  constructor(private prisma: PrismaService) {}

  // Prazo de reavaliacao, em dias corridos, contado da data da rodada que
  // gerou o resultado. So vale enquanto a auditoria esta em andamento: quando
  // a Qualidade encerra o registro, o relogio some da tela.
  private reavaliacao(a: {
    statusAuditoria: string;
    resultado: string | null;
    prazoReavaliacaoDias: number | null;
    dataLimiteReavaliacao: Date | null;
  }) {
    if (a.statusAuditoria !== 'EM_ANDAMENTO') return null;
    if (!a.dataLimiteReavaliacao) return null;
    const diasRestantes = diasCorridosEntre(
      new Date(),
      a.dataLimiteReavaliacao,
    );
    return {
      resultado: a.resultado,
      prazoDias: a.prazoReavaliacaoDias,
      dataLimite: a.dataLimiteReavaliacao,
      diasRestantes,
      vencida: diasRestantes < 0,
      semaforo: semaforoReavaliacao(diasRestantes),
    };
  }

  // O recorte de periodo e pela DATA DA AUDITORIA: e ela que numera o registro
  // e e o marco zero do prazo de reavaliacao. Recortar pela data limite da
  // reavaliacao jogaria a auditoria para um mes em que nada aconteceu.
  async listar(ano?: number, de?: string, ate?: string) {
    const registros = await this.prisma.auditoriaFornecedor.findMany({
      where: {
        ano: ano ?? undefined,
        dataAuditoria:
          de || ate
            ? {
                gte: de ? new Date(`${de}T00:00:00.000Z`) : undefined,
                lte: ate ? new Date(`${ate}T23:59:59.999Z`) : undefined,
              }
            : undefined,
      },
      orderBy: [{ ano: 'desc' }, { sequencial: 'desc' }],
      include: {
        criadoPor: { select: { id: true, nome: true } },
        _count: { select: { rodadas: true } },
      },
    });
    // A revisao do registro e o numero da ultima rodada do checklist.
    return registros.map((a) => ({
      ...a,
      rodadasLancadas: a._count.rodadas,
      revisao: String(a._count.rodadas).padStart(2, '0'),
      reavaliacao: this.reavaliacao(a),
    }));
  }

  async detalhe(id: number) {
    const a = await this.prisma.auditoriaFornecedor.findUnique({
      where: { id },
      include: includeAuditoria,
    });
    if (!a) throw new NotFoundException('Auditoria não encontrada');
    return {
      ...a,
      rodadasLancadas: a.rodadas.length,
      revisao: String(a.rodadas.length).padStart(2, '0'),
      checklist: BLOCOS_AUDITORIA,
      reavaliacao: this.reavaliacao(a),
      pendenciasFinalizacao: await this.pendenciasFinalizacao(a),
    };
  }

  // O ciclo so fecha quando existe checklist lancado, relatorio final anexado
  // e conclusao escrita. O plano de acao do fornecedor e anexo opcional e nao
  // trava a finalizacao.
  private async pendenciasFinalizacao(a: {
    id: number;
    resultado: string | null;
    conclusao: string | null;
  }): Promise<string[]> {
    const faltas: string[] = [];
    if (!a.resultado) faltas.push('o checklist de auditoria lançado');

    const anexos = await this.prisma.anexo.findMany({
      where: {
        entidadeId: a.id,
        entidadeTipo: TIPO_ANEXO_RELATORIO_AUDITORIA,
      },
      select: { id: true },
    });
    if (!anexos.length) faltas.push('o relatório final anexado');
    if (!a.conclusao?.trim()) faltas.push('a conclusão da Qualidade preenchida');
    return faltas;
  }

  // Abertura do registro. A auditoria e um evento: um registro por auditoria,
  // com N rodadas dentro (a 01 e a inicial, as seguintes sao reavaliacoes).
  async criar(dto: any, usuarioId: number) {
    const dataAuditoria = dataPura(dto.dataAuditoria);
    if (!dataAuditoria) {
      throw new BadRequestException('Informe a data da auditoria.');
    }
    const ano = dataAuditoria.getUTCFullYear();
    const { semana } = semanaAno(dataAuditoria);

    // Retry: dois registros abertos ao mesmo tempo cairiam no mesmo numero.
    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.auditoriaFornecedor.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.auditoriaFornecedor.create({
          data: {
            numero: numeroSqd('AUD', sequencial, ano),
            ano,
            sequencial,
            semana,
            fornecedorNome: dto.fornecedorNome,
            cnpj: texto(dto.cnpj),
            codigoFornecedor: texto(dto.codigoFornecedor),
            motivo: texto(dto.motivo),
            local: texto(dto.local),
            // "Auditores responsáveis" saiu do formulario: quem assina e o
            // usuario logado, gravado em criadoPorId.
            participantes: texto(dto.participantes),
            dataAuditoria,
            observacoes: texto(dto.observacoes),
            criadoPorId: usuarioId,
          },
        });
        return this.detalhe(criado.id);
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }
    throw new ConflictException(
      'Não foi possível numerar a auditoria. Tente salvar novamente.',
    );
  }

  // Checklist preenchido. Sem rodada informada, abre uma nova: cada passada de
  // auditoria e uma rodada propria, sob o mesmo numero do registro, com a
  // revisao igual ao numero da rodada.
  async salvarRodada(id: number, dto: any, usuarioId: number) {
    const atual = await this.prisma.auditoriaFornecedor.findUnique({
      where: { id },
      include: { rodadas: { orderBy: { rodada: 'asc' } } },
    });
    if (!atual) throw new NotFoundException('Auditoria não encontrada');
    if (atual.statusAuditoria === 'CANCELADO') {
      throw new BadRequestException(
        'Esta auditoria está cancelada e não aceita checklist.',
      );
    }

    // [{ codigo, resposta, evidencia }] -> mapa para o motor de nota
    const lista: any[] = Array.isArray(dto.respostas) ? dto.respostas : [];
    const mapa: Record<string, RespostaAuditoria> = {};
    for (const r of lista) {
      if (r?.codigo) mapa[r.codigo] = (r.resposta ?? 'NAO') as RespostaAuditoria;
    }
    const calculo = calcularAuditoria(mapa);

    const respostas = BLOCOS_AUDITORIA.flatMap((b) =>
      b.perguntas.map((p) => {
        const informada = lista.find((r) => r?.codigo === p.codigo);
        return {
          codigo: p.codigo,
          bloco: b.codigo,
          resposta: (informada?.resposta ?? 'NAO') as RespostaAuditoria,
          evidencia: texto(informada?.evidencia),
        };
      }),
    );

    const existente = dto.rodada
      ? atual.rodadas.find((r) => r.rodada === Number(dto.rodada))
      : null;
    if (dto.rodada && !existente) {
      throw new NotFoundException('Rodada não encontrada');
    }

    const rodada = existente
      ? existente.rodada
      : (atual.rodadas.at(-1)?.rodada ?? 0) + 1;

    const dataAuditoria =
      dataPura(dto.dataAuditoria) ??
      existente?.dataAuditoria ??
      (rodada === 1 ? atual.dataAuditoria : null) ??
      new Date();

    const dados = {
      revisao: String(rodada).padStart(2, '0'),
      dataAuditoria,
      // "Auditores responsáveis" saiu do formulario: quem assina a rodada e o
      // usuario logado, gravado em criadoPorId.
      participantes: texto(dto.participantes) ?? atual.participantes,
      local: texto(dto.local) ?? atual.local,
      respostas: respostas as any,
      blocos: calculo.blocos as any,
      nota: calculo.nota,
      resultado: calculo.resultado,
      conclusao: texto(dto.conclusao),
      observacoes: texto(dto.observacoes),
    };

    if (existente) {
      await this.prisma.rodadaAuditoria.update({
        where: { id: existente.id },
        data: dados,
      });
    } else {
      await this.prisma.rodadaAuditoria.create({
        data: { ...dados, auditoriaId: id, rodada, criadoPorId: usuarioId },
      });
    }

    await this.sincronizarComUltimaRodada(id);
    return this.detalhe(id);
  }

  // O resultado do registro sai sempre da rodada mais recente, e o prazo de
  // reavaliacao e recontado a partir da data dessa rodada. Se a reavaliacao
  // piorar o resultado, o prazo diminui junto.
  private async sincronizarComUltimaRodada(id: number) {
    const [recente] = await this.prisma.rodadaAuditoria.findMany({
      where: { auditoriaId: id },
      orderBy: { rodada: 'desc' },
      take: 1,
    });

    if (!recente) {
      await this.prisma.auditoriaFornecedor.update({
        where: { id },
        data: {
          dataUltimaRodada: null,
          nota: null,
          resultado: null,
          prazoReavaliacaoDias: null,
          dataLimiteReavaliacao: null,
        },
      });
      return;
    }

    const prazo = prazoReavaliacaoDias(recente.resultado);
    const base = recente.dataAuditoria ?? recente.createdAt;
    await this.prisma.auditoriaFornecedor.update({
      where: { id },
      data: {
        dataUltimaRodada: recente.dataAuditoria,
        nota: recente.nota,
        resultado: recente.resultado,
        prazoReavaliacaoDias: prazo,
        dataLimiteReavaliacao: prazo ? somarDiasCorridos(base, prazo) : null,
      },
    });
  }

  // Apaga uma rodada lancada por engano. O resultado volta a sair da rodada
  // que sobrou (ou fica vazio, se nao sobrar nenhuma).
  async removerRodada(id: number, rodada: number) {
    const registro = await this.prisma.rodadaAuditoria.findFirst({
      where: { auditoriaId: id, rodada },
    });
    if (!registro) throw new NotFoundException('Rodada não encontrada');

    await this.prisma.rodadaAuditoria.delete({ where: { id: registro.id } });
    await this.sincronizarComUltimaRodada(id);
    return this.detalhe(id);
  }

  async atualizar(id: number, dto: any) {
    const atual = await this.prisma.auditoriaFornecedor.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Auditoria não encontrada');

    const dataAuditoria =
      dto.dataAuditoria !== undefined
        ? dataPura(dto.dataAuditoria)
        : atual.dataAuditoria;

    // Editar o registro nunca e bloqueado: a Qualidade preenche o que tem, no
    // ritmo que consegue. Quem fecha (e cobra o que falta) e a rota finalizar.
    const cancelando = dto.statusAuditoria === 'CANCELADO';

    await this.prisma.auditoriaFornecedor.update({
      where: { id },
      data: {
        fornecedorNome: dto.fornecedorNome ?? undefined,
        cnpj: dto.cnpj !== undefined ? texto(dto.cnpj) : undefined,
        codigoFornecedor:
          dto.codigoFornecedor !== undefined
            ? texto(dto.codigoFornecedor)
            : undefined,
        motivo: dto.motivo !== undefined ? texto(dto.motivo) : undefined,
        local: dto.local !== undefined ? texto(dto.local) : undefined,
        participantes:
          dto.participantes !== undefined
            ? texto(dto.participantes)
            : undefined,
        dataAuditoria,
        semana: dataAuditoria ? semanaAno(dataAuditoria).semana : undefined,
        conclusao:
          dto.conclusao !== undefined ? texto(dto.conclusao) : undefined,
        observacoes:
          dto.observacoes !== undefined ? texto(dto.observacoes) : undefined,
        // "Cancelado" e resultado e status ao mesmo tempo: cancelar o registro
        // carimba o resultado e desliga o relogio da reavaliacao.
        statusAuditoria: dto.statusAuditoria ?? undefined,
        resultado: cancelando ? 'CANCELADO' : undefined,
        prazoReavaliacaoDias: cancelando ? null : undefined,
        dataLimiteReavaliacao: cancelando ? null : undefined,
      },
    });

    // Reabrir um registro cancelado devolve o resultado da ultima rodada.
    if (
      dto.statusAuditoria &&
      dto.statusAuditoria !== 'CANCELADO' &&
      atual.statusAuditoria === 'CANCELADO'
    ) {
      await this.sincronizarComUltimaRodada(id);
    }
    return this.detalhe(id);
  }

  // Encerramento do ciclo. A auditoria nunca fecha sozinha: mesmo aprovada, e
  // a Qualidade que encerra. Reprovado e aprovado condicionalmente ficam no
  // loop de reavaliacao ate alguem apertar este botao.
  async finalizar(id: number) {
    const atual = await this.prisma.auditoriaFornecedor.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Auditoria não encontrada');
    if (atual.statusAuditoria === 'CANCELADO') {
      throw new BadRequestException(
        'Esta auditoria está cancelada. Reabra o registro antes de encerrar.',
      );
    }

    const faltas = await this.pendenciasFinalizacao(atual);
    if (faltas.length) {
      throw new BadRequestException(
        `${fraseFaltas(faltas)} para encerrar a auditoria.`,
      );
    }

    await this.prisma.auditoriaFornecedor.update({
      where: { id },
      data: {
        statusAuditoria: 'FINALIZADO',
        dataFinalizacao: atual.dataFinalizacao ?? new Date(),
      },
    });
    return this.detalhe(id);
  }

  // Reabre um ciclo encerrado por engano: o carimbo do fechamento sai junto e
  // o relogio da reavaliacao volta a contar.
  async reabrir(id: number) {
    const atual = await this.prisma.auditoriaFornecedor.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Auditoria não encontrada');
    await this.prisma.auditoriaFornecedor.update({
      where: { id },
      data: { statusAuditoria: 'EM_ANDAMENTO', dataFinalizacao: null },
    });
    await this.sincronizarComUltimaRodada(id);
    return this.detalhe(id);
  }

  async remover(id: number) {
    const a = await this.prisma.auditoriaFornecedor.findUnique({
      where: { id },
    });
    if (!a) throw new NotFoundException('Auditoria não encontrada');

    // Os anexos sao polimorficos (nao tem FK), entao a limpeza e explicita.
    // As rodadas saem em cascata com o registro.
    await this.prisma.anexo.deleteMany({
      where: {
        entidadeId: id,
        entidadeTipo: {
          in: [
            TIPO_ANEXO_RELATORIO_AUDITORIA,
            TIPO_ANEXO_PLANO_ACAO_AUDITORIA,
          ],
        },
      },
    });
    await this.prisma.auditoriaFornecedor.delete({ where: { id } });
    return { ok: true };
  }
}
