import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { existsSync } from 'fs';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { PeriodicidadeModule } from './periodicidade/periodicidade.module';
import { ItensModule } from './itens/itens.module';
import { InstrumentosModule } from './instrumentos/instrumentos.module';
import { AnexosModule } from './anexos/anexos.module';
import { HistoricoModule } from './historico/historico.module';
import { InspecoesModule } from './sqe/inspecoes/inspecoes.module';
import { RncModule } from './sqe/rnc/rnc.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MaquinasModule } from './manufatura/maquinas/maquinas.module';
import { DefeitosModule } from './manufatura/defeitos/defeitos.module';
import { InspecoesManufaturaModule } from './manufatura/inspecoes/inspecoes-manufatura.module';
import { CnqModule } from './manufatura/cnq/cnq.module';
import { OitoDModule } from './manufatura/oitod/oitod.module';
import { CincoGModule } from './manufatura/cincog/cincog.module';
import { AlertasModule } from './manufatura/alertas/alertas.module';
import { PainelManufaturaModule } from './manufatura/painel/painel.module';
import { HomologacoesModule } from './sqd/homologacoes/homologacoes.module';
import { HomologacoesItensModule } from './sqd/homologacoes-itens/homologacoes-itens.module';
import { AuditoriasModule } from './sqd/auditorias/auditorias.module';
import { PainelSqdModule } from './sqd/painel/painel-sqd.module';

// Pasta com o frontend ja compilado (usada no pacote portatil, onde o proprio
// backend serve as telas numa unica porta). No modo Docker/dev o nginx serve o
// frontend e esta pasta pode nao existir — por isso so ativamos se ela existir.
const frontendDir =
  process.env.FRONTEND_DIR || join(process.cwd(), 'public');
const servirFrontend = existsSync(frontendDir);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(servirFrontend
      ? [
          ServeStaticModule.forRoot({
            rootPath: frontendDir,
            exclude: ['/api*'],
          }),
        ]
      : []),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    FornecedoresModule,
    PeriodicidadeModule,
    ItensModule,
    InstrumentosModule,
    AnexosModule,
    HistoricoModule,
    InspecoesModule,
    RncModule,
    DashboardModule,
    MaquinasModule,
    DefeitosModule,
    InspecoesManufaturaModule,
    CnqModule,
    OitoDModule,
    CincoGModule,
    AlertasModule,
    PainelManufaturaModule,
    HomologacoesModule,
    HomologacoesItensModule,
    AuditoriasModule,
    PainelSqdModule,
  ],
})
export class AppModule {}
