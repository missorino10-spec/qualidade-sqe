import { Module } from '@nestjs/common';
import { AnexosController } from './anexos.controller';
import { StorageService } from './storage.service';

@Module({
  controllers: [AnexosController],
  providers: [StorageService],
  exports: [StorageService],
})
export class AnexosModule {}
