import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { numeroManufatura } from '../manufatura-utils';
import { hojeComoDataPura } from '../../sqe/sqe-utils';

const includeCnq = {
  maquina: { select: { id: true, codigo: true, nome: true, area: true } },
  tipoDefeito: { select: { id: true, nome: true, exigeDetalhe: true } },
  criadoPor: { select: { id: true, nome: true } },
  oitoDs: { select: { id: true, numero: true, status: true } },
  cincoGs: { select: { id: true, numero: true, status: true } },
};

@Injectable()
export class CnqService {
  constructor(private prisma: PrismaService) {}

  listar(de?: string, ate?: string, maquinaId?: number) {
    return this.prisma.cnq.findMany({
      where: {
        maquinaId: maquinaId ?? undefined,
        data:
          de || ate
            ? { gte: de ? new Date(de) : undefined, lte: ate ? new Date(ate) : undefined }
            : undefined,
      },
      orderBy: { data: 'desc' },
      include: includeCnq,
    });
  }

  // Nome da maquina para escrever o filtro no cabecalho do PDF (o recorte
  // pode nao ter nenhum lancamento e ainda assim precisa dizer qual maquina).
  async nomeMaquina(id: number) {
    const m = await this.prisma.maquina.findUnique({ where: { id } });
    return m ? `${m.codigo} — ${m.nome}` : undefined;
  }

  async detalhe(id: number) {
    const c = await this.prisma.cnq.findUnique({
      where: { id },
      include: includeCnq,
    });
    if (!c) throw new NotFoundException('Lançamento de CNQ não encontrado');
    return c;
  }

  // CNQ (custo da nao qualidade) = quantidade x valor unitario da peca.
  // O valor unitario e digitado no lancamento, como na planilha.
  //
  // O total e calculado, mas nao e imposto: se a tela mandar um valorTotal, e
  // porque a pessoa digitou um valor a mao (frete, retrabalho, lote parcial) e
  // esse valor manda. Sem valorTotal no dto, volta a valer a conta.
  private calcular(dto: any) {
    const quantidade = dto.quantidade ?? 0;
    const valorUnitario = dto.valorUnitario ?? 0;
    const calculado = Math.round(quantidade * valorUnitario * 100) / 100;
    return {
      quantidade,
      valorUnitario,
      valorTotal:
        dto.valorTotal != null
          ? Math.round(dto.valorTotal * 100) / 100
          : calculado,
    };
  }

  // Texto livre do defeito, so quando o tipo escolhido pede detalhe ("Outros").
  // Trocar de "Outros" para um defeito da lista limpa o texto, senao ele ficaria
  // pendurado no lancamento contando uma historia que nao e mais a dele.
  private async detalheDoDefeito(dto: any) {
    if (!dto.tipoDefeitoId) return null;
    const tipo = await this.prisma.tipoDefeito.findUnique({
      where: { id: dto.tipoDefeitoId },
      select: { exigeDetalhe: true },
    });
    if (!tipo?.exigeDetalhe) return null;
    return String(dto.defeitoOutros ?? '').trim() || null;
  }

  async criar(dto: any, usuarioId: number) {
    // Campo de data: sem informar vale HOJE como data pura, e o ano do numero
    // se le em UTC. Com o getter local, um lancamento de 01/01 em UTC-3 seria
    // numerado no ano anterior - e o sequencial reinicia a cada ano.
    const data = dto.data ? new Date(dto.data) : hojeComoDataPura();
    const ano = data.getUTCFullYear();
    const valores = this.calcular(dto);

    // Retry: dois lancamentos simultaneos podem cair no mesmo sequencial.
    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.cnq.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.cnq.create({
          data: {
            numero: numeroManufatura('CNQ', sequencial, ano),
            ano,
            sequencial,
            data,
            maquinaId: dto.maquinaId,
            itemCodigo: dto.itemCodigo,
            itemDescricao: dto.itemDescricao ?? null,
            tipoDefeitoId: dto.tipoDefeitoId,
            defeitoOutros: await this.detalheDoDefeito(dto),
            ...valores,
            observacoes: dto.observacoes ?? null,
            acao: dto.acao ?? null,
            criadoPorId: usuarioId,
          },
        });
        return this.detalhe(criado.id);
      } catch (e: any) {
        // Numero tomado por outro usuario no mesmo instante: tenta o proximo.
        if (e?.code !== 'P2002') throw e;
      }
    }
    throw new ConflictException(
      'Não foi possível numerar o CNQ. Tente salvar novamente.',
    );
  }

  async atualizar(id: number, dto: any) {
    const atual = await this.detalhe(id);
    const valores = this.calcular({
      quantidade: dto.quantidade ?? atual.quantidade,
      valorUnitario: dto.valorUnitario ?? atual.valorUnitario,
    });
    await this.prisma.cnq.update({
      where: { id },
      data: {
        data: dto.data ? new Date(dto.data) : undefined,
        maquinaId: dto.maquinaId ?? undefined,
        itemCodigo: dto.itemCodigo ?? undefined,
        itemDescricao: dto.itemDescricao ?? undefined,
        tipoDefeitoId: dto.tipoDefeitoId ?? undefined,
        defeitoOutros: await this.detalheDoDefeito({
          tipoDefeitoId: dto.tipoDefeitoId ?? atual.tipoDefeitoId,
          defeitoOutros: dto.defeitoOutros,
        }),
        ...valores,
        observacoes: dto.observacoes ?? undefined,
        acao: dto.acao ?? undefined,
      },
    });
    return this.detalhe(id);
  }

  async remover(id: number) {
    const c = await this.detalhe(id);
    if (c.oitoDs.length)
      throw new ConflictException(
        'Este CNQ tem um 8D vinculado. Exclua o 8D antes.',
      );
    if (c.cincoGs.length)
      throw new ConflictException(
        'Este CNQ tem um 5G vinculado. Exclua o 5G antes.',
      );
    await this.prisma.cnq.delete({ where: { id } });
    return { ok: true };
  }
}
