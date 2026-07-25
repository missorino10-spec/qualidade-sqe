import { Module } from '@nestjs/common';
import { ItensController } from './itens.controller';

@Module({
  controllers: [ItensController],
})
export class ItensModule {}
