import { Global, Module } from '@nestjs/common';
import { HistoricoService } from './historico.service';

// Modulo sem controller de proposito: o historico nao tem tela propria. Quem
// precisa dele le junto com o registro (a RNC ja devolve rnc.historico), entao
// e so o servico que circula, importado por quem grava e por quem le.
@Global()
@Module({
  providers: [HistoricoService],
  exports: [HistoricoService],
})
export class HistoricoModule {}
