-- DDL da INSPECAO VISUAL DA MANUFATURA: documento proprio, separado do
-- relatorio dimensional.
--
-- Antes o visual era um campo opcional (RelatorioDimensional."inspecaoVisual")
-- dentro do formulario dimensional. Virou registro proprio porque a inspecao
-- visual acontece sozinha, sem medicao: cabecalho igual ao do dimensional,
-- campo aberto para o inspetor descrever o que observou e ate 4 fotos de
-- evidencia (que ficam na tabela Anexo, pelo entidadeTipo
-- INSPECAO_VISUAL_MANUFATURA).
--
-- Serie de numeracao SEPARADA da do dimensional:
--   SETV0001/2026 (setup) e PRODV0001/2026 (producao).
--
-- Nao cria enum novo: reaproveita "TipoInspecaoManufatura" e "OrigemInspecao",
-- que ja existem.
--
-- A coluna antiga RelatorioDimensional."inspecaoVisual" NAO e removida: os
-- relatorios ja gravados continuam mostrando o visual antigo na tela e no PDF.
--
-- 100% aditivo: so cria tabela, indices e chaves estrangeiras novas.
-- Idempotente: pode ser executado mais de uma vez sem erro.
--
-- Rodar com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-inspecao-visual-manufatura.sql --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS "InspecaoVisualManufatura" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoInspecaoManufatura" NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "revisao" TEXT NOT NULL DEFAULT '01',
    "dataInspecao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "semana" TEXT,
    "origem" "OrigemInspecao" NOT NULL DEFAULT 'LIBERACAO_SETUP',
    "origemOutros" TEXT,
    "itemCodigo" TEXT,
    "itemDescricao" TEXT,
    "desenho" TEXT,
    "desenhoRevisao" TEXT,
    "po" TEXT,
    "qtdInspecionada" DOUBLE PRECISION,
    "qtdTotal" DOUBLE PRECISION,
    "observacoes" TEXT,
    "elaboradoPor" TEXT,
    "inspecionadoPor" TEXT,
    "inspetorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspecaoVisualManufatura_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------- indices
CREATE UNIQUE INDEX IF NOT EXISTS "InspecaoVisualManufatura_numero_key"
    ON "InspecaoVisualManufatura"("numero");
-- A unicidade por (tipo, ano, sequencial) e o que garante a numeracao mesmo
-- quando dois inspetores salvam no mesmo instante.
CREATE UNIQUE INDEX IF NOT EXISTS "InspecaoVisualManufatura_tipo_ano_sequencial_key"
    ON "InspecaoVisualManufatura"("tipo", "ano", "sequencial");
CREATE INDEX IF NOT EXISTS "InspecaoVisualManufatura_tipo_dataInspecao_idx"
    ON "InspecaoVisualManufatura"("tipo", "dataInspecao");

-- --------------------------------------------------- chaves estrangeiras
ALTER TABLE "InspecaoVisualManufatura"
    DROP CONSTRAINT IF EXISTS "InspecaoVisualManufatura_maquinaId_fkey";
ALTER TABLE "InspecaoVisualManufatura"
    ADD CONSTRAINT "InspecaoVisualManufatura_maquinaId_fkey"
    FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InspecaoVisualManufatura"
    DROP CONSTRAINT IF EXISTS "InspecaoVisualManufatura_inspetorId_fkey";
ALTER TABLE "InspecaoVisualManufatura"
    ADD CONSTRAINT "InspecaoVisualManufatura_inspetorId_fkey"
    FOREIGN KEY ("inspetorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
