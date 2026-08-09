-- DDL da Auditoria de Fornecedores (SQD), parte 1 de 2: enums.
--
-- Espelha a planilha "Checklist Auditoria" (abas Checklist, Pontuacao e
-- Resumo) e o relatorio de auditoria (RT).
--
-- Precisa ficar separado da parte 2 porque o Postgres nao aceita usar um
-- valor de enum na mesma transacao em que o enum foi criado ou alterado.
--
-- 100% aditivo e idempotente. Rodar com o DIRECT_URL (porta 5432):
--   npx prisma db execute --file prisma/ddl-sqd-auditorias-1-enum.sql --url "$DIRECT_URL"

-- Regra de nota definida pela Qualidade:
--   >= 90      -> APROVADO
--   80 a 89,99 -> APROVADO_CONDICIONALMENTE (reavaliacao em 180 dias corridos)
--   < 80       -> REPROVADO (reavaliacao em 90 dias corridos)
DO $$ BEGIN
  CREATE TYPE "ResultadoAuditoria" AS ENUM ('APROVADO', 'APROVADO_CONDICIONALMENTE', 'REPROVADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A auditoria nunca fecha sozinha: mesmo aprovada, o ciclo so termina quando
-- a Qualidade encerra o registro.
DO $$ BEGIN
  CREATE TYPE "StatusAuditoria" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
