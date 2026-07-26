import { Module } from '@nestjs/common';
import { RncService } from './rnc.service';
import { RncController } from './rnc.controller';
import { AnexosModule } from '../../anexos/anexos.module';

@Module({
  imports: [AnexosModule],
  providers: [RncService],
  controllers: [RncController],
  exports: [RncService],
})
export class RncModule {}
