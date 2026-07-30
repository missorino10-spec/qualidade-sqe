import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoricoService } from '../../historico/historico.service';
import { numeroDocumento, semanaAno } from '../sqe-utils';

const ENTIDADE = 'RNC';

const includePadrao = {
  fornecedor: { select: { id: true, nome: true, codigo: true } },
  item: { select: { id: true, descricao: true, codigo: true } },
  entrega: { select: { id: true, numeroInspecao: true } },
  inspecaoVisual: { select: { id: true, resultado: true } },
  inspecaoLote: { select: { id: true, resultado: true } },
  criadoPor: { select: { id: true, nome: true } },
};

@Injectable()
export class RncService {
  constructor(
    private prisma: PrismaService,
    private historico: HistoricoService,
  ) {}

  // Gera numero no formato RNC0001/2026 (sequencial por ano)
  private async gerarNumero(): Promise<{
    numero: string;
    ano: number;
    sequencial: number;
  }> {
    const ano = new Date().getFullYear();
    const ultima = await this.prisma.rnc.findFirst({
      where: { ano },
      orderBy: { sequencial: 'desc' },
    });
    const sequencial = (ultima?.sequencial ?? 0) + 1;
    return { numero: numeroDocumento('RNC', sequencial, ano), ano, sequencial };
  }

  findAll(filtros: {
    status?: string;
    fornecedorId?: number;
    de?: string;
    ate?: string;
  }) {
    return this.prisma.rnc.findMany({
      where: {
        status: filtros.status ? (filtros.status as any) : undefined,
        fornecedorId: filtros.fornecedorId ?? undefined,
        dataAbertura: {
          gte: filtros.de ? new Date(filtros.de) : undefined,
          lte: filtros.ate ? new Date(filtros.ate) : undefined,
        },
      },
      include: includePadrao,
      orderBy: { dataAbertura: 'desc' },
    });
  }

  async findOne(id: number) {
    const rnc = await this.prisma.rnc.findUnique({
      where: { id },
      include: includePadrao,
    });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    const historico = await this.historico.listar(ENTIDADE, id);
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: ENTIDADE, entidadeId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { ...rnc, historico, anexos };
  }

  // Sugere se e reincidencia: mesmo fornecedor + item ja teve RNC antes
  async sugereReincidencia(
    fornecedorId: number,
    itemId: number,
  ): Promise<boolean> {
    const anterior = await this.prisma.rnc.findFirst({
      where: { fornecedorId, itemId },
    });
    return !!anterior;
  }

  // Resolve o item a partir de texto livre (a Qualidade define o item ao abrir
  // a RNC). Reaproveita item existente por codigo/descricao ou cria um novo.
  private async resolverItemId(data: any): Promise<number> {
    if (data.itemId) return data.itemId;
    const codigo = (data.itemCodigo ?? '').trim();
    const descricao = (data.itemDescricao ?? '').trim();

    if (codigo) {
      const existente = await this.prisma.item.findUnique({
        where: { codigo },
      });
      if (existente) return existente.id;
      const criado = await this.prisma.item.create({
        data: {
          codigo,
          descricao: descricao || codigo,
          fornecedorId: data.fornecedorId ?? null,
        },
      });
      return criado.id;
    }

    if (descricao) {
      const existente = await this.prisma.item.findFirst({
        where: { descricao, fornecedorId: data.fornecedorId ?? null },
      });
      if (existente) return existente.id;
      const criado = await this.prisma.item.create({
        data: {
          codigo: `AUTO-${Date.now()}`,
          descricao,
          fornecedorId: data.fornecedorId ?? null,
        },
      });
      return criado.id;
    }

    const criado = await this.prisma.item.create({
      data: {
        codigo: `AUTO-${Date.now()}`,
        descricao: 'Item nao especificado',
        fornecedorId: data.fornecedorId ?? null,
      },
    });
    return criado.id;
  }

  async create(data: any, usuarioId: number) {
    const { numero, ano, sequencial } = await this.gerarNumero();
    const itemId = await this.resolverItemId(data);
    const reincidencia =
      data.reincidencia ??
      (await this.sugereReincidencia(data.fornecedorId, itemId));
    const valorTotal =
      data.quantidadePecas != null && data.valorUnitario != null
        ? data.quantidadePecas * data.valorUnitario
        : (data.valorTotal ?? null);

    const { semana } = semanaAno(new Date());

    const rnc = await this.prisma.rnc.create({
      data: {
        numero,
        ano,
        sequencial,
        semana,
        entregaId: data.entregaId ?? null,
        inspecaoVisualId: data.inspecaoVisualId ?? null,
        inspecaoLoteId: data.inspecaoLoteId ?? null,
        solicitante: data.solicitante ?? 'Qualidade',
        itemId,
        quantidadeLote: data.quantidadeLote ?? null,
        po: data.po ?? null,
        notaFiscal: data.notaFiscal ?? null,
        fornecedorId: data.fornecedorId,
        tipoDesvio: data.tipoDesvio ?? '',
        reincidencia,
        descricaoDesvio: data.descricaoDesvio ?? '',
        quantidadePecas: data.quantidadePecas ?? null,
        valorUnitario: data.valorUnitario ?? null,
        valorTotal,
        disposicao: data.disposicao ?? null,
        observacoes: data.observacoes ?? null,
        criadoPorId: usuarioId,
      },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: rnc.id,
      statusAnterior: null,
      statusNovo: 'EM_ANDAMENTO',
      comentario: 'RNC aberta',
      usuarioId,
    });
    return rnc;
  }

  // Uma inspecao (= um recebimento) tem UMA RNC. Quando o Visual e o Lote do
  // mesmo recebimento reprovam, a segunda reprova COMPLEMENTA a RNC ja aberta
  // em vez de abrir uma segunda - inclusive se os formularios forem salvos em
  // dias diferentes, porque o vinculo e a entrega, nao o momento.
  async abrirOuComplementar(data: any, usuarioId: number) {
    const existente = data.entregaId
      ? await this.prisma.rnc.findFirst({
          where: { entregaId: data.entregaId },
          orderBy: { id: 'asc' },
        })
      : null;
    if (!existente) return this.create(data, usuarioId);

    // Concatena sem repetir: o texto do primeiro formulario continua la.
    const juntar = (atual: string | null, novo?: string | null): string => {
      const n = (novo ?? '').trim();
      const a = (atual ?? '').trim();
      if (!n) return a;
      if (!a) return n;
      return a.includes(n) ? a : `${a} | ${n}`;
    };

    const atualizada = await this.prisma.rnc.update({
      where: { id: existente.id },
      data: {
        inspecaoVisualId: data.inspecaoVisualId ?? existente.inspecaoVisualId,
        inspecaoLoteId: data.inspecaoLoteId ?? existente.inspecaoLoteId,
        tipoDesvio: juntar(existente.tipoDesvio, data.tipoDesvio),
        descricaoDesvio: juntar(
          existente.descricaoDesvio,
          data.descricaoDesvio,
        ),
      },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: existente.id,
      statusAnterior: existente.status,
      statusNovo: existente.status,
      comentario: `Desvio adicionado: ${data.tipoDesvio ?? 'novo desvio'}`,
      usuarioId,
    });
    return atualizada;
  }

  // Atualiza os campos de controle/plano de acao (planilha 3)
  async atualizar(id: number, data: any, usuarioId: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');

    const quantidadePecas = data.quantidadePecas ?? rnc.quantidadePecas;
    const valorUnitario = data.valorUnitario ?? rnc.valorUnitario;
    const valorTotal =
      quantidadePecas != null && valorUnitario != null
        ? quantidadePecas * valorUnitario
        : rnc.valorTotal;

    const dataAbertura = rnc.dataAbertura;
    const dataRetorno = data.dataRetorno
      ? new Date(data.dataRetorno)
      : rnc.dataRetorno;
    const tempoRetornoDias = dataRetorno
      ? Math.round(
          (dataRetorno.getTime() - dataAbertura.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : rnc.tempoRetornoDias;

    const statusAnterior = rnc.status;
    const novoStatus = data.status ?? rnc.status;

    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: {
        tipoDesvio: data.tipoDesvio ?? rnc.tipoDesvio,
        reincidencia: data.reincidencia ?? rnc.reincidencia,
        descricaoDesvio: data.descricaoDesvio ?? rnc.descricaoDesvio,
        quantidadePecas,
        valorUnitario,
        valorTotal,
        disposicao: data.disposicao ?? rnc.disposicao,
        houveRetorno: data.houveRetorno ?? rnc.houveRetorno,
        dataRetorno,
        tempoRetornoDias,
        fornecedorAceitou: data.fornecedorAceitou ?? rnc.fornecedorAceitou,
        fornecedorEnviouPlano:
          data.fornecedorEnviouPlano ?? rnc.fornecedorEnviouPlano,
        nivelPlano: data.nivelPlano ?? rnc.nivelPlano,
        status: novoStatus,
        verificacaoEficacia:
          data.verificacaoEficacia ?? rnc.verificacaoEficacia,
        dataVerificacao: data.dataVerificacao
          ? new Date(data.dataVerificacao)
          : rnc.dataVerificacao,
        evidencias: data.evidencias ?? rnc.evidencias,
        observacoes: data.observacoes ?? rnc.observacoes,
      },
      include: includePadrao,
    });

    if (novoStatus !== statusAnterior) {
      await this.historico.registrar({
        entidadeTipo: ENTIDADE,
        entidadeId: id,
        statusAnterior,
        statusNovo: novoStatus,
        comentario: data.comentario ?? `Status alterado para ${novoStatus}`,
        usuarioId,
      });
    }
    return atualizada;
  }

  async mudarStatus(
    id: number,
    novoStatus: string,
    comentario: string | undefined,
    usuarioId: number,
  ) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: { status: novoStatus as any },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: rnc.status,
      statusNovo: novoStatus,
      comentario: comentario ?? null,
      usuarioId,
    });
    return atualizada;
  }

  // Cancela a RNC (motivo obrigatorio). Sai dos KPIs, permanece na lista.
  // O motivo NAO vai para o historico de status - so aparece ao abrir a RNC.
  async cancelar(id: number, motivo: string, usuarioId: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    if (!motivo || !motivo.trim())
      throw new BadRequestException('Informe o motivo do cancelamento.');
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: {
        status: 'CANCELADA' as any,
        motivoCancelamento: motivo.trim(),
      },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: rnc.status,
      statusNovo: 'CANCELADA',
      comentario: 'RNC cancelada',
      usuarioId,
    });
    return atualizada;
  }

  // Reabre a RNC (a partir de FINALIZADA ou CANCELADA) para EM_ANDAMENTO.
  async reabrir(id: number, usuarioId: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: {
        status: 'EM_ANDAMENTO' as any,
        motivoCancelamento: null,
      },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: rnc.status,
      statusNovo: 'EM_ANDAMENTO',
      comentario: 'RNC reaberta',
      usuarioId,
    });
    return atualizada;
  }

  // Remocao permanente do banco (restrito a ADMIN no controller).
  // Remove anexos, historico e vinculos antes de apagar a RNC.
  async remover(id: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');
    await this.prisma.anexo.deleteMany({
      where: { entidadeTipo: ENTIDADE, entidadeId: id },
    });
    await this.historico.remover(ENTIDADE, id);
    await this.prisma.rnc.delete({ where: { id } });
    return { ok: true, id };
  }
}
