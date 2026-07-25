import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RncService } from '../rnc/rnc.service';
import {
  checklistVisualInicial,
  semanaAno,
  semanaReferencia,
} from '../sqe-utils';

const includeVisual = {
  fornecedor: { select: { id: true, nome: true, codigo: true } },
  item: { select: { id: true, descricao: true, codigo: true } },
  inspetor: { select: { id: true, nome: true } },
  rncs: { select: { id: true, numero: true, status: true } },
};

@Injectable()
export class InspecoesService {
  constructor(
    private prisma: PrismaService,
    private rnc: RncService,
  ) {}

  templateVisual() {
    return checklistVisualInicial();
  }

  // Lista unificada de inspecoes (visual + lote) + recebimentos sem inspecao,
  // ordenada por data (mais recente primeiro), para a tela de Inspecoes.
  async listarTodas(fornecedorId?: number) {
    const where = fornecedorId ? { fornecedorId } : {};
    const [visuais, lotes, entregas] = await Promise.all([
      this.prisma.inspecaoVisual.findMany({
        where,
        include: includeVisual,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inspecaoLote.findMany({
        where,
        include: includeVisual,
        orderBy: { createdAt: 'desc' },
      }),
      // Recebimentos que nao geraram inspecao (sem inspecao recomendada)
      this.prisma.entregaPortaria.findMany({
        where: {
          ...where,
          inspecoesVisual: { none: {} },
          inspecoesLote: { none: {} },
        },
        include: {
          fornecedor: { select: { id: true, nome: true, codigo: true } },
          item: { select: { id: true, descricao: true, codigo: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const marcar = (arr: any[], tipo: string) =>
      arr.map((i) => ({ ...i, tipoFormulario: tipo }));
    const recebimentos = entregas.map((e) => ({
      ...e,
      tipoFormulario: 'RECEBIMENTO',
      resultado: 'SEM_INSPECAO',
      dataInspecao: e.dataEntrega,
      rncs: [],
    }));
    return [
      ...marcar(visuais, 'VISUAL'),
      ...marcar(lotes, 'LOTE'),
      ...recebimentos,
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // Exclusao de inspecao (restrito a ADMIN no controller).
  // Se houver RNC vinculada e cascade=false, bloqueia e retorna a RNC.
  async deletarVisual(id: number, cascade: boolean) {
    const insp = await this.prisma.inspecaoVisual.findUnique({
      where: { id },
      include: {
        rncs: { select: { id: true, numero: true } },
        entrega: {
          include: {
            inspecoesVisual: { select: { id: true } },
            inspecoesLote: { select: { id: true } },
          },
        },
      },
    });
    if (!insp) throw new ConflictException('Inspecao nao encontrada');
    await this.removerRncsVinculadas(insp.rncs, cascade);
    await this.prisma.inspecaoVisual.delete({ where: { id } });
    await this.reverterInspecao(insp, 'VISUAL');
    return { ok: true };
  }

  async deletarLote(id: number, cascade: boolean) {
    const insp = await this.prisma.inspecaoLote.findUnique({
      where: { id },
      include: {
        rncs: { select: { id: true, numero: true } },
        entrega: {
          include: {
            inspecoesVisual: { select: { id: true } },
            inspecoesLote: { select: { id: true } },
          },
        },
      },
    });
    if (!insp) throw new ConflictException('Inspecao nao encontrada');
    await this.removerRncsVinculadas(insp.rncs, cascade);
    await this.prisma.inspecaoLote.delete({ where: { id } });
    await this.reverterInspecao(insp, 'LOTE');
    return { ok: true };
  }

  // Desfaz os incrementos feitos ao criar a inspecao e limpa a carga recebida
  // (EntregaPortaria) quando ela nao tem mais nenhuma inspecao. Assim uma
  // inspecao excluida por engano nao vira "recebimento sem inspecao" fantasma.
  private async reverterInspecao(insp: any, tipo: 'VISUAL' | 'LOTE') {
    const reprovado = insp.resultado === 'REPROVADO';
    const entrega = insp.entrega;
    const restamVisual = (entrega?.inspecoesVisual ?? []).filter(
      (v: any) => !(tipo === 'VISUAL' && v.id === insp.id),
    );
    const restamLote = (entrega?.inspecoesLote ?? []).filter(
      (l: any) => !(tipo === 'LOTE' && l.id === insp.id),
    );
    // Lote encadeado apos Visual nao gerou credito de entrega/inspecao no
    // fornecedor (so contou lote); os demais casos sim.
    const encadeadoLote = tipo === 'LOTE' && restamVisual.length > 0;
    const teveCreditoEntrega = !encadeadoLote;

    const f = await this.prisma.fornecedor.findUnique({
      where: { id: insp.fornecedorId },
    });
    if (f) {
      await this.prisma.fornecedor.update({
        where: { id: insp.fornecedorId },
        data: {
          totalEntregas: teveCreditoEntrega
            ? Math.max(0, f.totalEntregas - 1)
            : undefined,
          totalInspecoes: teveCreditoEntrega
            ? Math.max(0, f.totalInspecoes - 1)
            : undefined,
          lotesInspecionados: Math.max(0, f.lotesInspecionados - 1),
          lotesReprovados: reprovado
            ? Math.max(0, f.lotesReprovados - 1)
            : undefined,
        },
      });
    }

    // Carga sem nenhuma inspecao restante: remove a EntregaPortaria.
    if (entrega && restamVisual.length === 0 && restamLote.length === 0) {
      await this.prisma.entregaPortaria
        .delete({ where: { id: entrega.id } })
        .catch(() => undefined);
    }
  }

  private async removerRncsVinculadas(
    rncs: { id: number; numero: string }[],
    cascade: boolean,
  ) {
    if (!rncs.length) return;
    if (!cascade) {
      throw new ConflictException({
        message: 'Existe RNC vinculada a esta inspecao.',
        rncs,
      });
    }
    for (const r of rncs) {
      await this.rnc.remover(r.id);
    }
  }

  // Avalia, na abertura de uma inspecao, se o fornecedor deve ser inspecionado
  // nesta entrega (classificacao + periodicidade + contador ciclico).
  async avaliarRecebimento(fornecedorId: number) {
    const fornecedor = await this.prisma.fornecedor.findUniqueOrThrow({
      where: { id: fornecedorId },
    });
    const config = await this.prisma.periodicidadeConfig.findUnique({
      where: { classificacao: fornecedor.classificacaoFornecimento },
    });
    const frequenciaN = config?.frequenciaN ?? 1;
    const proximoContador = fornecedor.contadorEntregas + 1;
    const precisaInspecionar = proximoContador >= frequenciaN;

    return {
      fornecedor: {
        id: fornecedor.id,
        nome: fornecedor.nome,
        codigo: fornecedor.codigo,
        classificacaoFornecimento: fornecedor.classificacaoFornecimento,
        fazVisual: fornecedor.fazVisual,
        fazLote: fornecedor.fazLote,
      },
      periodicidade: config,
      frequenciaN,
      contadorAtual: fornecedor.contadorEntregas,
      proximoContador,
      precisaInspecionar,
    };
  }

  // Resolve o item a partir de texto livre (a Qualidade define o item na inspecao).
  // Reaproveita item existente por codigo/descricao ou cria um novo.
  private async resolverItemId(dto: any): Promise<number> {
    if (dto.itemId) return dto.itemId;
    const codigo = (dto.itemCodigo ?? '').trim();
    const descricao = (dto.itemDescricao ?? '').trim();

    if (codigo) {
      const existente = await this.prisma.item.findUnique({
        where: { codigo },
      });
      if (existente) return existente.id;
      const criado = await this.prisma.item.create({
        data: {
          codigo,
          descricao: descricao || codigo,
          fornecedorId: dto.fornecedorId ?? null,
        },
      });
      return criado.id;
    }

    if (descricao) {
      const existente = await this.prisma.item.findFirst({
        where: { descricao, fornecedorId: dto.fornecedorId ?? null },
      });
      if (existente) return existente.id;
      const criado = await this.prisma.item.create({
        data: {
          codigo: `AUTO-${Date.now()}`,
          descricao,
          fornecedorId: dto.fornecedorId ?? null,
        },
      });
      return criado.id;
    }

    const criado = await this.prisma.item.create({
      data: {
        codigo: `AUTO-${Date.now()}`,
        descricao: 'Item nao especificado',
        fornecedorId: dto.fornecedorId ?? null,
      },
    });
    return criado.id;
  }

  // Registra uma entrega sem inspecao (quando o ciclo de periodicidade nao
  // exige inspecao neste recebimento). Avanca o contador ciclico.
  async registrarRecebimento(dto: any, usuarioId: number) {
    const fornecedor = await this.prisma.fornecedor.findUniqueOrThrow({
      where: { id: dto.fornecedorId },
    });
    const config = await this.prisma.periodicidadeConfig.findUnique({
      where: { classificacao: fornecedor.classificacaoFornecimento },
    });
    const frequenciaN = config?.frequenciaN ?? 1;
    const novoContador = fornecedor.contadorEntregas + 1;
    const passivelInspecao = novoContador >= frequenciaN;

    const data = dto.dataEntrega ? new Date(dto.dataEntrega) : new Date();
    const { semana, ano } = semanaAno(data);
    const entrega = await this.prisma.entregaPortaria.create({
      data: {
        fornecedorId: dto.fornecedorId,
        itemId: dto.itemId ?? null,
        dataEntrega: data,
        semanaReferencia: semanaReferencia(data),
        semana,
        ano,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        quantidade: dto.qtdTotal ?? dto.quantidade ?? null,
        numeroEntregaAcumulado: novoContador,
        passivelInspecao,
        confirmadoPorId: usuarioId,
      },
    });

    await this.prisma.fornecedor.update({
      where: { id: fornecedor.id },
      data: {
        totalEntregas: { increment: 1 },
        contadorEntregas: passivelInspecao ? 0 : novoContador,
      },
    });

    return { entrega, inspecionado: false, passivelInspecao };
  }

  // Atualiza contadores do fornecedor apos uma inspecao (a inspecao tambem
  // conta como uma entrega recebida e zera o contador ciclico).
  private async atualizarContadores(fornecedorId: number, reprovado: boolean) {
    await this.prisma.fornecedor.update({
      where: { id: fornecedorId },
      data: {
        totalEntregas: { increment: 1 },
        totalInspecoes: { increment: 1 },
        lotesInspecionados: { increment: 1 },
        lotesReprovados: reprovado ? { increment: 1 } : undefined,
        contadorEntregas: 0,
      },
    });
  }

  // Toda inspecao representa uma carga recebida: cria (ou reaproveita, no
  // encadeamento Visual->Lote) a EntregaPortaria correspondente. Uma unica
  // entrega por recebimento, mesmo que faca Visual + Lote.
  private async entregaDaInspecao(
    dto: any,
    itemId: number,
    dataInsp: Date,
    usuarioId: number,
  ): Promise<number> {
    if (dto.entregaId) return dto.entregaId;
    const { semana, ano } = semanaAno(dataInsp);
    const entrega = await this.prisma.entregaPortaria.create({
      data: {
        fornecedorId: dto.fornecedorId,
        itemId,
        dataEntrega: dataInsp,
        semanaReferencia: semanaReferencia(dataInsp),
        semana,
        ano,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        quantidade: dto.qtdTotal ?? null,
        passivelInspecao: true,
        confirmadoPorId: usuarioId,
      },
    });
    return entrega.id;
  }

  async criarVisual(dto: any, usuarioId: number) {
    const itemId = await this.resolverItemId(dto);
    const dataInsp = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const { semana, ano } = semanaAno(dataInsp);
    const entregaId = await this.entregaDaInspecao(
      dto,
      itemId,
      dataInsp,
      usuarioId,
    );
    const insp = await this.prisma.inspecaoVisual.create({
      data: {
        entregaId,
        fornecedorId: dto.fornecedorId,
        itemId,
        dataInspecao: dataInsp,
        semana,
        ano,
        desenhoRev: dto.desenhoRev ?? null,
        toleranciasNorm: dto.toleranciasNorm ?? null,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        qtdInspecionada: dto.qtdInspecionada ?? null,
        qtdTotal: dto.qtdTotal ?? null,
        relatorioNumero: dto.relatorioNumero ?? null,
        origem: dto.origem ?? 'PLANO_INSPECAO',
        checklist: dto.checklist ?? checklistVisualInicial(),
        observacoes: dto.observacoes ?? null,
        resultado: dto.resultado ?? 'APROVADO',
        inspetorId: usuarioId,
      },
      include: includeVisual,
    });

    const reprovado = insp.resultado === 'REPROVADO';
    await this.atualizarContadores(dto.fornecedorId, reprovado);

    let rnc: any = null;
    if (reprovado) {
      const itensReprovados = this.itensReprovados(dto.checklist);
      rnc = await this.rnc.create(
        {
          inspecaoVisualId: insp.id,
          fornecedorId: dto.fornecedorId,
          itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: itensReprovados.length
            ? `Visual: ${itensReprovados.join('; ')}`
            : 'Inspeção Visual reprovada',
          descricaoDesvio:
            dto.observacoes ||
            (itensReprovados.length
              ? `Itens reprovados: ${itensReprovados.join('; ')}`
              : 'Não conformidade identificada na inspeção visual.'),
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    return { inspecao: insp, rnc };
  }

  async criarLote(dto: any, usuarioId: number) {
    const itemId = await this.resolverItemId(dto);
    const dataInsp = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const { semana, ano } = semanaAno(dataInsp);
    // Encadeado apos Visual: reaproveita a mesma entrega (dto.entregaId).
    const entregaId = await this.entregaDaInspecao(
      dto,
      itemId,
      dataInsp,
      usuarioId,
    );
    const insp = await this.prisma.inspecaoLote.create({
      data: {
        entregaId,
        fornecedorId: dto.fornecedorId,
        itemId,
        dataInspecao: dataInsp,
        semana,
        ano,
        desenhoRev: dto.desenhoRev ?? null,
        toleranciasNorm: dto.toleranciasNorm ?? null,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        qtdInspecionada: dto.qtdInspecionada ?? null,
        qtdTotal: dto.qtdTotal ?? null,
        relatorioNumero: dto.relatorioNumero ?? null,
        origem: dto.origem ?? 'PLANO_INSPECAO',
        cotas: dto.cotas ?? [],
        observacoes: dto.observacoes ?? null,
        resultado: dto.resultado ?? 'APROVADO',
        inspetorId: usuarioId,
      },
      include: includeVisual,
    });

    const reprovado = insp.resultado === 'REPROVADO';
    // Quando o Lote e a segunda etapa de um recebimento que ja fez o Visual
    // (encadeamento Visual->Lote), a entrega ja foi contabilizada no Visual;
    // aqui contamos apenas a inspecao de lote e a eventual reprova.
    if (dto.encadeadoAposVisual) {
      await this.prisma.fornecedor.update({
        where: { id: dto.fornecedorId },
        data: {
          lotesInspecionados: { increment: 1 },
          lotesReprovados: reprovado ? { increment: 1 } : undefined,
        },
      });
    } else {
      await this.atualizarContadores(dto.fornecedorId, reprovado);
    }

    let rnc: any = null;
    if (reprovado) {
      rnc = await this.rnc.create(
        {
          inspecaoLoteId: insp.id,
          fornecedorId: dto.fornecedorId,
          itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: 'Dimensional',
          descricaoDesvio:
            dto.observacoes ||
            'Não conformidade dimensional identificada na inspeção de lote.',
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    return { inspecao: insp, rnc };
  }

  private itensReprovados(checklist: any): string[] {
    if (!Array.isArray(checklist)) return [];
    const reprovados: string[] = [];
    for (const grupo of checklist) {
      for (const item of grupo.itens ?? []) {
        if (item.status === 'REPROVADO') reprovados.push(item.texto);
      }
    }
    return reprovados;
  }
}
