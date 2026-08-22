import { Module } from '@nestjs/common';
import { InspecoesManufaturaController } from './inspecoes-manufatura.controller';
import { InspecoesManufaturaService } from './inspecoes-manufatura.service';
import { InspecaoVisualManufaturaController } from './inspecao-visual.controller';
import { InspecaoVisualManufaturaService } from './inspecao-visual.service';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  // AnexosModule entra pelo StorageService: o PDF precisa dos bytes das fotos
  // dos blocos de evidencia.
  imports: [AnexosModule],
  controllers: [
    InspecoesManufaturaController,
    InspecaoVisualManufaturaController,
  ],
  providers: [InspecoesManufaturaService, InspecaoVisualManufaturaService],
  exports: [InspecoesManufaturaService, InspecaoVisualManufaturaService],
})
export class InspecoesManufaturaModule {}
