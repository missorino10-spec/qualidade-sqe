-- Base de codigos e custo (planilha "Base de Codigos e Custo.xlsx").
--
-- O cadastro de Item ja existia (codigo unico + descricao). Faltavam duas
-- coisas para atender a base:
--   custoUnitario -> custo unitario em R$ de cada codigo. E ele que alimenta
--                    o "valor unitario" da RNC e do CNQ quando o inspetor
--                    digita o codigo. Fica NULL para item digitado na mao,
--                    que nao esta na base.
--   ativo         -> cadastro nao se apaga por padrao, se inativa. Item
--                    inativo some da busca dos formularios, mas continua
--                    valendo nos registros antigos que apontam para ele.
--
-- Indice por descricao porque a busca do campo de item procura tanto pelo
-- codigo quanto por pedaco da descricao, em uma base de ~15.000 linhas.
--
-- 100% aditivo e idempotente: so acrescenta colunas e indice.
--
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-item-custo.sql --url "$DIRECT_URL"

ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "custoUnitario" DOUBLE PRECISION;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "ativo" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Item_descricao_idx" ON "Item" ("descricao");
CREATE INDEX IF NOT EXISTS "Item_ativo_idx" ON "Item" ("ativo");
