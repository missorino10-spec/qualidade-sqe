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
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { CODIGOS_ACAO } from '../sqd-utils';
import { periodoTexto, responderRelatorio } from '../../comum/relatorio-lista';
import { HomologacoesService } from './homologacoes.service';
import {
  gerarPdfAutoavaliacao,
  gerarPdfRegistroHomologacao,
} from './homologacao-pdf';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

// Cabecalho do FMR.024.03 + controle do FMR.029.01. O registro nasce so com o
// controle; a autoavaliacao entra depois, pela rota /autoavaliacao.
class HomologacaoDto {
  @IsOptional() @IsString() fornecedorNome?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() inscricaoEstadual?: string;
  @IsOptional() @IsString() responsavelInfo?: string;
  @IsOptional() @IsString() setor?: string;

  @IsOptional() @IsString() codigoFornecedor?: string;
  @IsOptional()
  @IsIn(['COMPRAS', 'ENGENHARIA', 'NC'])
  solicitante?: string;
  @IsOptional() @IsString() segmento?: string;
  @IsOptional() @IsString() escopoFornecedor?: string;
  @IsOptional() @IsString() processosTerceirizados?: string;
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
  // Lista de validacao da coluna "Ação" da planilha.
  @IsOptional() @IsIn(CODIGOS_ACAO) acao?: string;
  @IsOptional() @IsString() observacoes?: string;
}

// Respostas devolvidas pelo fornecedor: { "A1": "SIM", "A2": "NAO", ... }
class AutoavaliacaoDto {
  @IsObject() respostas!: Record<string, string>;
  @IsOptional() @IsString() dataAvaliacao?: string;
  @IsOptional() @IsString() dataRetornoFornecedor?: string;
  @IsOptional() @IsString() fornecedorNome?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() inscricaoEstadual?: string;
  @IsOptional() @IsString() responsavelInfo?: string;
  @IsOptional() @IsString() setor?: string;
}

// O relatorio sai com as mesmas palavras da tela: quem exporta compara o papel
// com a lista e os dois tem que dizer a mesma coisa.
const ROTULO_STATUS_HOMOLOGACAO: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

const ROTULO_RESULTADO: Record<string, string> = {
  APROVADO: 'Aprovado',
  APROVADO_CONDICIONALMENTE: 'Aprovado Condicionalmente',
  REPROVADO: 'Reprovado',
};

const ROTULO_SOLICITANTE: Record<string, string> = {
  COMPRAS: 'Compras',
  ENGENHARIA: 'Engenharia',
  NC: 'N/C',
};

// Sem autoavaliacao devolvida nao existe nota nem resultado; a coluna diz o que
// o registro esta esperando, igual a tela.
function resultadoHomologacao(h: any): string {
  if (h.resultado) return ROTULO_RESULTADO[h.resultado] ?? h.resultado;
  return h.statusHomologacao === 'CANCELADO'
    ? ''
    : 'Aguardando retorno do fornecedor';
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQD)
@Controller('sqd/homologacoes')
export class HomologacoesController {
  constructor(private service: HomologacoesService) {}

  @Get()
  listar(
    @Query('ano') ano?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.service.listar(ano ? Number(ano) : undefined, de, ate);
  }

  // Relatorio do recorte que a tela esta mostrando, em PDF ou planilha.
  // Precisa vir antes de ':id', senao "relatorio" cai na rota do detalhe.
  @Get('relatorio')
  async relatorio(
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
    @Query('formato') formato?: string,
    @Query('ano') ano?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    const registros = await this.service.listar(
      ano ? Number(ano) : undefined,
      de,
      ate,
    );
    await responderRelatorio(
      res,
      {
        titulo: 'Homologação de Fornecedores',
        emitidoPor: user.nome,
        filtros: [{ rotulo: 'Período', valor: periodoTexto(de, ate) }],
        colunas: [
          { titulo: 'Número', peso: 60, valor: (h: any) => h.numero },
          {
            titulo: 'Solicitação',
            peso: 45,
            valor: (h: any) => h.dataSolicitacao,
            tipo: 'data',
          },
          { titulo: 'Semana', peso: 35, valor: (h: any) => h.semana },
          {
            titulo: 'Fornecedor',
            peso: 140,
            valor: (h: any) => h.fornecedorNome,
          },
          {
            titulo: 'Solicitante',
            peso: 50,
            valor: (h: any) => ROTULO_SOLICITANTE[h.solicitante] ?? '',
          },
          {
            titulo: 'Nota',
            peso: 35,
            valor: (h: any) => h.nota,
            tipo: 'numero',
            negrito: true,
          },
          {
            titulo: 'Resultado',
            peso: 110,
            valor: (h: any) => resultadoHomologacao(h),
          },
          {
            titulo: 'Status',
            peso: 55,
            valor: (h: any) =>
              ROTULO_STATUS_HOMOLOGACAO[h.statusHomologacao] ??
              h.statusHomologacao,
          },
        ],
        linhas: registros,
      },
      formato,
    );
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
    const doc = gerarPdfRegistroHomologacao(h);
    doc.pipe(res);
    doc.end();
  }

  // Autoavaliação preenchida pelo fornecedor, com a apuração dos 10 blocos.
  @Get(':id/autoavaliacao/pdf')
  async pdfAutoavaliacao(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const h = await this.service.detalhe(id);
    this.enviarPdf(res, `${h.numero.replace('/', '-')}-autoavaliacao.pdf`);
    const doc = gerarPdfAutoavaliacao(h);
    doc.pipe(res);
    doc.end();
  }

  private enviarPdf(res: Response, nomeArquivo: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: HomologacaoDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  // Lancamento (ou correcao) da autoavaliacao devolvida pelo fornecedor.
  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/autoavaliacao')
  lancarAutoavaliacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AutoavaliacaoDto,
  ) {
    return this.service.lancarAutoavaliacao(id, dto);
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
    @Body() dto: HomologacaoDto,
  ) {
    return this.service.atualizar(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
