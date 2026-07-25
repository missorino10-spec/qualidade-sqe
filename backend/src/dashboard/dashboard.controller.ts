import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
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

  @UseGuards(RolesGuard)
  @Roles('QUALIDADE', 'ADMIN')
  @Post('fechar-trimestre')
  fecharTrimestre() {
    return this.service.fecharTrimestre();
  }
}
