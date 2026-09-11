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
import {
  periodoTexto,
  responderRelatorio,
} from '../../comum/relatorio-lista';
import { StorageService } from '../../anexos/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

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
  // So vem preenchido quando a pessoa digita o total a mao.
  @IsOptional() @Type(() => Number) @IsNumber() valorTotal?: number;
  @IsOptional() @IsString() disposicao?: string;
  @IsOptional() @IsString() observacoes?: string;
}

class AtualizarRncDto {
  @IsOptional() @IsString() tipoDesvio?: string;
  @IsOptional() @IsBoolean() reincidencia?: boolean;
  @IsOptional() @IsString() descricaoDesvio?: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidadePecas?: number;
  @IsOptional() @Type(() => Number) @IsNumber() valorUnitario?: number;
  // So vem preenchido quando a pessoa digita o total a mao.
  @IsOptional() @Type(() => Number) @IsNumber() valorTotal?: number;
  @IsOptional() @IsString() disposicao?: string;
  @IsOptional() @IsBoolean() houveRetorno?: boolean;
  @IsOptional() @IsString() dataRetorno?: string;
  // Envio do documento ao fornecedor: fecha o lead time INTERNO da Qualidade.
  // Nao sai no PDF - e controle de processo, so aparece na tela do sistema.
  // A data nao entra aqui de proposito: quem carimba e o servidor, no dia em
  // que a RNC foi marcada como enviada.
  @IsOptional() @IsBoolean() enviadaFornecedor?: boolean;
  @IsOptional() @IsString() fornecedorAceitou?: string;
  @IsOptional() @IsBoolean() fornecedorEnviouPlano?: boolean;
  @IsOptional()
  @IsIn(['RUIM', 'SATISFATORIO', 'EXCELENTE', 'NAO_APLICAVEL'])
  nivelPlano?: any;
  @IsOptional()
  @IsIn(['EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA'])
  status?: any;
  @IsOptional() @IsString() dataEncerramento?: string;
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
  @IsOptional() @IsString() dataEncerramento?: string;
}

class CancelarRncDto {
  @IsString() motivo: string;
}

// Desvio de qualidade: quantidade, prazo, ou os dois. A validacao do "ao menos
// um" e do documento anexo fica no servico, junto com a da homologacao.
class AbrirDesvioDto {
  @IsString() aberturaEm: string;
  @IsOptional() @Type(() => Number) @IsNumber() quantidade?: number;
  @IsOptional() @IsString() prazoFim?: string;
  @IsOptional() @IsString() descricao?: string;
}

class EncerrarDesvioDto {
  @IsString() encerradoEm: string;
  @IsOptional() @IsString() observacoes?: string;
}

// O relatorio sai com as mesmas palavras da tela: quem exporta compara o papel
// com a lista e os dois tem que dizer a mesma coisa.
const ROTULO_STATUS: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const ROTULO_NIVEL_PLANO: Record<string, string> = {
  RUIM: 'Ruim',
  SATISFATORIO: 'Satisfatório',
  EXCELENTE: 'Excelente',
  NAO_APLICAVEL: 'Não aplicável',
};

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQE)
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

  // Relatorio do recorte que a tela esta mostrando, em PDF ou planilha.
  // Precisa vir antes de ':id', senao "relatorio" cai na rota do detalhe.
  @Get('relatorio')
  async relatorio(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('status') status?: string,
    @Query('fornecedorId') fornecedorId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    const id = fornecedorId ? Number(fornecedorId) : undefined;
    const rncs = await this.service.findAll({ status, fornecedorId: id, de, ate });
    const fornecedor = id
      ? (rncs[0] as any)?.fornecedor?.nome
      : undefined;
    await responderRelatorio(
      res,
      {
        titulo: 'Relatório de RNC',
        emitidoPor: user.nome,
        filtros: [
          { rotulo: 'Período', valor: periodoTexto(de, ate) },
          {
            rotulo: 'Status',
            valor: status ? (ROTULO_STATUS[status] ?? status) : 'Todos',
          },
          { rotulo: 'Fornecedor', valor: fornecedor ?? 'Todos' },
        ],
        totais: [
          {
            rotulo: 'Custo total',
            valor: `R$ ${rncs
              .reduce((t: number, r: any) => t + Number(r.valorTotal ?? 0), 0)
              .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          },
          {
            rotulo: 'Em andamento',
            valor: String(
              rncs.filter((r: any) => r.status === 'EM_ANDAMENTO').length,
            ),
          },
          {
            rotulo: 'Finalizadas',
            valor: String(
              rncs.filter((r: any) => r.status === 'FINALIZADA').length,
            ),
          },
        ],
        colunas: [
          { titulo: 'Número', peso: 50, valor: (r: any) => r.numero },
          { titulo: 'Abertura', peso: 42, valor: (r: any) => r.dataAbertura, tipo: 'data' },
          { titulo: 'Fornecedor', peso: 100, valor: (r: any) => r.fornecedor?.nome },
          {
            titulo: 'Item',
            peso: 110,
            valor: (r: any) =>
              [r.item?.codigo, r.item?.descricao].filter(Boolean).join(' — '),
          },
          { titulo: 'Tipo de desvio', peso: 70, valor: (r: any) => r.tipoDesvio },
          { titulo: 'Descrição do desvio', peso: 120, valor: (r: any) => r.descricaoDesvio },
          { titulo: 'Qtd. peças', peso: 40, valor: (r: any) => r.quantidadePecas, tipo: 'numero' },
          { titulo: 'Custo', peso: 55, valor: (r: any) => r.valorTotal, tipo: 'moeda', negrito: true },
          {
            titulo: 'Enviada em',
            peso: 45,
            valor: (r: any) => r.dataEnvioFornecedor,
            tipo: 'data',
          },
          { titulo: 'Retorno', peso: 45, valor: (r: any) => r.dataRetorno, tipo: 'data' },
          {
            titulo: 'Plano de ação',
            peso: 55,
            valor: (r: any) => ROTULO_NIVEL_PLANO[r.nivelPlano] ?? '',
          },
          { titulo: 'Status', peso: 55, valor: (r: any) => ROTULO_STATUS[r.status] ?? r.status },
        ],
        linhas: rncs,
      },
      formato,
    );
  }

  // Consulta antes de abrir a RNC: o mesmo fornecedor ja repetiu este modo de
  // falha neste item? Devolve tambem as RNCs que bateram, para a tela mostrar
  // o motivo da sugestao.
  @Get('reincidencia')
  reincidencia(
    @Query('fornecedorId') fornecedorId: string,
    @Query('itemId') itemId: string,
    @Query('tipoDesvio') tipoDesvio?: string,
    @Query('inspecaoVisualId') inspecaoVisualId?: string,
    @Query('inspecaoLoteId') inspecaoLoteId?: string,
  ) {
    return this.service.analisarReincidencia({
      fornecedorId: Number(fornecedorId),
      itemId: Number(itemId),
      tipoDesvio,
      inspecaoVisualId: inspecaoVisualId ? Number(inspecaoVisualId) : undefined,
      inspecaoLoteId: inspecaoLoteId ? Number(inspecaoLoteId) : undefined,
    });
  }

  // Mesma analise, para uma RNC ja gravada (a RNC aberta pela inspecao ja
  // nasce com o fornecedor, o item e as inspecoes vinculadas).
  @Get(':id/reincidencia')
  reincidenciaDaRnc(@Param('id', ParseIntPipe) id: number) {
    return this.service.reincidenciaDaRnc(id);
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
        // O Responsavel do cabecalho e quem abriu a RNC, e nao o texto fixo
        // "Qualidade" que a planilha trazia.
        criadoPor: { select: { nome: true } },
        // As cotas reprovadas saem no PDF lidas da inspecao, e nao de uma
        // copia: o papel sempre reflete o dimensional como ele esta hoje.
        inspecaoLote: { select: { cotas: true } },
      },
    });
    if (!rnc) throw new NotFoundException('RNC não encontrada');

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
    return this.service.mudarStatus(
      id,
      dto.status,
      dto.comentario,
      user.id,
      dto.dataEncerramento,
    );
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

  // Desvio de qualidade (concessao). O documento que autoriza sobe antes, em
  // /anexos com entidadeTipo RNC_DESVIO - sem ele a abertura e recusada.
  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/desvio')
  abrirDesvio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AbrirDesvioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.abrirDesvio(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/desvio/encerrar')
  encerrarDesvio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncerrarDesvioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.encerrarDesvio(id, dto, user.id);
  }

  // Remocao permanente do banco - restrito a ADMIN.
  @Roles('ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
