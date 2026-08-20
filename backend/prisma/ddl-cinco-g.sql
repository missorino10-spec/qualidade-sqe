-- DDL do MÉTODO 5G (Manufatura): documento proprio, numerado 5G0001/2026.
--
-- Espelha a aba "MÉTODO 5G" da planilha "Analise de Problemas da Qualidade -
-- Padrao". O corpo e o checklist fixo das 9 avaliacoes, gravado na coluna
-- "avaliacoes" (JSONB). As fotos ficam na tabela Anexo, pelo entidadeTipo
-- CINCO_G_EVID.
--
-- Nao cria enum novo: reaproveita "StatusOitoD", "OrigemOitoD" e
-- "TurnoManufatura", que ja existem por causa do 8D.
--
-- 100% aditivo: so cria tabela, indices e chaves estrangeiras novas.
-- Idempotente: pode ser executado mais de uma vez sem erro.
--
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-cinco-g.sql --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS "CincoG" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "inspecaoId" INTEGER,
    "cnqId" INTEGER,
    "dataAbertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusOitoD" NOT NULL DEFAULT 'AGUARDANDO',
    "origem" "OrigemOitoD" NOT NULL DEFAULT 'PRODUCAO',
    "turno" "TurnoManufatura" NOT NULL DEFAULT 'COMERCIAL',
    "produtoItem" TEXT,
    "codigoDesenho" TEXT,
    "local" TEXT,
    "processoOperacao" TEXT,
    "equipamento" TEXT,
    "responsavel" TEXT,
    "equipe" TEXT,
    "departamento" TEXT,
    "areaAplicacao" TEXT,
    "descricaoProblema" TEXT,
    "avaliacoes" JSONB,
    "conclusao" TEXT,
    "dataTermino" TIMESTAMP(3),
    "verificacaoGerente" TEXT,
    "aprovadoPorId" INTEGER,
    "aprovadoEm" TIMESTAMP(3),
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CincoG_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------- indices
CREATE UNIQUE INDEX IF NOT EXISTS "CincoG_numero_key" ON "CincoG"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "CincoG_ano_sequencial_key" ON "CincoG"("ano", "sequencial");
CREATE INDEX IF NOT EXISTS "CincoG_dataAbertura_idx" ON "CincoG"("dataAbertura");

-- --------------------------------------------------- chaves estrangeiras
ALTER TABLE "CincoG" DROP CONSTRAINT IF EXISTS "CincoG_inspecaoId_fkey";
ALTER TABLE "CincoG" ADD CONSTRAINT "CincoG_inspecaoId_fkey" FOREIGN KEY ("inspecaoId") REFERENCES "InspecaoManufatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CincoG" DROP CONSTRAINT IF EXISTS "CincoG_cnqId_fkey";
ALTER TABLE "CincoG" ADD CONSTRAINT "CincoG_cnqId_fkey" FOREIGN KEY ("cnqId") REFERENCES "Cnq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CincoG" DROP CONSTRAINT IF EXISTS "CincoG_aprovadoPorId_fkey";
ALTER TABLE "CincoG" ADD CONSTRAINT "CincoG_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CincoG" DROP CONSTRAINT IF EXISTS "CincoG_criadoPorId_fkey";
ALTER TABLE "CincoG" ADD CONSTRAINT "CincoG_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
