-- Manufatura: sai a classificacao ABCD das maquinas e todo o ciclo de setups
-- (1 producao a cada N setups). A inspecao passa a ser lancada livremente.
-- Autorizado pelo usuario em 17/08/2026.
-- O enum "Classificacao" CONTINUA existindo: e usado pelos fornecedores.
ALTER TABLE "Maquina"            DROP COLUMN IF EXISTS "classificacao";
ALTER TABLE "Maquina"            DROP COLUMN IF EXISTS "frequenciaProducaoN";
ALTER TABLE "Maquina"            DROP COLUMN IF EXISTS "contadorSetups";
ALTER TABLE "HistoricoMaquina"   DROP COLUMN IF EXISTS "classificacao";
ALTER TABLE "InspecaoManufatura" DROP COLUMN IF EXISTS "extra";
