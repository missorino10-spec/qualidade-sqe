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
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { ModuloSistema } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
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

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQE)
@Controller('registros-entrada')
export class RegistrosEntradaController {
  constructor(private service: InspecoesService) {}

  @Get()
  listar(@Query('fornecedorId') fornecedorId?: string) {
    return this.service.listarEntradas(
      fornecedorId ? Number(fornecedorId) : undefined,
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
