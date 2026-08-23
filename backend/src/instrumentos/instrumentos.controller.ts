import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { gerarInventarioPdf } from './instrumentos-pdf';

/**
 * Inventario de Instrumentos e Equipamentos - BDBR.QUA.FMR.004.01.
 *
 * A planilha e uma lista simples de nove colunas; o que o sistema acrescenta e
 * a conta da PROXIMA CALIBRACAO (data de calibracao + periodo em anos), que na
 * planilha era feita na mao e por isso ficava desatualizada.
 */

class InstrumentoDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() equipamento?: string;
  @IsOptional() @IsString() fabricante?: string;
  @IsOptional() @IsString() numeroSerie?: string;
  @IsOptional() @IsString() dataCalibracao?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) periodoAnos?: number;
  @IsOptional() @IsString() proximaCalibracao?: string;
  @IsOptional() @IsString() numeroCertificado?: string;
  @IsOptional() @IsString() localizacao?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

// SUGESTAO de proxima calibracao: data de calibracao + periodo em anos.
//
// E so uma sugestao, nao uma regra imposta. A planilha original traz as 52
// linhas com proxima = calibracao + 730 dias enquanto o PERIODO (ANOS) esta
// preenchido com 1, ou seja, a data real do certificado nem sempre bate com o
// periodo declarado. Quem manda e a data que o usuario informar; a conta so
// preenche o campo quando ele nao vem no corpo.
function calcularProxima(data?: Date | null, anos?: number | null) {
  if (!data || !anos) return null;
  const d = new Date(data);
  d.setFullYear(d.getFullYear() + anos);
  return d;
}

function dataOuNulo(texto?: string | null) {
  if (!texto) return null;
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instrumentos')
export class InstrumentosController {
  constructor(private prisma: PrismaService) {}

  @Get()
  listar(
    @Query('busca') busca?: string,
    @Query('incluirInativos') incluirInativos?: string,
  ) {
    const termo = (busca ?? '').trim();
    const where: Prisma.InstrumentoWhereInput = {};
    if (incluirInativos !== 'true') where.ativo = true;
    if (termo) {
      where.OR = [
        { codigo: { contains: termo, mode: 'insensitive' } },
        { equipamento: { contains: termo, mode: 'insensitive' } },
        { fabricante: { contains: termo, mode: 'insensitive' } },
        { numeroSerie: { contains: termo, mode: 'insensitive' } },
        { numeroCertificado: { contains: termo, mode: 'insensitive' } },
        { localizacao: { contains: termo, mode: 'insensitive' } },
      ];
    }
    // Mesma ordem da planilha impressa: pelo codigo, e as linhas sem codigo
    // ("-") no fim, agrupadas pelo equipamento.
    return this.prisma.instrumento.findMany({
      where,
      orderBy: [{ codigo: 'asc' }, { equipamento: 'asc' }],
    });
  }

  // PDF no layout do 004.01, para imprimir e afixar na metrologia.
  @Get('pdf')
  async pdf(
    @Res() res: Response,
    @Query('incluirInativos') incluirInativos?: string,
  ) {
    const lista = await this.prisma.instrumento.findMany({
      where: incluirInativos === 'true' ? {} : { ativo: true },
      orderBy: [{ codigo: 'asc' }, { equipamento: 'asc' }],
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="inventario-instrumentos.pdf"',
    );
    const doc = gerarInventarioPdf(lista);
    doc.pipe(res);
    doc.end();
  }

  @Get(':id')
  async detalhe(@Param('id', ParseIntPipe) id: number) {
    const i = await this.prisma.instrumento.findUnique({ where: { id } });
    if (!i) throw new NotFoundException('Instrumento não encontrado');
    return i;
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: InstrumentoDto, @CurrentUser() user: AuthUser) {
    if (!dto.equipamento?.trim())
      throw new BadRequestException('Informe o equipamento.');
    const dataCalibracao = dataOuNulo(dto.dataCalibracao);
    return this.prisma.instrumento.create({
      data: {
        codigo: dto.codigo ?? null,
        equipamento: dto.equipamento.trim(),
        fabricante: dto.fabricante ?? null,
        numeroSerie: dto.numeroSerie ?? null,
        dataCalibracao,
        periodoAnos: dto.periodoAnos ?? null,
        proximaCalibracao:
          dataOuNulo(dto.proximaCalibracao) ??
          calcularProxima(dataCalibracao, dto.periodoAnos),
        numeroCertificado: dto.numeroCertificado ?? null,
        localizacao: dto.localizacao ?? null,
        observacoes: dto.observacoes ?? null,
        criadoPorId: user.id,
      },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InstrumentoDto,
  ) {
    const atual = await this.prisma.instrumento.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Instrumento não encontrado');

    const dataCalibracao =
      dto.dataCalibracao !== undefined
        ? dataOuNulo(dto.dataCalibracao)
        : atual.dataCalibracao;
    const periodoAnos =
      dto.periodoAnos !== undefined ? dto.periodoAnos : atual.periodoAnos;

    // A data informada vence a conta. So quando o usuario nao manda a proxima
    // calibracao E mexeu na data ou no periodo e que o sistema refaz a
    // sugestao - senao editar a localizacao apagaria a data do certificado.
    const mexeuNoPar =
      dto.dataCalibracao !== undefined || dto.periodoAnos !== undefined;
    const proximaCalibracao =
      dto.proximaCalibracao !== undefined
        ? dataOuNulo(dto.proximaCalibracao)
        : mexeuNoPar
          ? calcularProxima(dataCalibracao, periodoAnos)
          : atual.proximaCalibracao;

    return this.prisma.instrumento.update({
      where: { id },
      data: {
        codigo: dto.codigo ?? atual.codigo,
        equipamento: dto.equipamento?.trim() || atual.equipamento,
        fabricante: dto.fabricante ?? atual.fabricante,
        numeroSerie: dto.numeroSerie ?? atual.numeroSerie,
        dataCalibracao,
        periodoAnos,
        proximaCalibracao,
        numeroCertificado: dto.numeroCertificado ?? atual.numeroCertificado,
        localizacao: dto.localizacao ?? atual.localizacao,
        observacoes: dto.observacoes ?? atual.observacoes,
        ativo: dto.ativo ?? atual.ativo,
      },
    });
  }

  // Excluir de verdade e so do ADMIN; o caminho normal e inativar.
  @Roles('ADMIN')
  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.instrumento.delete({ where: { id } });
      return { ok: true };
    } catch (e: any) {
      if (e?.code === 'P2025')
        throw new NotFoundException('Instrumento não encontrado');
      throw e;
    }
  }
}
