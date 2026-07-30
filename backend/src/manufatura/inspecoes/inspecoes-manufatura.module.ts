import { Module } from '@nestjs/common';
import { InspecoesManufaturaController } from './inspecoes-manufatura.controller';
import { InspecoesManufaturaService } from './inspecoes-manufatura.service';

@Module({
  controllers: [InspecoesManufaturaController],
  providers: [InspecoesManufaturaService],
  exports: [InspecoesManufaturaService],
})
export class InspecoesManufaturaModule {}
