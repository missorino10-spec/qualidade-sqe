-- DDL da Auditoria de Fornecedores (SQD), parte 2 de 2: tabelas.
--
-- Espelha a planilha "Checklist Auditoria" (46 perguntas em 12 blocos com peso)
-- e o relatorio de auditoria (RT). Um registro = uma auditoria (um evento/motivo)
-- com N rodadas dentro: a rodada 01 e a auditoria inicial e as seguintes sao as
-- reavaliacoes. A revisao e o proprio numero da rodada (01, 02...).
--
-- 100% aditivo: so cria tabelas, indices e chaves estrangeiras novas.
-- Idempotente: pode ser executado mais de uma vez sem erro.
--
-- Rodar DEPOIS da parte 1, com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-sqd-auditorias-2-tabelas.sql --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS "AuditoriaFornecedor" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "semana" TEXT NOT NULL,
    "fornecedorNome" TEXT NOT NULL,
    "cnpj" TEXT,
    "codigoFornecedor" TEXT,
    "motivo" TEXT,
    "local" TEXT,
    "auditores" TEXT,
    "participantes" TEXT,
    "dataAuditoria" TIMESTAMP(3),
    "dataUltimaRodada" TIMESTAMP(3),
    "nota" DOUBLE PRECISION,
    "resultado" "ResultadoAuditoria",
    "prazoReavaliacaoDias" INTEGER,
    "dataLimiteReavaliacao" TIMESTAMP(3),
    "conclusao" TEXT,
    "observacoes" TEXT,
    "statusAuditoria" "StatusAuditoria" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "dataFinalizacao" TIMESTAMP(3),
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditoriaFornecedor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RodadaAuditoria" (
    "id" SERIAL NOT NULL,
    "auditoriaId" INTEGER NOT NULL,
    "rodada" INTEGER NOT NULL DEFAULT 1,
    "revisao" TEXT NOT NULL DEFAULT '01',
    "dataAuditoria" TIMESTAMP(3),
    "auditores" TEXT,
    "participantes" TEXT,
    "local" TEXT,
    "respostas" JSONB,
    "blocos" JSONB,
    "nota" DOUBLE PRECISION,
    "resultado" "ResultadoAuditoria",
    "conclusao" TEXT,
    "observacoes" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RodadaAuditoria_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------- indices
CREATE UNIQUE INDEX IF NOT EXISTS "AuditoriaFornecedor_numero_key" ON "AuditoriaFornecedor"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "AuditoriaFornecedor_ano_sequencial_key" ON "AuditoriaFornecedor"("ano", "sequencial");
CREATE INDEX IF NOT EXISTS "AuditoriaFornecedor_dataAuditoria_idx" ON "AuditoriaFornecedor"("dataAuditoria");
CREATE UNIQUE INDEX IF NOT EXISTS "RodadaAuditoria_auditoriaId_rodada_key" ON "RodadaAuditoria"("auditoriaId", "rodada");

-- --------------------------------------------------- chaves estrangeiras
ALTER TABLE "AuditoriaFornecedor" DROP CONSTRAINT IF EXISTS "AuditoriaFornecedor_criadoPorId_fkey";
ALTER TABLE "AuditoriaFornecedor" ADD CONSTRAINT "AuditoriaFornecedor_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RodadaAuditoria" DROP CONSTRAINT IF EXISTS "RodadaAuditoria_auditoriaId_fkey";
ALTER TABLE "RodadaAuditoria" ADD CONSTRAINT "RodadaAuditoria_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "AuditoriaFornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RodadaAuditoria" DROP CONSTRAINT IF EXISTS "RodadaAuditoria_criadoPorId_fkey";
ALTER TABLE "RodadaAuditoria" ADD CONSTRAINT "RodadaAuditoria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
