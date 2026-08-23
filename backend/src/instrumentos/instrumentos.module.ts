import { Module } from '@nestjs/common';
import { InstrumentosController } from './instrumentos.controller';

@Module({
  controllers: [InstrumentosController],
})
export class InstrumentosModule {}
