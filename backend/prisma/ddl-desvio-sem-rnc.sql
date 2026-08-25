-- Desvio apontado sem RNC aberta.
-- Quando o inspetor responde NAO a pergunta "Abrir RNC?", a inspecao encerra
-- APROVADA e as cotas / itens visuais reprovados continuam marcados no
-- relatorio. A observacao explica por que foi encerrada assim e sai impressa.
ALTER TABLE "InspecaoVisual"
  ADD COLUMN IF NOT EXISTS "desvioSemRnc" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "observacaoDesvio" TEXT;

ALTER TABLE "InspecaoLote"
  ADD COLUMN IF NOT EXISTS "desvioSemRnc" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "observacaoDesvio" TEXT;
