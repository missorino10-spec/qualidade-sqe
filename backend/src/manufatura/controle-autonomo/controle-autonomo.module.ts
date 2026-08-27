import { Module } from '@nestjs/common';
import { ControleAutonomoController } from './controle-autonomo.controller';
import { ControleAutonomoService } from './controle-autonomo.service';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  // O PDF do ICAQ leva as fotos de evidencia: precisa do Storage.
  imports: [AnexosModule],
  controllers: [ControleAutonomoController],
  providers: [ControleAutonomoService],
  exports: [ControleAutonomoService],
})
export class ControleAutonomoModule {}
