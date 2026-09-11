import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../auth/modulo.decorator';
import { PermissaoGuard } from '../auth/permissao.guard';

@UseGuards(JwtAuthGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQE)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('kpis-sqe')
  kpisSqe(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.service.kpisSqe(de, ate);
  }

  @Get('evolucao-fornecedores')
  evolucaoFornecedores() {
    return this.service.evolucaoFornecedores();
  }

  @Get('historico-classificacao')
  historicoClassificacao(@Query('fornecedorId') fornecedorId?: string) {
    return this.service.historicoClassificacao(
      fornecedorId ? Number(fornecedorId) : undefined,
    );
  }
}
