import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { semanaReferencia } from '../sqe-utils';

class CreateEntregaDto {
  @IsOptional() @Type(() => Number) @IsInt() planejamentoId?: number;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() dataEntrega?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidade?: number;
}

const includePadrao = {
  fornecedor: {
    select: {
      id: true,
      nome: true,
      codigo: true,
      classificacaoFornecimento: true,
      fazVisual: true,
      fazLote: true,
    },
  },
  item: { select: { id: true, descricao: true, codigo: true } },
};

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQE)
@Controller('entregas')
export class EntregasController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('fornecedorId') fornecedorId?: string) {
    return this.prisma.entregaPortaria.findMany({
      where: fornecedorId ? { fornecedorId: Number(fornecedorId) } : undefined,
      include: {
        ...includePadrao,
        inspecoesVisual: { select: { id: true, resultado: true } },
        inspecoesLote: { select: { id: true, resultado: true } },
      },
      orderBy: { dataEntrega: 'desc' },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  async create(@Body() dto: CreateEntregaDto, @CurrentUser() user: AuthUser) {
    const fornecedor = await this.prisma.fornecedor.findUniqueOrThrow({
      where: { id: dto.fornecedorId },
    });

    // Frequencia de inspecao conforme a classificacao de fornecimento
    const config = await this.prisma.periodicidadeConfig.findUnique({
      where: { classificacao: fornecedor.classificacaoFornecimento },
    });
    const frequenciaN = config?.frequenciaN ?? 1;

    // Contador ciclico: incrementa; se atingir a frequencia, dispara inspecao e zera.
    const novoContador = fornecedor.contadorEntregas + 1;
    const passivelInspecao = novoContador >= frequenciaN;

    const data = dto.dataEntrega ? new Date(dto.dataEntrega) : new Date();

    const entrega = await this.prisma.entregaPortaria.create({
      data: {
        planejamentoId: dto.planejamentoId ?? null,
        fornecedorId: dto.fornecedorId,
        itemId: dto.itemId ?? null,
        dataEntrega: data,
        semanaReferencia: semanaReferencia(data),
        notaFiscal: dto.notaFiscal ?? null,
        po: dto.po ?? null,
        quantidade: dto.quantidade ?? null,
        numeroEntregaAcumulado: novoContador,
        passivelInspecao,
        confirmadoPorId: user.id,
      },
      include: includePadrao,
    });

    // Atualiza contadores do fornecedor
    await this.prisma.fornecedor.update({
      where: { id: fornecedor.id },
      data: {
        totalEntregas: { increment: 1 },
        contadorEntregas: passivelInspecao ? 0 : novoContador,
      },
    });

    // Marca o planejamento vinculado como ENTREGUE
    if (dto.planejamentoId) {
      await this.prisma.planejamentoSemanal.update({
        where: { id: dto.planejamentoId },
        data: { status: 'ENTREGUE' },
      });
    }

    return entrega;
  }
}
