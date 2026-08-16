-- DDL ADITIVO: novo valor INSPECAO_PRODUCAO no enum OrigemInspecao.
-- O enum e compartilhado pelos tres modulos, mas o valor novo so e ofertado
-- na Manufatura - quem filtra a lista por modulo e o frontend.
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-origem-producao.sql --url "$DIRECT_URL"
-- Idempotente: pode ser executado mais de uma vez sem erro.

ALTER TYPE "OrigemInspecao" ADD VALUE IF NOT EXISTS 'INSPECAO_PRODUCAO';
