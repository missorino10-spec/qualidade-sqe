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
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class CreateItemDto {
  @IsString() codigo: string;
  @IsString() descricao: string;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) custoUnitario?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() fornecedorId?: number;
}

class UpdateItemDto {
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) custoUnitario?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() fornecedorId?: number;
}

// A base de codigos tem ~14.400 itens. Nenhuma tela pode baixar isso inteiro,
// entao a listagem e sempre uma BUSCA com teto de resultados: o formulario
// pede o que o inspetor digitou e recebe as primeiras linhas que casam.
const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 200;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('itens')
export class ItensController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(
    @Query('busca') busca?: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('limite') limite?: string,
    @Query('incluirInativos') incluirInativos?: string,
  ) {
    const termo = (busca ?? '').trim();
    const take = Math.min(Number(limite) || LIMITE_PADRAO, LIMITE_MAXIMO);

    const where: Prisma.ItemWhereInput = {};
    if (incluirInativos !== 'true') where.ativo = true;
    if (fornecedorId) where.fornecedorId = Number(fornecedorId);
    if (termo) {
      where.OR = [
        { codigo: { contains: termo, mode: 'insensitive' } },
        { descricao: { contains: termo, mode: 'insensitive' } },
      ];
    }

    return this.prisma.item.findMany({
      where,
      include: { fornecedor: { select: { id: true, nome: true } } },
      // Codigo primeiro: quem digita "8000" quer ver os codigos que comecam
      // assim, nao a descricao em ordem alfabetica.
      orderBy: termo ? { codigo: 'asc' } : { descricao: 'asc' },
      take,
    });
  }

  // Consulta exata usada pelo campo de codigo dos formularios: digitou o
  // codigo, devolve descricao e custo unitario para preencher a tela.
  @Get('por-codigo/:codigo')
  async porCodigo(@Param('codigo') codigo: string) {
    const item = await this.prisma.item.findUnique({
      where: { codigo: codigo.trim() },
      include: { fornecedor: { select: { id: true, nome: true } } },
    });
    if (!item) throw new NotFoundException('Código não encontrado na base.');
    return item;
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.prisma.item.create({ data: dto });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    return this.prisma.item.update({ where: { id }, data: dto });
  }

  // Excluir de verdade e so do ADMIN. Se o item ja tiver inspecao, RNC ou
  // planejamento apontando para ele, o banco recusa e a tela mostra o motivo
  // em vez de quebrar - nesse caso o caminho e inativar.
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.prisma.item.delete({ where: { id } });
      return { ok: true };
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Item não encontrado');
      if (e?.code === 'P2003')
        throw new BadRequestException(
          'Este item já está sendo usado em outros registros e não pode ser excluído. Use "Inativar".',
        );
      throw e;
    }
  }
}
