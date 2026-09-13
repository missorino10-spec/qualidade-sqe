import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { HistoricoService } from './historico.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntidadeModuloGuard } from '../auth/entidade-modulo.guard';

// O historico e uma tabela so para o sistema inteiro. Quem manda no acesso e o
// "entidadeTipo" da linha: o historico de uma RNC so aparece para quem tem SQE.
@UseGuards(JwtAuthGuard, EntidadeModuloGuard)
@Controller('historico')
export class HistoricoController {
  constructor(private service: HistoricoService) {}

  @Get(':entidadeTipo/:entidadeId')
  listar(
    @Param('entidadeTipo') entidadeTipo: string,
    // ParseIntPipe no lugar do Number(): um id nao numerico virava NaN, chegava
    // no Prisma e voltava como erro 500. Agora para no pipe, com 400.
    @Param('entidadeId', ParseIntPipe) entidadeId: number,
  ) {
    return this.service.listar(entidadeTipo, entidadeId);
  }
}
