-- DDL do Alerta da Qualidade (Manufatura), parte 1 de 2: enum.
--
-- Precisa ficar separado da parte 2 porque o Postgres nao aceita usar um
-- valor de enum na mesma transacao em que o enum foi criado.
--
-- 100% aditivo e idempotente. Rodar com o DIRECT_URL (porta 5432):
--   npx prisma db execute --file prisma/ddl-alerta-qualidade-1-enum.sql --url "$DIRECT_URL"

-- ABERTO e RENOVADO sao as duas situacoes em que o alerta ainda vale.
-- VENCIDO nao entra aqui de proposito: e calculado (prazo passado com o
-- alerta ainda em aberto), para que encerrar fora do prazo nao deixe o
-- registro marcado como vencido para sempre.
DO $$ BEGIN
  CREATE TYPE "StatusAlertaQualidade" AS ENUM ('ABERTO', 'RENOVADO', 'ENCERRADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
