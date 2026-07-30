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
  NotFoundException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import { RncService } from './rnc.service';
import { gerarPdfRnc } from './rnc-pdf';
import { StorageService } from '../../anexos/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';

class CreateRncDto {
  // Recebimento (= inspecao) de origem: e por ele que a RNC e reaproveitada
  // quando o mesmo recebimento tem Visual e Lote reprovados.
  @IsOptional() @Type(() => Number) @IsInt() entregaId?: number;
  @IsOptional() @Type(() => Number) @IsInt() inspecaoVisualId?: number;
  @IsOptional() @Type(() => Number) @IsInt() inspecaoLoteId?: number;
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidadeLote?: number;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() tipoDesvio?: string;
  @IsOptional() @IsBoolean() reincidencia?: boolean;
  @IsString() descricaoDesvio: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidadePecas?: number;
  @IsOptional() @Type(() => Number) @IsNumber() valorUnitario?: number;
  @IsOptional() @IsString() disposicao?: string;
  @IsOptional() @IsString() observacoes?: string;
}

class AtualizarRncDto {
  @IsOptional() @IsString() tipoDesvio?: string;
  @IsOptional() @IsBoolean() reincidencia?: boolean;
  @IsOptional() @IsString() descricaoDesvio?: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidadePecas?: number;
  @IsOptional() @Type(() => Number) @IsNumber() valorUnitario?: number;
  @IsOptional() @IsString() disposicao?: string;
  @IsOptional() @IsBoolean() houveRetorno?: boolean;
  @IsOptional() @IsString() dataRetorno?: string;
  @IsOptional() @IsString() fornecedorAceitou?: string;
  @IsOptional() @IsBoolean() fornecedorEnviouPlano?: boolean;
  @IsOptional()
  @IsIn(['RUIM', 'SATISFATORIO', 'EXCELENTE', 'NAO_APLICAVEL'])
  nivelPlano?: any;
  @IsOptional()
  @IsIn(['EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA'])
  status?: any;
  @IsOptional()
  @IsIn(['PENDENTE', 'APROVADO', 'REPROVADO', 'NAO_APLICAVEL'])
  verificacaoEficacia?: any;
  @IsOptional() @IsString() dataVerificacao?: string;
  @IsOptional() @IsString() evidencias?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() comentario?: string;
}

class MudarStatusDto {
  @IsIn(['EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA']) status: string;
  @IsOptional() @IsString() comentario?: string;
}

class CancelarRncDto {
  @IsString() motivo: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rnc')
export class RncController {
  constructor(
    private service: RncService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.service.findAll({
      status,
      fornecedorId: fornecedorId ? Number(fornecedorId) : undefined,
      de,
      ate,
    });
  }

  @Get('reincidencia')
  async reincidencia(
    @Query('fornecedorId') fornecedorId: string,
    @Query('itemId') itemId: string,
  ) {
    const sugere = await this.service.sugereReincidencia(
      Number(fornecedorId),
      Number(itemId),
    );
    return { reincidencia: sugere };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const rnc = await this.prisma.rnc.findUnique({
      where: { id },
      include: {
        fornecedor: { select: { nome: true, codigo: true } },
        item: { select: { descricao: true, codigo: true } },
      },
    });
    if (!rnc) throw new NotFoundException('RNC nao encontrada');

    // Fotos anexadas a RNC entram no Registro Fotografico do formulario.
    // Elas vivem no Supabase Storage, entao aqui baixamos os bytes. O
    // formulario usa no maximo 4 fotos - so buscamos essas.
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: 'RNC', entidadeId: id },
      orderBy: { createdAt: 'asc' },
    });
    const imagens = anexos
      .filter((a) => (a.mimeType ?? '').startsWith('image/'))
      .slice(0, 4);
    const baixadas = await Promise.all(
      imagens.map((a) => this.storage.baixarOuNulo(a.caminho)),
    );
    const fotos = baixadas.filter((b): b is Buffer => b !== null);

    const nomeArquivo = `RNC-${rnc.numero.replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${nomeArquivo}"`,
    );
    const doc = gerarPdfRnc(rnc, fotos);
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  create(@Body() dto: CreateRncDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AtualizarRncDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.atualizar(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id/status')
  mudarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MudarStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.mudarStatus(id, dto.status, dto.comentario, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id/cancelar')
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarRncDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancelar(id, dto.motivo, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id/reabrir')
  reabrir(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reabrir(id, user.id);
  }

  // Remocao permanente do banco - restrito a ADMIN.
  @Roles('ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
