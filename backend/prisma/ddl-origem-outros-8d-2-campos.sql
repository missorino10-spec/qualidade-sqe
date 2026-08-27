-- Parte 2 de 2: campos novos do CNQ e do 8D / 5G.
--
-- CNQ ganha "NAO DEFINIDO" e "OUTROS" na lista de descricao do defeito. Como a
-- lista e uma tabela cadastravel, as duas entram como linhas. "Outros" vem
-- marcado com "exigeDetalhe" para a tela abrir o campo de digitacao: e uma
-- flag e nao uma comparacao pelo nome, senao renomear a linha no cadastro
-- apagaria o campo aberto.
--
-- 8D e 5G ganham a origem digitada (quando a escolhida e OUTROS) e o documento
-- que motivou a abertura: o numero fica aqui e o arquivo entra pelo mecanismo
-- de anexos (entidadeTipo OITO_D_DOC / CINCO_G_DOC).
--
-- Aditivo e idempotente. Rodar com o DIRECT_URL (porta 5432):
--   npx prisma db execute --file prisma/ddl-origem-outros-8d-2-campos.sql --url "$DIRECT_URL"

ALTER TABLE "TipoDefeito"
  ADD COLUMN IF NOT EXISTS "exigeDetalhe" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Cnq"
  ADD COLUMN IF NOT EXISTS "defeitoOutros" TEXT;

-- Ordem alta para as duas cairem no fim da lista, depois dos defeitos reais.
INSERT INTO "TipoDefeito" ("nome", "ordem", "ativo", "exigeDetalhe")
VALUES ('Não Definido', 900, true, false)
ON CONFLICT ("nome") DO NOTHING;

INSERT INTO "TipoDefeito" ("nome", "ordem", "ativo", "exigeDetalhe")
VALUES ('Outros', 901, true, true)
ON CONFLICT ("nome") DO UPDATE SET "exigeDetalhe" = true;

ALTER TABLE "OitoD"
  ADD COLUMN IF NOT EXISTS "origemOutros" TEXT,
  ADD COLUMN IF NOT EXISTS "documentoReferencia" TEXT;

ALTER TABLE "CincoG"
  ADD COLUMN IF NOT EXISTS "origemOutros" TEXT,
  ADD COLUMN IF NOT EXISTS "documentoReferencia" TEXT;
