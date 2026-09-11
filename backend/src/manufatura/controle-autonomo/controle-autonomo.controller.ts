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
import { IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../anexos/storage.service';
import { FOTO_ICAQ } from '../../comum/icaq';
import { ControleAutonomoService } from './controle-autonomo.service';
import { gerarPdfControleAutonomo, FotosIcaq } from './controle-autonomo-pdf';
import {
  VERIFICACOES_ICAQ,
  rotuloClassificacaoIcaq,
  rotuloTurnoIcaq,
} from './icaq-utils';
import { periodoTexto, responderRelatorio } from '../../comum/relatorio-lista';

// ICAQ - Auditoria do Controle Autonomo da Qualidade.
// A auditoria e lancada e fechada de uma vez: as dez linhas chegam juntas.
class ControleAutonomoDto {
  @IsOptional() @IsString() dataAuditoria?: string;
  @IsOptional()
  @IsIn(['PRIMEIRO_TURNO', 'SEGUNDO_TURNO', 'TERCEIRO_TURNO', 'COMERCIAL'])
  turno?: any;
  @IsOptional() @IsInt() maquinaId?: number;
  @IsOptional() @IsInt() itemId?: number;
  @IsOptional() @IsString() ordemLote?: string;
  @IsOptional() @IsString() operador?: string;
  @IsOptional() @IsString() observacoesIniciais?: string;
  // [{ numero, resultado, evidencia, responsavel }] - as dez verificacoes
  @IsOptional() @IsArray() itens?: any[];
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/controle-autonomo')
export class ControleAutonomoController {
  constructor(
    private service: ControleAutonomoService,
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // As fotos de evidencia sao da auditoria inteira, nao de cada verificacao:
  // entram num bloco unico no fim do PDF.
  private async fotosDaAuditoria(id: number): Promise<FotosIcaq> {
    const anexos = await this.prisma.anexo.findMany({
      where: { entidadeTipo: FOTO_ICAQ as any, entidadeId: id },
      orderBy: { createdAt: 'asc' },
    });

    const fotos: FotosIcaq = [];
    for (const a of anexos) {
      if (!a.mimeType?.startsWith('image/')) continue;
      if (fotos.length >= 4) break;
      const bytes = await this.storage.baixarOuNulo(a.caminho);
      if (bytes) fotos.push(bytes);
    }
    return fotos;
  }

  // O modelo em branco do checklist: a tela de lancamento monta as dez linhas
  // a partir daqui, sem repetir os textos do formulario no frontend.
  @Get('modelo')
  modelo() {
    return VERIFICACOES_ICAQ;
  }

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

  // Relatorio do recorte que a tela esta mostrando, em PDF ou planilha.
  // Precisa vir antes de ':id', senao "relatorio" cai na rota do detalhe.
  @Get('relatorio')
  async relatorio(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('maquinaId') maquinaId?: string,
  ) {
    const id = maquinaId ? Number(maquinaId) : undefined;
    const auditorias = await this.service.listar(de, ate, id);
    // O nome vem do cadastro: o recorte pode nao ter nenhuma auditoria e ainda
    // assim precisa dizer qual equipamento foi escolhido.
    const maquina = id
      ? await this.prisma.maquina.findUnique({ where: { id } })
      : null;

    // Os mesmos numeros dos cartoes do topo da tela.
    const soma = auditorias.reduce((t, a) => t + (a.nota ?? 0), 0);
    const notaMedia = auditorias.length
      ? Math.round((soma / auditorias.length) * 10) / 10
      : 0;
    const conformes = auditorias.filter(
      (a) => a.classificacao === 'CONFORME',
    ).length;
    const pct = (parte: number) =>
      auditorias.length
        ? `${(Math.round((parte / auditorias.length) * 1000) / 10).toLocaleString(
            'pt-BR',
            { minimumFractionDigits: 1 },
          )}%`
        : '0,0%';

    await responderRelatorio(
      res,
      {
        titulo: 'ICAQ — Controle Autônomo da Qualidade',
        emitidoPor: user.nome,
        filtros: [
          { rotulo: 'Período', valor: periodoTexto(de, ate) },
          {
            rotulo: 'Equipamento',
            valor: maquina ? `${maquina.codigo} — ${maquina.nome}` : 'Todos',
          },
        ],
        totais: [
          { rotulo: 'Auditorias', valor: String(auditorias.length) },
          {
            rotulo: 'Nota média',
            valor: `${notaMedia.toLocaleString('pt-BR', {
              minimumFractionDigits: 1,
            })}%`,
          },
          { rotulo: 'Dentro do padrão', valor: pct(conformes) },
          {
            rotulo: 'Fora do padrão',
            valor: pct(auditorias.length - conformes),
          },
        ],
        colunas: [
          { titulo: 'Número', peso: 60, valor: (a: any) => a.numero },
          {
            titulo: 'Data',
            peso: 44,
            valor: (a: any) => a.dataAuditoria,
            tipo: 'data',
          },
          { titulo: 'Turno', peso: 44, valor: (a: any) => rotuloTurnoIcaq(a.turno) },
          {
            titulo: 'Equipamento',
            peso: 90,
            valor: (a: any) => a.maquina?.nome,
          },
          {
            titulo: 'Produto / código',
            peso: 110,
            valor: (a: any) =>
              a.item ? `${a.item.codigo} — ${a.item.descricao}` : '',
          },
          { titulo: 'Ordem / lote', peso: 60, valor: (a: any) => a.ordemLote },
          {
            titulo: 'Operador auditado',
            peso: 80,
            valor: (a: any) => a.operador,
          },
          {
            titulo: 'Nota',
            peso: 40,
            valor: (a: any) => a.nota,
            tipo: 'percentual',
            negrito: true,
          },
          {
            titulo: 'Classificação',
            peso: 60,
            valor: (a: any) => rotuloClassificacaoIcaq(a.classificacao),
          },
        ],
        linhas: auditorias,
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
    const reg = await this.service.detalhe(id);
    const fotos = await this.fotosDaAuditoria(id);
    const nomeArquivo = `${(reg.numero ?? `icaq-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfControleAutonomo(reg, fotos);
    doc.pipe(res);
    doc.end();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: ControleAutonomoDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ControleAutonomoDto,
  ) {
    return this.service.atualizar(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
