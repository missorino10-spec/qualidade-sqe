-- DDL do envio da RNC ao fornecedor (SQE).
--
-- Dois campos novos na RNC para medir o LEAD TIME INTERNO da Qualidade: da
-- abertura da RNC ate o dia em que o documento saiu para o fornecedor. O
-- tempo em dias nao e gravado - e calculado na leitura, como ja acontece com
-- o tempo de retorno do fornecedor.
--
-- 100% aditivo: so acrescenta colunas. Idempotente (IF NOT EXISTS).
--
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-rnc-envio-fornecedor.sql --url "$DIRECT_URL"

ALTER TABLE "Rnc" ADD COLUMN IF NOT EXISTS "enviadaFornecedor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Rnc" ADD COLUMN IF NOT EXISTS "dataEnvioFornecedor" TIMESTAMP(3);
