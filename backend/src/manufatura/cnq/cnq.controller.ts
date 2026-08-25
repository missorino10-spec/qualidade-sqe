import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { CnqService } from './cnq.service';
import { gerarPdfCnq } from './cnq-pdf';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

// Espelha a aba "Defeitos e CNQ" da planilha de indicadores.
class CnqDto {
  @IsOptional() @IsString() data?: string;
  @IsOptional() @IsInt() maquinaId?: number;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsInt() tipoDefeitoId?: number;
  @IsOptional() @IsNumber() quantidade?: number;
  @IsOptional() @IsNumber() valorUnitario?: number;
  // So vem preenchido quando a pessoa digita o total a mao. Sem ele o servico
  // volta a calcular quantidade x valor unitario.
  @IsOptional() @IsNumber() valorTotal?: number;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() acao?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/cnq')
export class CnqController {
  constructor(private service: CnqService) {}

  @Get()
  listar(
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('maquinaId') maquinaId?: string,
  ) {
    return this.service.listar(
      de,
      ate,
      maquinaId ? Number(maquinaId) : undefined,
    );
  }

  // PDF do recorte que a tela esta mostrando (mesmo filtro da listagem).
  // Precisa vir antes de ':id', senao "pdf" cai na rota do detalhe.
  @Get('pdf')
  async pdf(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('maquinaId') maquinaId?: string,
  ) {
    const id = maquinaId ? Number(maquinaId) : undefined;
    const lancamentos = await this.service.listar(de, ate, id);
    const maquina = id ? await this.service.nomeMaquina(id) : undefined;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="cnq.pdf"');
    const doc = gerarPdfCnq(lancamentos, { de, ate, maquina }, user.nome);
    doc.pipe(res);
    doc.end();
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: CnqDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: CnqDto) {
    return this.service.atualizar(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
