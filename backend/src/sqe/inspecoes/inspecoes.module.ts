import { Module } from '@nestjs/common';
import { InspecoesController } from './inspecoes.controller';
import { InspecoesService } from './inspecoes.service';
import { RncModule } from '../rnc/rnc.module';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  // AnexosModule entra pelo StorageService: o PDF precisa dos bytes das fotos
  // do bloco EVIDENCIAS.
  imports: [RncModule, AnexosModule],
  controllers: [InspecoesController],
  providers: [InspecoesService],
})
export class InspecoesModule {}
