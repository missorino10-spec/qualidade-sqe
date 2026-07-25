import { Module } from '@nestjs/common';
import { AnexosController } from './anexos.controller';

@Module({
  controllers: [AnexosController],
})
export class AnexosModule {}
