import { Module } from '@nestjs/common';
import { PainelManufaturaController } from './painel.controller';
import { PainelManufaturaService } from './painel.service';

@Module({
  controllers: [PainelManufaturaController],
  providers: [PainelManufaturaService],
})
export class PainelManufaturaModule {}
