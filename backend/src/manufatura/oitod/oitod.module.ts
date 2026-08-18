import { Module } from '@nestjs/common';
import { OitoDController } from './oitod.controller';
import { OitoDService } from './oitod.service';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  // O PDF do 8D leva as fotos de cada passo, entao precisa do Storage.
  imports: [AnexosModule],
  controllers: [OitoDController],
  providers: [OitoDService],
  exports: [OitoDService],
})
export class OitoDModule {}
