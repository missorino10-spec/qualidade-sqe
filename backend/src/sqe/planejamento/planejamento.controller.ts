import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

class CreatePlanejamentoDto {
  @IsString() semanaReferencia: string;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() dataPrevista?: string;
}

const includePadrao = {
  fornecedor: { select: { id: true, nome: true, codigo: true } },
  item: { select: { id: true, descricao: true, codigo: true } },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('planejamento-semanal')
export class PlanejamentoController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll(@Query('semana') semana?: string) {
    return this.prisma.planejamentoSemanal.findMany({
      where: semana ? { semanaReferencia: semana } : undefined,
      include: includePadrao,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: CreatePlanejamentoDto, @CurrentUser() user: AuthUser) {
    return this.prisma.planejamentoSemanal.create({
      data: {
        semanaReferencia: dto.semanaReferencia,
        fornecedorId: dto.fornecedorId,
        itemId: dto.itemId ?? null,
        dataPrevista: dto.dataPrevista ? new Date(dto.dataPrevista) : null,
        criadoPorId: user.id,
      },
      include: includePadrao,
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id/entregue')
  marcarEntregue(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.planejamentoSemanal.update({
      where: { id },
      data: { status: 'ENTREGUE' },
      include: includePadrao,
    });
  }
}
