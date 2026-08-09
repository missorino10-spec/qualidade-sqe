-- DDL ADITIVO do SQD: inversao do fluxo da homologacao.
-- O registro passa a ser aberto ANTES da autoavaliacao, entao as colunas do
-- resultado deixam de ser obrigatorias e entram os relogios de resposta do
-- fornecedor e de fechamento do ciclo.
-- Nenhuma coluna e apagada e nenhum dado e alterado.
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-sqd-fluxo.sql --url "$DIRECT_URL"
-- Idempotente: pode ser executado mais de uma vez sem erro.

ALTER TABLE "HomologacaoFornecedor"
  ADD COLUMN IF NOT EXISTS "dataRetornoFornecedor" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tempoRespostaDiasUteis" INTEGER,
  ADD COLUMN IF NOT EXISTS "dataFinalizacao" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tempoTotalDiasUteis" INTEGER;

-- A avaliacao so existe depois que o fornecedor responde.
ALTER TABLE "HomologacaoFornecedor"
  ALTER COLUMN "dataAvaliacao" DROP NOT NULL,
  ALTER COLUMN "respostas" DROP NOT NULL,
  ALTER COLUMN "blocos" DROP NOT NULL,
  ALTER COLUMN "nota" DROP NOT NULL,
  ALTER COLUMN "resultado" DROP NOT NULL;

-- A data da solicitacao passa a ser o marco zero do registro. A coluna segue
-- aceitando nulo por causa dos registros abertos antes da inversao do fluxo;
-- quem exige a data e a tela de abertura.
CREATE INDEX IF NOT EXISTS "HomologacaoFornecedor_dataSolicitacao_idx"
  ON "HomologacaoFornecedor"("dataSolicitacao");
DROP INDEX IF EXISTS "HomologacaoFornecedor_dataAvaliacao_idx";
