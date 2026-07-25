import { Module } from '@nestjs/common';
import { PlanejamentoController } from './planejamento.controller';

@Module({
  controllers: [PlanejamentoController],
})
export class PlanejamentoModule {}
