import { Module } from '@nestjs/common';
import { DefeitosController } from './defeitos.controller';

@Module({
  controllers: [DefeitosController],
})
export class DefeitosModule {}
