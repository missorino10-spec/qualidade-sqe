import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HistoricoService } from '../../historico/historico.service';
import { numeroDocumento, semanaAno } from '../sqe-utils';
import { proximoSequencial } from '../../comum/numeracao';
import {
  DESVIO,
  dadosAberturaDesvio,
  dadosEncerramentoDesvio,
} from '../../comum/desvio-qualidade';
import type {
  AbrirDesvioDados,
  EncerrarDesvioDados,
} from '../../comum/desvio-qualidade';

const ENTIDADE = 'RNC';

// Data do jeito que o usuario le no formulario. Usada nos comentarios do
// historico, onde o que importa e a data informada e nao a do salvamento.
function dataBr(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// Lead time INTERNO da Qualidade: da abertura da RNC ate o dia em que o
// documento saiu para o fornecedor. E calculado na leitura, nunca gravado -
// assim uma correcao de data corrige o indicador na hora.
function comLeadTimeEnvio<T extends { dataAbertura: Date; dataEnvioFornecedor: Date | null }>(
  rnc: T,
): T & { leadTimeEnvioDias: number | null } {
  const leadTimeEnvioDias = rnc.dataEnvioFornecedor
    ? Math.max(
        0,
        Math.round(
          (rnc.dataEnvioFornecedor.getTime() - rnc.dataAbertura.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;
  return { ...rnc, leadTimeEnvioDias };
}

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
    const sequencial = proximoSequencial('RNC', ultima?.sequencial, ano);
    return { numero: numeroDocumento('RNC', sequencial, ano), ano, sequencial };
  }

  async findAll(filtros: {
    status?: string;
    fornecedorId?: number;
    de?: string;
    ate?: string;
  }) {
    const rncs = await this.prisma.rnc.findMany({
      where: {
        status: filtros.status ? (filtros.status as any) : undefined,
        fornecedorId: filtros.fornecedorId ?? undefined,
        // "Ate" vale o dia inteiro. A RNC guarda hora; parar na meia-noite
        // deixaria de fora tudo que foi aberto no ultimo dia do recorte.
        dataAbertura: {
          gte: filtros.de ? new Date(filtros.de) : undefined,
          lte: filtros.ate
            ? new Date(`${filtros.ate}T23:59:59.999Z`)
            : undefined,
        },
      },
      include: includePadrao,
      orderBy: { dataAbertura: 'desc' },
    });
    return rncs.map(comLeadTimeEnvio);
  }

  async findOne(id: number) {
    const rnc = await this.prisma.rnc.findUnique({
      where: { id },
      // As cotas vem da inspecao vinculada, sem copia: se o dimensional for
      // corrigido depois, a RNC acompanha. Fica so no detalhe - a listagem
      // nao precisa carregar a tabela inteira.
      include: {
        ...includePadrao,
        inspecaoLote: {
          select: { id: true, resultado: true, cotas: true },
        },
      },
    });
    if (!rnc) throw new NotFoundException('RNC não encontrada');
    const historico = await this.historico.listar(ENTIDADE, id);
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: ENTIDADE, entidadeId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { ...comLeadTimeEnvio(rnc), historico, anexos };
  }

  // -------------------------------------------------------------------------
  // REINCIDENCIA
  // E reincidencia quando o MESMO fornecedor repete o MESMO modo de falha no
  // MESMO item. Nao ha janela de tempo: qualquer RNC anterior conta.
  //
  // "Modo de falha" e o que efetivamente reprovou, e nao o texto livre da
  // descricao:
  //   - VISUAL      -> cada item do checklist marcado como REPROVADO;
  //   - DIMENSIONAL -> a localizacao de cada cota fora da tolerancia.
  // O tipo de desvio digitado so entra quando a RNC nao tem inspecao
  // vinculada (RNC aberta a mao), porque nas automaticas ele e um resumo
  // generico ("Dimensional") que casaria com qualquer outra RNC.
  // -------------------------------------------------------------------------

  // Busca o que a comparacao precisa ler das inspecoes vinculadas.
  private readonly includeModos = {
    inspecaoVisual: { select: { checklist: true } },
    inspecaoLote: { select: { cotas: true } },
  };

  // Devolve os modos de falha de uma RNC: chave normalizada -> texto legivel.
  // Normalizar (sem acento, sem caixa, sem espaco duplicado) faz "Rebarba " e
  // "rebarba" contarem como o mesmo modo.
  private modosDeFalha(fonte: any): Map<string, string> {
    const modos = new Map<string, string>();
    const chave = (t: string) =>
      t
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    const add = (prefixo: string, texto: unknown, rotulo: string) => {
      const k = chave(String(texto ?? ''));
      if (k) modos.set(`${prefixo}:${k}`, rotulo);
    };

    const checklist = fonte?.inspecaoVisual?.checklist;
    for (const grupo of Array.isArray(checklist) ? checklist : [])
      for (const item of grupo?.itens ?? [])
        if (item?.status === 'REPROVADO')
          add('VISUAL', item.texto, `Visual: ${item.texto}`);

    const cotas = fonte?.inspecaoLote?.cotas;
    for (const cota of Array.isArray(cotas) ? cotas : [])
      if (cota?.conforme === false)
        add('COTA', cota.localizacao, `Cota ${cota.localizacao}`);

    if (!modos.size)
      for (const parte of String(fonte?.tipoDesvio ?? '').split('|'))
        add('DESVIO', parte, parte.trim());

    return modos;
  }

  // Compara os modos de falha com os das RNCs anteriores do mesmo fornecedor
  // e item. Devolve tambem quais RNCs bateram, para a tela mostrar o porque.
  async analisarReincidencia(candidato: {
    fornecedorId: number;
    itemId: number;
    ignorarRncId?: number;
    tipoDesvio?: string | null;
    inspecaoVisualId?: number | null;
    inspecaoLoteId?: number | null;
  }): Promise<{
    reincidencia: boolean;
    anteriores: { id: number; numero: string; dataAbertura: Date; modos: string[] }[];
  }> {
    const vazio = { reincidencia: false, anteriores: [] };
    if (!candidato.fornecedorId || !candidato.itemId) return vazio;

    const [inspecaoVisual, inspecaoLote] = await Promise.all([
      candidato.inspecaoVisualId
        ? this.prisma.inspecaoVisual.findUnique({
            where: { id: candidato.inspecaoVisualId },
            select: { checklist: true },
          })
        : null,
      candidato.inspecaoLoteId
        ? this.prisma.inspecaoLote.findUnique({
            where: { id: candidato.inspecaoLoteId },
            select: { cotas: true },
          })
        : null,
    ]);
    const modos = this.modosDeFalha({
      tipoDesvio: candidato.tipoDesvio,
      inspecaoVisual,
      inspecaoLote,
    });
    if (!modos.size) return vazio;

    // RNC cancelada foi anulada (abertura indevida), entao nao conta como
    // historico de falha do fornecedor.
    const anteriores = await this.prisma.rnc.findMany({
      where: {
        fornecedorId: candidato.fornecedorId,
        itemId: candidato.itemId,
        status: { not: 'CANCELADA' },
        id: candidato.ignorarRncId ? { not: candidato.ignorarRncId } : undefined,
      },
      select: {
        id: true,
        numero: true,
        dataAbertura: true,
        tipoDesvio: true,
        ...this.includeModos,
      },
      orderBy: { dataAbertura: 'desc' },
    });

    const casaram = anteriores
      .map((a) => {
        const iguais = [...this.modosDeFalha(a).keys()].filter((k) =>
          modos.has(k),
        );
        return {
          id: a.id,
          numero: a.numero,
          dataAbertura: a.dataAbertura,
          modos: iguais.map((k) => modos.get(k) as string),
        };
      })
      .filter((a) => a.modos.length > 0);

    return { reincidencia: casaram.length > 0, anteriores: casaram };
  }

  // Analise de uma RNC ja gravada (usada pela tela, que precisa do motivo).
  async reincidenciaDaRnc(id: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC não encontrada');
    return this.analisarReincidencia({
      fornecedorId: rnc.fornecedorId,
      itemId: rnc.itemId,
      ignorarRncId: rnc.id,
      tipoDesvio: rnc.tipoDesvio,
      inspecaoVisualId: rnc.inspecaoVisualId,
      inspecaoLoteId: rnc.inspecaoLoteId,
    });
  }

  async sugereReincidencia(candidato: {
    fornecedorId: number;
    itemId: number;
    ignorarRncId?: number;
    tipoDesvio?: string | null;
    inspecaoVisualId?: number | null;
    inspecaoLoteId?: number | null;
  }): Promise<boolean> {
    return (await this.analisarReincidencia(candidato)).reincidencia;
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
      (await this.sugereReincidencia({
        fornecedorId: data.fornecedorId,
        itemId,
        tipoDesvio: data.tipoDesvio,
        inspecaoVisualId: data.inspecaoVisualId,
        inspecaoLoteId: data.inspecaoLoteId,
      }));
    // Total informado a mao tem prioridade sobre a conta: ha desvio que nao e
    // quantidade x unitario (frete, retrabalho, lote parcial). Sem total na
    // tela, calcula como sempre.
    const valorTotal =
      data.valorTotal != null
        ? data.valorTotal
        : data.quantidadePecas != null && data.valorUnitario != null
          ? data.quantidadePecas * data.valorUnitario
          : null;

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
    // RNC cancelada e historico encerrado: o desvio que aparecer depois - por
    // exemplo numa correcao que voltou a reprovar a inspecao - merece uma RNC
    // nova, e nao ressuscita a que foi cancelada.
    const existente = data.entregaId
      ? await this.prisma.rnc.findFirst({
          where: { entregaId: data.entregaId, status: { not: 'CANCELADA' } },
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

    const inspecaoVisualId =
      data.inspecaoVisualId ?? existente.inspecaoVisualId;
    const inspecaoLoteId = data.inspecaoLoteId ?? existente.inspecaoLoteId;
    const tipoDesvio = juntar(existente.tipoDesvio, data.tipoDesvio);

    // O segundo formulario traz modos de falha novos, entao a sugestao e
    // refeita. Sempre soma: o que ja apontava reincidencia continua valendo.
    // A palavra final e do usuario, no formulario de encerramento.
    const reincidencia =
      existente.reincidencia ||
      (await this.sugereReincidencia({
        fornecedorId: existente.fornecedorId,
        itemId: existente.itemId,
        ignorarRncId: existente.id,
        tipoDesvio,
        inspecaoVisualId,
        inspecaoLoteId,
      }));

    const atualizada = await this.prisma.rnc.update({
      where: { id: existente.id },
      data: {
        inspecaoVisualId,
        inspecaoLoteId,
        reincidencia,
        tipoDesvio,
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
    if (!rnc) throw new NotFoundException('RNC não encontrada');

    const quantidadePecas = data.quantidadePecas ?? rnc.quantidadePecas;
    const valorUnitario = data.valorUnitario ?? rnc.valorUnitario;
    // Total digitado a mao ganha da conta. A tela sempre manda valorTotal ao
    // editar, entao o valor que aparece la e o que fica gravado.
    const valorTotal =
      data.valorTotal != null
        ? data.valorTotal
        : quantidadePecas != null && valorUnitario != null
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

    // Envio ao fornecedor: a data e carimbada pelo servidor, nao escolhida por
    // quem edita - e o lead time interno da Qualidade e nao pode ser ajustado
    // depois. Marcou como enviada, grava o dia de hoje; desmarcou, a data cai
    // junto para o lead time nao mentir. Data ja gravada nunca muda, e por isso
    // que o dataEnvioFornecedor que vem do formulario e ignorado.
    const enviadaFornecedor = data.enviadaFornecedor ?? rnc.enviadaFornecedor;
    const dataEnvioFornecedor = !enviadaFornecedor
      ? null
      : (rnc.dataEnvioFornecedor ?? new Date());

    const statusAnterior = rnc.status;
    const novoStatus = data.status ?? rnc.status;

    // Eficacia e encerramento andam em pares independentes: cada status manda
    // na sua propria data. Pendente nao pode ter data; verificada exige data.
    const eficacia = data.verificacaoEficacia ?? rnc.verificacaoEficacia;
    // dataVerificacao === null significa "limpar"; ausente significa "manter".
    const dataVerificacao =
      eficacia === 'PENDENTE'
        ? null
        : data.dataVerificacao !== undefined
          ? data.dataVerificacao
            ? new Date(data.dataVerificacao)
            : null
          : rnc.dataVerificacao;
    // So cobra a data quando o usuario mexe na eficacia ou na propria data.
    // Registros antigos, gravados antes desta regra, continuam editaveis.
    const mexeuNaEficacia =
      eficacia !== rnc.verificacaoEficacia || data.dataVerificacao !== undefined;
    if (
      (eficacia === 'APROVADO' || eficacia === 'REPROVADO') &&
      mexeuNaEficacia &&
      !dataVerificacao
    ) {
      throw new BadRequestException(
        'Informe a data da verificação de eficácia.',
      );
    }

    const dataEncerramento =
      novoStatus === 'FINALIZADA'
        ? data.dataEncerramento
          ? new Date(data.dataEncerramento)
          : rnc.dataEncerramento
        : null;
    // So cobra a data no ato de encerrar. RNCs finalizadas antes deste campo
    // existir continuam editaveis sem data.
    if (
      novoStatus === 'FINALIZADA' &&
      statusAnterior !== 'FINALIZADA' &&
      !dataEncerramento
    ) {
      throw new BadRequestException('Informe a data de encerramento da RNC.');
    }

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
        enviadaFornecedor,
        dataEnvioFornecedor,
        fornecedorAceitou: data.fornecedorAceitou ?? rnc.fornecedorAceitou,
        fornecedorEnviouPlano:
          data.fornecedorEnviouPlano ?? rnc.fornecedorEnviouPlano,
        nivelPlano: data.nivelPlano ?? rnc.nivelPlano,
        status: novoStatus,
        dataEncerramento,
        verificacaoEficacia: eficacia,
        dataVerificacao,
        evidencias: data.evidencias ?? rnc.evidencias,
        observacoes: data.observacoes ?? rnc.observacoes,
      },
      include: includePadrao,
    });

    // O envio ao fornecedor e um marco do processo: entra no historico com a
    // data informada, mesmo que o status da RNC nao mude.
    if (enviadaFornecedor && !rnc.enviadaFornecedor && dataEnvioFornecedor) {
      await this.historico.registrar({
        entidadeTipo: ENTIDADE,
        entidadeId: id,
        statusAnterior: 'ENVIO_FORNECEDOR_NAO',
        statusNovo: 'ENVIO_FORNECEDOR_SIM',
        comentario: `Documento enviado ao fornecedor em ${dataBr(dataEnvioFornecedor)}`,
        usuarioId,
      });
    }

    if (novoStatus !== statusAnterior) {
      // A data que vale e a informada pelo usuario, nao a hora em que o
      // registro foi salvo - por isso ela entra no comentario.
      const quando =
        novoStatus === 'FINALIZADA' && dataEncerramento
          ? ` em ${dataBr(dataEncerramento)}`
          : '';
      await this.historico.registrar({
        entidadeTipo: ENTIDADE,
        entidadeId: id,
        statusAnterior,
        statusNovo: novoStatus,
        comentario:
          data.comentario ?? `Status alterado para ${novoStatus}${quando}`,
        usuarioId,
      });
    }

    // Verificar a eficacia e um ato proprio: entra no historico com a data em
    // que a verificacao aconteceu, mesmo que o status da RNC nao mude.
    if (eficacia !== rnc.verificacaoEficacia) {
      const quando = dataVerificacao
        ? `Eficácia verificada em ${dataBr(dataVerificacao)}`
        : 'Verificação de eficácia pendente';
      await this.historico.registrar({
        entidadeTipo: ENTIDADE,
        entidadeId: id,
        statusAnterior: `EFICACIA_${rnc.verificacaoEficacia}`,
        statusNovo: `EFICACIA_${eficacia}`,
        comentario: data.comentario ? `${quando} - ${data.comentario}` : quando,
        usuarioId,
      });
    }
    return atualizada;
  }

  // -------------------------------------------------------------------------
  // DESVIO DE QUALIDADE (concessao). As regras estao em comum/desvio-qualidade,
  // porque a homologacao de itens usa exatamente as mesmas.
  // -------------------------------------------------------------------------
  async abrirDesvio(id: number, dados: AbrirDesvioDados, usuarioId: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC não encontrada');
    const data = await dadosAberturaDesvio(
      this.prisma,
      DESVIO.rnc,
      id,
      dados,
    );
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data,
      include: includePadrao,
    });
    const limite = [
      data.desvioQuantidade != null ? `${data.desvioQuantidade} peça(s)` : null,
      data.desvioPrazoFim ? `até ${dataBr(data.desvioPrazoFim)}` : null,
    ]
      .filter(Boolean)
      .join(' e ');
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: 'DESVIO_NAO',
      statusNovo: 'DESVIO_ABERTO',
      comentario: `Desvio de qualidade aberto em ${dataBr(data.desvioAberturaEm)} (${limite})`,
      usuarioId,
    });
    return atualizada;
  }

  async encerrarDesvio(
    id: number,
    dados: EncerrarDesvioDados,
    usuarioId: number,
  ) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC não encontrada');
    const data = dadosEncerramentoDesvio(rnc, dados);
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data,
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: 'DESVIO_ABERTO',
      statusNovo: 'DESVIO_ENCERRADO',
      comentario: `Desvio de qualidade encerrado em ${dataBr(data.desvioEncerradoEm)}${
        data.desvioEncerramentoObs ? ` - ${data.desvioEncerramentoObs}` : ''
      }`,
      usuarioId,
    });
    return atualizada;
  }

  async mudarStatus(
    id: number,
    novoStatus: string,
    comentario: string | undefined,
    usuarioId: number,
    dataEncerramento?: string,
  ) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC não encontrada');
    // Mesma regra do PATCH: so a RNC finalizada tem data de encerramento, e
    // ela e sempre informada pelo usuario.
    const encerramento =
      novoStatus === 'FINALIZADA'
        ? dataEncerramento
          ? new Date(dataEncerramento)
          : rnc.dataEncerramento
        : null;
    if (novoStatus === 'FINALIZADA' && !encerramento) {
      throw new BadRequestException('Informe a data de encerramento da RNC.');
    }
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: { status: novoStatus as any, dataEncerramento: encerramento },
      include: includePadrao,
    });
    await this.historico.registrar({
      entidadeTipo: ENTIDADE,
      entidadeId: id,
      statusAnterior: rnc.status,
      statusNovo: novoStatus,
      comentario:
        comentario ??
        (novoStatus === 'FINALIZADA' && encerramento
          ? `Encerrada em ${dataBr(encerramento)}`
          : null),
      usuarioId,
    });
    return atualizada;
  }

  // Cancela a RNC (motivo obrigatorio). Sai dos KPIs, permanece na lista.
  // O motivo NAO vai para o historico de status - so aparece ao abrir a RNC.
  async cancelar(id: number, motivo: string, usuarioId: number) {
    const rnc = await this.prisma.rnc.findUnique({ where: { id } });
    if (!rnc) throw new NotFoundException('RNC não encontrada');
    if (!motivo || !motivo.trim())
      throw new BadRequestException('Informe o motivo do cancelamento.');
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: {
        status: 'CANCELADA' as any,
        motivoCancelamento: motivo.trim(),
        dataEncerramento: null,
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
    if (!rnc) throw new NotFoundException('RNC não encontrada');
    const atualizada = await this.prisma.rnc.update({
      where: { id },
      data: {
        status: 'EM_ANDAMENTO' as any,
        motivoCancelamento: null,
        dataEncerramento: null,
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
    if (!rnc) throw new NotFoundException('RNC não encontrada');
    // O documento que autoriza o desvio de qualidade fica em outro
    // entidadeTipo, mas pertence a mesma RNC: sai junto.
    await this.prisma.anexo.deleteMany({
      where: {
        entidadeTipo: { in: [ENTIDADE, DESVIO.rnc] },
        entidadeId: id,
      },
    });
    await this.historico.remover(ENTIDADE, id);
    await this.prisma.rnc.delete({ where: { id } });
    return { ok: true, id };
  }
}
