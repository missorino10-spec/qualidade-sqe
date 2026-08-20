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
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import type { Response } from 'express';
import { OitoDService } from './oitod.service';
import { gerarPdfOitoD, FotosOitoD } from './oitod-pdf';
import { EVID_8D } from '../../comum/oitod';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../anexos/storage.service';

// Analise de Problemas da Qualidade / 8D - Doc BDBR.QUA.FMR.007.01.
class OitoDDto {
  @IsOptional() @IsInt() inspecaoId?: number;
  @IsOptional() @IsInt() cnqId?: number;
  @IsOptional()
  @IsIn(['AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDO'])
  status?: any;
  // Cabecalho
  @IsOptional() @IsString() dataAbertura?: string;
  @IsOptional() @IsString() produtoItem?: string;
  @IsOptional() @IsString() codigoDesenho?: string;
  @IsOptional()
  @IsIn(['RELATORIO_RO', 'PRODUCAO', 'INSPECAO_EXTRA', 'SETUP'])
  origem?: any;
  @IsOptional() @IsString() local?: string;
  @IsOptional() @IsString() processoOperacao?: string;
  @IsOptional() @IsString() equipamento?: string;
  @IsOptional() @IsIn(['COMERCIAL', 'SEGUNDO_TURNO']) turno?: any;
  @IsOptional() @IsString() qtdAfetada?: string;
  @IsOptional() @IsString() responsavel?: string;
  @IsOptional() @IsString() equipe?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() areaAplicacao?: string;
  // Passo 1 - Problema
  @IsOptional() @IsString() descricaoProblema?: string;
  @IsOptional() @IsString() objetivos?: string;
  @IsOptional() @IsString() perdaAtacada?: string;
  @IsOptional() @IsNumber() perdaValorAno?: number;
  @IsOptional() @IsObject() descricao5W1H?: any;
  @IsOptional() @IsString() situacaoAtual?: string;
  @IsOptional() @IsString() estratificacao?: string;
  // Passo 2 - causa raiz (6M + 1D)
  @IsOptional() @IsString() efeito?: string;
  @IsOptional() @IsObject() causas6M?: any;
  @IsOptional() @IsArray() causasPotenciais?: any[];
  @IsOptional() @IsString() causaRaiz?: string;
  // Passo 3 - plano de acao
  @IsOptional() @IsArray() planoAcao?: any[];
  @IsOptional() @IsObject() padronizacao?: any;
  // Passo 4 - verificacao dos resultados
  @IsOptional() @IsString() verificacaoResultados?: string;
  @IsOptional() @IsObject() verificacaoEficacia?: any;
  // Conclusao / fechamento
  @IsOptional() @IsString() dataTermino?: string;
  @IsOptional() @IsString() custosInvestimentos?: string;
  @IsOptional() @IsString() beneficiosGanhos?: string;
  @IsOptional() @IsString() resultadosIndices?: string;
  @IsOptional() @IsString() verificacaoGerente?: string;
  @IsOptional() @IsString() aprovacaoProducao?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('manufatura/8d')
export class OitoDController {
  constructor(
    private service: OitoDService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // Cada passo da planilha tem o seu quadro de imagem: as fotos sao buscadas
  // por entidadeTipo e entregues ao PDF ja em bytes (o Storage e remoto).
  private async fotosDoOitoD(id: number): Promise<FotosOitoD> {
    const tipos = Object.values(EVID_8D);
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: { in: tipos as any }, entidadeId: id },
      orderBy: { createdAt: 'asc' },
    });

    const fotos: FotosOitoD = {};
    for (const [passo, tipo] of Object.entries(EVID_8D)) {
      const imagens = anexos
        .filter((a) => a.entidadeTipo === tipo && a.mimeType?.startsWith('image/'))
        .slice(0, 4);
      const baixadas = await Promise.all(
        imagens.map((a) => this.storage.baixarOuNulo(a.caminho)),
      );
      const validas = baixadas.filter((b): b is Buffer => b !== null);
      if (validas.length) fotos[passo as keyof typeof EVID_8D] = validas;
    }
    return fotos;
  }

  @Get()
  listar(@Query('status') status?: string) {
    return this.service.listar(status);
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const d8 = await this.service.detalhe(id);
    const fotos = await this.fotosDoOitoD(id);
    const nomeArquivo = `${(d8.numero ?? `8d-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfOitoD(d8, fotos);
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: OitoDDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: OitoDDto) {
    return this.service.atualizar(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/aprovar')
  aprovar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.aprovar(id, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
