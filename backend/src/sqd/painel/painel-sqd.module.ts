import { Module } from '@nestjs/common';
import { PainelSqdController } from './painel-sqd.controller';
import { PainelSqdService } from './painel-sqd.service';

@Module({
  controllers: [PainelSqdController],
  providers: [PainelSqdService],
})
export class PainelSqdModule {}
