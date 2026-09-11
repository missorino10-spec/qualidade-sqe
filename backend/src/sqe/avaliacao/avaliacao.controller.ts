import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ModuloSistema } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';
import { Modulo } from '../../auth/modulo.decorator';
import { CurrentUser, AuthUser } from '../../auth/current-user.decorator';
import { AvaliacaoService } from './avaliacao.service';

// Nota digitada a mao. Mandar null (ou omitir) devolve o criterio ao calculo
// automatico.
class NotasManuaisDto {
  @IsOptional() @IsNumber() @Min(0) @Max(10) notaC1Manual?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10) notaC2Manual?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(10) notaC3Manual?: number | null;
  @IsOptional() @IsString() justificativa?: string | null;
}

class CompetenciaDto {
  @IsNumber() ano!: number;
  @IsNumber() @Min(1) @Max(12) mes!: number;
}

@UseGuards(JwtAuthGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQE)
@Controller('avaliacao-fornecedores')
export class AvaliacaoController {
  constructor(private service: AvaliacaoService) {}

  @Get('competencia-atual')
  competenciaAtual() {
    return this.service.competenciaAtual();
  }

  @Get()
  listar(@Query('ano') ano?: string, @Query('mes') mes?: string) {
    const atual = this.service.competenciaAtual();
    return this.service.listar(
      ano ? Number(ano) : atual.ano,
      mes ? Number(mes) : atual.mes,
    );
  }

  @Get('consolidado')
  consolidado(@Query('ano') ano?: string) {
    return this.service.consolidado(
      ano ? Number(ano) : this.service.competenciaAtual().ano,
    );
  }

  @Get('fornecedor/:id')
  historico(@Param('id', ParseIntPipe) id: number) {
    return this.service.historico(id);
  }

  @UseGuards(RolesGuard)
  @Roles('QUALIDADE', 'ADMIN')
  @Put(':fornecedorId/:ano/:mes')
  salvarNotas(
    @Param('fornecedorId', ParseIntPipe) fornecedorId: number,
    @Param('ano', ParseIntPipe) ano: number,
    @Param('mes', ParseIntPipe) mes: number,
    @Body() dto: NotasManuaisDto,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.service.salvarNotas(fornecedorId, ano, mes, dto, usuario?.id);
  }

  @UseGuards(RolesGuard)
  @Roles('QUALIDADE', 'ADMIN')
  @Post('fechar')
  fechar(@Body() dto: CompetenciaDto, @CurrentUser() usuario: AuthUser) {
    return this.service.fechar(dto.ano, dto.mes, usuario?.id);
  }

  @UseGuards(RolesGuard)
  @Roles('QUALIDADE', 'ADMIN')
  @Post('reabrir')
  reabrir(@Body() dto: CompetenciaDto) {
    return this.service.reabrir(dto.ano, dto.mes);
  }
}
