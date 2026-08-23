-- Inventario de Instrumentos e Equipamentos (BDBR.QUA.FMR.004.01).
--
-- Tabela nova, com as nove colunas da planilha. Duas coisas que vieram do
-- arquivo real e explicam o desenho:
--   codigo NAO e unico e nem obrigatorio -> 35 das 57 linhas vem com "-" e
--     varios codigos se repetem (a barra padrao carrega o codigo do
--     micrometro a que pertence).
--   proximaCalibracao e gravada, nao calculada na leitura -> a regra e
--     dataCalibracao + periodoAnos, e o backend aplica ao salvar.
--
-- 100% aditivo e idempotente: so cria a tabela e os indices.
--
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-instrumentos.sql --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS "Instrumento" (
  "id"                SERIAL PRIMARY KEY,
  "codigo"            TEXT,
  "equipamento"       TEXT NOT NULL,
  "fabricante"        TEXT,
  "numeroSerie"       TEXT,
  "dataCalibracao"    TIMESTAMP(3),
  "periodoAnos"       INTEGER,
  "proximaCalibracao" TIMESTAMP(3),
  "numeroCertificado" TEXT,
  "localizacao"       TEXT,
  "observacoes"       TEXT,
  "ativo"             BOOLEAN NOT NULL DEFAULT true,
  "criadoPorId"       INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Quem criou o registro nunca pode impedir o usuario de ser removido: por isso
-- ON DELETE SET NULL, como nas demais tabelas do sistema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Instrumento_criadoPorId_fkey'
  ) THEN
    ALTER TABLE "Instrumento"
      ADD CONSTRAINT "Instrumento_criadoPorId_fkey"
      FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Instrumento_ativo_idx" ON "Instrumento" ("ativo");
CREATE INDEX IF NOT EXISTS "Instrumento_proximaCalibracao_idx"
  ON "Instrumento" ("proximaCalibracao");
