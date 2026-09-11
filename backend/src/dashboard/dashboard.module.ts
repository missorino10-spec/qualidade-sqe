import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { AvaliacaoModule } from '../sqe/avaliacao/avaliacao.module';

@Module({
  imports: [AvaliacaoModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
