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
  IsOptional,
  IsString,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import type { Response } from 'express';
import { CincoGService } from './cincog.service';
import { gerarPdfCincoG, FotosCincoG } from './cincog-pdf';
import { DOC_5G, EVID_5G } from '../../comum/cincog';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../anexos/storage.service';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

// MÉTODO 5G - aba "MÉTODO 5G" da planilha de Analise de Problemas.
class CincoGDto {
  @IsOptional() @IsInt() inspecaoId?: number;
  @IsOptional() @IsInt() cnqId?: number;
  @IsOptional()
  @IsIn(['AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDO'])
  status?: any;
  @IsOptional() @IsString() dataAbertura?: string;
  @IsOptional()
  @IsIn([
    'RELATORIO_RO',
    'PRODUCAO',
    'INSPECAO_EXTRA',
    'SETUP',
    'RNC',
    'OUTROS',
  ])
  origem?: any;
  // Origem digitada quando a escolhida e OUTROS
  @IsOptional() @IsString() origemOutros?: string;
  // Numero do documento que motivou a abertura; o arquivo vai nos anexos
  @IsOptional() @IsString() documentoReferencia?: string;
  @IsOptional() @IsIn(['COMERCIAL', 'SEGUNDO_TURNO']) turno?: any;
  @IsOptional() @IsString() produtoItem?: string;
  @IsOptional() @IsString() codigoDesenho?: string;
  @IsOptional() @IsString() local?: string;
  @IsOptional() @IsString() processoOperacao?: string;
  @IsOptional() @IsString() equipamento?: string;
  @IsOptional() @IsString() responsavel?: string;
  @IsOptional() @IsString() equipe?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() areaAplicacao?: string;
  @IsOptional() @IsString() descricaoProblema?: string;
  @IsOptional() @IsArray() avaliacoes?: any[];
  @IsOptional() @IsString() conclusao?: string;
  @IsOptional() @IsString() dataTermino?: string;
  @IsOptional() @IsString() verificacaoGerente?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/5g')
export class CincoGController {
  constructor(
    private service: CincoGService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // As fotos sao buscadas por entidadeTipo e entregues ao PDF ja em bytes
  // (o Storage e remoto e a geracao do PDF e sincrona).
  private async fotosDoCincoG(id: number): Promise<FotosCincoG> {
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: EVID_5G.evidencias as any, entidadeId: id },
      orderBy: { createdAt: 'asc' },
    });
    const imagens = anexos
      .filter((a) => a.mimeType?.startsWith('image/'))
      .slice(0, 4);
    const baixadas = await Promise.all(
      imagens.map((a) => this.storage.baixarOuNulo(a.caminho)),
    );
    const validas = baixadas.filter((b): b is Buffer => b !== null);
    return validas.length ? { evidencias: validas } : {};
  }

  // Nomes dos arquivos anexados como documento de referencia. So o nome: o PDF
  // registra que o documento existe, quem quiser o arquivo abre pela tela.
  private async docsDoCincoG(id: number): Promise<string[]> {
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: DOC_5G as any, entidadeId: id },
      orderBy: { createdAt: 'asc' },
      select: { nomeArquivo: true },
    });
    return anexos.map((a) => a.nomeArquivo);
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
    const reg = await this.service.detalhe(id);
    const fotos = await this.fotosDoCincoG(id);
    const docs = await this.docsDoCincoG(id);
    const nomeArquivo = `${(reg.numero ?? `5g-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfCincoG(reg, fotos, docs);
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: CincoGDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: CincoGDto) {
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
