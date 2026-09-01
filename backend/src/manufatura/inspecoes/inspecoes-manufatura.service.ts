import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { semanaAno } from '../../sqe/sqe-utils';
import { numeroManufatura, statusPorResultado } from '../manufatura-utils';
import {
  CotaMaxMin,
  calcularCotaMaxMin,
  desenhosExtras,
  resultadoDimensional,
} from '../../comum/inspecao';

const includeInspecao = {
  maquina: { select: { id: true, codigo: true, nome: true, area: true } },
  inspetor: { select: { id: true, nome: true } },
  relatorios: {
    orderBy: { tentativa: 'asc' as const },
    include: { inspetor: { select: { id: true, nome: true } } },
  },
  oitoDs: { select: { id: true, numero: true, status: true } },
  cincoGs: { select: { id: true, numero: true, status: true } },
  setup: { select: { id: true, numero: true } },
};

@Injectable()
export class InspecoesManufaturaService {
  constructor(private prisma: PrismaService) {}

  listar(tipo?: string, maquinaId?: number) {
    return this.prisma.inspecaoManufatura.findMany({
      where: {
        tipo: tipo ? (tipo as any) : undefined,
        maquinaId: maquinaId ?? undefined,
      },
      orderBy: { dataInspecao: 'desc' },
      include: includeInspecao,
    });
  }

  async detalhe(id: number) {
    const insp = await this.prisma.inspecaoManufatura.findUnique({
      where: { id },
      include: includeInspecao,
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    return insp;
  }

  // Setups da maquina ainda sem inspecao de producao vinculada: e a lista que
  // a tela de producao oferece para amarrar a producao ao setup que a liberou.
  setupsDisponiveis(maquinaId: number) {
    return this.prisma.inspecaoManufatura.findMany({
      where: { tipo: 'SETUP', maquinaId },
      orderBy: { dataInspecao: 'desc' },
      take: 20,
      select: {
        id: true,
        numero: true,
        dataInspecao: true,
        status: true,
        itemCodigo: true,
        itemDescricao: true,
      },
    });
  }

  // ---------------------------------------------------------------- escrita

  // Numera o relatorio na serie do tipo (SET0001/2026 ou PROD0001/2026).
  // O retry existe porque dois inspetores podem salvar ao mesmo tempo e cair
  // no mesmo sequencial; sem ele, um deles perderia o formulario preenchido.
  private async criarRelatorio(
    inspecaoId: number,
    tipo: 'SETUP' | 'PRODUCAO',
    tentativa: number,
    dto: any,
    usuarioId: number,
  ) {
    const data = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const ano = data.getFullYear();
    const prefixo = tipo === 'SETUP' ? 'SET' : 'PROD';
    // O calculo das cotas e refeito aqui: o que a tela mostrou tem que ser
    // exatamente o que vai para o banco e para o PDF.
    const cotas = (dto.cotas ?? []).map((c: CotaMaxMin) => calcularCotaMaxMin(c));

    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.relatorioDimensional.findFirst({
        where: { tipo, ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        return await this.prisma.relatorioDimensional.create({
          data: {
            inspecaoId,
            tipo,
            numero: numeroManufatura(prefixo, sequencial, ano),
            ano,
            sequencial,
            tentativa,
            revisao: dto.revisao ?? '01',
            dataInspecao: data,
            origem: dto.origem ?? 'LIBERACAO_SETUP',
            origemOutros: dto.origemOutros ?? null,
            itemCodigo: dto.itemCodigo ?? null,
            itemDescricao: dto.itemDescricao ?? null,
            desenhoRev: dto.desenhoRev ?? null,
            desenho: dto.desenho ?? null,
            desenhoRevisao: dto.desenhoRevisao ?? null,
            po: dto.po ?? null,
            qtdInspecionada: dto.qtdInspecionada ?? null,
            qtdTotal: dto.qtdTotal ?? null,
            toleranciasNorm: dto.toleranciasNorm ?? null,
            cotas,
            // Sempre array (nunca null): o campo e Json? e o Prisma cobraria
            // JsonNull no lugar de null.
            desenhos: desenhosExtras(dto.desenhos) as any,
            inspecaoVisual: dto.inspecaoVisual ?? null,
            observacoesFinais: dto.observacoesFinais ?? null,
            resultado: dto.resultado ?? resultadoDimensional(cotas),
            observacaoResultado: dto.observacaoResultado ?? null,
            defeitos: dto.defeitos ?? undefined,
            qtdAfetada: dto.qtdAfetada ?? null,
            descricaoDesvio: dto.descricaoDesvio ?? null,
            // Relatorio salvo pela metade. O numero ja e consumido aqui, para
            // o documento nascer com a identificacao que vai levar ate o fim,
            // mas ele nao conta na maquina nem nos indicadores ate ser lancado.
            rascunho: dto.rascunho === true,
            // Elaborado/inspecionado por saiu do formulario: quem assina e o
            // usuario logado, gravado em inspetorId. As colunas de texto ficam
            // vazias e sobrevivem so pelos relatorios antigos.
            inspetorId: usuarioId,
          },
        });
      } catch {
        // Numero tomado por outro inspetor no mesmo instante: tenta o proximo.
      }
    }
    throw new ConflictException(
      'Não foi possível numerar o relatório. Tente salvar novamente.',
    );
  }

  // Abre a inspecao (setup ou producao) com o primeiro relatorio dimensional.
  async criar(tipo: 'SETUP' | 'PRODUCAO', dto: any, usuarioId: number) {
    const maquina = await this.prisma.maquina.findUnique({
      where: { id: dto.maquinaId },
    });
    if (!maquina) throw new NotFoundException('Máquina não encontrada');

    const data = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const { semana, ano } = semanaAno(data);

    const inspecao = await this.prisma.inspecaoManufatura.create({
      data: {
        tipo,
        numero: `TEMP-${Date.now()}`,
        maquinaId: dto.maquinaId,
        itemCodigo: dto.itemCodigo ?? null,
        itemDescricao: dto.itemDescricao ?? null,
        po: dto.po ?? null,
        setupId: tipo === 'PRODUCAO' ? (dto.setupId ?? null) : null,
        status: 'PENDENTE',
        dataInspecao: data,
        semana,
        ano,
        inspetorId: usuarioId,
      },
    });

    const relatorio = await this.criarRelatorio(
      inspecao.id,
      tipo,
      1,
      dto,
      usuarioId,
    );

    // O numero da inspecao e o do primeiro relatorio: as reinspecoes ganham
    // numeros novos na mesma serie, mas ficam dentro desta mesma inspecao.
    // Rascunho fica PENDENTE: o veredito dele ainda nao vale, entao a maquina
    // nao soma setup/producao nem reprova enquanto ele nao for lancado.
    await this.prisma.inspecaoManufatura.update({
      where: { id: inspecao.id },
      data: {
        numero: relatorio.numero,
        status: relatorio.rascunho
          ? 'PENDENTE'
          : statusPorResultado(relatorio.resultado),
      },
    });

    if (!relatorio.rascunho)
      await this.contabilizar(maquina.id, tipo, relatorio.resultado);
    return this.detalhe(inspecao.id);
  }

  // Reinspecao: novo relatorio completo, com numero proprio, dentro da mesma
  // inspecao. Nao ha limite de tentativas; a inspecao so sai de PENDENTE
  // quando a ULTIMA tentativa e aprovada.
  async reinspecionar(inspecaoId: number, dto: any, usuarioId: number) {
    const insp = await this.prisma.inspecaoManufatura.findUnique({
      where: { id: inspecaoId },
      include: { relatorios: { orderBy: { tentativa: 'desc' } } },
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    // Rascunho aberto trava a reinspecao: primeiro se termina (ou se descarta)
    // a medicao que ficou pela metade, senao a inspecao ficaria com duas
    // tentativas em aberto e nenhuma com veredito.
    if (insp.relatorios.some((r) => r.rascunho))
      throw new ConflictException(
        'Existe um relatório em rascunho nesta inspeção. Lance ou descarte esse rascunho antes de reinspecionar.',
      );
    const ultima = insp.relatorios[0];
    if (ultima && ultima.resultado !== 'REPROVADO')
      throw new ConflictException(
        'Só é possível reinspecionar uma inspeção reprovada.',
      );

    const relatorio = await this.criarRelatorio(
      insp.id,
      insp.tipo,
      (ultima?.tentativa ?? 0) + 1,
      dto,
      usuarioId,
    );

    // Ver criar(): enquanto o relatorio e rascunho a inspecao continua como
    // estava e a maquina nao contabiliza nada.
    if (relatorio.rascunho) return this.detalhe(insp.id);

    await this.prisma.inspecaoManufatura.update({
      where: { id: insp.id },
      data: { status: statusPorResultado(relatorio.resultado) },
    });

    if (relatorio.resultado === 'REPROVADO')
      await this.prisma.maquina.update({
        where: { id: insp.maquinaId },
        data: { inspecoesReprovadas: { increment: 1 } },
      });

    return this.detalhe(insp.id);
  }

  // Correcao de um relatorio ja lancado. Nao e reinspecao: e o MESMO
  // relatorio, com o mesmo numero e a mesma tentativa, sendo consertado -
  // inclusive o resultado. A reinspecao continua sendo uma medicao nova.
  async corrigirRelatorio(
    inspecaoId: number,
    relatorioId: number,
    dto: any,
    usuarioId: number,
  ) {
    const atual = await this.prisma.relatorioDimensional.findUnique({
      where: { id: relatorioId },
    });
    if (!atual || atual.inspecaoId !== inspecaoId)
      throw new NotFoundException('Relatório não encontrado nesta inspeção.');

    const cotas = (dto.cotas ?? (atual.cotas as any) ?? []).map(
      (c: CotaMaxMin) => calcularCotaMaxMin(c),
    );
    const data = dto.dataInspecao
      ? new Date(dto.dataInspecao)
      : atual.dataInspecao;

    const relatorio = await this.prisma.relatorioDimensional.update({
      where: { id: relatorioId },
      data: {
        revisao: dto.revisao ?? atual.revisao,
        dataInspecao: data,
        origem: dto.origem ?? atual.origem,
        origemOutros: dto.origemOutros ?? null,
        itemCodigo: dto.itemCodigo ?? null,
        itemDescricao: dto.itemDescricao ?? null,
        desenhoRev: dto.desenhoRev ?? null,
        desenho: dto.desenho ?? null,
        desenhoRevisao: dto.desenhoRevisao ?? null,
        po: dto.po ?? null,
        qtdInspecionada: dto.qtdInspecionada ?? null,
        qtdTotal: dto.qtdTotal ?? null,
        toleranciasNorm: dto.toleranciasNorm ?? null,
        cotas,
        desenhos: desenhosExtras(dto.desenhos ?? atual.desenhos) as any,
        inspecaoVisual: dto.inspecaoVisual ?? null,
        observacoesFinais: dto.observacoesFinais ?? null,
        resultado: dto.resultado ?? resultadoDimensional(cotas),
        observacaoResultado: dto.observacaoResultado ?? null,
        defeitos: dto.defeitos ?? undefined,
        qtdAfetada: dto.qtdAfetada ?? null,
        descricaoDesvio: dto.descricaoDesvio ?? null,
        // Rascunho que continua rascunho segue fora de tudo. Rascunho salvo
        // sem a marca e um LANCAMENTO: o relatorio passa a valer agora e daqui
        // para a frente e corrigido como qualquer outro.
        rascunho: atual.rascunho && dto.rascunho === true,
        // Quem corrigiu passa a assinar o relatorio: e ele que responde pelo
        // que esta escrito la agora.
        inspetorId: usuarioId,
      },
    });

    // Rascunho pela metade nao mexe no cabecalho nem na maquina.
    if (relatorio.rascunho) return this.detalhe(inspecaoId);

    const insp = await this.prisma.inspecaoManufatura.findUniqueOrThrow({
      where: { id: inspecaoId },
      include: {
        relatorios: {
          where: { rascunho: false },
          orderBy: { tentativa: 'desc' },
          take: 1,
        },
      },
    });

    // Lancamento de rascunho: e aqui que a maquina finalmente contabiliza. Na
    // primeira tentativa entra o setup/producao inteiro; na reinspecao so a
    // reprova, igual ao que reinspecionar() faria.
    if (atual.rascunho) {
      if (relatorio.tentativa === 1)
        await this.contabilizar(insp.maquinaId, insp.tipo, relatorio.resultado);
      else if (relatorio.resultado === 'REPROVADO')
        await this.prisma.maquina.update({
          where: { id: insp.maquinaId },
          data: { inspecoesReprovadas: { increment: 1 } },
        });
    }

    // O status da inspecao sai sempre da ULTIMA tentativa - corrigir a
    // primeira nao reabre uma inspecao que a reinspecao ja aprovou.
    const cabecalho: any = {
      status: statusPorResultado(insp.relatorios[0].resultado),
      itemCodigo: relatorio.itemCodigo,
      itemDescricao: relatorio.itemDescricao,
      po: relatorio.po,
    };
    // A data da inspecao e a da abertura: so a primeira tentativa a define.
    if (relatorio.tentativa === 1) {
      const { semana, ano } = semanaAno(data);
      Object.assign(cabecalho, { dataInspecao: data, semana, ano });
    }
    await this.prisma.inspecaoManufatura.update({
      where: { id: inspecaoId },
      data: cabecalho,
    });

    // O indicador de reprovas da maquina conta um por relatorio reprovado.
    // Se a correcao mudou o veredito, a conta acompanha. No lancamento de
    // rascunho nao ha o que acompanhar: a contabilizacao acabou de ser feita
    // acima, sobre o resultado final.
    const eraReprovado = !atual.rascunho && atual.resultado === 'REPROVADO';
    const agoraReprovado = !atual.rascunho && relatorio.resultado === 'REPROVADO';
    if (eraReprovado !== agoraReprovado) {
      const maquina = await this.prisma.maquina.findUniqueOrThrow({
        where: { id: insp.maquinaId },
      });
      await this.prisma.maquina.update({
        where: { id: maquina.id },
        data: {
          inspecoesReprovadas: agoraReprovado
            ? maquina.inspecoesReprovadas + 1
            : Math.max(0, maquina.inspecoesReprovadas - 1),
        },
      });
    }

    return this.detalhe(inspecaoId);
  }

  // Contadores da maquina, atualizados so na abertura da inspecao.
  private async contabilizar(
    maquinaId: number,
    tipo: 'SETUP' | 'PRODUCAO',
    resultado: string,
  ) {
    const data: any = {};
    if (tipo === 'SETUP') data.setupsRealizados = { increment: 1 };
    else data.producoesRealizadas = { increment: 1 };
    if (resultado === 'REPROVADO') data.inspecoesReprovadas = { increment: 1 };
    await this.prisma.maquina.update({ where: { id: maquinaId }, data });
  }

  async remover(id: number) {
    const insp = await this.prisma.inspecaoManufatura.findUnique({
      where: { id },
      include: {
        relatorios: true,
        oitoDs: { select: { id: true } },
        cincoGs: { select: { id: true } },
      },
    });
    if (!insp) throw new NotFoundException('Inspeção não encontrada');
    if (insp.oitoDs.length)
      throw new ConflictException(
        'Esta inspeção tem um 8D vinculado. Exclua o 8D antes.',
      );
    if (insp.cincoGs.length)
      throw new ConflictException(
        'Esta inspeção tem um 5G vinculado. Exclua o 5G antes.',
      );

    // Rascunho nunca somou nada na maquina, entao tambem nao desconta.
    const lancados = insp.relatorios.filter((r) => !r.rascunho);
    const reprovados = lancados.filter(
      (r) => r.resultado === 'REPROVADO',
    ).length;
    const maquina = await this.prisma.maquina.findUniqueOrThrow({
      where: { id: insp.maquinaId },
    });

    await this.prisma.inspecaoManufatura.delete({ where: { id } });
    // Uma inspecao que so tinha rascunho nunca abriu setup nem producao.
    const abriu = lancados.length > 0;
    await this.prisma.maquina.update({
      where: { id: maquina.id },
      data: {
        setupsRealizados:
          abriu && insp.tipo === 'SETUP'
            ? Math.max(0, maquina.setupsRealizados - 1)
            : undefined,
        producoesRealizadas:
          abriu && insp.tipo === 'PRODUCAO'
            ? Math.max(0, maquina.producoesRealizadas - 1)
            : undefined,
        inspecoesReprovadas: Math.max(
          0,
          maquina.inspecoesReprovadas - reprovados,
        ),
      },
    });
    return { ok: true };
  }

  // Descartar rascunho: joga fora a medicao que ficou pela metade. Nao ha nada
  // a desfazer na maquina, porque o rascunho nunca somou. Se era o unico
  // relatorio, a inspecao inteira vai junto - sem relatorio ela nao existe.
  async descartarRascunho(inspecaoId: number, relatorioId: number) {
    const rel = await this.prisma.relatorioDimensional.findUnique({
      where: { id: relatorioId },
    });
    if (!rel || rel.inspecaoId !== inspecaoId)
      throw new NotFoundException('Relatório não encontrado nesta inspeção.');
    if (!rel.rascunho)
      throw new ConflictException(
        'Este relatório já foi lançado e não pode mais ser descartado.',
      );

    const total = await this.prisma.relatorioDimensional.count({
      where: { inspecaoId },
    });
    if (total <= 1) {
      await this.prisma.inspecaoManufatura.delete({ where: { id: inspecaoId } });
      return { ok: true, inspecaoRemovida: true };
    }
    await this.prisma.relatorioDimensional.delete({ where: { id: relatorioId } });
    return { ok: true, inspecaoRemovida: false };
  }
}
