import { Module } from '@nestjs/common';
import { RncService } from './rnc.service';
import { RncController } from './rnc.controller';

@Module({
  providers: [RncService],
  controllers: [RncController],
  exports: [RncService],
})
export class RncModule {}
