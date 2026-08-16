import { Module } from '@nestjs/common';
import { HomologacoesItensController } from './homologacoes-itens.controller';
import { HomologacoesItensService } from './homologacoes-itens.service';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  // AnexosModule entra pelo StorageService: o PDF precisa dos bytes das fotos
  // do bloco EVIDENCIAS.
  imports: [AnexosModule],
  controllers: [HomologacoesItensController],
  providers: [HomologacoesItensService],
  exports: [HomologacoesItensService],
})
export class HomologacoesItensModule {}
