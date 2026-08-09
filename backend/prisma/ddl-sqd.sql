-- DDL ADITIVO do modulo SQD (homologacao de fornecedores).
-- Nada e apagado nem alterado: cria 5 enums e 1 tabela novos.
-- Rodar com o DIRECT_URL (pooler na porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-sqd.sql --url "$DIRECT_URL"
-- Idempotente: pode ser executado mais de uma vez sem erro.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ResultadoHomologacao') THEN
    CREATE TYPE "ResultadoHomologacao" AS ENUM ('APROVADO', 'APROVADO_CONDICIONALMENTE', 'REPROVADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusHomologacao') THEN
    CREATE TYPE "StatusHomologacao" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusPlanoAcaoSqd') THEN
    CREATE TYPE "StatusPlanoAcaoSqd" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO', 'NAO_APLICAVEL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EfetividadePlanoAcao') THEN
    CREATE TYPE "EfetividadePlanoAcao" AS ENUM ('NAO_APLICAVEL_CANCELADO', 'NAO_IMPLEMENTADO_ATRASADO', 'EFETIVO', 'PARCIALMENTE_EFETIVO', 'INEFICAZ');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SolicitanteSqd') THEN
    CREATE TYPE "SolicitanteSqd" AS ENUM ('COMPRAS', 'ENGENHARIA', 'NC');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "HomologacaoFornecedor" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "semana" TEXT NOT NULL,
    "fornecedorNome" TEXT NOT NULL,
    "cnpj" TEXT,
    "inscricaoEstadual" TEXT,
    "responsavelInfo" TEXT,
    "setor" TEXT,
    "dataAvaliacao" TIMESTAMP(3) NOT NULL,
    "respostas" JSONB NOT NULL,
    "blocos" JSONB NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "resultado" "ResultadoHomologacao" NOT NULL,
    "codigoFornecedor" TEXT,
    "solicitante" "SolicitanteSqd",
    "segmento" TEXT,
    "escopoFornecedor" TEXT,
    "processosTerceirizados" TEXT,
    "dataSolicitacao" TIMESTAMP(3),
    "dataEnvioRelatorio" TIMESTAMP(3),
    "leadTimeDiasUteis" INTEGER,
    "statusHomologacao" "StatusHomologacao" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "statusPlanoAcao" "StatusPlanoAcaoSqd",
    "dataReavaliacao" TIMESTAMP(3),
    "efetividadePlanoAcao" "EfetividadePlanoAcao",
    "acao" TEXT,
    "observacoes" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomologacaoFornecedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HomologacaoFornecedor_numero_key" ON "HomologacaoFornecedor"("numero");
CREATE INDEX IF NOT EXISTS "HomologacaoFornecedor_dataAvaliacao_idx" ON "HomologacaoFornecedor"("dataAvaliacao");
CREATE UNIQUE INDEX IF NOT EXISTS "HomologacaoFornecedor_ano_sequencial_key" ON "HomologacaoFornecedor"("ano", "sequencial");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HomologacaoFornecedor_criadoPorId_fkey'
  ) THEN
    ALTER TABLE "HomologacaoFornecedor"
      ADD CONSTRAINT "HomologacaoFornecedor_criadoPorId_fkey"
      FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
