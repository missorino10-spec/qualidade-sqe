import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { TipoFeriado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { FeriadosService } from './feriados.service';
import { calendarioDoAno } from './calendario';

/**
 * Calendario de feriados - configuracao do sistema inteiro.
 *
 * Nao entra na grade de acesso por modulo porque nao e de modulo nenhum: e o
 * relogio que conta os prazos da R.O, do SQD e do painel do SQE. Mexer aqui
 * muda prazo em toda a casa, entao fica com o admin, no mesmo lugar de
 * Colaboradores e Acessos.
 */

const TIPOS = [
  'NACIONAL',
  'ESTADUAL',
  'MUNICIPAL',
  'FACULTATIVO',
  'PARADA',
] as const;

class FeriadoDto {
  @IsString() data!: string; // AAAA-MM-DD
  @IsString() descricao!: string;
  @IsOptional() @IsIn(TIPOS as unknown as string[]) tipo?: string;
}

// Le "AAAA-MM-DD" como meia-noite UTC. A coluna e @db.Date e a contagem de dias
// uteis compara pela data em UTC - qualquer hora aqui viraria erro de fuso.
function dataDoTexto(texto: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto.trim());
  if (!m) throw new BadRequestException('Data inválida. Use AAAA-MM-DD.');
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()))
    throw new BadRequestException('Data inválida.');
  return d;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('feriados')
export class FeriadosController {
  constructor(
    private prisma: PrismaService,
    private feriados: FeriadosService,
  ) {}

  @Get()
  listar(@Query('ano') ano?: string) {
    const n = Number(ano);
    const where = Number.isInteger(n)
      ? {
          data: {
            gte: new Date(Date.UTC(n, 0, 1)),
            lte: new Date(Date.UTC(n, 11, 31)),
          },
        }
      : {};
    return this.prisma.feriado.findMany({ where, orderBy: { data: 'asc' } });
  }

  @Post()
  async criar(@Body() dto: FeriadoDto, @CurrentUser() user: AuthUser) {
    if (!dto.descricao?.trim())
      throw new BadRequestException('Informe a descrição do feriado.');
    const data = dataDoTexto(dto.data);
    const existente = await this.prisma.feriado.findUnique({ where: { data } });
    if (existente)
      throw new BadRequestException(
        `Já existe feriado nessa data: ${existente.descricao}.`,
      );

    const criado = await this.prisma.feriado.create({
      data: {
        data,
        descricao: dto.descricao.trim(),
        tipo: (dto.tipo ?? 'PARADA') as TipoFeriado,
        criadoPorId: user.id,
      },
    });
    this.feriados.invalidar();
    return criado;
  }

  /**
   * Gera o calendario do ano (nacionais + SP + Araraquara + Carnaval e Corpus
   * Christi). Nao mexe no que ja existe: quem foi lancado a mao continua como
   * esta, e rodar duas vezes no mesmo ano nao duplica nada.
   */
  @Post('gerar/:ano')
  async gerar(
    @Param('ano', ParseIntPipe) ano: number,
    @CurrentUser() user: AuthUser,
  ) {
    if (ano < 2000 || ano > 2100)
      throw new BadRequestException('Ano fora do intervalo aceito.');

    const gerados = calendarioDoAno(ano);
    const jaExistem = await this.prisma.feriado.findMany({
      where: {
        data: {
          gte: new Date(Date.UTC(ano, 0, 1)),
          lte: new Date(Date.UTC(ano, 11, 31)),
        },
      },
      select: { data: true },
    });
    const ocupadas = new Set(jaExistem.map((f) => f.data.getTime()));
    const novos = gerados.filter((g) => !ocupadas.has(g.data.getTime()));

    if (novos.length)
      await this.prisma.feriado.createMany({
        data: novos.map((n) => ({
          data: n.data,
          descricao: n.descricao,
          tipo: n.tipo as TipoFeriado,
          criadoPorId: user.id,
        })),
      });

    this.feriados.invalidar();
    return { ano, criados: novos.length, jaExistiam: ocupadas.size };
  }

  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.feriado.delete({ where: { id } });
      this.feriados.invalidar();
      return { ok: true };
    } catch (e: any) {
      if (e?.code === 'P2025')
        throw new NotFoundException('Feriado não encontrado');
      throw e;
    }
  }
}
