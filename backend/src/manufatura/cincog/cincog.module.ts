import { Module } from '@nestjs/common';
import { CincoGController } from './cincog.controller';
import { CincoGService } from './cincog.service';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  // O PDF do 5G leva as evidencias do processo investigado: precisa do Storage.
  imports: [AnexosModule],
  controllers: [CincoGController],
  providers: [CincoGService],
  exports: [CincoGService],
})
export class CincoGModule {}
