import { Module } from '@nestjs/common';
import { InspecoesController } from './inspecoes.controller';
import { InspecoesService } from './inspecoes.service';
import { RncModule } from '../rnc/rnc.module';

@Module({
  imports: [RncModule],
  controllers: [InspecoesController],
  providers: [InspecoesService],
})
export class InspecoesModule {}
