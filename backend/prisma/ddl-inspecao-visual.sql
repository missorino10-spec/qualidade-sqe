-- Inspecao visual OPCIONAL do relatorio dimensional (setup e producao): campo
-- aberto de descricao. As fotos continuam na tabela Anexo, no bloco do visual.
-- A coluna e opcional, entao nenhum relatorio ja gravado e afetado.
ALTER TABLE "RelatorioDimensional" ADD COLUMN IF NOT EXISTS "inspecaoVisual" TEXT;
