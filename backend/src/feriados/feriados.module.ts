import { Global, Module } from '@nestjs/common';
import { FeriadosController } from './feriados.controller';
import { FeriadosService } from './feriados.service';

// Global como o Prisma: quase todo modulo que calcula prazo precisa do
// calendario, e ficar importando este modulo em cada um seria so ruido.
@Global()
@Module({
  controllers: [FeriadosController],
  providers: [FeriadosService],
  exports: [FeriadosService],
})
export class FeriadosModule {}
