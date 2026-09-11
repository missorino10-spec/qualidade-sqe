import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { semanaAno } from '../../sqe/sqe-utils';
import { numeroManufatura } from '../manufatura-utils';

// INSPECAO VISUAL DA MANUFATURA - documento proprio, sem cotas e sem
// reinspecao: e o registro do que o inspetor observou naquele momento, com o
// mesmo cabecalho do formulario dimensional.
//
// Nao mexe nos contadores da maquina (setupsRealizados / producoesRealizadas /
// inspecoesReprovadas): esses indicadores medem a inspecao dimensional, que e
// quem tem resultado de aprovacao. O visual e um registro descritivo.

const includeVisual = {
  maquina: { select: { id: true, codigo: true, nome: true, area: true } },
  inspetor: { select: { id: true, nome: true } },
};

// O recorte por periodo compara com a data gravada em UTC. O "ate" vai ate o
// fim do dia porque a inspecao lancada sem data informada guarda a hora do
// lancamento, e meia-noite deixaria o proprio dia de hoje de fora.
function deUtc(v?: string) {
  return v ? new Date(`${v.slice(0, 10)}T00:00:00.000Z`) : undefined;
}
function ateUtc(v?: string) {
  return v ? new Date(`${v.slice(0, 10)}T23:59:59.999Z`) : undefined;
}

@Injectable()
export class InspecaoVisualManufaturaService {
  constructor(private prisma: PrismaService) {}

  listar(tipo?: string, maquinaId?: number, de?: string, ate?: string) {
    return this.prisma.inspecaoVisualManufatura.findMany({
      where: {
        tipo: tipo ? (tipo as any) : undefined,
        maquinaId: maquinaId ?? undefined,
        dataInspecao:
          de || ate ? { gte: deUtc(de), lte: ateUtc(ate) } : undefined,
      },
      orderBy: { dataInspecao: 'desc' },
      include: includeVisual,
    });
  }

  async detalhe(id: number) {
    const insp = await this.prisma.inspecaoVisualManufatura.findUnique({
      where: { id },
      include: includeVisual,
    });
    if (!insp) throw new NotFoundException('Inspeção visual não encontrada');
    return insp;
  }

  // Numera na serie propria do visual (SETV0001/2026 ou PRODV0001/2026).
  // O retry existe porque dois inspetores podem salvar ao mesmo tempo e cair
  // no mesmo sequencial; sem ele, um deles perderia o formulario preenchido.
  async criar(tipo: 'SETUP' | 'PRODUCAO', dto: any, usuarioId: number) {
    const maquina = await this.prisma.maquina.findUnique({
      where: { id: dto.maquinaId },
    });
    if (!maquina) throw new NotFoundException('Máquina não encontrada');

    const data = dto.dataInspecao ? new Date(dto.dataInspecao) : new Date();
    const ano = data.getFullYear();
    const { semana } = semanaAno(data);
    const prefixo = tipo === 'SETUP' ? 'SETV' : 'PRODV';

    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.inspecaoVisualManufatura.findFirst({
        where: { tipo, ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criada = await this.prisma.inspecaoVisualManufatura.create({
          data: {
            tipo,
            numero: numeroManufatura(prefixo, sequencial, ano),
            ano,
            sequencial,
            maquinaId: dto.maquinaId,
            revisao: dto.revisao ?? '01',
            dataInspecao: data,
            semana,
            origem: dto.origem ?? 'LIBERACAO_SETUP',
            origemOutros: dto.origemOutros ?? null,
            itemCodigo: dto.itemCodigo ?? null,
            itemDescricao: dto.itemDescricao ?? null,
            desenho: dto.desenho ?? null,
            desenhoRevisao: dto.desenhoRevisao ?? null,
            po: dto.po ?? null,
            qtdInspecionada: dto.qtdInspecionada ?? null,
            qtdTotal: dto.qtdTotal ?? null,
            observacoes: dto.observacoes ?? null,
            // Salva pela metade, para terminar depois. O numero ja e consumido
            // aqui; o que muda e que a listagem marca RASCUNHO e o documento
            // ainda nao vale como inspecao feita.
            rascunho: dto.rascunho === true,
            // Quem assina e o usuario logado (inspetorId); os campos digitados
            // sairam do formulario.
            inspetorId: usuarioId,
          },
        });
        return this.detalhe(criada.id);
      } catch {
        // Numero tomado por outro inspetor no mesmo instante: tenta o proximo.
      }
    }
    throw new ConflictException(
      'Não foi possível numerar a inspeção visual. Tente salvar novamente.',
    );
  }

  // Correcao do que foi digitado errado: o mesmo registro, com o mesmo numero
  // e a mesma serie. So a maquina fica de fora - trocar de maquina seria outra
  // inspecao, nao um conserto.
  async corrigir(id: number, dto: any, usuarioId: number) {
    const atual = await this.detalhe(id);
    const data = dto.dataInspecao
      ? new Date(dto.dataInspecao)
      : atual.dataInspecao;
    const { semana } = semanaAno(data);

    await this.prisma.inspecaoVisualManufatura.update({
      where: { id },
      data: {
        revisao: dto.revisao ?? atual.revisao,
        dataInspecao: data,
        semana,
        origem: dto.origem ?? atual.origem,
        origemOutros: dto.origemOutros ?? null,
        itemCodigo: dto.itemCodigo ?? null,
        itemDescricao: dto.itemDescricao ?? null,
        desenho: dto.desenho ?? null,
        desenhoRevisao: dto.desenhoRevisao ?? null,
        po: dto.po ?? null,
        qtdInspecionada: dto.qtdInspecionada ?? null,
        qtdTotal: dto.qtdTotal ?? null,
        observacoes: dto.observacoes ?? null,
        // Rascunho que continua rascunho segue pela metade. Salvo sem a marca,
        // e um LANCAMENTO: o documento passa a valer agora.
        rascunho: atual.rascunho && dto.rascunho === true,
        // Quem corrigiu passa a assinar: e ele que responde pelo que esta
        // escrito no documento agora.
        inspetorId: usuarioId,
      },
    });
    return this.detalhe(id);
  }

  async remover(id: number) {
    await this.detalhe(id);
    await this.prisma.inspecaoVisualManufatura.delete({ where: { id } });
    return { ok: true };
  }

  // Descartar rascunho: joga fora o que ficou pela metade. Documento ja
  // lancado continua so podendo ser excluido por quem tem o papel para isso.
  async descartarRascunho(id: number) {
    const insp = await this.detalhe(id);
    if (!insp.rascunho)
      throw new ConflictException(
        'Esta inspeção já foi lançada e não pode mais ser descartada.',
      );
    await this.prisma.inspecaoVisualManufatura.delete({ where: { id } });
    return { ok: true };
  }
}
