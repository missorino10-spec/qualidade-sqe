import { Module } from '@nestjs/common';
import { PeriodicidadeController } from './periodicidade.controller';

@Module({
  controllers: [PeriodicidadeController],
})
export class PeriodicidadeModule {}
