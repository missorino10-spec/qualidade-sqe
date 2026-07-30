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
import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

class TipoDefeitoDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsInt() ordem?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

// Lista oficial de "Descricao do Defeito" da Qualidade. Alimenta o lancamento
// de CNQ e o bloco visual do relatorio de inspecao.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tipos-defeito')
export class DefeitosController {
  constructor(private prisma: PrismaService) {}

  @Get()
  listar(@Query('todos') todos?: string) {
    return this.prisma.tipoDefeito.findMany({
      where: todos === 'true' ? undefined : { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: TipoDefeitoDto) {
    return this.prisma.tipoDefeito.create({
      data: { nome: dto.nome!, ordem: dto.ordem ?? 99, ativo: dto.ativo ?? true },
    });
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TipoDefeitoDto,
  ) {
    return this.prisma.tipoDefeito.update({ where: { id }, data: dto });
  }
}
