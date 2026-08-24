import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import type { Response } from 'express';
import { InspecaoVisualManufaturaService } from './inspecao-visual.service';
import { gerarPdfInspecaoVisual } from './inspecao-visual-pdf';
import { StorageService } from '../../anexos/storage.service';
import { carregarFotosEvidencia } from '../../comum/fotos-evidencia';
import { EVID, ORIGENS_INSPECAO } from '../../comum/inspecao';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

// A Manufatura e o unico modulo que oferta a inspecao de producao, entao usa
// a lista cheia de origens.
const ORIGENS = ORIGENS_INSPECAO.map((o) => o.value);

// Inspecao visual da manufatura: mesmo cabecalho do formulario dimensional,
// mas sem cotas - so o campo aberto com o que foi observado.
class InspecaoVisualDto {
  @IsInt() maquinaId: number;
  @IsOptional() @IsString() dataInspecao?: string;
  // Revisao do proprio relatorio, digitada pelo inspetor. Comeca em "01".
  @IsOptional() @IsString() revisao?: string;
  @IsOptional() @IsIn(ORIGENS) origem?: any;
  @IsOptional() @IsString() origemOutros?: string;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsString() desenho?: string;
  // Revisao DO DESENHO - nao confundir com "revisao", que e a do relatorio.
  @IsOptional() @IsString() desenhoRevisao?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @IsNumber() qtdInspecionada?: number;
  @IsOptional() @IsNumber() qtdTotal?: number;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() elaboradoPor?: string;
  @IsOptional() @IsString() inspecionadoPor?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/inspecoes-visuais')
export class InspecaoVisualManufaturaController {
  constructor(
    private service: InspecaoVisualManufaturaService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  @Get()
  listar(@Query('tipo') tipo?: string, @Query('maquinaId') maquinaId?: string) {
    return this.service.listar(tipo, maquinaId ? Number(maquinaId) : undefined);
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const insp = await this.service.detalhe(id);
    const fotos = await carregarFotosEvidencia(
      this.prisma,
      this.storage,
      EVID.manufaturaVisualInspecao,
      insp.id,
    );
    const nomeArquivo = `${(insp.numero ?? `visual-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfInspecaoVisual(insp, fotos);
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('setup')
  criarSetup(@Body() dto: InspecaoVisualDto, @CurrentUser() user: AuthUser) {
    return this.service.criar('SETUP', dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('producao')
  criarProducao(@Body() dto: InspecaoVisualDto, @CurrentUser() user: AuthUser) {
    return this.service.criar('PRODUCAO', dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
