-- DDL ADITIVO do padrao unico de relatorio de inspecao.
--   1) RelatorioDimensional ganha a norma de tolerancia (ISO2768 / DIN7168 /
--      NA), que ate agora so existia no SQE.
--   2) Rnc ganha a data de encerramento propria: encerrar a RNC e verificar a
--      eficacia viraram dois pares independentes de status + data.
-- Nenhuma coluna e apagada e nenhum dado e alterado.
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-inspecao-padrao.sql --url "$DIRECT_URL"
-- Idempotente: pode ser executado mais de uma vez sem erro.

ALTER TABLE "RelatorioDimensional"
  ADD COLUMN IF NOT EXISTS "toleranciasNorm" TEXT;

ALTER TABLE "Rnc"
  ADD COLUMN IF NOT EXISTS "dataEncerramento" TIMESTAMP(3);
