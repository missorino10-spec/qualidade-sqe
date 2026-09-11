import { fraseFaltas } from '../../comum/pendencias';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { semanaAno } from '../../sqe/sqe-utils';
import { diasUteisEntre } from '../../comum/dias-uteis';
import { FeriadosService } from '../../feriados/feriados.service';
import {
  BLOCOS_AUTOAVALIACAO,
  CODIGOS_AUTOAVALIACAO,
  RespostaSqd,
  calcularAutoavaliacao,
  numeroSqd,
} from '../sqd-utils';

const includeHomologacao = {
  criadoPor: { select: { id: true, nome: true } },
};

export const TIPO_ANEXO_RELATORIO = 'HOMOLOGACAO_RELATORIO';
export const TIPO_ANEXO_PLANO_ACAO = 'HOMOLOGACAO_PLANO_ACAO';

// Data "pura" (sem hora): o formulario manda "2026-08-08" e o registro precisa
// guardar meia-noite UTC, senao o fuso do servidor joga o dia para tras.
function dataPura(v?: string | null): Date | null {
  if (!v) return null;
  return new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class HomologacoesService {
  constructor(
    private prisma: PrismaService,
    private feriados: FeriadosService,
  ) {}

  // O formulario em branco: e daqui que a tela monta os 10 blocos.
  formulario() {
    return BLOCOS_AUTOAVALIACAO;
  }

  // O recorte de periodo e pela DATA DA SOLICITACAO: e ela que numera o
  // registro e e o marco zero dos prazos. Recortar pela finalizacao tiraria da
  // lista justamente o que ainda esta aguardando o fornecedor.
  listar(ano?: number, de?: string, ate?: string) {
    return this.prisma.homologacaoFornecedor.findMany({
      where: {
        ano: ano ?? undefined,
        dataSolicitacao:
          de || ate
            ? {
                gte: de ? new Date(`${de}T00:00:00.000Z`) : undefined,
                lte: ate ? new Date(`${ate}T23:59:59.999Z`) : undefined,
              }
            : undefined,
      },
      orderBy: [{ ano: 'desc' }, { sequencial: 'desc' }],
      include: includeHomologacao,
    });
  }

  async detalhe(id: number) {
    const h = await this.prisma.homologacaoFornecedor.findUnique({
      where: { id },
      include: includeHomologacao,
    });
    if (!h) throw new NotFoundException('Homologação não encontrada');
    return {
      ...h,
      perguntas: BLOCOS_AUTOAVALIACAO,
      pendenciasFinalizacao: await this.pendenciasFinalizacao(h),
    };
  }

  // Normaliza as respostas: toda pergunta do catalogo entra no registro, o que
  // nao veio preenchido fica como "NAO" (mesmo efeito da celula vazia).
  private normalizarRespostas(
    entrada: Record<string, string> | undefined,
  ): Record<string, RespostaSqd> {
    const saida: Record<string, RespostaSqd> = {};
    for (const codigo of CODIGOS_AUTOAVALIACAO) {
      const r = entrada?.[codigo];
      saida[codigo] = r === 'SIM' || r === 'NA' ? r : 'NAO';
    }
    return saida;
  }

  // Dias uteis entre duas datas, ja descontando o calendario de feriados.
  private async dias(inicio: Date | null, fim: Date | null) {
    if (!inicio || !fim) return null;
    return diasUteisEntre(inicio, fim, await this.feriados.conjunto());
  }

  // O ciclo so fecha quando a homologacao esta completa: fornecedor avaliado,
  // relatorio final anexado e acao registrada.
  //
  // O plano de acao do fornecedor NAO entra nessa conta. Ele continua no
  // registro, com status e anexo proprios, mas quem decide se ele e necessario
  // e a Qualidade - e no campo Acao que essa decisao fica escrita. Cobra-lo
  // travava o encerramento de registro que ja estava resolvido por outro
  // caminho (troca de fornecedor, acao interna, item descontinuado).
  private async pendenciasFinalizacao(h: {
    id: number;
    resultado: string | null;
    acao: string | null;
  }): Promise<string[]> {
    const faltas: string[] = [];
    if (!h.resultado) faltas.push('a autoavaliação do fornecedor');

    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeId: h.id, entidadeTipo: TIPO_ANEXO_RELATORIO },
      select: { id: true },
    });

    if (!anexos.length) faltas.push('o relatório final anexado');
    if (!h.acao?.trim()) faltas.push('o campo Ação preenchido');

    return faltas;
  }

  // Abertura do registro (FMR.029.01). Ainda nao ha avaliacao: o fornecedor
  // acabou de receber o formulario e o registro fica aguardando o retorno.
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
      const ultimo = await this.prisma.homologacaoFornecedor.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.homologacaoFornecedor.create({
          data: {
            numero: numeroSqd('HFOR', sequencial, ano),
            ano,
            sequencial,
            semana,
            fornecedorNome: dto.fornecedorNome,
            cnpj: dto.cnpj ?? null,
            inscricaoEstadual: dto.inscricaoEstadual ?? null,
            responsavelInfo: dto.responsavelInfo ?? null,
            setor: dto.setor ?? null,
            codigoFornecedor: dto.codigoFornecedor ?? null,
            solicitante: dto.solicitante ?? null,
            segmento: dto.segmento ?? null,
            escopoFornecedor: dto.escopoFornecedor ?? null,
            processosTerceirizados: dto.processosTerceirizados ?? null,
            dataSolicitacao,
            dataEnvioRelatorio,
            leadTimeDiasUteis: await this.dias(dataSolicitacao, dataEnvioRelatorio),
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

  // Lancamento da autoavaliacao devolvida pelo fornecedor (FMR.024.03). E aqui
  // que sai a nota, o resultado e o tempo de resposta do fornecedor.
  async lancarAutoavaliacao(id: number, dto: any) {
    const atual = await this.prisma.homologacaoFornecedor.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Homologação não encontrada');
    if (atual.statusHomologacao === 'CANCELADO') {
      throw new BadRequestException(
        'Esta homologação está cancelada e não aceita avaliação.',
      );
    }

    const respostas = this.normalizarRespostas(dto.respostas);
    const calculo = calcularAutoavaliacao(respostas);

    // A data do retorno e a data em que o fornecedor devolveu o formulario;
    // por padrao, a propria data da avaliacao lancada pela Qualidade.
    const dataAvaliacao = dataPura(dto.dataAvaliacao) ?? new Date();
    const dataRetornoFornecedor =
      dataPura(dto.dataRetornoFornecedor) ?? dataAvaliacao;

    await this.prisma.homologacaoFornecedor.update({
      where: { id },
      data: {
        fornecedorNome: dto.fornecedorNome ?? undefined,
        cnpj: dto.cnpj ?? undefined,
        inscricaoEstadual: dto.inscricaoEstadual ?? undefined,
        responsavelInfo: dto.responsavelInfo ?? undefined,
        setor: dto.setor ?? undefined,
        dataAvaliacao,
        dataRetornoFornecedor,
        tempoRespostaDiasUteis: await this.dias(
          atual.dataSolicitacao,
          dataRetornoFornecedor,
        ),
        respostas: respostas as any,
        blocos: calculo.blocos as any,
        nota: calculo.nota,
        resultado: calculo.resultado,
      },
    });
    return this.detalhe(id);
  }

  async atualizar(id: number, dto: any) {
    const atual = await this.prisma.homologacaoFornecedor.findUnique({
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

    await this.prisma.homologacaoFornecedor.update({
      where: { id },
      data: {
        fornecedorNome: dto.fornecedorNome ?? undefined,
        cnpj: dto.cnpj ?? undefined,
        inscricaoEstadual: dto.inscricaoEstadual ?? undefined,
        responsavelInfo: dto.responsavelInfo ?? undefined,
        setor: dto.setor ?? undefined,
        codigoFornecedor: dto.codigoFornecedor ?? undefined,
        solicitante: dto.solicitante ?? undefined,
        segmento: dto.segmento ?? undefined,
        escopoFornecedor: dto.escopoFornecedor ?? undefined,
        processosTerceirizados: dto.processosTerceirizados ?? undefined,
        dataSolicitacao,
        semana: dataSolicitacao ? semanaAno(dataSolicitacao).semana : undefined,
        dataEnvioRelatorio,
        leadTimeDiasUteis: await this.dias(dataSolicitacao, dataEnvioRelatorio),
        dataRetornoFornecedor,
        tempoRespostaDiasUteis: await this.dias(
          dataSolicitacao,
          dataRetornoFornecedor,
        ),
        dataFinalizacao,
        tempoTotalDiasUteis: await this.dias(dataSolicitacao, dataFinalizacao),
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
    const atual = await this.prisma.homologacaoFornecedor.findUnique({
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
        `${fraseFaltas(faltas)} para finalizar a homologação.`,
      );
    }

    const dataFinalizacao = atual.dataFinalizacao ?? new Date();
    await this.prisma.homologacaoFornecedor.update({
      where: { id },
      data: {
        statusHomologacao: 'FINALIZADO',
        dataFinalizacao,
        tempoTotalDiasUteis: await this.dias(atual.dataSolicitacao, dataFinalizacao),
      },
    });
    return this.detalhe(id);
  }

  // Reabre um ciclo fechado por engano: o carimbo do fechamento sai junto.
  async reabrir(id: number) {
    const atual = await this.prisma.homologacaoFornecedor.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Homologação não encontrada');
    await this.prisma.homologacaoFornecedor.update({
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
    const h = await this.prisma.homologacaoFornecedor.findUnique({
      where: { id },
    });
    if (!h) throw new NotFoundException('Homologação não encontrada');

    // Os anexos sao polimorficos (nao tem FK), entao a limpeza e explicita.
    await this.prisma.anexo.deleteMany({
      where: {
        entidadeId: id,
        entidadeTipo: { in: [TIPO_ANEXO_RELATORIO, TIPO_ANEXO_PLANO_ACAO] },
      },
    });
    await this.prisma.homologacaoFornecedor.delete({ where: { id } });
    return { ok: true };
  }
}
