-- Campo livre "Outros:" da origem da inspecao no SQE.
-- Na Manufatura ele ja existia (RelatorioDimensional.origemOutros); aqui os
-- dois formularios do recebimento passam a ter o mesmo campo.
-- Aditivo e idempotente: coluna opcional, sem default, nao mexe em registro
-- existente.

ALTER TABLE "InspecaoVisual"
  ADD COLUMN IF NOT EXISTS "origemOutros" TEXT;

ALTER TABLE "InspecaoLote"
  ADD COLUMN IF NOT EXISTS "origemOutros" TEXT;
