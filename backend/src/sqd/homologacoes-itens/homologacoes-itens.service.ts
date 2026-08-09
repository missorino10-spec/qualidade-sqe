import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { semanaAno } from '../../sqe/sqe-utils';
import { diasUteisEntre, numeroSqd } from '../sqd-utils';
import {
  CHECKLIST_VISUAL_SQD,
  CotaItem,
  GrupoVisual,
  calcularCota,
  checklistVisualInicial,
  resultadoVisual,
} from './itens-utils';

const includeHomologacao = {
  criadoPor: { select: { id: true, nome: true } },
  relatorios: { orderBy: { tentativa: 'asc' } as const },
};

export const TIPO_ANEXO_RELATORIO_ITEM = 'HOMOLOGACAO_ITEM_RELATORIO';
export const TIPO_ANEXO_PLANO_ACAO_ITEM = 'HOMOLOGACAO_ITEM_PLANO_ACAO';

// Data "pura" (sem hora): o formulario manda "2026-08-08" e o registro precisa
// guardar meia-noite UTC, senao o fuso do servidor joga o dia para tras.
function dataPura(v?: string | null): Date | null {
  if (!v) return null;
  return new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`);
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class HomologacoesItensService {
  constructor(private prisma: PrismaService) {}

  // O checklist VISUAL em branco: e daqui que a tela monta os 12 grupos.
  formulario() {
    return CHECKLIST_VISUAL_SQD;
  }

  async listar(ano?: number) {
    const registros = await this.prisma.homologacaoItem.findMany({
      where: { ano: ano ?? undefined },
      orderBy: [{ ano: 'desc' }, { sequencial: 'desc' }],
      include: {
        criadoPor: { select: { id: true, nome: true } },
        _count: { select: { relatorios: true } },
      },
    });
    // "Revisão" e "Nº de Tentativas" sao a mesma coisa na planilha: a revisao
    // do registro e o numero do ultimo relatorio de inspecao.
    return registros.map((h) => ({
      ...h,
      tentativas: h._count.relatorios,
      revisao: String(h._count.relatorios).padStart(2, '0'),
    }));
  }

  async detalhe(id: number) {
    const h = await this.prisma.homologacaoItem.findUnique({
      where: { id },
      include: includeHomologacao,
    });
    if (!h) throw new NotFoundException('Homologação não encontrada');
    return {
      ...h,
      tentativas: h.relatorios.length,
      revisao: String(h.relatorios.length).padStart(2, '0'),
      checklistVisual: CHECKLIST_VISUAL_SQD,
      pendenciasFinalizacao: await this.pendenciasFinalizacao(h),
    };
  }

  private dias(inicio: Date | null, fim: Date | null) {
    if (!inicio || !fim) return null;
    return diasUteisEntre(inicio, fim);
  }

  // O ciclo so fecha quando a homologacao esta completa: item inspecionado,
  // relatorio final anexado e acao registrada.
  //
  // O plano de acao so e cobrado no reprovado, que aqui e o unico caso em que a
  // homologacao depende do fornecedor corrigir alguma coisa e mandar novas
  // amostras. No aprovado ele e opcional e no cancelado nao existe. E o mesmo
  // papel do "aprovado condicionalmente" da homologacao de fornecedores, que
  // nao existe em itens.
  private async pendenciasFinalizacao(h: {
    id: number;
    resultado: string | null;
    acao: string | null;
    statusPlanoAcao: string | null;
  }): Promise<string[]> {
    const faltas: string[] = [];
    if (!h.resultado) faltas.push('o relatório de inspeção do item');

    const anexos = await this.prisma.anexo.findMany({
      where: {
        entidadeId: h.id,
        entidadeTipo: {
          in: [TIPO_ANEXO_RELATORIO_ITEM, TIPO_ANEXO_PLANO_ACAO_ITEM],
        },
      },
      select: { entidadeTipo: true },
    });
    const tem = (tipo: string) => anexos.some((a) => a.entidadeTipo === tipo);

    if (!tem(TIPO_ANEXO_RELATORIO_ITEM)) {
      faltas.push('o relatório final anexado');
    }
    if (!h.acao?.trim()) faltas.push('o campo Ação preenchido');

    if (h.resultado === 'REPROVADO') {
      if (
        h.statusPlanoAcao !== 'FINALIZADO' &&
        h.statusPlanoAcao !== 'NAO_APLICAVEL'
      ) {
        faltas.push(
          'o plano de ação em "Finalizado" ou marcado como "Não aplicável"',
        );
      } else if (
        h.statusPlanoAcao === 'FINALIZADO' &&
        !tem(TIPO_ANEXO_PLANO_ACAO_ITEM)
      ) {
        faltas.push('o plano de ação do fornecedor anexado');
      }
    }
    return faltas;
  }

  // Abertura do registro (FMR.025.01). Ainda nao ha analise: o item acabou de
  // ser solicitado e o registro fica aguardando as amostras do fornecedor.
  async criar(dto: any, usuarioId: number) {
    const dataSolicitacao = dataPura(dto.dataSolicitacao);
    if (!dataSolicitacao) {
      throw new BadRequestException('Informe a data da solicitação.');
    }
    const ano = dataSolicitacao.getUTCFullYear();
    const { semana } = semanaAno(dataSolicitacao);
    const dataEnvioRelatorio = dataPura(dto.dataEnvioRelatorio);

    // Retry: dois registros abertos ao mesmo tempo cairiam no mesmo numero.
    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.homologacaoItem.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.homologacaoItem.create({
          data: {
            numero: numeroSqd('HITE', sequencial, ano),
            ano,
            sequencial,
            semana,
            fornecedorNome: dto.fornecedorNome,
            codigoFornecedor: dto.codigoFornecedor ?? null,
            itemCodigo: dto.itemCodigo ?? null,
            itemDescricao: dto.itemDescricao ?? null,
            solicitante: dto.solicitante ?? null,
            motivo: dto.motivo ?? null,
            custoEvitado: numero(dto.custoEvitado),
            dataSolicitacao,
            dataEnvioRelatorio,
            leadTimeDiasUteis: this.dias(dataSolicitacao, dataEnvioRelatorio),
            observacoes: dto.observacoes ?? null,
            criadoPorId: usuarioId,
          },
        });
        return this.detalhe(criado.id);
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }
    throw new ConflictException(
      'Não foi possível numerar a homologação. Tente salvar novamente.',
    );
  }

  // Relatorio de inspecao (abas AMOSTRAS e VISUAL). Sem tentativa informada,
  // abre uma nova: cada rodada de amostras e um relatorio proprio, sob o mesmo
  // numero do registro, com a revisao igual ao numero da tentativa.
  async salvarRelatorio(id: number, dto: any, usuarioId: number) {
    const atual = await this.prisma.homologacaoItem.findUnique({
      where: { id },
      include: { relatorios: { orderBy: { tentativa: 'asc' } } },
    });
    if (!atual) throw new NotFoundException('Homologação não encontrada');
    if (atual.statusHomologacao === 'CANCELADO') {
      throw new BadRequestException(
        'Esta homologação está cancelada e não aceita relatório de inspeção.',
      );
    }

    const cotas = (dto.cotas ?? []).map((c: CotaItem) => calcularCota(c));
    const checklist: GrupoVisual[] = dto.checklistVisual?.length
      ? dto.checklistVisual
      : checklistVisualInicial();

    // O papel tem os dois campos "RESULTADO" marcados a mao; o calculo entra
    // so como padrao quando a tela nao manda nada.
    const temDesvio = cotas.some(
      (c: CotaItem) => (numero(c.desvioMin) ?? 0) > 0 || (numero(c.desvioMax) ?? 0) > 0,
    );
    const resAmostras =
      dto.resultadoAmostras ?? (temDesvio ? 'REPROVADO' : 'APROVADO');
    const resVisual = dto.resultadoVisual ?? resultadoVisual(checklist);

    const existente = dto.tentativa
      ? atual.relatorios.find((r) => r.tentativa === Number(dto.tentativa))
      : null;
    if (dto.tentativa && !existente) {
      throw new NotFoundException('Tentativa não encontrada');
    }

    const tentativa = existente
      ? existente.tentativa
      : (atual.relatorios.at(-1)?.tentativa ?? 0) + 1;

    const dataInspecao = dataPura(dto.dataInspecao) ?? new Date();

    const dados = {
      revisao: String(tentativa).padStart(2, '0'),
      dataInspecao,
      origem: dto.origem ?? 'HOMOLOGACAO',
      desenhoRev: dto.desenhoRev ?? null,
      tolerancias: dto.tolerancias ?? null,
      nf: dto.nf ?? null,
      po: dto.po ?? null,
      qtdInspecionada: numero(dto.qtdInspecionada),
      qtdTotal: numero(dto.qtdTotal),
      elaboradoPor: dto.elaboradoPor ?? null,
      inspecionadoPor: dto.inspecionadoPor ?? null,
      cotas: cotas as any,
      observacoesAmostras: dto.observacoesAmostras ?? null,
      resultadoAmostras: resAmostras,
      checklistVisual: checklist as any,
      evidenciasVisual: dto.evidenciasVisual ?? null,
      observacoesVisual: dto.observacoesVisual ?? null,
      resultadoVisual: resVisual,
    };

    if (existente) {
      await this.prisma.relatorioInspecaoItem.update({
        where: { id: existente.id },
        data: dados,
      });
    } else {
      await this.prisma.relatorioInspecaoItem.create({
        data: {
          ...dados,
          homologacaoId: id,
          tentativa,
          criadoPorId: usuarioId,
        },
      });
    }

    // O resultado da homologacao sai sempre do relatorio mais recente: o item
    // so e aprovado quando AMOSTRAS e VISUAL sao aprovadas.
    const relatorios = await this.prisma.relatorioInspecaoItem.findMany({
      where: { homologacaoId: id },
      orderBy: { tentativa: 'desc' },
      take: 1,
    });
    const recente = relatorios[0];
    const resultado =
      recente.resultadoAmostras === 'APROVADO' &&
      recente.resultadoVisual === 'APROVADO'
        ? 'APROVADO'
        : 'REPROVADO';

    // A data de retorno do fornecedor e a da primeira inspecao: e quando as
    // amostras chegaram e o relogio do fornecedor parou.
    const dataRetornoFornecedor =
      dataPura(dto.dataRetornoFornecedor) ??
      atual.dataRetornoFornecedor ??
      (tentativa === 1 ? dataInspecao : null);

    await this.prisma.homologacaoItem.update({
      where: { id },
      data: {
        resultado,
        dataRetornoFornecedor,
        tempoRespostaDiasUteis: this.dias(
          atual.dataSolicitacao,
          dataRetornoFornecedor,
        ),
      },
    });
    return this.detalhe(id);
  }

  // Apaga uma tentativa lancada por engano. O resultado volta a sair do
  // relatorio que sobrou (ou fica vazio, se nao sobrar nenhum).
  async removerRelatorio(id: number, tentativa: number) {
    const relatorio = await this.prisma.relatorioInspecaoItem.findFirst({
      where: { homologacaoId: id, tentativa },
    });
    if (!relatorio) throw new NotFoundException('Tentativa não encontrada');

    await this.prisma.relatorioInspecaoItem.delete({
      where: { id: relatorio.id },
    });

    const restantes = await this.prisma.relatorioInspecaoItem.findMany({
      where: { homologacaoId: id },
      orderBy: { tentativa: 'desc' },
      take: 1,
    });
    const recente = restantes[0];
    await this.prisma.homologacaoItem.update({
      where: { id },
      data: {
        resultado: !recente
          ? null
          : recente.resultadoAmostras === 'APROVADO' &&
              recente.resultadoVisual === 'APROVADO'
            ? 'APROVADO'
            : 'REPROVADO',
      },
    });
    return this.detalhe(id);
  }

  async atualizar(id: number, dto: any) {
    const atual = await this.prisma.homologacaoItem.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Homologação não encontrada');

    const dataSolicitacao =
      dto.dataSolicitacao !== undefined
        ? dataPura(dto.dataSolicitacao)
        : atual.dataSolicitacao;
    const dataEnvioRelatorio =
      dto.dataEnvioRelatorio !== undefined
        ? dataPura(dto.dataEnvioRelatorio)
        : atual.dataEnvioRelatorio;
    const dataRetornoFornecedor =
      dto.dataRetornoFornecedor !== undefined
        ? dataPura(dto.dataRetornoFornecedor)
        : atual.dataRetornoFornecedor;

    // Editar o registro nunca e bloqueado: a Qualidade preenche o que tem, no
    // ritmo que consegue. Quem fecha (e cobra o que falta) e a rota finalizar.
    // Por isso o status daqui so vai ate "Em andamento" / "Cancelado".
    const status = dto.statusHomologacao ?? atual.statusHomologacao;
    const dataFinalizacao =
      status === 'FINALIZADO' ? atual.dataFinalizacao : null;

    await this.prisma.homologacaoItem.update({
      where: { id },
      data: {
        fornecedorNome: dto.fornecedorNome ?? undefined,
        codigoFornecedor: dto.codigoFornecedor ?? undefined,
        itemCodigo: dto.itemCodigo ?? undefined,
        itemDescricao: dto.itemDescricao ?? undefined,
        solicitante: dto.solicitante ?? undefined,
        motivo: dto.motivo ?? undefined,
        custoEvitado:
          dto.custoEvitado !== undefined ? numero(dto.custoEvitado) : undefined,
        dataSolicitacao,
        semana: dataSolicitacao ? semanaAno(dataSolicitacao).semana : undefined,
        dataEnvioRelatorio,
        leadTimeDiasUteis: this.dias(dataSolicitacao, dataEnvioRelatorio),
        dataRetornoFornecedor,
        tempoRespostaDiasUteis: this.dias(
          dataSolicitacao,
          dataRetornoFornecedor,
        ),
        dataFinalizacao,
        tempoTotalDiasUteis: this.dias(dataSolicitacao, dataFinalizacao),
        // "Cancelado" e resultado e status ao mesmo tempo: cancelar o registro
        // carimba o resultado, e reabrir devolve o que o relatorio disser.
        resultado:
          dto.statusHomologacao === 'CANCELADO' ? 'CANCELADO' : undefined,
        statusHomologacao: dto.statusHomologacao ?? undefined,
        statusPlanoAcao: dto.statusPlanoAcao ?? undefined,
        dataReavaliacao:
          dto.dataReavaliacao !== undefined
            ? dataPura(dto.dataReavaliacao)
            : undefined,
        efetividadePlanoAcao: dto.efetividadePlanoAcao ?? undefined,
        acao: dto.acao ?? undefined,
        observacoes: dto.observacoes ?? undefined,
      },
    });
    return this.detalhe(id);
  }

  // Encerramento do ciclo. E aqui que mora a trava: se faltar alguma frente, a
  // homologacao nao fecha e a mensagem diz o que falta.
  async finalizar(id: number) {
    const atual = await this.prisma.homologacaoItem.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Homologação não encontrada');
    if (atual.statusHomologacao === 'CANCELADO') {
      throw new BadRequestException(
        'Esta homologação está cancelada. Reabra o registro antes de finalizar.',
      );
    }

    const faltas = await this.pendenciasFinalizacao(atual);
    if (faltas.length) {
      throw new BadRequestException(
        `Ainda falta ${faltas.join(', ')} para finalizar a homologação.`,
      );
    }

    const dataFinalizacao = atual.dataFinalizacao ?? new Date();
    await this.prisma.homologacaoItem.update({
      where: { id },
      data: {
        statusHomologacao: 'FINALIZADO',
        dataFinalizacao,
        tempoTotalDiasUteis: this.dias(atual.dataSolicitacao, dataFinalizacao),
      },
    });
    return this.detalhe(id);
  }

  // Reabre um ciclo fechado por engano: o carimbo do fechamento sai junto.
  async reabrir(id: number) {
    const atual = await this.prisma.homologacaoItem.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Homologação não encontrada');
    await this.prisma.homologacaoItem.update({
      where: { id },
      data: {
        statusHomologacao: 'EM_ANDAMENTO',
        dataFinalizacao: null,
        tempoTotalDiasUteis: null,
      },
    });
    return this.detalhe(id);
  }

  async remover(id: number) {
    const h = await this.prisma.homologacaoItem.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('Homologação não encontrada');

    // Os anexos sao polimorficos (nao tem FK), entao a limpeza e explicita.
    // Os relatorios de inspecao saem em cascata com o registro.
    await this.prisma.anexo.deleteMany({
      where: {
        entidadeId: id,
        entidadeTipo: {
          in: [TIPO_ANEXO_RELATORIO_ITEM, TIPO_ANEXO_PLANO_ACAO_ITEM],
        },
      },
    });
    await this.prisma.homologacaoItem.delete({ where: { id } });
    return { ok: true };
  }
}
