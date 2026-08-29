import { Module } from '@nestjs/common';
import { ReclamacoesController } from './reclamacoes.controller';
import { ReclamacoesService } from './reclamacoes.service';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  // O PDF do R.O leva as fotos de evidencia: precisa do Storage.
  imports: [AnexosModule],
  controllers: [ReclamacoesController],
  providers: [ReclamacoesService],
  exports: [ReclamacoesService],
})
export class ReclamacoesModule {}
