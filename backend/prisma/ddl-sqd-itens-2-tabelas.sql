-- DDL da Homologacao de Itens (SQD), parte 2 de 2: tabelas.
--
-- Espelha o BDBR.QUA.FMR.025.01 (Registro de Homologacao de Itens, aba
-- "Lista") e o modelo de relatorio de inspecao (abas AMOSTRAS = FMR.011.06 e
-- VISUAL = FMR.06.07). Um registro tem N relatorios: cada tentativa e um
-- relatorio novo sob o mesmo numero, com a revisao igual ao numero da
-- tentativa.
--
-- 100% aditivo: so cria tabelas, indices e chaves estrangeiras novas.
-- Idempotente: pode ser executado mais de uma vez sem erro.
--
-- Rodar DEPOIS da parte 1, com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-sqd-itens-2-tabelas.sql --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS "HomologacaoItem" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "semana" TEXT NOT NULL,
    "fornecedorNome" TEXT NOT NULL,
    "codigoFornecedor" TEXT,
    "itemCodigo" TEXT,
    "itemDescricao" TEXT,
    "solicitante" "SolicitanteSqd",
    "motivo" "MotivoHomologacaoItem",
    "custoEvitado" DOUBLE PRECISION,
    "dataSolicitacao" TIMESTAMP(3),
    "dataEnvioRelatorio" TIMESTAMP(3),
    "leadTimeDiasUteis" INTEGER,
    "dataRetornoFornecedor" TIMESTAMP(3),
    "tempoRespostaDiasUteis" INTEGER,
    "dataFinalizacao" TIMESTAMP(3),
    "tempoTotalDiasUteis" INTEGER,
    "resultado" "ResultadoHomologacaoItem",
    "statusHomologacao" "StatusHomologacao" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "statusPlanoAcao" "StatusPlanoAcaoSqd",
    "dataReavaliacao" TIMESTAMP(3),
    "efetividadePlanoAcao" "EfetividadePlanoAcao",
    "acao" TEXT,
    "observacoes" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomologacaoItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RelatorioInspecaoItem" (
    "id" SERIAL NOT NULL,
    "homologacaoId" INTEGER NOT NULL,
    "tentativa" INTEGER NOT NULL DEFAULT 1,
    "revisao" TEXT NOT NULL DEFAULT '01',
    "dataInspecao" TIMESTAMP(3),
    "origem" "OrigemInspecao" NOT NULL DEFAULT 'HOMOLOGACAO',
    "desenhoRev" TEXT,
    "tolerancias" TEXT,
    "nf" TEXT,
    "po" TEXT,
    "qtdInspecionada" DOUBLE PRECISION,
    "qtdTotal" DOUBLE PRECISION,
    "elaboradoPor" TEXT,
    "inspecionadoPor" TEXT,
    "cotas" JSONB,
    "observacoesAmostras" TEXT,
    "resultadoAmostras" "ResultadoInspecao",
    "checklistVisual" JSONB,
    "evidenciasVisual" TEXT,
    "observacoesVisual" TEXT,
    "resultadoVisual" "ResultadoInspecao",
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioInspecaoItem_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------- indices
CREATE UNIQUE INDEX IF NOT EXISTS "HomologacaoItem_numero_key" ON "HomologacaoItem"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "HomologacaoItem_ano_sequencial_key" ON "HomologacaoItem"("ano", "sequencial");
CREATE INDEX IF NOT EXISTS "HomologacaoItem_dataSolicitacao_idx" ON "HomologacaoItem"("dataSolicitacao");
CREATE UNIQUE INDEX IF NOT EXISTS "RelatorioInspecaoItem_homologacaoId_tentativa_key" ON "RelatorioInspecaoItem"("homologacaoId", "tentativa");

-- --------------------------------------------------- chaves estrangeiras
ALTER TABLE "HomologacaoItem" DROP CONSTRAINT IF EXISTS "HomologacaoItem_criadoPorId_fkey";
ALTER TABLE "HomologacaoItem" ADD CONSTRAINT "HomologacaoItem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RelatorioInspecaoItem" DROP CONSTRAINT IF EXISTS "RelatorioInspecaoItem_homologacaoId_fkey";
ALTER TABLE "RelatorioInspecaoItem" ADD CONSTRAINT "RelatorioInspecaoItem_homologacaoId_fkey" FOREIGN KEY ("homologacaoId") REFERENCES "HomologacaoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RelatorioInspecaoItem" DROP CONSTRAINT IF EXISTS "RelatorioInspecaoItem_criadoPorId_fkey";
ALTER TABLE "RelatorioInspecaoItem" ADD CONSTRAINT "RelatorioInspecaoItem_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
