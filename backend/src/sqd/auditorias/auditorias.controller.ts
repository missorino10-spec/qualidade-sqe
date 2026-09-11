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
import { periodoTexto, responderRelatorio } from '../../comum/relatorio-lista';
import { AuditoriasService } from './auditorias.service';
import {
  gerarPdfRegistroAuditoria,
  gerarPdfChecklistAuditoria,
} from './auditoria-pdf';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

// Registro da auditoria de fornecedor (cabecalho da aba "Checklist").
class AuditoriaDto {
  @IsOptional() @IsString() fornecedorNome?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() codigoFornecedor?: string;
  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsString() local?: string;
  // "Auditores responsáveis" nao vem mais do formulario: o sistema assina com
  // o usuario logado. "Participantes" continua digitado - sao as pessoas do
  // fornecedor, que nao tem login aqui.
  @IsOptional() @IsString() participantes?: string;
  @IsOptional() @IsString() dataAuditoria?: string;

  @IsOptional() @IsString() conclusao?: string;
  @IsOptional() @IsString() observacoes?: string;

  // "Finalizado" nao entra por aqui: salvar o registro nunca e bloqueado, quem
  // encerra o ciclo (e cobra o que falta) e a rota /finalizar.
  @IsOptional()
  @IsIn(['EM_ANDAMENTO', 'CANCELADO'])
  statusAuditoria?: string;
}

// Checklist preenchido. Sem "rodada" abre uma passada nova (reavaliacao);
// com "rodada" corrige a existente.
class RodadaAuditoriaDto {
  @IsOptional() @IsNumber() rodada?: number;
  @IsOptional() @IsString() dataAuditoria?: string;
  // Idem: quem assina a rodada e o usuario logado (criadoPorId).
  @IsOptional() @IsString() participantes?: string;
  @IsOptional() @IsString() local?: string;
  // [{ codigo, resposta: SIM|PARCIAL|NAO|NAO_APLICAVEL, evidencia }]
  @IsOptional() @IsArray() respostas?: any[];
  @IsOptional() @IsString() conclusao?: string;
  @IsOptional() @IsString() observacoes?: string;
}

// O relatorio sai com as mesmas palavras da tela: quem exporta compara o papel
// com a lista e os dois tem que dizer a mesma coisa.
const ROTULO_STATUS_AUDITORIA: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
};

const ROTULO_RESULTADO_AUDITORIA: Record<string, string> = {
  APROVADO: 'Aprovado',
  APROVADO_CONDICIONALMENTE: 'Aprovado Condicionalmente',
  REPROVADO: 'Reprovado',
  CANCELADO: 'Cancelado',
};

// Mesma leitura do semaforo da tela (pages/sqd/comum.ts): o papel precisa
// dizer ate quando reavaliar e quanto falta, nao so a cor.
function textoReavaliacao(r: any): string {
  if (!r?.dataLimite) return '';
  const limite = new Date(r.dataLimite).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
  });
  const dias = Math.abs(r.diasRestantes);
  const plural = dias === 1 ? '' : 's';
  if (r.diasRestantes < 0) {
    return `Reavaliar até ${limite} · vencida há ${dias} dia${plural}`;
  }
  if (r.diasRestantes === 0) return `Reavaliar até ${limite} · vence hoje`;
  return `Reavaliar até ${limite} · faltam ${dias} dia${plural}`;
}

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQD)
@Controller('sqd/auditorias')
export class AuditoriasController {
  constructor(private service: AuditoriasService) {}

  // Catalogo do checklist (12 blocos, 46 perguntas) para montar a tela.
  @Get('formulario')
  formulario() {
    return this.service.formulario();
  }

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
        titulo: 'Auditoria de Fornecedores',
        emitidoPor: user.nome,
        filtros: [{ rotulo: 'Período', valor: periodoTexto(de, ate) }],
        colunas: [
          { titulo: 'Número', peso: 60, valor: (a: any) => a.numero },
          { titulo: 'Rev.', peso: 25, valor: (a: any) => a.revisao },
          {
            titulo: 'Auditoria',
            peso: 45,
            valor: (a: any) => a.dataAuditoria,
            tipo: 'data',
          },
          { titulo: 'Semana', peso: 35, valor: (a: any) => a.semana },
          {
            titulo: 'Fornecedor',
            peso: 120,
            valor: (a: any) => a.fornecedorNome,
          },
          { titulo: 'Motivo', peso: 100, valor: (a: any) => a.motivo },
          {
            titulo: 'Nota',
            peso: 35,
            valor: (a: any) => a.nota,
            tipo: 'numero',
            negrito: true,
          },
          {
            titulo: 'Resultado',
            peso: 90,
            valor: (a: any) =>
              a.resultado
                ? (ROTULO_RESULTADO_AUDITORIA[a.resultado] ?? a.resultado)
                : 'Aguardando checklist',
          },
          {
            titulo: 'Reavaliação',
            peso: 130,
            valor: (a: any) => textoReavaliacao(a.reavaliacao),
          },
          {
            titulo: 'Status',
            peso: 55,
            valor: (a: any) =>
              ROTULO_STATUS_AUDITORIA[a.statusAuditoria] ?? a.statusAuditoria,
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

  // Registro da auditoria em PDF, para controles internos e evidências.
  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const a = await this.service.detalhe(id);
    this.enviarPdf(res, `${a.numero.replace('/', '-')}-registro.pdf`);
    const doc = gerarPdfRegistroAuditoria(a);
    doc.pipe(res);
    doc.end();
  }

  // Checklist de auditoria preenchido (Anexo 1 do relatório de auditoria).
  // Sem ?rodada= sai a mais recente.
  @Get(':id/checklist/pdf')
  async pdfChecklist(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
    @Query('rodada') rodada?: string,
  ) {
    const a = await this.service.detalhe(id);
    const doc = gerarPdfChecklistAuditoria(a, rodada ? Number(rodada) : undefined);
    this.enviarPdf(res, `${a.numero.replace('/', '-')}-checklist.pdf`);
    doc.pipe(res);
    doc.end();
  }

  private enviarPdf(res: Response, nomeArquivo: string) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: AuditoriaDto, @CurrentUser() user: AuthUser) {
    return this.service.criar(dto, user.id);
  }

  // Lancamento (ou correcao) do checklist de uma rodada de auditoria.
  @Roles('QUALIDADE', 'ADMIN')
  @Post(':id/rodada')
  salvarRodada(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RodadaAuditoriaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.salvarRodada(id, dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id/rodada/:rodada')
  removerRodada(
    @Param('id', ParseIntPipe) id: number,
    @Param('rodada', ParseIntPipe) rodada: number,
  ) {
    return this.service.removerRodada(id, rodada);
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
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: AuditoriaDto) {
    return this.service.atualizar(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.service.remover(id);
  }
}
