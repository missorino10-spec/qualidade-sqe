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
import { InspecaoVisualManufaturaService } from './inspecao-visual.service';
import { gerarPdfInspecaoVisual } from './inspecao-visual-pdf';
import { StorageService } from '../../anexos/storage.service';
import { carregarFotosEvidencia } from '../../comum/fotos-evidencia';
import { EVID, ORIGENS_INSPECAO } from '../../comum/inspecao';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { periodoTexto, responderRelatorio } from '../../comum/relatorio-lista';
import { nomeCurto } from '../../comum/nome';

// A Manufatura e o unico modulo que oferta a inspecao de producao, entao usa
// a lista cheia de origens.
const ORIGENS = ORIGENS_INSPECAO.map((o) => o.value);

// Inspecao visual da manufatura: mesmo cabecalho do formulario dimensional,
// mas sem cotas - so o campo aberto com o que foi observado.
// A maquina fica de fora: na correcao ela nao muda (trocar de maquina seria
// outra inspecao) e por isso os campos do formulario vivem separados dela.
class CamposVisualDto {
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
  // Salvar sem terminar. O numero ja e consumido, mas o documento so vale como
  // inspecao feita depois de lancado. PATCH sem esta marca LANCA o rascunho.
  @IsOptional() @IsBoolean() rascunho?: boolean;
  // "Elaborado por" e "Inspecionado por" nao vem mais do formulario: o sistema
  // assina com o usuario logado.
}

class InspecaoVisualDto extends CamposVisualDto {
  @IsInt() maquinaId: number;
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
  listar(
    @Query('tipo') tipo?: string,
    @Query('maquinaId') maquinaId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.service.listar(
      tipo,
      maquinaId ? Number(maquinaId) : undefined,
      de,
      ate,
    );
  }

  // Relatorio do recorte que a tela esta mostrando, em PDF ou planilha.
  // Precisa vir antes de ':id', senao "relatorio" cai na rota do detalhe.
  @Get('relatorio')
  async relatorio(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('tipo') tipo?: string,
    @Query('maquinaId') maquinaId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    const id = maquinaId ? Number(maquinaId) : undefined;
    const inspecoes = await this.service.listar(tipo, id, de, ate);
    // O nome vem do cadastro: o recorte pode nao ter nenhuma inspecao e ainda
    // assim precisa dizer qual maquina foi escolhida.
    const maquina = id
      ? await this.prisma.maquina.findUnique({ where: { id } })
      : null;

    await responderRelatorio(
      res,
      {
        titulo:
          tipo === 'SETUP'
            ? 'Inspeção de setup — visual'
            : 'Inspeção de produção — visual',
        emitidoPor: user.nome,
        filtros: [
          { rotulo: 'Período', valor: periodoTexto(de, ate) },
          {
            rotulo: 'Máquina',
            valor: maquina ? `${maquina.codigo} — ${maquina.nome}` : 'Todas',
          },
        ],
        totais: [{ rotulo: 'Inspeções visuais', valor: String(inspecoes.length) }],
        colunas: [
          { titulo: 'Número', peso: 60, valor: (i: any) => i.numero },
          {
            titulo: 'Data',
            peso: 44,
            valor: (i: any) => i.dataInspecao,
            tipo: 'data',
          },
          { titulo: 'Máquina', peso: 90, valor: (i: any) => i.maquina?.nome },
          {
            titulo: 'Item',
            peso: 130,
            valor: (i: any) =>
              [i.itemCodigo, i.itemDescricao].filter(Boolean).join(' — '),
          },
          {
            titulo: 'Inspetor',
            peso: 80,
            valor: (i: any) => nomeCurto(i.inspetor?.nome),
          },
          // A visual nao tem resultado: a unica situacao que interessa na
          // lista e se o documento ja foi lancado.
          {
            titulo: 'Situação',
            peso: 56,
            valor: (i: any) => (i.rascunho ? 'Rascunho' : 'Lançada'),
          },
        ],
        linhas: inspecoes,
      },
      formato,
    );
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

  // Correcao do que foi digitado errado - o mesmo documento, com o mesmo
  // numero. Sem @Roles de proposito: quem enxerga o modulo conserta.
  @Patch(':id')
  corrigir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CamposVisualDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.corrigir(id, dto, user.id);
  }

  // Descartar rascunho. Sem @Roles: o rascunho e visivel para todo mundo do
  // modulo e nunca valeu como inspecao, entao jogar fora nao desfaz nada.
  @Delete(':id/rascunho')
  descartarRascunho(@Param('id', ParseIntPipe) id: number) {
    return this.service.descartarRascunho(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
