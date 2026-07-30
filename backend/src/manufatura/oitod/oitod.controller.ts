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
import { gerarPdfOitoD } from './oitod-pdf';

// Formulario 8D / Registro de Melhoria - Doc BDBR.QUA.FMR.007.01.
class OitoDDto {
  @IsOptional() @IsInt() inspecaoId?: number;
  @IsOptional() @IsInt() cnqId?: number;
  @IsOptional() @IsString() dataAbertura?: string;
  @IsOptional()
  @IsIn(['AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDO'])
  status?: any;
  // 1. Dados / cabecalho
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
  @IsOptional() @IsString() descricaoProblema?: string;
  // 2. Analise de causa raiz (6M + 5 porques)
  @IsOptional() @IsString() efeito?: string;
  @IsOptional() @IsObject() causas6M?: any;
  @IsOptional() @IsArray() porques?: any[];
  // 3. Causa raiz confirmada
  @IsOptional() @IsString() causaRaiz?: string;
  // 4. Plano de acao corretiva
  @IsOptional() @IsArray() planoAcao?: any[];
  // 5. Padronizacao
  @IsOptional() @IsObject() padronizacao?: any;
  // 7. Verificacao da eficacia
  @IsOptional() @IsObject() verificacaoEficacia?: any;
  @IsOptional() @IsString() aprovacaoProducao?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('manufatura/8d')
export class OitoDController {
  constructor(private service: OitoDService) {}

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
    const nomeArquivo = `${(d8.numero ?? `8d-${id}`).replace('/', '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const doc = gerarPdfOitoD(d8);
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
