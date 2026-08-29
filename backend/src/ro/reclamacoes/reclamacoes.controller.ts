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
import {
  IsArray,
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
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../anexos/storage.service';
import {
  ACEITE_RO,
  AREA_RESPONSAVEL_RO,
  CLASSIFICACAO_RO,
  COMPLETUDE_SAC_RO,
  EFICACIA_RO,
  FOTO_RO,
  METODO_ANALISE_RO,
  MOTIVO_ENCERRAMENTO_RO,
  PRIORIDADE_RO,
  PROCEDENCIA_RO,
  SIM_NAO_RO,
  STATUS_ACAO_RO,
  STATUS_RO,
} from '../../comum/ro';
import { ReclamacoesService } from './reclamacoes.service';
import { gerarPdfReclamacao, FotosRo } from './reclamacao-pdf';

// A lista fechada de cada campo vem da propria planilha (comum/ro.ts): assim a
// validacao aqui e a lista da tela nunca saem de sincronia.
const valores = (opcoes: { value: string }[]) => opcoes.map((o) => o.value);

// O R.O nasce com o bloco 1 e vai sendo completado ao longo da tratativa:
// todo campo e opcional no DTO, e o que fecha cada bloco e a regra do service.
class ReclamacaoDto {
  // 1. Dados recebidos
  // "Data/hora Recebimento Qualidade" e automatica na planilha: o carimbo sai
  // da abertura do registro e nao entra aqui.
  @IsOptional() @IsString() cliente?: string;
  @IsOptional() @IsString() produtoCodigo?: string;
  @IsOptional() @IsString() produtoDescricao?: string;
  @IsOptional() @IsNumber() quantidadeAfetada?: number;
  @IsOptional() @IsNumber() valorUnitario?: number;
  @IsOptional() @IsString() tipoInformado?: string;
  @IsOptional() @IsString() resultadoAnaliseSac?: string;
  @IsOptional() @IsString() origemIndicada?: string;

  // 2. Triagem e direcionamento da Qualidade
  @IsOptional() @IsIn(valores(COMPLETUDE_SAC_RO)) dadosCompletos?: any;
  @IsOptional() @IsIn(valores(ACEITE_RO)) aceita?: any;
  @IsOptional() @IsIn(valores(CLASSIFICACAO_RO)) classificacao?: any;
  @IsOptional() @IsIn(valores(PROCEDENCIA_RO)) procedencia?: any;
  @IsOptional() @IsIn(valores(PRIORIDADE_RO)) prioridade?: any;
  @IsOptional() @IsIn(valores(AREA_RESPONSAVEL_RO)) areaResponsavel?: any;
  @IsOptional() @IsInt() responsavelId?: number;
  @IsOptional() @IsString() pendenciasSac?: string;

  // 3. Tratativa interna
  @IsOptional() @IsIn(valores(SIM_NAO_RO)) necessidadeContencao?: any;
  @IsOptional() @IsIn(valores(METODO_ANALISE_RO)) metodoAnalise?: any;
  @IsOptional() @IsString() causaImediata?: string;
  @IsOptional() @IsString() causaSistemica?: string;
  @IsOptional() @IsIn(valores(EFICACIA_RO)) verificacaoEficacia?: any;
  @IsOptional() @IsString() evidencias?: string;
  // [{ tipo, descricao, responsavel, prazo, status }] - contencao e acoes
  // corretivas chegam na mesma lista, separadas pelo tipo.
  @IsOptional() @IsArray() tarefas?: any[];

  // 4. Retorno ao SAC e encerramento
  @IsOptional() @IsString() resumoConclusao?: string;
  @IsOptional() @IsString() dataRetornoSac?: string;
  @IsOptional() @IsIn(valores(MOTIVO_ENCERRAMENTO_RO)) motivoEncerramento?: any;
  @IsOptional() @IsIn(valores(STATUS_RO)) status?: any;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.RO)
@Controller('ro/reclamacoes')
export class ReclamacoesController {
  constructor(
    private service: ReclamacoesService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // As fotos sao do R.O inteiro, num bloco unico no fim do PDF.
  private async fotosDoRo(id: number): Promise<FotosRo> {
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: FOTO_RO as any, entidadeId: id },
      orderBy: { createdAt: 'asc' },
    });

    const fotos: FotosRo = [];
    for (const a of anexos) {
      if (!a.mimeType?.startsWith('image/')) continue;
      if (fotos.length >= 4) break;
      const bytes = await this.storage.baixarOuNulo(a.caminho);
      if (bytes) fotos.push(bytes);
    }
    return fotos;
  }

  // Quem pode ser "Responsável interno" na triagem. A lista de colaboradores
  // completa e so do admin; aqui vai o minimo para o campo funcionar.
  @Get('responsaveis')
  responsaveis() {
    return this.prisma.usuario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  // As listas suspensas da planilha, servidas de um lugar so.
  @Get('listas')
  listas() {
    return {
      dadosCompletos: COMPLETUDE_SAC_RO,
      aceita: ACEITE_RO,
      classificacao: CLASSIFICACAO_RO,
      procedencia: PROCEDENCIA_RO,
      prioridade: PRIORIDADE_RO,
      areaResponsavel: AREA_RESPONSAVEL_RO,
      necessidadeContencao: SIM_NAO_RO,
      metodoAnalise: METODO_ANALISE_RO,
      statusAcao: STATUS_ACAO_RO,
      verificacaoEficacia: EFICACIA_RO,
      motivoEncerramento: MOTIVO_ENCERRAMENTO_RO,
      status: STATUS_RO,
    };
  }

  @Get()
  listar(
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listar(de, ate, status);
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const reg = await this.service.detalhe(id);
    const fotos = await this.fotosDoRo(id);
    const nomeArquivo = `${(reg.numero ?? `ro-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfReclamacao(reg, fotos);
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: ReclamacaoDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReclamacaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.atualizar(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
