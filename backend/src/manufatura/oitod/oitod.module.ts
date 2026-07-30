import { Module } from '@nestjs/common';
import { OitoDController } from './oitod.controller';
import { OitoDService } from './oitod.service';

@Module({
  controllers: [OitoDController],
  providers: [OitoDService],
  exports: [OitoDService],
})
export class OitoDModule {}
