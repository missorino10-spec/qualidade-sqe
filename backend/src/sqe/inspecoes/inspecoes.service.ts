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
    // Encerrada com desvio apontado e sem RNC continua sendo um APROVADO comum
    // na listagem: o desvio esta registrado dentro do relatorio (cotas e itens
    // reprovados marcados, mais a justificativa), nao no veredito.
    const reprovado = [visual, lote].some((f) => f?.resultado === 'REPROVADO');

    return {
      id: e.id,
      numeroInspecao: e.numeroInspecao,
      inspecaoExtra: e.inspecaoExtra,
      fornecedor: e.fornecedor,
      item: principal?.item ?? e.item ?? null,
      formularios,
      resultado: !formularios.length
        ? 'SEM_INSPECAO'
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

  async listarTodas(fornecedorId?: number) {
    const entregas = await this.prisma.entregaPortaria.findMany({
      where: fornecedorId ? { fornecedorId } : {},
      include: includeInspecao,
      orderBy: { createdAt: 'desc' },
    });
    return entregas.map((e) => this.resumo(e));
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

  // Toda inspecao representa uma carga recebida: cria (ou reaproveita, no
  // encadeamento Visual->Lote) a EntregaPortaria correspondente.
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
        inspecoesVisual: { select: { id: true, resultado: true } },
        inspecoesLote: { select: { id: true, resultado: true } },
        rncs: { select: { id: true } },
      },
    });
    const formulariosAntes = [
      ...antes.inspecoesVisual,
      ...antes.inspecoesLote,
    ];
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

  // Formulario ja gravado deste recebimento que reprovou e ainda espera a
  // decisao da RNC. Existe porque a decisao e UMA por inspecao, tomada no
  // ultimo formulario: o Visual que reprova numa inspecao Visual + Dimensional
  // fica reprovado, sem RNC, ate o ciclo terminar.
  private async temDesvioPendente(entregaId?: number) {
    if (!entregaId) return false;
    const entrega = await this.prisma.entregaPortaria.findUnique({
      where: { id: entregaId },
      include: {
        inspecoesVisual: { select: { resultado: true } },
        inspecoesLote: { select: { resultado: true } },
      },
    });
    return [
      ...(entrega?.inspecoesVisual ?? []),
      ...(entrega?.inspecoesLote ?? []),
    ].some((f) => f.resultado === 'REPROVADO');
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
    const visuais = entrega.inspecoesVisual.filter(
      (f) => f.id !== atual.visualId && f.resultado === 'REPROVADO',
    );
    const lotes = entrega.inspecoesLote.filter(
      (f) => f.id !== atual.loteId && f.resultado === 'REPROVADO',
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
    await this.exigirJustificativa(dto, apurado);

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
        inspetorId: usuarioId,
      },
      include: includeFormulario,
    });

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
    await this.exigirJustificativa(dto, apurado);

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
        observacoes: dto.observacoes ?? null,
        resultado: desvio.resultado as any,
        desvioSemRnc: desvio.desvioSemRnc,
        observacaoDesvio: desvio.observacaoDesvio,
        inspetorId: usuarioId,
      },
      include: includeFormulario,
    });

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
