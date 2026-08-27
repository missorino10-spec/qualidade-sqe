-- Origem do 8D / 5G: duas opcoes novas, parte 1 de 2 (enum).
--
-- Separado da parte 2 porque o Postgres nao aceita usar um valor de enum na
-- mesma transacao em que ele foi acrescentado.
--
-- RNC e apenas o motivo da abertura ("estou abrindo este 8D por causa de uma
-- RNC"): NAO ha vinculo com a RNC do SQE. O numero dela vai no campo
-- "documentoReferencia" da parte 2.
--
-- Aditivo e idempotente. Rodar com o DIRECT_URL (porta 5432):
--   npx prisma db execute --file prisma/ddl-origem-outros-8d-1-enum.sql --url "$DIRECT_URL"

ALTER TYPE "OrigemOitoD" ADD VALUE IF NOT EXISTS 'RNC';
ALTER TYPE "OrigemOitoD" ADD VALUE IF NOT EXISTS 'OUTROS';
