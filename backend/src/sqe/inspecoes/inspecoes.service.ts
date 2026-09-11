import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RncService } from '../rnc/rnc.service';
import { TIPO_DESVIO } from '../../comum/tipo-desvio';
import {
  numeroDocumento,
  semanaAno,
  semanaReferencia,
} from '../sqe-utils';
import {
  CotaMaxMin,
  calcularCotaMaxMin,
  checklistVisualInicial,
  desenhosExtras,
  resultadoDimensional,
  resultadoVisual,
} from '../../comum/inspecao';

const includeFormulario = {
  fornecedor: { select: { id: true, nome: true, codigo: true } },
  item: { select: { id: true, descricao: true, codigo: true } },
  inspetor: { select: { id: true, nome: true } },
  rncs: { select: { id: true, numero: true, status: true } },
};

// Um recebimento com seus formularios: e assim que a inspecao e lida.
const includeInspecao = {
  fornecedor: {
    select: {
      id: true,
      nome: true,
      codigo: true,
      eventual: true,
      classificacaoFornecimento: true,
    },
  },
  item: { select: { id: true, descricao: true, codigo: true } },
  inspecoesVisual: { include: includeFormulario },
  inspecoesLote: { include: includeFormulario },
  rncs: { select: { id: true, numero: true, status: true } },
};

// "Ate" e o dia inteiro, e nao a meia-noite dele: as datas do SQE carregam
// hora, entao lte no T00:00 jogaria fora tudo o que foi lancado no ultimo dia
// do recorte.
export function fimDoDia(ate: string) {
  return new Date(`${ate}T23:59:59.999Z`);
}

function dentroDoPeriodo(data: any, de?: string, ate?: string) {
  if (!de && !ate) return true;
  if (!data) return false;
  const d = data instanceof Date ? data : new Date(data);
  if (de && d < new Date(de)) return false;
  if (ate && d > fimDoDia(ate)) return false;
  return true;
}

// So o necessario para saber se o recebimento fica sem formulario nenhum
// depois que o rascunho for descartado.
const includeEntregaDoRascunho = {
  inspecoesVisual: { select: { id: true } },
  inspecoesLote: { select: { id: true } },
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

  // ---------------------------------------------------------------- leitura

  // Uma inspecao = um recebimento. Os formularios Visual e Lote do mesmo
  // recebimento aparecem como UMA linha, com o mesmo numero INSP.
  private resumo(e: any) {
    const visual = e.inspecoesVisual?.[0] ?? null;
    const lote = e.inspecoesLote?.[0] ?? null;
    const formularios = [
      visual ? 'VISUAL' : null,
      lote ? 'LOTE' : null,
    ].filter(Boolean) as string[];
    const principal = visual ?? lote;
    // Rascunho e trabalho pela metade: o veredito dele ainda nao vale. A
    // listagem mostra RASCUNHO no lugar de aprovado/reprovado, e so o que ja
    // foi lancado e que forma o resultado do recebimento.
    const lancados = [visual, lote].filter((f) => f && !f.rascunho);
    const rascunho = !lancados.length && formularios.length > 0;
    // Encerrada com desvio apontado e sem RNC continua sendo um APROVADO comum
    // na listagem: o desvio esta registrado dentro do relatorio (cotas e itens
    // reprovados marcados, mais a justificativa), nao no veredito.
    const reprovado = lancados.some((f) => f?.resultado === 'REPROVADO');

    return {
      id: e.id,
      numeroInspecao: e.numeroInspecao,
      inspecaoExtra: e.inspecaoExtra,
      fornecedor: e.fornecedor,
      item: principal?.item ?? e.item ?? null,
      formularios,
      rascunho,
      // Quais formularios ainda estao pela metade. Um recebimento pode ter o
      // Visual ja lancado e o Dimensional em rascunho, entao a tela precisa
      // saber disso formulario a formulario para oferecer "continuar" e
      // "descartar" so em quem cabe.
      rascunhos: [
        visual?.rascunho ? 'VISUAL' : null,
        lote?.rascunho ? 'LOTE' : null,
      ].filter(Boolean) as string[],
      resultado: !formularios.length
        ? 'SEM_INSPECAO'
        : rascunho
          ? 'RASCUNHO'
          : reprovado
            ? 'REPROVADO'
            : 'APROVADO',
      dataInspecao: principal?.dataInspecao ?? e.dataEntrega,
      semana: principal?.semana ?? e.semana,
      ano: principal?.ano ?? e.ano,
      notaFiscal: principal?.notaFiscal ?? e.notaFiscal,
      po: principal?.po ?? e.po,
      qtdTotal: principal?.qtdTotal ?? e.quantidade,
      inspetor: principal?.inspetor ?? null,
      rncs: e.rncs ?? [],
      visualId: visual?.id ?? null,
      loteId: lote?.id ?? null,
      createdAt: e.createdAt,
    };
  }

  // So as inspecoes de fato realizadas. A chegada sem inspecao (fora do ciclo)
  // fica no Registro de Entrada, que e onde ela nasce e onde ela termina.
  //
  // O recorte por data cai sobre a DATA DA INSPECAO, que e a coluna "Data" da
  // tela. Ela nao existe na entrega: mora no formulario, e o resumo escolhe
  // qual dos dois manda. Por isso o filtro roda depois do mapa - filtrar a
  // entrega por dataEntrega deixaria de fora a inspecao feita no mes seguinte
  // ao da chegada, que e justamente a que o inspetor procura.
  async listarTodas(filtros: {
    fornecedorId?: number;
    de?: string;
    ate?: string;
  } = {}) {
    const entregas = await this.prisma.entregaPortaria.findMany({
      where: {
        ...(filtros.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
        OR: [
          { inspecoesVisual: { some: {} } },
          { inspecoesLote: { some: {} } },
        ],
      },
      include: includeInspecao,
      orderBy: { createdAt: 'desc' },
    });
    return entregas
      .map((e) => this.resumo(e))
      .filter((r) => dentroDoPeriodo(r.dataInspecao, filtros.de, filtros.ate));
  }

  // Detalhe da inspecao: o resumo + os formularios COMO FORAM PREENCHIDOS
  // (checklist item a item, cotas, observacoes), aprovada ou reprovada.
  async detalhe(id: number) {
    const e = await this.prisma.entregaPortaria.findUnique({
      where: { id },
      include: includeInspecao,
    });
    if (!e) throw new NotFoundException('Inspeção não encontrada');
    return {
      ...this.resumo(e),
      visual: e.inspecoesVisual?.[0] ?? null,
      lote: e.inspecoesLote?.[0] ?? null,
    };
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
    // Fornecedor eventual nao entra no plano de periodicidade: qualquer
    // inspecao dele e extra e os formularios sao escolhidos na hora.
    const precisaInspecionar =
      !fornecedor.eventual && proximoContador >= frequenciaN;

    return {
      fornecedor: {
        id: fornecedor.id,
        nome: fornecedor.nome,
        codigo: fornecedor.codigo,
        classificacaoFornecimento: fornecedor.classificacaoFornecimento,
        fazVisual: fornecedor.fazVisual,
        fazLote: fornecedor.fazLote,
        eventual: fornecedor.eventual,
      },
      periodicidade: config,
      frequenciaN,
      contadorAtual: fornecedor.contadorEntregas,
      proximoContador,
      precisaInspecionar,
      eventual: fornecedor.eventual,
    };
  }

  // ---------------------------------------------------------------- escrita

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

  // Registra a chegada da carga. E o ponto de partida de tudo: aqui o ciclo de
  // periodicidade avanca e o sistema decide se esta entrega vai ser
  // inspecionada. Fora do ciclo o registro se encerra aqui mesmo; dentro do
  // ciclo (ou por inspecao extra) a tela leva o inspetor para a inspecao, que
  // se prende a esta entrega pelo entregaId.
  async registrarRecebimento(dto: any, usuarioId: number) {
    const fornecedor = await this.prisma.fornecedor.findUniqueOrThrow({
      where: { id: dto.fornecedorId },
    });
    const config = await this.prisma.periodicidadeConfig.findUnique({
      where: { classificacao: fornecedor.classificacaoFornecimento },
    });
    const frequenciaN = config?.frequenciaN ?? 1;
    const novoContador = fornecedor.contadorEntregas + 1;
    // Fornecedor eventual nunca entra no plano: so e inspecionado no extra.
    const noCiclo =
      !fornecedor.eventual && novoContador >= frequenciaN;
    const extra = !noCiclo && !!dto.extra;

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
        passivelInspecao: noCiclo || extra,
        inspecaoExtra: extra,
        confirmadoPorId: usuarioId,
      },
    });

    await this.prisma.fornecedor.update({
      where: { id: fornecedor.id },
      data: {
        totalEntregas: { increment: 1 },
        // A extra zera o ciclo so quando a inspecao e gravada (contabilizar).
        contadorEntregas: noCiclo ? 0 : novoContador,
      },
    });

    return {
      entrega,
      noCiclo,
      extra,
      // A tela usa isso para decidir se encerra aqui ou abre a inspecao.
      irParaInspecao: noCiclo || extra,
    };
  }

  // ------------------------------------------------- registros de entrada

  // Situacao da entrada, do jeito que a lista mostra. Ela sai do que existe de
  // fato (a inspecao foi gravada?) e nao so da intencao registrada na chegada:
  // uma entrada que caiu no ciclo mas cuja inspecao foi abandonada no meio
  // aparece como pendente, nao como inspecionada.
  private situacaoEntrada(e: any) {
    const temInspecao = !!(e.inspecoesVisual?.length || e.inspecoesLote?.length);
    if (temInspecao)
      return e.inspecaoExtra ? 'INSPECAO_EXTRA' : 'INSPECAO_REALIZADA';
    if (e.passivelInspecao || e.inspecaoExtra) return 'INSPECAO_PENDENTE';
    return 'FORA_DO_CICLO';
  }

  async listarEntradas(filtros: {
    fornecedorId?: number;
    de?: string;
    ate?: string;
  } = {}) {
    const entregas = await this.prisma.entregaPortaria.findMany({
      where: {
        ...(filtros.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
        // A entrada e a chegada da carga: o recorte e pela data dela.
        ...(filtros.de || filtros.ate
          ? {
              dataEntrega: {
                gte: filtros.de ? new Date(filtros.de) : undefined,
                lte: filtros.ate ? fimDoDia(filtros.ate) : undefined,
              },
            }
          : {}),
      },
      include: {
        fornecedor: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            classificacaoFornecimento: true,
            eventual: true,
          },
        },
        item: { select: { id: true, codigo: true, descricao: true } },
        confirmadoPor: { select: { id: true, nome: true } },
        inspecoesVisual: { select: { id: true, resultado: true } },
        inspecoesLote: { select: { id: true, resultado: true } },
      },
      orderBy: { dataEntrega: 'desc' },
    });

    return entregas.map((e) => {
      const formularios = [...e.inspecoesVisual, ...e.inspecoesLote];
      return {
        id: e.id,
        dataEntrega: e.dataEntrega,
        semana: e.semana,
        ano: e.ano,
        fornecedor: e.fornecedor,
        item: e.item,
        notaFiscal: e.notaFiscal,
        po: e.po,
        quantidade: e.quantidade,
        numeroEntregaAcumulado: e.numeroEntregaAcumulado,
        situacao: this.situacaoEntrada(e),
        numeroInspecao: e.numeroInspecao,
        resultado: !formularios.length
          ? null
          : formularios.some((f) => f.resultado === 'REPROVADO')
            ? 'REPROVADO'
            : 'APROVADO',
        registradoPor: e.confirmadoPor,
        createdAt: e.createdAt,
      };
    });
  }

  // Correcao do que foi digitado na chegada: nota fiscal trocada, PO errada,
  // data ou quantidade equivocada.
  //
  // O FORNECEDOR NAO SE EDITA. Ele decide a classificacao, a classificacao
  // decide a periodicidade e a periodicidade ja decidiu, no momento do
  // registro, se esta entrega seria inspecionada. Trocar o fornecedor depois
  // reescreveria essa decisao e desencontraria o contador do ciclo. Para
  // corrigir fornecedor, exclui-se a entrada e lanca-se de novo.
  async atualizarEntrada(id: number, dto: any) {
    const atual = await this.prisma.entregaPortaria.findUnique({
      where: { id },
    });
    if (!atual)
      throw new NotFoundException('Registro de entrada não encontrado');

    const dados: any = {
      notaFiscal: dto.notaFiscal ?? null,
      po: dto.po ?? null,
      quantidade: dto.qtdTotal ?? dto.quantidade ?? null,
      itemId: dto.itemId ?? null,
    };

    // A semana e o ano sao derivados da data: se a data muda, eles mudam
    // junto, senao a entrada aparece na semana errada do acompanhamento.
    if (dto.dataEntrega) {
      const data = new Date(dto.dataEntrega);
      const { semana, ano } = semanaAno(data);
      dados.dataEntrega = data;
      dados.semana = semana;
      dados.ano = ano;
      dados.semanaReferencia = semanaReferencia(data);
    }

    await this.prisma.entregaPortaria.update({ where: { id }, data: dados });
    return this.entrada(id);
  }

  // Exclusao da entrada lancada por engano.
  //
  // Duas travas: entrada com inspecao gravada nao sai (levaria embora a
  // inspecao, a RNC e os indicadores), e o contador do ciclo do fornecedor
  // volta atras - senao a proxima entrega dispararia inspecao na hora errada.
  async excluirEntrada(id: number) {
    const e = await this.prisma.entregaPortaria.findUnique({
      where: { id },
      include: {
        inspecoesVisual: { select: { id: true } },
        inspecoesLote: { select: { id: true } },
        rncs: { select: { id: true, numero: true } },
      },
    });
    if (!e) throw new NotFoundException('Registro de entrada não encontrado');

    if (e.inspecoesVisual.length || e.inspecoesLote.length)
      throw new ConflictException(
        `Esta entrada já tem inspeção registrada (${e.numeroInspecao ?? 'em andamento'}). Exclua a inspeção antes de excluir a entrada.`,
      );
    if (e.rncs.length)
      throw new ConflictException(
        `Esta entrada tem a RNC ${e.rncs[0].numero} presa nela. Cancele ou exclua a RNC antes.`,
      );

    await this.prisma.$transaction(async (tx) => {
      await tx.entregaPortaria.delete({ where: { id } });

      // O contador nao volta "menos um": ele volta para o que a ultima entrada
      // que sobrou deixou. Se aquela entrada fechou o ciclo (foi a inspecionada
      // do plano), o contador la ficou zerado e e para zero que ele volta.
      const ultima = await tx.entregaPortaria.findFirst({
        where: { fornecedorId: e.fornecedorId },
        orderBy: { id: 'desc' },
        select: {
          numeroEntregaAcumulado: true,
          passivelInspecao: true,
          inspecaoExtra: true,
        },
      });
      const fechouCiclo =
        !!ultima?.passivelInspecao && !ultima?.inspecaoExtra;
      const contador = !ultima
        ? 0
        : fechouCiclo
          ? 0
          : (ultima.numeroEntregaAcumulado ?? 0);

      await tx.fornecedor.update({
        where: { id: e.fornecedorId },
        data: {
          totalEntregas: { decrement: 1 },
          contadorEntregas: contador,
        },
      });
    });

    return { ok: true };
  }

  // Entrada aberta na tela de inspecao: o cabecalho ja vem preenchido com o
  // que foi informado na chegada, e o inspetor nao redigita nada.
  async entrada(id: number) {
    const e = await this.prisma.entregaPortaria.findUnique({
      where: { id },
      include: {
        fornecedor: true,
        item: { select: { id: true, codigo: true, descricao: true } },
        inspecoesVisual: { select: { id: true } },
        inspecoesLote: { select: { id: true } },
      },
    });
    if (!e) throw new NotFoundException('Registro de entrada não encontrado');
    return {
      id: e.id,
      dataEntrega: e.dataEntrega,
      fornecedor: e.fornecedor,
      item: e.item,
      notaFiscal: e.notaFiscal,
      po: e.po,
      quantidade: e.quantidade,
      passivelInspecao: e.passivelInspecao,
      inspecaoExtra: e.inspecaoExtra,
      numeroInspecao: e.numeroInspecao,
      situacao: this.situacaoEntrada(e),
    };
  }


  // Toda inspecao representa uma carga recebida: cria (ou reaproveita, no
  // encadeamento Visual->Lote) a EntregaPortaria correspondente.
  private async entregaDaInspecao(
    dto: any,
    itemId: number,
    dataInsp: Date,
    usuarioId: number,
  ): Promise<number> {
    // Entrada que ja existe: veio do Registro de Entrada ou do formulario
    // anterior da mesma inspecao. O que o inspetor preencheu agora completa o
    // registro da chegada, que muitas vezes entrou so com o fornecedor.
    if (dto.entregaId) {
      await this.prisma.entregaPortaria.update({
        where: { id: dto.entregaId },
        data: {
          itemId,
          notaFiscal: dto.notaFiscal ?? undefined,
          po: dto.po ?? undefined,
          quantidade: dto.qtdTotal ?? undefined,
        },
      });
      return dto.entregaId;
    }
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
        inspecaoExtra: !!dto.extra,
        confirmadoPorId: usuarioId,
      },
    });
    return entrega.id;
  }

  // Numera o recebimento como inspecao (INSP0001/2026) na primeira vez que um
  // formulario e salvo. Se ja tem numero, mantem: Visual e Lote do mesmo
  // recebimento sao a mesma inspecao e compartilham o numero.
  //
  // O retry existe porque dois inspetores podem salvar ao mesmo tempo e cair
  // no mesmo sequencial; sem ele, um deles perderia o formulario preenchido.
  private async numerarInspecao(entregaId: number, dataInsp: Date) {
    const atual = await this.prisma.entregaPortaria.findUniqueOrThrow({
      where: { id: entregaId },
    });
    if (atual.numeroInspecao) return atual;

    const ano = dataInsp.getFullYear();
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const ultima = await this.prisma.entregaPortaria.findFirst({
        where: { inspecaoAno: ano },
        orderBy: { inspecaoSequencial: 'desc' },
      });
      const sequencial = (ultima?.inspecaoSequencial ?? 0) + 1;
      try {
        return await this.prisma.entregaPortaria.update({
          where: { id: entregaId },
          data: {
            numeroInspecao: numeroDocumento('INSP', sequencial, ano),
            inspecaoAno: ano,
            inspecaoSequencial: sequencial,
          },
        });
      } catch {
        // Numero tomado por outro inspetor no mesmo instante: tenta o proximo.
      }
    }
    throw new ConflictException(
      'Não foi possível numerar a inspeção. Tente salvar novamente.',
    );
  }

  // Estado do recebimento ANTES de salvar este formulario. E o que permite
  // contabilizar a inspecao uma unica vez e reaproveitar a RNC ja aberta.
  private async prepararInspecao(dto: any, usuarioId: number) {
    const itemId = await this.resolverItemId(dto);
    const dataInsp = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const { semana, ano } = semanaAno(dataInsp);
    const entregaJaExistia = !!dto.entregaId;
    const entregaId = await this.entregaDaInspecao(
      dto,
      itemId,
      dataInsp,
      usuarioId,
    );

    const antes = await this.prisma.entregaPortaria.findUniqueOrThrow({
      where: { id: entregaId },
      include: {
        inspecoesVisual: {
          select: { id: true, resultado: true, rascunho: true },
        },
        inspecoesLote: {
          select: { id: true, resultado: true, rascunho: true },
        },
        rncs: { select: { id: true } },
      },
    });
    // Rascunho nao conta como formulario ja feito: ele nao somou no fornecedor
    // nem reprovou nada. Enquanto o recebimento so tem rascunho, o proximo
    // formulario lancado ainda e o primeiro para efeito de contagem.
    const formulariosAntes = [
      ...antes.inspecoesVisual,
      ...antes.inspecoesLote,
    ].filter((f) => !f.rascunho);
    const entrega = await this.numerarInspecao(entregaId, dataInsp);

    return {
      itemId,
      dataInsp,
      semana,
      ano,
      entregaId,
      entrega,
      primeiroFormulario: formulariosAntes.length === 0,
      jaEstavaReprovado: formulariosAntes.some(
        (f) => f.resultado === 'REPROVADO',
      ),
      // Recebimento que ja tem RNC aberta nao volta a perguntar: o desvio novo
      // complementa a RNC que existe, como sempre foi.
      jaTemRnc: antes.rncs.length > 0,
      entregaJaExistia,
    };
  }

  // Contabiliza a inspecao no fornecedor. A unidade e o RECEBIMENTO: um
  // recebimento com Visual + Lote conta UMA inspecao e reprova uma vez so.
  private async contabilizar(opts: {
    fornecedorId: number;
    primeiroFormulario: boolean;
    entregaJaExistia: boolean;
    reprovouAgora: boolean;
    jaEstavaReprovado: boolean;
  }) {
    const primeiro = opts.primeiroFormulario;
    // Entrega vinda da portaria ja foi somada em totalEntregas la.
    const contarEntrega = primeiro && !opts.entregaJaExistia;
    const contarReprova = opts.reprovouAgora && !opts.jaEstavaReprovado;

    await this.prisma.fornecedor.update({
      where: { id: opts.fornecedorId },
      data: {
        totalEntregas: contarEntrega ? { increment: 1 } : undefined,
        totalInspecoes: primeiro ? { increment: 1 } : undefined,
        lotesInspecionados: primeiro ? { increment: 1 } : undefined,
        lotesReprovados: contarReprova ? { increment: 1 } : undefined,
        // Inspecionar zera o ciclo de periodicidade - inclusive na extra.
        contadorEntregas: primeiro ? 0 : undefined,
      },
    });
  }

  // Lancamento de um rascunho: e aqui que o recebimento finalmente conta no
  // fornecedor. Os numeros sao recalculados do estado atual, e nao guardados
  // desde a criacao, porque entre salvar o rascunho e lanca-lo pode ter entrado
  // o outro formulario da mesma inspecao.
  //
  // `numeroEntregaAcumulado` so e preenchido pelo Registro de Entrada: e ele
  // que separa a chegada que ja foi somada em totalEntregas la da entrega que
  // nasceu junto com a inspecao e ainda nao foi somada em lugar nenhum.
  private async contabilizarLancamento(
    entregaId: number,
    fornecedorId: number,
    esteId: number,
    tipo: 'VISUAL' | 'LOTE',
    reprovouAgora: boolean,
  ) {
    const entrega = await this.prisma.entregaPortaria.findUniqueOrThrow({
      where: { id: entregaId },
      include: {
        inspecoesVisual: {
          select: { id: true, resultado: true, rascunho: true },
        },
        inspecoesLote: {
          select: { id: true, resultado: true, rascunho: true },
        },
      },
    });
    const outros = [
      ...entrega.inspecoesVisual.map((f) => ({ ...f, t: 'VISUAL' })),
      ...entrega.inspecoesLote.map((f) => ({ ...f, t: 'LOTE' })),
    ].filter((f) => !(f.t === tipo && f.id === esteId) && !f.rascunho);

    await this.contabilizar({
      fornecedorId,
      primeiroFormulario: outros.length === 0,
      entregaJaExistia: entrega.numeroEntregaAcumulado != null,
      reprovouAgora,
      jaEstavaReprovado: outros.some((f) => f.resultado === 'REPROVADO'),
    });
  }

  // Formulario ja gravado deste recebimento que reprovou e ainda espera a
  // decisao da RNC. Existe porque a decisao e UMA por inspecao, tomada no
  // ultimo formulario: o Visual que reprova numa inspecao Visual + Dimensional
  // fica reprovado, sem RNC, ate o ciclo terminar.
  private async temDesvioPendente(entregaId?: number) {
    if (!entregaId) return false;
    const entrega = await this.prisma.entregaPortaria.findUnique({
      where: { id: entregaId },
      include: {
        inspecoesVisual: { select: { resultado: true, rascunho: true } },
        inspecoesLote: { select: { resultado: true, rascunho: true } },
      },
    });
    return [
      ...(entrega?.inspecoesVisual ?? []),
      ...(entrega?.inspecoesLote ?? []),
    ].some((f) => !f.rascunho && f.resultado === 'REPROVADO');
  }

  // Abrir RNC e decisao do inspetor, tomada na tela antes de gravar. Dizendo
  // NAO, o recebimento encerra APROVADO e as cotas / itens reprovados
  // continuam marcados no relatorio: muda o veredito, nao o que foi medido.
  // Duas travas: a justificativa e obrigatoria (senao o documento nao se
  // explica) e a decisao nao vale se o recebimento ja tem RNC aberta - nesse
  // caso o desvio novo complementa a RNC existente.
  // Roda ANTES de preparar a inspecao: prepararInspecao cria e numera a
  // entrega, entao recusar depois deixaria um INSP orfao na sequencia.
  //
  // O desvio pode estar no formulario anterior e nao neste: Visual reprovado
  // seguido de Dimensional aprovado ainda e uma inspecao com desvio, e a
  // justificativa continua obrigatoria.
  private async exigirJustificativa(dto: any, resultadoApurado: string) {
    if (dto.abrirRnc !== false) return;
    if (String(dto.observacaoDesvio ?? '').trim()) return;
    if (
      resultadoApurado === 'REPROVADO' ||
      (await this.temDesvioPendente(dto.entregaId))
    )
      throw new BadRequestException(
        'Explique por que a inspeção foi encerrada como aprovada mesmo com desvio apontado.',
      );
  }

  // Aplica a decisao do inspetor aos formularios que ficaram esperando.
  //
  // Roda no ultimo formulario do ciclo, depois que ele foi gravado. Os
  // anteriores vieram com `decidirNoFim`: reprovados, sem RNC e sem veredito,
  // porque a pergunta e uma so por recebimento. Aqui os dois formularios
  // terminam com a MESMA resposta - uma RNC unica ou a mesma justificativa.
  private async fecharDecisaoDaInspecao(
    ctx: { entregaId: number; jaTemRnc: boolean },
    dto: any,
    usuarioId: number,
    atual: { visualId?: number; loteId?: number },
  ) {
    const entrega = await this.prisma.entregaPortaria.findUniqueOrThrow({
      where: { id: ctx.entregaId },
      include: { inspecoesVisual: true, inspecoesLote: true },
    });
    // O formulario recem-criado ja resolveu a propria decisao; aqui so entram
    // os que ficaram para tras.
    // Rascunho fica de fora: ele ainda nao tem veredito, entao nao entra na
    // decisao da RNC. Quando for lancado, ele mesmo abre a sua.
    const visuais = entrega.inspecoesVisual.filter(
      (f) => f.id !== atual.visualId && !f.rascunho && f.resultado === 'REPROVADO',
    );
    const lotes = entrega.inspecoesLote.filter(
      (f) => f.id !== atual.loteId && !f.rascunho && f.resultado === 'REPROVADO',
    );
    if (!visuais.length && !lotes.length) return null;

    if (dto.abrirRnc === false && !ctx.jaTemRnc) {
      const dados = {
        resultado: 'APROVADO' as any,
        desvioSemRnc: true,
        observacaoDesvio: String(dto.observacaoDesvio ?? '').trim(),
      };
      if (visuais.length)
        await this.prisma.inspecaoVisual.updateMany({
          where: { id: { in: visuais.map((f) => f.id) } },
          data: dados,
        });
      if (lotes.length)
        await this.prisma.inspecaoLote.updateMany({
          where: { id: { in: lotes.map((f) => f.id) } },
          data: dados,
        });
      return null;
    }

    // Escolheu abrir: os desvios represados entram na mesma RNC do
    // recebimento, cada um com o seu tipo e a sua descricao.
    let rnc: any = null;
    for (const f of visuais) {
      const itens = this.itensReprovados(f.checklist);
      rnc = await this.rnc.abrirOuComplementar(
        {
          entregaId: ctx.entregaId,
          inspecaoVisualId: f.id,
          fornecedorId: f.fornecedorId,
          itemId: f.itemId,
          notaFiscal: f.notaFiscal,
          po: f.po,
          quantidadeLote: f.qtdTotal,
          quantidadePecas: f.qtdTotal,
          tipoDesvio: TIPO_DESVIO.VISUAL,
          descricaoDesvio:
            f.observacoes ||
            (itens.length
              ? `Itens reprovados: ${itens.join('; ')}`
              : 'Não conformidade identificada na inspeção visual.'),
        },
        usuarioId,
      );
    }
    for (const f of lotes) {
      rnc = await this.rnc.abrirOuComplementar(
        {
          entregaId: ctx.entregaId,
          inspecaoLoteId: f.id,
          fornecedorId: f.fornecedorId,
          itemId: f.itemId,
          notaFiscal: f.notaFiscal,
          po: f.po,
          quantidadeLote: f.qtdTotal,
          quantidadePecas: f.qtdTotal,
          tipoDesvio: TIPO_DESVIO.DIMENSIONAL,
          descricaoDesvio:
            f.observacoes ||
            'Não conformidade dimensional identificada na inspeção de lote.',
        },
        usuarioId,
      );
    }
    return rnc;
  }

  private decidirDesvio(
    dto: any,
    ctx: { jaTemRnc: boolean },
    resultadoApurado: string,
  ) {
    const semRnc =
      resultadoApurado === 'REPROVADO' &&
      dto.abrirRnc === false &&
      !ctx.jaTemRnc;
    return {
      semRnc,
      resultado: semRnc ? 'APROVADO' : resultadoApurado,
      desvioSemRnc: semRnc,
      observacaoDesvio: semRnc
        ? String(dto.observacaoDesvio ?? '').trim()
        : null,
    };
  }

  async criarVisual(dto: any, usuarioId: number) {
    const checklist = dto.checklist ?? checklistVisualInicial();
    const apurado = dto.resultado ?? resultadoVisual(checklist);
    // Rascunho e trabalho pela metade: nao se cobra justificativa de desvio
    // nem se decide RNC de uma inspecao que ainda nao terminou.
    const rascunho = dto.rascunho === true;
    if (!rascunho) await this.exigirJustificativa(dto, apurado);

    const ctx = await this.prepararInspecao(dto, usuarioId);
    const desvio = this.decidirDesvio(dto, ctx, apurado);
    const insp = await this.prisma.inspecaoVisual.create({
      data: {
        entregaId: ctx.entregaId,
        fornecedorId: dto.fornecedorId,
        itemId: ctx.itemId,
        dataInspecao: ctx.dataInsp,
        semana: ctx.semana,
        ano: ctx.ano,
        desenhoRev: dto.desenhoRev ?? null,
        desenho: dto.desenho ?? null,
        revisao: dto.revisao ?? null,
        toleranciasNorm: dto.toleranciasNorm ?? null,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        qtdInspecionada: dto.qtdInspecionada ?? null,
        qtdTotal: dto.qtdTotal ?? null,
        // O numero do relatorio E o numero da inspecao: um so numero por
        // recebimento, referenciado pela RNC.
        relatorioNumero: ctx.entrega.numeroInspecao,
        origem: dto.origem ?? 'PLANO_INSPECAO',
        origemOutros: dto.origemOutros ?? null,
        checklist,
        observacoes: dto.observacoes ?? null,
        resultado: desvio.resultado as any,
        desvioSemRnc: desvio.desvioSemRnc,
        observacaoDesvio: desvio.observacaoDesvio,
        rascunho,
        inspetorId: usuarioId,
      },
      include: includeFormulario,
    });

    // Rascunho nao soma no fornecedor nem zera o ciclo de periodicidade: o
    // fornecedor continua devendo inspecao ate o relatorio ser lancado.
    if (rascunho)
      return {
        inspecao: insp,
        numeroInspecao: ctx.entrega.numeroInspecao,
        rnc: null,
      };

    const reprovado = insp.resultado === 'REPROVADO';
    await this.contabilizar({
      fornecedorId: dto.fornecedorId,
      primeiroFormulario: ctx.primeiroFormulario,
      entregaJaExistia: ctx.entregaJaExistia,
      reprovouAgora: reprovado,
      jaEstavaReprovado: ctx.jaEstavaReprovado,
    });

    // `decidirNoFim`: ainda vem outro formulario nesta inspecao, entao o desvio
    // fica gravado como reprovado e espera. Quem abre (ou dispensa) a RNC e o
    // ultimo formulario do ciclo, com a resposta valendo para os dois.
    let rnc: any = null;
    if (reprovado && !dto.decidirNoFim) {
      const itensReprovados = this.itensReprovados(dto.checklist);
      rnc = await this.rnc.abrirOuComplementar(
        {
          entregaId: ctx.entregaId,
          inspecaoVisualId: insp.id,
          fornecedorId: dto.fornecedorId,
          itemId: ctx.itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          // O tipo e so a natureza do desvio (VISUAL / DIMENSIONAL). O que
          // exatamente reprovou vai na descricao: quando os itens reprovados
          // iam para o tipo, a coluna da listagem virava um paragrafo.
          tipoDesvio: TIPO_DESVIO.VISUAL,
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

    const rncPendentes = dto.decidirNoFim
      ? null
      : await this.fecharDecisaoDaInspecao(ctx, dto, usuarioId, {
          visualId: insp.id,
        });

    return {
      inspecao: insp,
      numeroInspecao: ctx.entrega.numeroInspecao,
      // A RNC dos pendentes e a mais recente: ela ja inclui o desvio deste
      // formulario, porque complementou a que acabou de ser aberta.
      rnc: rncPendentes ?? rnc,
    };
  }

  async criarLote(dto: any, usuarioId: number) {
    // O calculo das cotas e refeito aqui: o que a tela mostrou tem que ser
    // exatamente o que vai para o banco e para o PDF.
    const cotas = (dto.cotas ?? []).map((c: CotaMaxMin) => calcularCotaMaxMin(c));
    const apurado = dto.resultado ?? resultadoDimensional(cotas);
    // Ver criarVisual: rascunho nao responde por desvio nem por RNC.
    const rascunho = dto.rascunho === true;
    if (!rascunho) await this.exigirJustificativa(dto, apurado);

    const ctx = await this.prepararInspecao(dto, usuarioId);
    const desvio = this.decidirDesvio(dto, ctx, apurado);
    const insp = await this.prisma.inspecaoLote.create({
      data: {
        entregaId: ctx.entregaId,
        fornecedorId: dto.fornecedorId,
        itemId: ctx.itemId,
        dataInspecao: ctx.dataInsp,
        semana: ctx.semana,
        ano: ctx.ano,
        desenhoRev: dto.desenhoRev ?? null,
        desenho: dto.desenho ?? null,
        revisao: dto.revisao ?? null,
        toleranciasNorm: dto.toleranciasNorm ?? null,
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        qtdInspecionada: dto.qtdInspecionada ?? null,
        qtdTotal: dto.qtdTotal ?? null,
        relatorioNumero: ctx.entrega.numeroInspecao,
        origem: dto.origem ?? 'PLANO_INSPECAO',
        origemOutros: dto.origemOutros ?? null,
        cotas,
        desenhos: desenhosExtras(dto.desenhos) as any,
        observacoes: dto.observacoes ?? null,
        resultado: desvio.resultado as any,
        desvioSemRnc: desvio.desvioSemRnc,
        observacaoDesvio: desvio.observacaoDesvio,
        rascunho,
        inspetorId: usuarioId,
      },
      include: includeFormulario,
    });

    if (rascunho)
      return {
        inspecao: insp,
        numeroInspecao: ctx.entrega.numeroInspecao,
        rnc: null,
      };

    const reprovado = insp.resultado === 'REPROVADO';
    await this.contabilizar({
      fornecedorId: dto.fornecedorId,
      primeiroFormulario: ctx.primeiroFormulario,
      entregaJaExistia: ctx.entregaJaExistia,
      reprovouAgora: reprovado,
      jaEstavaReprovado: ctx.jaEstavaReprovado,
    });

    // Mesma regra do Visual: com formulario pendente na inspecao, a RNC so e
    // decidida no ultimo do ciclo.
    let rnc: any = null;
    if (reprovado && !dto.decidirNoFim) {
      rnc = await this.rnc.abrirOuComplementar(
        {
          entregaId: ctx.entregaId,
          inspecaoLoteId: insp.id,
          fornecedorId: dto.fornecedorId,
          itemId: ctx.itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: TIPO_DESVIO.DIMENSIONAL,
          descricaoDesvio:
            dto.observacoes ||
            'Não conformidade dimensional identificada na inspeção de lote.',
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    const rncPendentes = dto.decidirNoFim
      ? null
      : await this.fecharDecisaoDaInspecao(ctx, dto, usuarioId, {
          loteId: insp.id,
        });

    return {
      inspecao: insp,
      numeroInspecao: ctx.entrega.numeroInspecao,
      rnc: rncPendentes ?? rnc,
    };
  }

  // ----------------------------------------------------------------- edicao

  // Correcao de uma inspecao ja realizada. Nao e reinspecao: aqui se conserta
  // o que foi digitado errado, entao o numero INSP, a entrega e o fornecedor
  // ficam de pe e so o conteudo do formulario e reescrito.
  private camposEditaveis(dto: any, itemId: number, dataInsp: Date) {
    const { semana, ano } = semanaAno(dataInsp);
    return {
      itemId,
      dataInspecao: dataInsp,
      semana,
      ano,
      desenhoRev: dto.desenhoRev ?? null,
      desenho: dto.desenho ?? null,
      revisao: dto.revisao ?? null,
      toleranciasNorm: dto.toleranciasNorm ?? null,
      notaFiscal: dto.notaFiscal ?? null,
      po: dto.po ?? null,
      qtdInspecionada: dto.qtdInspecionada ?? null,
      qtdTotal: dto.qtdTotal ?? null,
      origem: dto.origem ?? 'PLANO_INSPECAO',
      origemOutros: dto.origemOutros ?? null,
      observacoes: dto.observacoes ?? null,
    };
  }

  // Estado da inspecao ANTES da correcao. O veredito que conta e o do
  // RECEBIMENTO inteiro: Visual + Dimensional sao uma inspecao so, e e ela que
  // aparece nos indicadores e que motivou (ou nao) a RNC.
  private async antesDaEdicao(entregaId: number) {
    const entrega = await this.prisma.entregaPortaria.findUniqueOrThrow({
      where: { id: entregaId },
      include: {
        inspecoesVisual: { select: { resultado: true, rascunho: true } },
        inspecoesLote: { select: { resultado: true, rascunho: true } },
        rncs: { select: { id: true, numero: true, status: true } },
      },
    });
    const abertas = entrega.rncs.filter((r) => r.status !== 'CANCELADA');
    return {
      entrega,
      reprovadoAntes: [
        ...entrega.inspecoesVisual,
        ...entrega.inspecoesLote,
      ].some((f) => !f.rascunho && f.resultado === 'REPROVADO'),
      jaTemRnc: abertas.length > 0,
    };
  }

  // Acerta o que a correcao mexeu fora do formulario: o indicador de lotes
  // reprovados do fornecedor e a RNC que nasceu do desvio.
  private async reconciliarEdicao(
    entregaId: number,
    reprovadoAntes: boolean,
    usuarioId: number,
  ) {
    const entrega = await this.prisma.entregaPortaria.findUniqueOrThrow({
      where: { id: entregaId },
      include: {
        inspecoesVisual: { select: { resultado: true, rascunho: true } },
        inspecoesLote: { select: { resultado: true, rascunho: true } },
        rncs: { select: { id: true, numero: true, status: true } },
        fornecedor: { select: { id: true, lotesReprovados: true } },
      },
    });
    const reprovadoAgora = [
      ...entrega.inspecoesVisual,
      ...entrega.inspecoesLote,
    ].some((f) => !f.rascunho && f.resultado === 'REPROVADO');

    if (reprovadoAntes !== reprovadoAgora)
      await this.prisma.fornecedor.update({
        where: { id: entrega.fornecedorId },
        data: {
          lotesReprovados: reprovadoAgora
            ? { increment: 1 }
            : // Nunca abaixo de zero: se o historico ja estava torto, a
              // correcao nao piora a conta do fornecedor.
              { decrement: Math.min(1, entrega.fornecedor.lotesReprovados) },
        },
      });

    // Voltou a ser aprovada: a RNC perde o objeto e e cancelada. O motivo sai
    // pronto, dizendo qual inspecao foi corrigida, por quem e quando.
    const rncsCanceladas: string[] = [];
    if (reprovadoAntes && !reprovadoAgora) {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nome: true },
      });
      const quando = new Date().toLocaleDateString('pt-BR');
      const quem = usuario?.nome ?? 'usuário do sistema';
      for (const r of entrega.rncs) {
        if (r.status === 'CANCELADA') continue;
        await this.rnc.cancelar(
          r.id,
          `Inspeção ${entrega.numeroInspecao ?? ''} corrigida por ${quem} em ${quando}: o resultado voltou para APROVADO e o desvio que originou esta RNC deixou de existir.`,
          usuarioId,
        );
        rncsCanceladas.push(r.numero);
      }
    }
    return { reprovadoAgora, rncsCanceladas };
  }

  // A decisao sobre a RNC ja foi tomada quando a inspecao foi salva. Se a
  // correcao nao traz resposta nova, vale a que estava: sem isso, reabrir e
  // salvar de novo uma inspecao encerrada como "desvio sem RNC" abriria uma
  // RNC do nada, so por ter passado pela tela.
  private decisaoDaEdicao(dto: any, atual: any) {
    return {
      ...dto,
      abrirRnc: dto.abrirRnc ?? (atual.desvioSemRnc ? false : undefined),
      observacaoDesvio: dto.observacaoDesvio ?? atual.observacaoDesvio,
    };
  }

  async editarVisual(id: number, dto: any, usuarioId: number) {
    const atual = await this.prisma.inspecaoVisual.findUnique({
      where: { id },
    });
    if (!atual) throw new NotFoundException('Inspeção não encontrada');
    // Toda inspecao nasce de um registro de entrada; sem ele nao da para
    // reconciliar o veredito do recebimento nem a RNC.
    if (!atual.entregaId)
      throw new BadRequestException(
        'Esta inspeção não tem registro de entrada vinculado e não pode ser corrigida.',
      );
    const entregaId = atual.entregaId;

    const checklist = dto.checklist ?? (atual.checklist as any);
    const apurado = dto.resultado ?? resultadoVisual(checklist);

    // Rascunho que continua rascunho: so o conteudo do formulario e reescrito.
    // Nada de veredito, contabilizacao ou RNC - ele segue fora de tudo ate ser
    // lancado.
    if (atual.rascunho && dto.rascunho === true) {
      const inspecao = await this.prisma.inspecaoVisual.update({
        where: { id },
        data: {
          ...this.camposEditaveis(
            dto,
            await this.resolverItemId({
              ...dto,
              fornecedorId: atual.fornecedorId,
            }),
            dto.dataInspecao ? new Date(dto.dataInspecao) : atual.dataInspecao,
          ),
          checklist,
        },
        include: includeFormulario,
      });
      return { inspecao, rnc: null, reprovadoAgora: false, rncsCanceladas: [] };
    }

    // Lancamento do rascunho: o formulario nasce para o sistema agora. Daqui
    // para a frente ele e uma inspecao normal, entao passa pelas mesmas travas
    // da criacao - justificativa do desvio, contagem no fornecedor e RNC.
    if (atual.rascunho)
      return this.lancarVisual(atual, dto, checklist, apurado, usuarioId);

    const { reprovadoAntes, jaTemRnc } = await this.antesDaEdicao(
      entregaId,
    );
    const decisao = this.decisaoDaEdicao(dto, atual);
    // Encerrar com desvio e sem RNC continua exigindo justificativa: o
    // relatorio corrigido tem que se explicar igual ao original.
    if (apurado === 'REPROVADO' && !jaTemRnc)
      await this.exigirJustificativa(decisao, apurado);

    const desvio = this.decidirDesvio(decisao, { jaTemRnc }, apurado);
    const itemId = await this.resolverItemId({
      ...dto,
      fornecedorId: atual.fornecedorId,
    });
    const dataInsp = dto.dataInspecao
      ? new Date(dto.dataInspecao)
      : atual.dataInspecao;

    const insp = await this.prisma.inspecaoVisual.update({
      where: { id },
      data: {
        ...this.camposEditaveis(dto, itemId, dataInsp),
        checklist,
        resultado: desvio.resultado as any,
        desvioSemRnc: desvio.desvioSemRnc,
        observacaoDesvio: desvio.observacaoDesvio,
      },
      include: includeFormulario,
    });

    // A correcao pode ter criado o desvio que nao existia. Nesse caso a RNC
    // nasce agora, como nasceria se a inspecao tivesse sido salva assim.
    let rnc: any = null;
    if (
      insp.resultado === 'REPROVADO' &&
      !reprovadoAntes &&
      !jaTemRnc &&
      !desvio.semRnc
    ) {
      const itens = this.itensReprovados(checklist);
      rnc = await this.rnc.abrirOuComplementar(
        {
          entregaId: entregaId,
          inspecaoVisualId: insp.id,
          fornecedorId: atual.fornecedorId,
          itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: TIPO_DESVIO.VISUAL,
          descricaoDesvio:
            dto.observacoes ||
            (itens.length
              ? `Itens reprovados: ${itens.join('; ')}`
              : 'Não conformidade identificada na inspeção visual.'),
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    const acerto = await this.reconciliarEdicao(
      entregaId,
      reprovadoAntes,
      usuarioId,
    );
    return { inspecao: insp, rnc, ...acerto };
  }

  async editarLote(id: number, dto: any, usuarioId: number) {
    const atual = await this.prisma.inspecaoLote.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Inspeção não encontrada');
    // Toda inspecao nasce de um registro de entrada; sem ele nao da para
    // reconciliar o veredito do recebimento nem a RNC.
    if (!atual.entregaId)
      throw new BadRequestException(
        'Esta inspeção não tem registro de entrada vinculado e não pode ser corrigida.',
      );
    const entregaId = atual.entregaId;

    const cotas = dto.cotas
      ? dto.cotas.map((c: CotaMaxMin) => calcularCotaMaxMin(c))
      : (atual.cotas as any);
    // Sempre array (nunca null): o campo e Json? e o Prisma cobraria JsonNull.
    const desenhos = desenhosExtras(dto.desenhos ?? atual.desenhos) as any;
    const apurado = dto.resultado ?? resultadoDimensional(cotas);

    // Ver editarVisual: rascunho que continua rascunho so reescreve o
    // formulario, e rascunho que sai do rascunho vira lancamento.
    if (atual.rascunho && dto.rascunho === true) {
      const inspecao = await this.prisma.inspecaoLote.update({
        where: { id },
        data: {
          ...this.camposEditaveis(
            dto,
            await this.resolverItemId({
              ...dto,
              fornecedorId: atual.fornecedorId,
            }),
            dto.dataInspecao ? new Date(dto.dataInspecao) : atual.dataInspecao,
          ),
          cotas,
          desenhos,
        },
        include: includeFormulario,
      });
      return { inspecao, rnc: null, reprovadoAgora: false, rncsCanceladas: [] };
    }

    if (atual.rascunho)
      return this.lancarLote(atual, dto, cotas, desenhos, apurado, usuarioId);

    const { reprovadoAntes, jaTemRnc } = await this.antesDaEdicao(
      entregaId,
    );
    const decisao = this.decisaoDaEdicao(dto, atual);
    if (apurado === 'REPROVADO' && !jaTemRnc)
      await this.exigirJustificativa(decisao, apurado);

    const desvio = this.decidirDesvio(decisao, { jaTemRnc }, apurado);
    const itemId = await this.resolverItemId({
      ...dto,
      fornecedorId: atual.fornecedorId,
    });
    const dataInsp = dto.dataInspecao
      ? new Date(dto.dataInspecao)
      : atual.dataInspecao;

    const insp = await this.prisma.inspecaoLote.update({
      where: { id },
      data: {
        ...this.camposEditaveis(dto, itemId, dataInsp),
        cotas,
        desenhos,
        resultado: desvio.resultado as any,
        desvioSemRnc: desvio.desvioSemRnc,
        observacaoDesvio: desvio.observacaoDesvio,
      },
      include: includeFormulario,
    });

    let rnc: any = null;
    if (
      insp.resultado === 'REPROVADO' &&
      !reprovadoAntes &&
      !jaTemRnc &&
      !desvio.semRnc
    ) {
      rnc = await this.rnc.abrirOuComplementar(
        {
          entregaId: entregaId,
          inspecaoLoteId: insp.id,
          fornecedorId: atual.fornecedorId,
          itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: TIPO_DESVIO.DIMENSIONAL,
          descricaoDesvio:
            dto.observacoes ||
            'Não conformidade dimensional identificada na inspeção de lote.',
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    const acerto = await this.reconciliarEdicao(
      entregaId,
      reprovadoAntes,
      usuarioId,
    );
    return { inspecao: insp, rnc, ...acerto };
  }

  // -------------------------------------------------------------- lancamento

  // Rascunho virando inspecao de verdade. E o mesmo caminho da criacao, so que
  // sobre um formulario que ja existe e ja tem numero: exige a justificativa do
  // desvio, conta no fornecedor e resolve a RNC. Ate esta chamada o rascunho
  // nao existia para nenhum indicador.
  private async lancarVisual(
    atual: any,
    dto: any,
    checklist: any,
    apurado: string,
    usuarioId: number,
  ) {
    const entregaId: number = atual.entregaId;
    // A justificativa olha o recebimento inteiro, entao a entrega precisa ir
    // junto: o dto da tela de correcao nao carrega esse campo.
    await this.exigirJustificativa({ ...dto, entregaId }, apurado);

    const { jaTemRnc } = await this.antesDaEdicao(entregaId);
    const desvio = this.decidirDesvio(dto, { jaTemRnc }, apurado);
    const itemId = await this.resolverItemId({
      ...dto,
      fornecedorId: atual.fornecedorId,
    });
    const dataInsp = dto.dataInspecao
      ? new Date(dto.dataInspecao)
      : atual.dataInspecao;

    const insp = await this.prisma.inspecaoVisual.update({
      where: { id: atual.id },
      data: {
        ...this.camposEditaveis(dto, itemId, dataInsp),
        checklist,
        resultado: desvio.resultado as any,
        desvioSemRnc: desvio.desvioSemRnc,
        observacaoDesvio: desvio.observacaoDesvio,
        rascunho: false,
      },
      include: includeFormulario,
    });

    const reprovado = insp.resultado === 'REPROVADO';
    await this.contabilizarLancamento(
      entregaId,
      atual.fornecedorId,
      insp.id,
      'VISUAL',
      reprovado,
    );

    let rnc: any = null;
    if (reprovado && !dto.decidirNoFim) {
      const itens = this.itensReprovados(checklist);
      rnc = await this.rnc.abrirOuComplementar(
        {
          entregaId,
          inspecaoVisualId: insp.id,
          fornecedorId: atual.fornecedorId,
          itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: TIPO_DESVIO.VISUAL,
          descricaoDesvio:
            dto.observacoes ||
            (itens.length
              ? `Itens reprovados: ${itens.join('; ')}`
              : 'Não conformidade identificada na inspeção visual.'),
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    const rncPendentes = dto.decidirNoFim
      ? null
      : await this.fecharDecisaoDaInspecao(
          { entregaId, jaTemRnc },
          dto,
          usuarioId,
          { visualId: insp.id },
        );

    return {
      inspecao: insp,
      rnc: rncPendentes ?? rnc,
      reprovadoAgora: reprovado,
      rncsCanceladas: [] as string[],
    };
  }

  private async lancarLote(
    atual: any,
    dto: any,
    cotas: any,
    desenhos: any,
    apurado: string,
    usuarioId: number,
  ) {
    const entregaId: number = atual.entregaId;
    await this.exigirJustificativa({ ...dto, entregaId }, apurado);

    const { jaTemRnc } = await this.antesDaEdicao(entregaId);
    const desvio = this.decidirDesvio(dto, { jaTemRnc }, apurado);
    const itemId = await this.resolverItemId({
      ...dto,
      fornecedorId: atual.fornecedorId,
    });
    const dataInsp = dto.dataInspecao
      ? new Date(dto.dataInspecao)
      : atual.dataInspecao;

    const insp = await this.prisma.inspecaoLote.update({
      where: { id: atual.id },
      data: {
        ...this.camposEditaveis(dto, itemId, dataInsp),
        cotas,
        desenhos,
        resultado: desvio.resultado as any,
        desvioSemRnc: desvio.desvioSemRnc,
        observacaoDesvio: desvio.observacaoDesvio,
        rascunho: false,
      },
      include: includeFormulario,
    });

    const reprovado = insp.resultado === 'REPROVADO';
    await this.contabilizarLancamento(
      entregaId,
      atual.fornecedorId,
      insp.id,
      'LOTE',
      reprovado,
    );

    let rnc: any = null;
    if (reprovado && !dto.decidirNoFim) {
      rnc = await this.rnc.abrirOuComplementar(
        {
          entregaId,
          inspecaoLoteId: insp.id,
          fornecedorId: atual.fornecedorId,
          itemId,
          notaFiscal: dto.notaFiscal,
          po: dto.po,
          quantidadeLote: dto.qtdTotal,
          quantidadePecas: dto.qtdTotal,
          tipoDesvio: TIPO_DESVIO.DIMENSIONAL,
          descricaoDesvio:
            dto.observacoes ||
            'Não conformidade dimensional identificada na inspeção de lote.',
          disposicao: dto.disposicao ?? null,
        },
        usuarioId,
      );
    }

    const rncPendentes = dto.decidirNoFim
      ? null
      : await this.fecharDecisaoDaInspecao(
          { entregaId, jaTemRnc },
          dto,
          usuarioId,
          { loteId: insp.id },
        );

    return {
      inspecao: insp,
      rnc: rncPendentes ?? rnc,
      reprovadoAgora: reprovado,
      rncsCanceladas: [] as string[],
    };
  }

  // ---------------------------------------------------------------- descarte

  // Descartar rascunho e diferente da exclusao do ADMIN: aqui nao ha nada a
  // desfazer no fornecedor, porque o rascunho nunca somou. Qualquer um que
  // enxerga o modulo pode descartar - o rascunho e da equipe, nao de quem o
  // abriu.
  async descartarVisual(id: number) {
    const insp = await this.prisma.inspecaoVisual.findUnique({
      where: { id },
      include: { entrega: { include: includeEntregaDoRascunho } },
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    this.exigirRascunho(insp.rascunho);
    await this.prisma.inspecaoVisual.delete({ where: { id } });
    await this.limparEntregaDoRascunho(insp.entrega, id, 'VISUAL');
    return { ok: true };
  }

  async descartarLote(id: number) {
    const insp = await this.prisma.inspecaoLote.findUnique({
      where: { id },
      include: { entrega: { include: includeEntregaDoRascunho } },
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    this.exigirRascunho(insp.rascunho);
    await this.prisma.inspecaoLote.delete({ where: { id } });
    await this.limparEntregaDoRascunho(insp.entrega, id, 'LOTE');
    return { ok: true };
  }

  private exigirRascunho(rascunho: boolean) {
    if (!rascunho)
      throw new ConflictException(
        'Esta inspeção já foi lançada e não pode mais ser descartada.',
      );
  }

  // Sobrou um recebimento sem nenhum formulario. Se ele nasceu junto com a
  // inspecao descartada, vai junto. Se veio do Registro de Entrada, fica: a
  // chegada aconteceu de verdade e continua valendo mesmo sem inspecao.
  private async limparEntregaDoRascunho(
    entrega: any,
    id: number,
    tipo: 'VISUAL' | 'LOTE',
  ) {
    if (!entrega || entrega.numeroEntregaAcumulado != null) return;
    const restantes = [
      ...entrega.inspecoesVisual.filter(
        (f: any) => !(tipo === 'VISUAL' && f.id === id),
      ),
      ...entrega.inspecoesLote.filter(
        (f: any) => !(tipo === 'LOTE' && f.id === id),
      ),
    ];
    if (restantes.length) return;
    await this.prisma.entregaPortaria
      .delete({ where: { id: entrega.id } })
      .catch(() => undefined);
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

  // ---------------------------------------------------------------- exclusao

  // Exclusao de formulario (restrito a ADMIN no controller).
  // Se houver RNC vinculada e cascade=false, bloqueia e retorna a RNC.
  async deletarVisual(id: number, cascade: boolean) {
    const insp = await this.prisma.inspecaoVisual.findUnique({
      where: { id },
      include: {
        rncs: { select: { id: true, numero: true } },
        entrega: {
          include: {
            inspecoesVisual: { select: { id: true, resultado: true } },
            inspecoesLote: { select: { id: true, resultado: true } },
          },
        },
      },
    });
    if (!insp) throw new ConflictException('Inspeção não encontrada');
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
            inspecoesVisual: { select: { id: true, resultado: true } },
            inspecoesLote: { select: { id: true, resultado: true } },
          },
        },
      },
    });
    if (!insp) throw new ConflictException('Inspeção não encontrada');
    await this.removerRncsVinculadas(insp.rncs, cascade);
    await this.prisma.inspecaoLote.delete({ where: { id } });
    await this.reverterInspecao(insp, 'LOTE');
    return { ok: true };
  }

  // Desfaz a contabilizacao do recebimento. Se o formulario apagado era o
  // ultimo, o recebimento deixa de ser uma inspecao e e removido - assim uma
  // inspecao excluida por engano nao vira "recebimento sem inspecao" fantasma.
  private async reverterInspecao(insp: any, tipo: 'VISUAL' | 'LOTE') {
    const entrega = insp.entrega;
    const restantes = [
      ...(entrega?.inspecoesVisual ?? []).filter(
        (v: any) => !(tipo === 'VISUAL' && v.id === insp.id),
      ),
      ...(entrega?.inspecoesLote ?? []).filter(
        (l: any) => !(tipo === 'LOTE' && l.id === insp.id),
      ),
    ];
    const eraUltimoFormulario = restantes.length === 0;
    const aindaReprovado = restantes.some(
      (f: any) => f.resultado === 'REPROVADO',
    );
    const perdeuReprova = insp.resultado === 'REPROVADO' && !aindaReprovado;

    const f = await this.prisma.fornecedor.findUnique({
      where: { id: insp.fornecedorId },
    });
    if (f) {
      await this.prisma.fornecedor.update({
        where: { id: insp.fornecedorId },
        data: {
          totalEntregas: eraUltimoFormulario
            ? Math.max(0, f.totalEntregas - 1)
            : undefined,
          totalInspecoes: eraUltimoFormulario
            ? Math.max(0, f.totalInspecoes - 1)
            : undefined,
          lotesInspecionados: eraUltimoFormulario
            ? Math.max(0, f.lotesInspecionados - 1)
            : undefined,
          lotesReprovados: perdeuReprova
            ? Math.max(0, f.lotesReprovados - 1)
            : undefined,
        },
      });
    }

    if (entrega && eraUltimoFormulario) {
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
        message: 'Existe RNC vinculada a esta inspeção.',
        rncs,
      });
    }
    for (const r of rncs) {
      await this.rnc.remover(r.id);
    }
  }
}
