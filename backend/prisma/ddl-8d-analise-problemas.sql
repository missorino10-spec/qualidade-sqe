-- 8D no padrao da planilha "Analise de Problemas da Qualidade": entram os
-- passos 1 a 6 e o bloco de conclusao. Todas as colunas sao opcionais, entao
-- nenhum registro ja existente e afetado.
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "departamento"          TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "areaAplicacao"         TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "objetivos"             TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "perdaAtacada"          TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "perdaValorAno"         DOUBLE PRECISION;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "descricao5W1H"         JSONB;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "situacaoAtual"         TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "estratificacao"        TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "metodo5G"              JSONB;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "cronograma"            JSONB;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "causasPotenciais"      JSONB;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "verificacaoResultados" TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "dataTermino"           TIMESTAMP(3);
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "custosInvestimentos"   TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "beneficiosGanhos"      TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "resultadosIndices"     TEXT;
ALTER TABLE "OitoD" ADD COLUMN IF NOT EXISTS "verificacaoGerente"    TEXT;
