-- DDL ADITIVO: o campo unico "desenhoRev" vira dois campos separados,
-- "desenho" e "revisao", nos quatro formularios de inspecao.
-- A coluna "desenhoRev" CONTINUA existindo: os registros antigos ficam como
-- estao e as telas exibem o valor legado quando os campos novos estao vazios.
-- Nenhuma coluna e apagada e nenhum dado e alterado.
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-desenho-revisao.sql --url "$DIRECT_URL"
-- Idempotente: pode ser executado mais de uma vez sem erro.

ALTER TABLE "InspecaoVisual"
  ADD COLUMN IF NOT EXISTS "desenho" TEXT,
  ADD COLUMN IF NOT EXISTS "revisao" TEXT;

ALTER TABLE "InspecaoLote"
  ADD COLUMN IF NOT EXISTS "desenho" TEXT,
  ADD COLUMN IF NOT EXISTS "revisao" TEXT;

ALTER TABLE "RelatorioDimensional"
  ADD COLUMN IF NOT EXISTS "desenho" TEXT,
  ADD COLUMN IF NOT EXISTS "desenhoRevisao" TEXT;

ALTER TABLE "RelatorioInspecaoItem"
  ADD COLUMN IF NOT EXISTS "desenho" TEXT,
  ADD COLUMN IF NOT EXISTS "desenhoRevisao" TEXT;
