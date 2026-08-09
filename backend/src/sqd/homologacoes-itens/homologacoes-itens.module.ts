import { Module } from '@nestjs/common';
import { HomologacoesItensController } from './homologacoes-itens.controller';
import { HomologacoesItensService } from './homologacoes-itens.service';

@Module({
  controllers: [HomologacoesItensController],
  providers: [HomologacoesItensService],
  exports: [HomologacoesItensService],
})
export class HomologacoesItensModule {}
