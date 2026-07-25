import { Module } from '@nestjs/common';
import { EntregasController } from './entregas.controller';

@Module({
  controllers: [EntregasController],
})
export class EntregasModule {}
