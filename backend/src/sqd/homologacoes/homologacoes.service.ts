import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { semanaAno } from '../../sqe/sqe-utils';
import {
  BLOCOS_AUTOAVALIACAO,
  CODIGOS_AUTOAVALIACAO,
  RespostaSqd,
  calcularAutoavaliacao,
  diasUteisEntre,
  numeroSqd,
} from '../sqd-utils';

const includeHomologacao = {
  criadoPor: { select: { id: true, nome: true } },
};

// Data "pura" (sem hora): o formulario manda "2026-08-08" e o registro precisa
// guardar meia-noite UTC, senao o fuso do servidor joga o dia para tras.
function dataPura(v?: string | null): Date | null {
  if (!v) return null;
  return new Date(`${String(v).slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class HomologacoesService {
  constructor(private prisma: PrismaService) {}

  // O formulario em branco: e daqui que a tela monta os 10 blocos.
  formulario() {
    return BLOCOS_AUTOAVALIACAO;
  }

  listar(ano?: number) {
    return this.prisma.homologacaoFornecedor.findMany({
      where: { ano: ano ?? undefined },
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
    return { ...h, perguntas: BLOCOS_AUTOAVALIACAO };
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

  private leadTime(solicitacao: Date | null, envio: Date | null) {
    if (!solicitacao || !envio) return null;
    return diasUteisEntre(solicitacao, envio);
  }

  async criar(dto: any, usuarioId: number) {
    const dataAvaliacao = dataPura(dto.dataAvaliacao) ?? new Date();
    const ano = dataAvaliacao.getUTCFullYear();
    const { semana } = semanaAno(dataAvaliacao);

    const respostas = this.normalizarRespostas(dto.respostas);
    const calculo = calcularAutoavaliacao(respostas);

    const dataSolicitacao = dataPura(dto.dataSolicitacao);
    const dataEnvioRelatorio = dataPura(dto.dataEnvioRelatorio);

    // Retry: duas homologacoes salvas ao mesmo tempo cairiam no mesmo numero.
    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.homologacaoFornecedor.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.homologacaoFornecedor.create({
          data: {
            numero: numeroSqd('AUT', sequencial, ano),
            ano,
            sequencial,
            semana,
            fornecedorNome: dto.fornecedorNome,
            cnpj: dto.cnpj ?? null,
            inscricaoEstadual: dto.inscricaoEstadual ?? null,
            responsavelInfo: dto.responsavelInfo ?? null,
            setor: dto.setor ?? null,
            dataAvaliacao,
            respostas,
            blocos: calculo.blocos,
            nota: calculo.nota,
            resultado: calculo.resultado,
            codigoFornecedor: dto.codigoFornecedor ?? null,
            solicitante: dto.solicitante ?? null,
            segmento: dto.segmento ?? null,
            escopoFornecedor: dto.escopoFornecedor ?? null,
            processosTerceirizados: dto.processosTerceirizados ?? null,
            dataSolicitacao,
            dataEnvioRelatorio,
            leadTimeDiasUteis: this.leadTime(dataSolicitacao, dataEnvioRelatorio),
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

  async atualizar(id: number, dto: any) {
    const atual = await this.prisma.homologacaoFornecedor.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Homologação não encontrada');

    // As respostas so sao recalculadas quando a tela reenvia o questionario.
    const recalcular = dto.respostas !== undefined;
    const respostas = recalcular
      ? this.normalizarRespostas(dto.respostas)
      : undefined;
    const calculo = respostas ? calcularAutoavaliacao(respostas) : undefined;

    const dataAvaliacao = dataPura(dto.dataAvaliacao);
    const dataSolicitacao =
      dto.dataSolicitacao !== undefined
        ? dataPura(dto.dataSolicitacao)
        : atual.dataSolicitacao;
    const dataEnvioRelatorio =
      dto.dataEnvioRelatorio !== undefined
        ? dataPura(dto.dataEnvioRelatorio)
        : atual.dataEnvioRelatorio;

    await this.prisma.homologacaoFornecedor.update({
      where: { id },
      data: {
        fornecedorNome: dto.fornecedorNome ?? undefined,
        cnpj: dto.cnpj ?? undefined,
        inscricaoEstadual: dto.inscricaoEstadual ?? undefined,
        responsavelInfo: dto.responsavelInfo ?? undefined,
        setor: dto.setor ?? undefined,
        dataAvaliacao: dataAvaliacao ?? undefined,
        semana: dataAvaliacao ? semanaAno(dataAvaliacao).semana : undefined,
        ...(calculo
          ? {
              respostas: respostas as any,
              blocos: calculo.blocos as any,
              nota: calculo.nota,
              resultado: calculo.resultado,
            }
          : {}),
        codigoFornecedor: dto.codigoFornecedor ?? undefined,
        solicitante: dto.solicitante ?? undefined,
        segmento: dto.segmento ?? undefined,
        escopoFornecedor: dto.escopoFornecedor ?? undefined,
        processosTerceirizados: dto.processosTerceirizados ?? undefined,
        dataSolicitacao,
        dataEnvioRelatorio,
        leadTimeDiasUteis: this.leadTime(dataSolicitacao, dataEnvioRelatorio),
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

  async remover(id: number) {
    const h = await this.prisma.homologacaoFornecedor.findUnique({
      where: { id },
    });
    if (!h) throw new NotFoundException('Homologação não encontrada');

    // Os anexos sao polimorficos (nao tem FK), entao a limpeza e explicita.
    await this.prisma.anexo.deleteMany({
      where: {
        entidadeId: id,
        entidadeTipo: { in: ['HOMOLOGACAO_RELATORIO', 'HOMOLOGACAO_PLANO_ACAO'] },
      },
    });
    await this.prisma.homologacaoFornecedor.delete({ where: { id } });
    return { ok: true };
  }
}
