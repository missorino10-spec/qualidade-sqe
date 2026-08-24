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
  @IsOptional() @IsString() auditores?: string;
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
  @IsOptional() @IsString() auditores?: string;
  @IsOptional() @IsString() participantes?: string;
  @IsOptional() @IsString() local?: string;
  // [{ codigo, resposta: SIM|PARCIAL|NAO|NAO_APLICAVEL, evidencia }]
  @IsOptional() @IsArray() respostas?: any[];
  @IsOptional() @IsString() conclusao?: string;
  @IsOptional() @IsString() observacoes?: string;
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
  listar(@Query('ano') ano?: string) {
    return this.service.listar(ano ? Number(ano) : undefined);
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
