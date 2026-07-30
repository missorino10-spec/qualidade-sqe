-- DDL da numeracao de inspecoes (executar UMA vez; ja aplicado na nuvem).
--
-- Escrito a mao de proposito: "prisma db push" exigiria --accept-data-loss por
-- causa dos dois indices unicos, e essa flag nunca e usada neste projeto.
-- Aqui esta o diff completo, e ele e 100% aditivo - nenhuma coluna e removida
-- ou alterada, e as colunas novas nascem nulas/com default.

ALTER TYPE "NivelPlano" ADD VALUE IF NOT EXISTS 'RUIM';

ALTER TABLE "EntregaPortaria"
  ADD COLUMN IF NOT EXISTS "numeroInspecao" TEXT,
  ADD COLUMN IF NOT EXISTS "inspecaoAno" INTEGER,
  ADD COLUMN IF NOT EXISTS "inspecaoSequencial" INTEGER,
  ADD COLUMN IF NOT EXISTS "inspecaoExtra" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Fornecedor"
  ADD COLUMN IF NOT EXISTS "eventual" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Rnc"
  ADD COLUMN IF NOT EXISTS "entregaId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "EntregaPortaria_numeroInspecao_key"
  ON "EntregaPortaria"("numeroInspecao");

CREATE UNIQUE INDEX IF NOT EXISTS "EntregaPortaria_inspecaoAno_inspecaoSequencial_key"
  ON "EntregaPortaria"("inspecaoAno", "inspecaoSequencial");

ALTER TABLE "Rnc" DROP CONSTRAINT IF EXISTS "Rnc_entregaId_fkey";
ALTER TABLE "Rnc" ADD CONSTRAINT "Rnc_entregaId_fkey"
  FOREIGN KEY ("entregaId") REFERENCES "EntregaPortaria"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
