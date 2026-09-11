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
import { periodoTexto, responderRelatorio } from '../comum/relatorio-lista';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../auth/modulo.decorator';
import { PermissaoGuard } from '../auth/permissao.guard';

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

// Dias que faltam para a proxima calibracao, na mesma conta da tela: em dias
// cheios e em UTC, porque a data vem gravada como meia-noite UTC e comparar no
// fuso do servidor faria a calibracao de hoje aparecer como vencida ontem.
function diasParaVencer(proxima?: Date | null): number | null {
  if (!proxima) return null;
  const dia = 24 * 60 * 60 * 1000;
  const alvo = Date.UTC(
    proxima.getUTCFullYear(),
    proxima.getUTCMonth(),
    proxima.getUTCDate(),
  );
  const agora = new Date();
  const hoje = Date.UTC(
    agora.getUTCFullYear(),
    agora.getUTCMonth(),
    agora.getUTCDate(),
  );
  return Math.round((alvo - hoje) / dia);
}

// Mesmo texto da etiqueta de Situação da tela.
function situacaoTexto(i: any): string {
  if (!i.ativo) return 'Inativo';
  const dias = diasParaVencer(i.proximaCalibracao);
  if (dias === null) return 'Sem data';
  if (dias < 0) return `Vencida há ${Math.abs(dias)} dia(s)`;
  if (dias <= 30) return `Vence em ${dias} dia(s)`;
  return `${dias} dia(s)`;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.CAD_INSTRUMENTOS, { leituraLivre: true })
@Controller('instrumentos')
export class InstrumentosController {
  constructor(private prisma: PrismaService) {}

  // Uma consulta so para a tela e para o relatorio: se cada um montasse o seu
  // where, o papel exportado poderia trazer linha que a lista nao mostra.
  //
  // O recorte por data cai sobre a PROXIMA CALIBRACAO. Instrumento nao tem data
  // de lancamento - ele nao "acontece" num dia; o que tem prazo e a calibracao,
  // e e por ela que se pergunta "o que vence neste mes".
  private buscar(filtros: {
    busca?: string;
    incluirInativos?: string;
    de?: string;
    ate?: string;
  }) {
    const termo = (filtros.busca ?? '').trim();
    const where: Prisma.InstrumentoWhereInput = {};
    if (filtros.incluirInativos !== 'true') where.ativo = true;
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
    if (filtros.de || filtros.ate) {
      where.proximaCalibracao = {
        gte: filtros.de ? new Date(filtros.de) : undefined,
        lte: filtros.ate ? new Date(`${filtros.ate}T23:59:59.999Z`) : undefined,
      };
    }
    // Mesma ordem da planilha impressa: pelo codigo, e as linhas sem codigo
    // ("-") no fim, agrupadas pelo equipamento.
    return this.prisma.instrumento.findMany({
      where,
      orderBy: [{ codigo: 'asc' }, { equipamento: 'asc' }],
    });
  }

  @Get()
  listar(
    @Query('busca') busca?: string,
    @Query('incluirInativos') incluirInativos?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.buscar({ busca, incluirInativos, de, ate });
  }

  // Relatorio do recorte que a tela esta mostrando, em PDF ou planilha.
  // Precisa vir antes de ':id', senao "relatorio" cai na rota do detalhe.
  //
  // Fora da leitura livre da classe, como o PDF do inventario: a lista continua
  // aberta porque alimenta os combos dos lancamentos, mas o documento do
  // cadastro so sai para quem tem Cadastros > Instrumentos.
  @Modulo(ModuloSistema.CAD_INSTRUMENTOS)
  @Get('relatorio')
  async relatorio(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('busca') busca?: string,
    @Query('incluirInativos') incluirInativos?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    const lista = await this.buscar({ busca, incluirInativos, de, ate });
    const dias = lista.map((i) => diasParaVencer(i.proximaCalibracao));
    const vencidos = dias.filter((d) => d !== null && d < 0).length;
    const aVencer = dias.filter((d) => d !== null && d >= 0 && d <= 30).length;

    await responderRelatorio(
      res,
      {
        titulo: 'Inventário de Instrumentos e Equipamentos',
        emitidoPor: user.nome,
        filtros: [
          { rotulo: 'Próxima calibração', valor: periodoTexto(de, ate) },
          { rotulo: 'Busca', valor: (busca ?? '').trim() || 'Sem busca' },
          {
            rotulo: 'Inativos',
            valor: incluirInativos === 'true' ? 'Incluídos' : 'Ocultos',
          },
        ],
        totais: [
          { rotulo: 'Instrumentos', valor: String(lista.length) },
          { rotulo: 'Calibração vencida', valor: String(vencidos) },
          { rotulo: 'Vence em até 30 dias', valor: String(aVencer) },
        ],
        colunas: [
          { titulo: 'Código', peso: 45, valor: (i: any) => i.codigo },
          {
            titulo: 'Equipamento',
            peso: 140,
            valor: (i: any) => i.equipamento,
          },
          { titulo: 'Fabricante', peso: 60, valor: (i: any) => i.fabricante },
          { titulo: 'Nº série', peso: 55, valor: (i: any) => i.numeroSerie },
          {
            titulo: 'Data de calibração',
            peso: 55,
            valor: (i: any) => i.dataCalibracao,
            tipo: 'data',
          },
          {
            titulo: 'Próxima calibração',
            peso: 55,
            valor: (i: any) => i.proximaCalibracao,
            tipo: 'data',
          },
          { titulo: 'Situação', peso: 70, valor: situacaoTexto },
          {
            titulo: 'Nº certificado',
            peso: 55,
            valor: (i: any) => i.numeroCertificado,
          },
          {
            titulo: 'Período (anos)',
            peso: 40,
            valor: (i: any) => i.periodoAnos,
            tipo: 'numero',
          },
          { titulo: 'Localização', peso: 70, valor: (i: any) => i.localizacao },
        ],
        linhas: lista,
      },
      formato,
    );
  }

  // PDF no layout do 004.01, para imprimir e afixar na metrologia.
  //
  // Fora da leitura livre da classe: a lista continua aberta porque alimenta os
  // combos dos lancamentos, mas o inventario impresso e documento do cadastro e
  // so sai para quem tem Cadastros > Instrumentos.
  @Modulo(ModuloSistema.CAD_INSTRUMENTOS)
  @Get('pdf')
  async pdf(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
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
    const doc = gerarInventarioPdf(lista, user.nome);
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
