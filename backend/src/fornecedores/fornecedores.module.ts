import { Module } from '@nestjs/common';
import { FornecedoresController } from './fornecedores.controller';

@Module({
  controllers: [FornecedoresController],
})
export class FornecedoresModule {}
