-- Remove a frente de "planejamento semanal / portaria", que nunca foi usada.
--
-- A tela de Inspecoes ja faz o papel inteiro: GET /inspecoes/avaliar decide se o
-- recebimento entra no ciclo de periodicidade e POST /inspecoes/recebimento
-- registra a carga que nao precisa de inspecao. O planejamento semanal ficou do
-- desenho inicial do processo e nunca recebeu um registro sequer.
--
-- ATENCAO: a tabela "EntregaPortaria" NAO e apagada aqui e nao pode ser. Ela e a
-- unidade de inspecao do SQE - guarda os numeros INSP0001/2026 em diante, e o
-- pai das inspecoes Visual e Lote e das RNCs, e e o universo de todos os KPIs do
-- painel. O que sai dela e so a coluna "planejamentoId", que esta nula em 100%
-- das linhas.
--
-- As duas travas abaixo abortam a migracao se a realidade nao for essa.

DO $$
DECLARE
  linhas_planejamento bigint;
  entregas_com_plano  bigint;
BEGIN
  IF to_regclass('public."PlanejamentoSemanal"') IS NULL THEN
    RAISE NOTICE 'PlanejamentoSemanal ja foi removida; nada a fazer.';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM "PlanejamentoSemanal"' INTO linhas_planejamento;
  IF linhas_planejamento > 0 THEN
    RAISE EXCEPTION 'ABORTADO: PlanejamentoSemanal tem % registro(s). Esperado 0.', linhas_planejamento;
  END IF;

  EXECUTE 'SELECT count(*) FROM "EntregaPortaria" WHERE "planejamentoId" IS NOT NULL'
    INTO entregas_com_plano;
  IF entregas_com_plano > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % entrega(s) apontam para um planejamento. Esperado 0.', entregas_com_plano;
  END IF;
END $$;

ALTER TABLE "EntregaPortaria" DROP COLUMN IF EXISTS "planejamentoId";
DROP TABLE IF EXISTS "PlanejamentoSemanal";
DROP TYPE IF EXISTS "StatusPlanejamento";
