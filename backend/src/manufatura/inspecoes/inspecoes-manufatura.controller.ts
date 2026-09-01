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
import type { FotosRelatorio } from './relatorio-pdf';
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

// Relatorio de Inspecao Dimensional - Doc BDBR.QUA.FMR.011.06.
// Os campos abaixo sao os do formulario, na mesma ordem do papel.
class RelatorioDto {
  @IsOptional() @IsInt() maquinaId?: number;
  @IsOptional() @IsInt() setupId?: number;
  @IsOptional() @IsString() dataInspecao?: string;
  // Revisao do proprio relatorio, digitada pelo inspetor. Comeca em "01".
  @IsOptional() @IsString() revisao?: string;
  @IsOptional() @IsIn(ORIGENS) origem?: any;
  @IsOptional() @IsString() origemOutros?: string;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;
  @IsOptional() @IsString() desenhoRev?: string;
  @IsOptional() @IsString() desenho?: string;
  // Revisao DO DESENHO - nao confundir com "revisao", que e a do relatorio.
  @IsOptional() @IsString() desenhoRevisao?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @IsNumber() qtdInspecionada?: number;
  @IsOptional() @IsNumber() qtdTotal?: number;
  // Norma padrao do relatorio. Cada cota pode ter a sua, na coluna NORMA.
  @IsOptional() @IsString() toleranciasNorm?: string;
  // [{ localizacao, especificado, norma, tolerancia, upper, lower, pecas: [],
  //    instrumento, desvioMin, desvioMax }]
  @IsOptional() @IsArray() cotas?: any[];
  // Peca de conjunto: desenhos do 2o em diante. Ver comum/inspecao.ts.
  @IsOptional() @IsArray() desenhos?: any[];
  // Inspecao visual, opcional no setup e na producao.
  @IsOptional() @IsString() inspecaoVisual?: string;
  @IsOptional() @IsString() observacoesFinais?: string;
  @IsOptional()
  @IsIn(['APROVADO', 'APROVADO_COM_OBSERVACAO', 'REPROVADO'])
  resultado?: any;
  @IsOptional() @IsString() observacaoResultado?: string;
  // Bloco visual opcional no fim do relatorio: [{ tipoDefeitoId, nome, qtd }]
  @IsOptional() @IsArray() defeitos?: any[];
  @IsOptional() @IsNumber() qtdAfetada?: number;
  @IsOptional() @IsString() descricaoDesvio?: string;
  // Salvar sem terminar. O numero do relatorio ja e consumido, mas ele nao
  // conta na maquina nem nos indicadores. Quando o PATCH vem sem esta marca, o
  // rascunho e LANCADO e passa a valer como qualquer relatorio.
  @IsOptional() @IsBoolean() rascunho?: boolean;
  // "Elaborado por" e "Inspecionado por" nao vem mais do formulario: o sistema
  // assina com o usuario logado.
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/inspecoes')
export class InspecoesManufaturaController {
  constructor(
    private service: InspecoesManufaturaService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  @Get()
  listar(@Query('tipo') tipo?: string, @Query('maquinaId') maquinaId?: string) {
    return this.service.listar(
      tipo,
      maquinaId ? Number(maquinaId) : undefined,
    );
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
    // Cada tentativa tem os seus dois blocos de evidencia (dimensional e
    // visual), independentes e opcionais.
    const fotos: FotosRelatorio = {};
    await Promise.all(
      (insp.relatorios ?? []).map(async (rel) => {
        const [dimensional, visual] = await Promise.all([
          carregarFotosEvidencia(
            this.prisma,
            this.storage,
            EVID.manufaturaDimensional,
            rel.id,
          ),
          carregarFotosEvidencia(
            this.prisma,
            this.storage,
            EVID.manufaturaVisual,
            rel.id,
          ),
        ]);
        fotos[rel.id] = { dimensional, visual };
      }),
    );
    const nomeArquivo = `${(insp.numero ?? `inspecao-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfRelatorioDimensional(insp, fotos);
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

  // Correcao de um relatorio ja lancado - o mesmo numero, a mesma tentativa.
  // Sem @Roles de proposito: quem enxerga o modulo conserta o que digitou
  // errado, sem depender da Qualidade.
  @Patch(':id/relatorio/:relatorioId')
  corrigirRelatorio(
    @Param('id', ParseIntPipe) id: number,
    @Param('relatorioId', ParseIntPipe) relatorioId: number,
    @Body() dto: RelatorioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.corrigirRelatorio(id, relatorioId, dto, user.id);
  }

  // Descartar rascunho. Sem @Roles: o rascunho e visivel para todo mundo do
  // modulo e nunca contou em lugar nenhum, entao jogar fora nao desfaz nada.
  // Excluir inspecao ja lancada continua restrito, na rota abaixo.
  @Delete(':id/relatorio/:relatorioId/rascunho')
  descartarRascunho(
    @Param('id', ParseIntPipe) id: number,
    @Param('relatorioId', ParseIntPipe) relatorioId: number,
  ) {
    return this.service.descartarRascunho(id, relatorioId);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
