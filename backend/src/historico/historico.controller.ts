import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { HistoricoService } from './historico.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('historico')
export class HistoricoController {
  constructor(private service: HistoricoService) {}

  @Get(':entidadeTipo/:entidadeId')
  listar(
    @Param('entidadeTipo') entidadeTipo: string,
    @Param('entidadeId') entidadeId: string,
  ) {
    return this.service.listar(entidadeTipo, Number(entidadeId));
  }
}
