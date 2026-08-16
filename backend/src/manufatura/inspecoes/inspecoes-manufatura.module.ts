import { Module } from '@nestjs/common';
import { InspecoesManufaturaController } from './inspecoes-manufatura.controller';
import { InspecoesManufaturaService } from './inspecoes-manufatura.service';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  // AnexosModule entra pelo StorageService: o PDF precisa dos bytes das fotos
  // dos blocos de evidencia.
  imports: [AnexosModule],
  controllers: [InspecoesManufaturaController],
  providers: [InspecoesManufaturaService],
  exports: [InspecoesManufaturaService],
})
export class InspecoesManufaturaModule {}
