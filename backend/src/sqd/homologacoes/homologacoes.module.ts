import { Module } from '@nestjs/common';
import { HomologacoesController } from './homologacoes.controller';
import { HomologacoesService } from './homologacoes.service';

@Module({
  controllers: [HomologacoesController],
  providers: [HomologacoesService],
  exports: [HomologacoesService],
})
export class HomologacoesModule {}
