import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { PainelManufaturaService } from './painel.service';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.MANUFATURA)
@Controller('manufatura/painel')
export class PainelManufaturaController {
  constructor(private service: PainelManufaturaService) {}

  @Get('kpis')
  kpis(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.service.kpis(de, ate);
  }

  @Get('evolucao-maquinas')
  evolucao() {
    return this.service.evolucaoMaquinas();
  }

  @Roles('QUALIDADE', 'ADMIN')
  @Post('fechar-trimestre')
  fecharTrimestre() {
    return this.service.fecharTrimestre();
  }
}
