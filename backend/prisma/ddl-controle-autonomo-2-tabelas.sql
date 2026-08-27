-- ICAQ - Auditoria do Controle Autonomo da Qualidade: tabelas.

CREATE TABLE IF NOT EXISTS "ControleAutonomo" (
  "id"                  SERIAL PRIMARY KEY,
  "numero"              TEXT NOT NULL,
  "ano"                 INTEGER NOT NULL,
  "sequencial"          INTEGER NOT NULL,
  "dataAuditoria"       DATE NOT NULL,
  "turno"               "TurnoIcaq" NOT NULL DEFAULT 'COMERCIAL',
  "maquinaId"           INTEGER NOT NULL,
  "itemId"              INTEGER,
  "ordemLote"           TEXT,
  "operador"            TEXT NOT NULL,
  "auditorId"           INTEGER NOT NULL,
  "observacoesIniciais" TEXT,
  "nota"                DOUBLE PRECISION NOT NULL DEFAULT 0,
  "classificacao"       "ClassificacaoIcaq" NOT NULL DEFAULT 'NAO_CONFORME',
  "criadoPorId"         INTEGER,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ControleAutonomo_maquinaId_fkey"
    FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "ControleAutonomo_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "ControleAutonomo_auditorId_fkey"
    FOREIGN KEY ("auditorId") REFERENCES "Usuario"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "ControleAutonomo_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControleAutonomo_numero_key" ON "ControleAutonomo"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "ControleAutonomo_ano_sequencial_key" ON "ControleAutonomo"("ano", "sequencial");
CREATE INDEX IF NOT EXISTS "ControleAutonomo_dataAuditoria_idx" ON "ControleAutonomo"("dataAuditoria");

CREATE TABLE IF NOT EXISTS "ItemControleAutonomo" (
  "id"          SERIAL PRIMARY KEY,
  "controleId"  INTEGER NOT NULL,
  "numero"      INTEGER NOT NULL,
  "dimensao"    TEXT NOT NULL,
  "peso"        DOUBLE PRECISION NOT NULL,
  "verificacao" TEXT NOT NULL,
  "resultado"   "ResultadoIcaq" NOT NULL,
  "pontos"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "evidencia"   TEXT,
  "responsavel" TEXT,
  CONSTRAINT "ItemControleAutonomo_controleId_fkey"
    FOREIGN KEY ("controleId") REFERENCES "ControleAutonomo"("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ItemControleAutonomo_controleId_numero_key"
  ON "ItemControleAutonomo"("controleId", "numero");
