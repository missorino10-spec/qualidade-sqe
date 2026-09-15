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
import { chaveDia } from '../comum/dias-uteis';

/**
 * Calendario de feriados - configuracao do sistema inteiro.
 *
 * Nao entra na grade de acesso por modulo porque nao e de modulo nenhum: e o
 * relogio que conta os prazos da R.O, do SQD e do painel do SQE. Mexer aqui
 * muda prazo em toda a casa, entao fica com o admin, no mesmo lugar de
 * Colaboradores e Acessos.
 *
 * O feriado de lei nao se cadastra: sai calculado de calendarioDoAno() toda vez
 * que a lista e pedida. O que se cadastra aqui e so o que a empresa decide -
 * recesso, ponte, parada de manutencao.
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

function emBR(data: Date): string {
  const [ano, mes, dia] = chaveDia(data).split('-');
  return `${dia}/${mes}/${ano}`;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('feriados')
export class FeriadosController {
  constructor(
    private prisma: PrismaService,
    private feriados: FeriadosService,
  ) {}

  /**
   * A lista do ano = feriados de lei calculados na hora + os dias que a empresa
   * acrescentou. Só os da empresa vêm com id; os de lei não se apagam porque
   * não estão guardados em lugar nenhum.
   */
  @Get()
  async listar(@Query('ano') ano?: string) {
    const n = Number(ano);
    const alvo =
      Number.isInteger(n) && n >= 2000 && n <= 2100
        ? n
        : new Date().getUTCFullYear();

    const lei = calendarioDoAno(alvo).map((f) => ({
      id: null as number | null,
      data: chaveDia(f.data),
      descricao: f.descricao,
      tipo: f.tipo,
      origem: 'lei',
    }));
    const jaCalculadas = new Set(lei.map((f) => f.data));

    const daEmpresa = await this.prisma.feriado.findMany({
      where: {
        data: {
          gte: new Date(Date.UTC(alvo, 0, 1)),
          lte: new Date(Date.UTC(alvo, 11, 31)),
        },
      },
      orderBy: { data: 'asc' },
    });

    // Sobra da epoca em que o calendario de lei era gravado no banco pelo botao
    // "Gerar calendario": se a data ja vem calculada, a linha velha e absorvida
    // em vez de aparecer duas vezes na tela.
    const extras = daEmpresa
      .filter((f) => !jaCalculadas.has(chaveDia(f.data)))
      .map((f) => ({
        id: f.id as number | null,
        data: chaveDia(f.data),
        descricao: f.descricao,
        tipo: f.tipo as string,
        origem: 'empresa',
      }));

    return [...lei, ...extras].sort((a, b) => a.data.localeCompare(b.data));
  }

  @Post()
  async criar(@Body() dto: FeriadoDto, @CurrentUser() user: AuthUser) {
    if (!dto.descricao?.trim())
      throw new BadRequestException('Informe a descrição do feriado.');
    const data = dataDoTexto(dto.data);

    const naLei = calendarioDoAno(data.getUTCFullYear()).find(
      (f) => f.data.getTime() === data.getTime(),
    );
    if (naLei)
      throw new BadRequestException(
        `${emBR(data)} já é feriado: ${naLei.descricao}. O calendário de lei ` +
          'já entra sozinho, não precisa cadastrar.',
      );

    const existente = await this.prisma.feriado.findUnique({ where: { data } });
    if (existente)
      throw new BadRequestException(
        `Já existe dia cadastrado nessa data: ${existente.descricao}.`,
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
