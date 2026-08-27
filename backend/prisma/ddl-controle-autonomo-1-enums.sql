-- ICAQ - Auditoria do Controle Autonomo da Qualidade: tipos.
-- Em arquivo separado porque o Postgres nao aceita usar um enum na mesma
-- transacao em que ele foi criado.

DO $$ BEGIN
  CREATE TYPE "TurnoIcaq" AS ENUM ('PRIMEIRO_TURNO', 'SEGUNDO_TURNO', 'TERCEIRO_TURNO', 'COMERCIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ResultadoIcaq" AS ENUM ('CONFORME', 'NAO_CONFORME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClassificacaoIcaq" AS ENUM ('CONFORME', 'ATENCAO', 'NAO_CONFORME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
