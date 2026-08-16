-- DDL ADITIVO: DESVIO DE QUALIDADE na RNC (SQE) e na Homologacao de Item (SQD).
-- O desvio libera o item por um limite: uma quantidade de pecas, um prazo, ou
-- os dois - quem decide e o usuario, mas ao menos um precisa ser informado.
-- O documento que autoriza o desvio e obrigatorio e vive na tabela Anexo,
-- com entidadeTipo "RNC_DESVIO" ou "HOMOLOGACAO_ITEM_DESVIO".
-- Nenhuma coluna e apagada e nenhum dado e alterado.
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-desvio-qualidade.sql --url "$DIRECT_URL"
-- Idempotente: pode ser executado mais de uma vez sem erro.

ALTER TABLE "Rnc"
  ADD COLUMN IF NOT EXISTS "desvioQualidade" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "desvioAberturaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "desvioQuantidade" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "desvioPrazoFim" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "desvioDescricao" TEXT,
  ADD COLUMN IF NOT EXISTS "desvioEncerradoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "desvioEncerramentoObs" TEXT;

ALTER TABLE "HomologacaoItem"
  ADD COLUMN IF NOT EXISTS "desvioQualidade" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "desvioAberturaEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "desvioQuantidade" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "desvioPrazoFim" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "desvioDescricao" TEXT,
  ADD COLUMN IF NOT EXISTS "desvioEncerradoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "desvioEncerramentoObs" TEXT;
