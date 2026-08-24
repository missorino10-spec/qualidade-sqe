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
import { IsInt, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { AlertasService } from './alertas.service';
import { gerarPdfAlerta } from './alerta-pdf';
import { StorageService } from '../../anexos/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { carregarFotosEvidencia } from '../../comum/fotos-evidencia';
import { EVID } from '../../comum/inspecao';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

// Espelha o formulario "Alerta da Qualidade" (.docx).
class AlertaDto {
  @IsOptional() @IsString() data?: string;
  @IsOptional() @IsString() titulo?: string;
  @IsOptional() @IsString() acao?: string;
  @IsOptional() @IsString() setor?: string;
  @IsOptional() @IsInt() maquinaId?: number;
  @IsOptional() @IsString() legendaErrado?: string;
  @IsOptional() @IsString() legendaCerto?: string;
  @IsOptional() @IsString() prazo?: string;
  @IsOptional() @IsString() elaboradoPor?: string;
}

class RenovacaoDto {
  @IsOptional() @IsString() prazo?: string;
  @IsOptional() @IsString() motivo?: string;
}

class EncerramentoDto {
  @IsOptional() @IsString() data?: string;
  @IsOptional() @IsString() observacao?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/alertas')
export class AlertasController {
  constructor(
    private service: AlertasService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  @Get()
  listar(
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('maquinaId') maquinaId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listar(
      de,
      ate,
      maquinaId ? Number(maquinaId) : undefined,
      status,
    );
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  // Cartaz do alerta, com as fotos dos dois paineis.
  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const alerta = await this.service.detalhe(id);
    const [errado, certo] = await Promise.all([
      carregarFotosEvidencia(this.prisma, this.storage, EVID.alertaErrado, id),
      carregarFotosEvidencia(this.prisma, this.storage, EVID.alertaCerto, id),
    ]);
    const nomeArquivo = `${(alerta.numero ?? `alerta-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfAlerta(alerta, { errado, certo });
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: AlertaDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AlertaDto) {
    return this.service.atualizar(id, dto);
  }

  // Renovar: prorroga o prazo e guarda o anterior no historico.
  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/renovar')
  renovar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenovacaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.renovar(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/encerrar')
  encerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncerramentoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.encerrar(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/reabrir')
  reabrir(@Param('id', ParseIntPipe) id: number) {
    return this.service.reabrir(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
