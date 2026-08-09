-- DDL da Homologacao de Itens (SQD), parte 1 de 2: enums.
--
-- Separado da parte 2 porque "ALTER TYPE ... ADD VALUE" nao pode aparecer na
-- mesma transacao em que o novo valor e usado. Rodar esta parte primeiro.
--
-- Rodar com o DIRECT_URL (pooler na porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-sqd-itens-1-enum.sql --url "$DIRECT_URL"
-- Idempotente: pode ser executado mais de uma vez sem erro.

-- Motivo da solicitacao (validacao da coluna G da aba "Lista" do FMR.025.01)
DO $$ BEGIN
  CREATE TYPE "MotivoHomologacaoItem" AS ENUM ('PRIMEIRO_FORNECIMENTO', 'ALTERACAO_MATERIAL', 'ALTERACAO_PROCESSO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Resultado da homologacao do item (coluna L). Diferente do de fornecedores:
-- aqui nao existe "Aprovado Condicionalmente", e "Cancelado" e um resultado.
DO $$ BEGIN
  CREATE TYPE "ResultadoHomologacaoItem" AS ENUM ('APROVADO', 'REPROVADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Em itens o solicitante tambem pode ser o proprio fornecedor (coluna F).
ALTER TYPE "SolicitanteSqd" ADD VALUE IF NOT EXISTS 'FORNECEDOR';
