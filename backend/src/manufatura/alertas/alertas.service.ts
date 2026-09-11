import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { alertaEmAberto } from '../../comum/alerta';

const includeAlerta = {
  maquina: { select: { id: true, codigo: true, nome: true, area: true } },
  criadoPor: { select: { id: true, nome: true } },
  encerradoPor: { select: { id: true, nome: true } },
  renovacoes: {
    orderBy: { createdAt: 'asc' as const },
    include: { criadoPor: { select: { id: true, nome: true } } },
  },
};

// Data pura: gravar meia-noite UTC para o dia digitado nao andar um dia.
function dataPura(valor?: string | null): Date | undefined {
  if (!valor) return undefined;
  return new Date(`${valor.slice(0, 10)}T00:00:00.000Z`);
}

@Injectable()
export class AlertasService {
  constructor(private prisma: PrismaService) {}

  async listar(
    de?: string,
    ate?: string,
    maquinaId?: number,
    status?: string,
  ) {
    return this.prisma.alertaQualidade.findMany({
      where: {
        maquinaId: maquinaId ?? undefined,
        status: (status as any) ?? undefined,
        data:
          de || ate
            ? { gte: dataPura(de), lte: dataPura(ate) }
            : undefined,
      },
      orderBy: { data: 'desc' },
      include: includeAlerta,
    });
  }

  // Nome da maquina para escrever o filtro no cabecalho do relatorio (o
  // recorte pode nao ter nenhum alerta e ainda assim precisa dizer qual
  // maquina foi escolhida).
  async nomeMaquina(id: number) {
    const m = await this.prisma.maquina.findUnique({ where: { id } });
    return m ? `${m.codigo} — ${m.nome}` : undefined;
  }

  async detalhe(id: number) {
    const a = await this.prisma.alertaQualidade.findUnique({
      where: { id },
      include: includeAlerta,
    });
    if (!a) throw new NotFoundException('Alerta da Qualidade não encontrado');
    return a;
  }

  async criar(dto: any, usuarioId: number) {
    const data = dataPura(dto.data) ?? dataPura(new Date().toISOString())!;
    const prazo = dataPura(dto.prazo);
    if (!prazo) throw new BadRequestException('Informe o prazo para corrigir.');
    const ano = Number(data.toISOString().slice(0, 4));

    // Retry: dois alertas salvos ao mesmo tempo cairiam no mesmo sequencial.
    for (let i = 0; i < 5; i++) {
      const ultimo = await this.prisma.alertaQualidade.findFirst({
        where: { ano },
        orderBy: { sequencial: 'desc' },
      });
      const sequencial = (ultimo?.sequencial ?? 0) + 1;
      try {
        const criado = await this.prisma.alertaQualidade.create({
          data: {
            numero: `ALQ${String(sequencial).padStart(4, '0')}/${ano}`,
            ano,
            sequencial,
            data,
            titulo: dto.titulo,
            acao: dto.acao,
            setor: dto.setor ?? null,
            maquinaId: dto.maquinaId ?? null,
            legendaErrado: dto.legendaErrado ?? null,
            legendaCerto: dto.legendaCerto ?? null,
            prazo,
            // "Elaborado por" saiu do formulario: quem assina e o usuario
            // logado, gravado em criadoPorId.
            criadoPorId: usuarioId,
          },
        });
        return this.detalhe(criado.id);
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
    }
    throw new ConflictException(
      'Não foi possível numerar o alerta. Tente salvar novamente.',
    );
  }

  async atualizar(id: number, dto: any) {
    const atual = await this.detalhe(id);
    if (!alertaEmAberto(atual.status))
      throw new ConflictException(
        'Alerta encerrado não pode ser editado. Reabra ou crie um novo alerta.',
      );
    await this.prisma.alertaQualidade.update({
      where: { id },
      data: {
        data: dataPura(dto.data),
        titulo: dto.titulo ?? undefined,
        acao: dto.acao ?? undefined,
        setor: dto.setor ?? undefined,
        maquinaId: dto.maquinaId ?? undefined,
        legendaErrado: dto.legendaErrado ?? undefined,
        legendaCerto: dto.legendaCerto ?? undefined,
        prazo: dataPura(dto.prazo),
      },
    });
    return this.detalhe(id);
  }

  // Renovar = prorrogar o prazo guardando o anterior. O alerta passa a
  // RENOVADO e sai de vencido, porque o prazo que vale agora e o novo.
  async renovar(id: number, dto: any, usuarioId: number) {
    const atual = await this.detalhe(id);
    if (!alertaEmAberto(atual.status))
      throw new ConflictException('Só é possível renovar um alerta em aberto.');
    const prazoNovo = dataPura(dto.prazo);
    if (!prazoNovo) throw new BadRequestException('Informe o novo prazo.');
    if (prazoNovo.getTime() <= atual.prazo.getTime())
      throw new BadRequestException(
        'O novo prazo precisa ser posterior ao prazo atual.',
      );

    await this.prisma.$transaction([
      this.prisma.renovacaoAlerta.create({
        data: {
          alertaId: id,
          prazoAnterior: atual.prazo,
          prazoNovo,
          motivo: dto.motivo ?? null,
          criadoPorId: usuarioId,
        },
      }),
      this.prisma.alertaQualidade.update({
        where: { id },
        data: { prazo: prazoNovo, status: 'RENOVADO' },
      }),
    ]);
    return this.detalhe(id);
  }

  // Encerrar nao olha o prazo de proposito: o alerta encerrado fora do prazo
  // nao fica marcado como vencido (decisao da Qualidade).
  async encerrar(id: number, dto: any, usuarioId: number) {
    const atual = await this.detalhe(id);
    if (!alertaEmAberto(atual.status))
      throw new ConflictException('Este alerta já está encerrado.');
    await this.prisma.alertaQualidade.update({
      where: { id },
      data: {
        status: 'ENCERRADO',
        dataEncerramento:
          dataPura(dto?.data) ?? dataPura(new Date().toISOString()),
        observacaoEncerramento: dto?.observacao ?? null,
        encerradoPorId: usuarioId,
      },
    });
    return this.detalhe(id);
  }

  async reabrir(id: number) {
    const atual = await this.detalhe(id);
    if (alertaEmAberto(atual.status))
      throw new ConflictException('Este alerta já está em aberto.');
    await this.prisma.alertaQualidade.update({
      where: { id },
      data: {
        // Volta para RENOVADO quando ja houve prorrogacao, para nao apagar
        // do historico o fato de o prazo ter sido esticado.
        status: atual.renovacoes.length ? 'RENOVADO' : 'ABERTO',
        dataEncerramento: null,
        observacaoEncerramento: null,
        encerradoPorId: null,
      },
    });
    return this.detalhe(id);
  }

  async remover(id: number) {
    await this.detalhe(id);
    await this.prisma.alertaQualidade.delete({ where: { id } });
    return { ok: true };
  }
}
