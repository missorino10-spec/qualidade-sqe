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
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { CODIGOS_ACAO_ITEM } from './itens-utils';
import { HomologacoesItensService } from './homologacoes-itens.service';
import {
  gerarPdfRegistroHomologacaoItem,
  gerarPdfRelatorioInspecaoItem,
} from './homologacao-item-pdf';

// Registro de Homologacao de Itens (FMR.025.01, aba "Lista"). O registro nasce
// so com o controle; o relatorio de inspecao entra depois, pela rota
// /relatorio.
class HomologacaoItemDto {
  @IsOptional() @IsString() fornecedorNome?: string;
  @IsOptional() @IsString() codigoFornecedor?: string;
  @IsOptional() @IsString() itemCodigo?: string;
  @IsOptional() @IsString() itemDescricao?: string;

  // Em itens o solicitante tambem pode ser o proprio fornecedor.
  @IsOptional()
  @IsIn(['COMPRAS', 'ENGENHARIA', 'NC', 'FORNECEDOR'])
  solicitante?: string;
  @IsOptional()
  @IsIn(['PRIMEIRO_FORNECIMENTO', 'ALTERACAO_MATERIAL', 'ALTERACAO_PROCESSO'])
  motivo?: string;
  @IsOptional() @IsNumber() custoEvitado?: number;

  @IsOptional() @IsString() dataSolicitacao?: string;
  @IsOptional() @IsString() dataEnvioRelatorio?: string;
  @IsOptional() @IsString() dataRetornoFornecedor?: string;

  // "Finalizado" nao entra por aqui: salvar o registro nunca e bloqueado, quem
  // fecha o ciclo (e cobra o que falta) e a rota /finalizar.
  @IsOptional()
  @IsIn(['EM_ANDAMENTO', 'CANCELADO'])
  statusHomologacao?: string;
  @IsOptional()
  @IsIn(['EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO', 'NAO_APLICAVEL'])
  statusPlanoAcao?: string;
  @IsOptional() @IsString() dataReavaliacao?: string;
  @IsOptional()
  @IsIn([
    'NAO_APLICAVEL_CANCELADO',
    'NAO_IMPLEMENTADO_ATRASADO',
    'EFETIVO',
    'PARCIALMENTE_EFETIVO',
    'INEFICAZ',
  ])
  efetividadePlanoAcao?: string;
  // Lista de validacao da coluna "Ação" da planilha (7 itens).
  @IsOptional() @IsIn(CODIGOS_ACAO_ITEM) acao?: string;
  @IsOptional() @IsString() observacoes?: string;
}

// Relatorio de inspecao: cabecalho + aba AMOSTRAS + aba VISUAL.
// Sem "tentativa" abre uma rodada nova; com "tentativa" corrige a existente.
class RelatorioInspecaoDto {
  @IsOptional() @IsNumber() tentativa?: number;
  @IsOptional() @IsString() dataInspecao?: string;
  @IsOptional() @IsString() dataRetornoFornecedor?: string;
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
  origem?: string;
  @IsOptional() @IsString() desenhoRev?: string;
  @IsOptional() @IsString() tolerancias?: string;
  @IsOptional() @IsString() nf?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @IsNumber() qtdInspecionada?: number;
  @IsOptional() @IsNumber() qtdTotal?: number;
  @IsOptional() @IsString() elaboradoPor?: string;
  @IsOptional() @IsString() inspecionadoPor?: string;

  @IsOptional() @IsArray() cotas?: any[];
  @IsOptional() @IsString() observacoesAmostras?: string;
  @IsOptional() @IsIn(['APROVADO', 'REPROVADO']) resultadoAmostras?: string;

  @IsOptional() @IsArray() checklistVisual?: any[];
  @IsOptional() @IsString() evidenciasVisual?: string;
  @IsOptional() @IsString() observacoesVisual?: string;
  @IsOptional() @IsIn(['APROVADO', 'REPROVADO']) resultadoVisual?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sqd/homologacoes-itens')
export class HomologacoesItensController {
  constructor(private service: HomologacoesItensService) {}

  // Catalogo do checklist VISUAL (12 grupos) para montar a tela.
  @Get('formulario')
  formulario() {
    return this.service.formulario();
  }

  @Get()
  listar(@Query('ano') ano?: string) {
    return this.service.listar(ano ? Number(ano) : undefined);
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.detalhe(id);
  }

  // Registro de Homologação em PDF, para controles internos e evidências.
  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const h = await this.service.detalhe(id);
    this.enviarPdf(res, `${h.numero.replace('/', '-')}-registro.pdf`);
    const doc = gerarPdfRegistroHomologacaoItem(h);
    doc.pipe(res);
    doc.end();
  }

  // Relatório de inspeção (cabeçalho + AMOSTRAS + VISUAL) de uma tentativa.
  // Sem ?tentativa= sai a mais recente.
  @Get(':id/relatorio/pdf')
  async pdfRelatorio(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Query('tentativa') tentativa?: string,
  ) {
    const h = await this.service.detalhe(id);
    const doc = gerarPdfRelatorioInspecaoItem(
      h,
      tentativa ? Number(tentativa) : undefined,
    );
    this.enviarPdf(res, `${h.numero.replace('/', '-')}-relatorio.pdf`);
    doc.pipe(res);
    doc.end();
  }

  private enviarPdf(res: Response, nomeArquivo: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: HomologacaoItemDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  // Lancamento (ou correcao) do relatorio de inspecao das amostras recebidas.
  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/relatorio')
  salvarRelatorio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RelatorioInspecaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.salvarRelatorio(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id/relatorio/:tentativa')
  removerRelatorio(
    @Param('id', ParseIntPipe) id: number,
    @Param('tentativa', ParseIntPipe) tentativa: number,
  ) {
    return this.service.removerRelatorio(id, tentativa);
  }

  // Encerramento do ciclo: e aqui que a trava do "Finalizado" e aplicada.
  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/finalizar')
  finalizar(@Param('id', ParseIntPipe) id: number) {
    return this.service.finalizar(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/reabrir')
  reabrir(@Param('id', ParseIntPipe) id: number) {
    return this.service.reabrir(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HomologacaoItemDto,
  ) {
    return this.service.atualizar(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
