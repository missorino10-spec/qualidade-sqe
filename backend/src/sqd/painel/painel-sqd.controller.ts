import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PainelSqdService } from './painel-sqd.service';
import { ModuloSistema } from '@prisma/client';
import { Modulo } from '../../auth/modulo.decorator';
import { PermissaoGuard } from '../../auth/permissao.guard';

@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)
@Modulo(ModuloSistema.SQD)
@Controller('sqd/painel')
export class PainelSqdController {
  constructor(private service: PainelSqdService) {}

  @Get('kpis')
  kpis(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.service.kpis(de, ate);
  }

  @Get('ultimas')
  ultimas() {
    return this.service.ultimas();
  }

  @Get('itens/kpis')
  kpisItens(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.service.kpisItens(de, ate);
  }

  @Get('itens/ultimas')
  ultimasItens() {
    return this.service.ultimasItens();
  }

  @Get('auditorias/kpis')
  kpisAuditorias(@Query('de') de?: string, @Query('ate') ate?: string) {
    return this.service.kpisAuditorias(de, ate);
  }

  @Get('auditorias/ultimas')
  ultimasAuditorias() {
    return this.service.ultimasAuditorias();
  }
}
