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
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { ModuloSistema } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { periodoTexto, responderRelatorio } from '../../comum/relatorio-lista';
import { InspecoesService } from './inspecoes.service';

// Registro de entrada: a chegada da carga, que e o ponto de partida do SQE.
// Fora do ciclo de periodicidade o registro se encerra aqui - nada alem do
// fornecedor e exigido. Dentro do ciclo (ou quando a Qualidade pede uma
// inspecao extra) a tela leva o inspetor para a inspecao, que se prende a
// esta entrada.
class RegistroEntradaDto {
  @Type(() => Number) @IsInt() fornecedorId: number;
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() dataEntrega?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qtdTotal?: number;
  // Inspecionar mesmo estando fora do ciclo.
  @IsOptional() @IsBoolean() extra?: boolean;
}

// Na correcao nao entra fornecedorId: trocar o fornecedor mudaria a decisao de
// inspecao que ja foi tomada na chegada. O ValidationPipe roda com whitelist,
// entao um fornecedorId enviado por engano e descartado antes do servico.
class EditarRegistroEntradaDto {
  @IsOptional() @Type(() => Number) @IsInt() itemId?: number;
  @IsOptional() @IsString() dataEntrega?: string;
  @IsOptional() @IsString() notaFiscal?: string;
  @IsOptional() @IsString() po?: string;
  @IsOptional() @Type(() => Number) @IsNumber() qtdTotal?: number;
}

// As mesmas palavras da etiqueta de Situação da tela: quem confere o papel
// contra a lista tem que ler a mesma coisa nos dois.
const ROTULO_SITUACAO: Record<string, string> = {
  FORA_DO_CICLO: 'Fora do ciclo',
  INSPECAO_PENDENTE: 'Inspeção pendente',
  INSPECAO_REALIZADA: 'Inspeção realizada',
  INSPECAO_EXTRA: 'Inspeção extra',
};

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQE)
@Controller('registros-entrada')
export class RegistrosEntradaController {
  constructor(private service: InspecoesService) {}

  @Get()
  listar(
    @Query('fornecedorId') fornecedorId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.service.listarEntradas({
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
    @Query('fornecedorId') fornecedorId?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    const id = fornecedorId ? Number(fornecedorId) : undefined;
    const entradas = await this.service.listarEntradas({
      fornecedorId: id,
      de,
      ate,
    });
    const conta = (s: string) =>
      entradas.filter((e: any) => e.situacao === s).length;
    await responderRelatorio(
      res,
      {
        titulo: 'Registros de Entrada',
        emitidoPor: user.nome,
        filtros: [
          { rotulo: 'Período', valor: periodoTexto(de, ate) },
          {
            rotulo: 'Fornecedor',
            valor: id
              ? ((entradas[0] as any)?.fornecedor?.nome ?? String(id))
              : 'Todos',
          },
        ],
        totais: [
          { rotulo: 'Entradas', valor: String(entradas.length) },
          { rotulo: 'Fora do ciclo', valor: String(conta('FORA_DO_CICLO')) },
          {
            rotulo: 'Inspecionadas',
            valor: String(
              conta('INSPECAO_REALIZADA') + conta('INSPECAO_EXTRA'),
            ),
          },
          {
            rotulo: 'Inspeção pendente',
            valor: String(conta('INSPECAO_PENDENTE')),
          },
        ],
        colunas: [
          {
            titulo: 'Data',
            peso: 45,
            valor: (e: any) => e.dataEntrega,
            tipo: 'data',
          },
          { titulo: 'Semana', peso: 35, valor: (e: any) => e.semana },
          {
            titulo: 'Fornecedor',
            peso: 120,
            valor: (e: any) => e.fornecedor?.nome,
          },
          {
            titulo: 'Item',
            peso: 140,
            valor: (e: any) =>
              [e.item?.codigo, e.item?.descricao].filter(Boolean).join(' — '),
          },
          { titulo: 'Nota Fiscal', peso: 55, valor: (e: any) => e.notaFiscal },
          { titulo: 'PO', peso: 50, valor: (e: any) => e.po },
          {
            titulo: 'Situação',
            peso: 70,
            valor: (e: any) => ROTULO_SITUACAO[e.situacao] ?? e.situacao,
          },
          {
            titulo: 'Inspeção',
            peso: 60,
            valor: (e: any) => e.numeroInspecao,
          },
          {
            titulo: 'Registrado por',
            peso: 80,
            valor: (e: any) => e.registradoPor?.nome,
          },
        ],
        linhas: entradas,
      },
      formato,
    );
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number) {
    return this.service.entrada(id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post()
  criar(@Body() dto: RegistroEntradaDto, @CurrentUser() user: AuthUser) {
    return this.service.registrarRecebimento(dto, user.id);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EditarRegistroEntradaDto,
  ) {
    return this.service.atualizarEntrada(id, dto);
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Delete(':id')
  excluir(@Param('id', ParseIntPipe) id: number) {
    return this.service.excluirEntrada(id);
  }
}
