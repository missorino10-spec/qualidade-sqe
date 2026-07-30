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
  IsArray,
  IsBoolean,
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
import { InspecoesManufaturaService } from './inspecoes-manufatura.service';
import { gerarPdfRelatorioDimensional } from './relatorio-pdf';

// Relatorio de Inspecao Dimensional - Doc BDBR.QUA.FMR.011.06.
// Os campos abaixo sao os do formulario, na mesma ordem do papel.
class RelatorioDto {
  @IsOptional() @IsInt() maquinaId?: number;
  @IsOptional() @IsInt() setupId?: number;
  @IsOptional() @IsBoolean() extra?: boolean;
  @IsOptional() @IsString() dataInspecao?: string;
  // Revisao do proprio relatorio, digitada pelo inspetor. Comeca em "01".
  @IsOptional() @IsString() revisao?: string;
  @IsOptional()
  @IsIn([
    'PLANO_INSPECAO',
    'HOMOLOGACAO',
    'DEVOLUCAO',
    'RETRABALHO',
    'RELATORIO_OCORRENCIA',
    'LIBERACAO_SETUP',
    'OUTROS',
  ])
  origem?: any;
  @IsOptional() @IsString() origemOutros?: string;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsString() desenhoRev?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @IsNumber() qtdInspecionada?: number;
  @IsOptional() @IsNumber() qtdTotal?: number;
  // [{ localizacao, especificado, tolerancia, upper, lower, pecas: [],
  //    instrumento, desvioMin, desvioMax }]
  @IsOptional() @IsArray() cotas?: any[];
  @IsOptional() @IsString() observacoesFinais?: string;
  @IsOptional()
  @IsIn(['APROVADO', 'APROVADO_COM_OBSERVACAO', 'REPROVADO'])
  resultado?: any;
  @IsOptional() @IsString() observacaoResultado?: string;
  // Bloco visual opcional no fim do relatorio: [{ tipoDefeitoId, nome, qtd }]
  @IsOptional() @IsArray() defeitos?: any[];
  @IsOptional() @IsNumber() qtdAfetada?: number;
  @IsOptional() @IsString() descricaoDesvio?: string;
  @IsOptional() @IsString() elaboradoPor?: string;
  @IsOptional() @IsString() inspecionadoPor?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('manufatura/inspecoes')
export class InspecoesManufaturaController {
  constructor(private service: InspecoesManufaturaService) {}

  @Get()
  listar(@Query('tipo') tipo?: string, @Query('maquinaId') maquinaId?: string) {
    return this.service.listar(
      tipo,
      maquinaId ? Number(maquinaId) : undefined,
    );
  }

  // Diz se a maquina ja fechou o ciclo de setups e a producao esta vencida.
  @Get('avaliar')
  avaliar(@Query('maquinaId', ParseIntPipe) maquinaId: number) {
    return this.service.avaliarProducao(maquinaId);
  }

  @Get('setups')
  setups(@Query('maquinaId', ParseIntPipe) maquinaId: number) {
    return this.service.setupsDisponiveis(maquinaId);
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  // PDF do 011.06 com TODAS as tentativas da inspecao (1a e reinspecoes).
  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const insp = await this.service.detalhe(id);
    const nomeArquivo = `${(insp.numero ?? `inspecao-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfRelatorioDimensional(insp);
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('setup')
  criarSetup(@Body() dto: RelatorioDto, @CurrentUser() user: AuthUser) {
    return this.service.criar('SETUP', dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('producao')
  criarProducao(@Body() dto: RelatorioDto, @CurrentUser() user: AuthUser) {
    return this.service.criar('PRODUCAO', dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/reinspecao')
  reinspecionar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RelatorioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reinspecionar(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
