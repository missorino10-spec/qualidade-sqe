import { Module } from '@nestjs/common';
import { CnqController } from './cnq.controller';
import { CnqService } from './cnq.service';

@Module({
  controllers: [CnqController],
  providers: [CnqService],
  exports: [CnqService],
})
export class CnqModule {}
