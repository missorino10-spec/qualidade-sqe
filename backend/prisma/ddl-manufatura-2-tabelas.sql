-- DDL da Manufatura, parte 2 de 2 (executar UMA vez, DEPOIS da parte 1).
--
-- 100% aditivo: só cria enums, tabelas, indices e chaves estrangeiras novas.
-- Nenhuma tabela ou coluna existente e alterada ou removida, entao o modulo
-- SQE ja em producao continua intacto.
--
-- Idempotente: pode ser reexecutado sem erro (CREATE ... IF NOT EXISTS e
-- DO/EXCEPTION para os enums, que nao aceitam IF NOT EXISTS).

-- ------------------------------------------------------------------ enums
DO $$ BEGIN
  CREATE TYPE "AreaManufatura" AS ENUM ('FABRICACAO', 'MONTAGEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoInspecaoManufatura" AS ENUM ('SETUP', 'PRODUCAO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ResultadoManufatura" AS ENUM ('APROVADO', 'APROVADO_COM_OBSERVACAO', 'REPROVADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatusInspecaoManufatura" AS ENUM ('PENDENTE', 'APROVADA', 'APROVADA_COM_OBSERVACAO', 'REPROVADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StatusOitoD" AS ENUM ('AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrigemOitoD" AS ENUM ('RELATORIO_RO', 'PRODUCAO', 'INSPECAO_EXTRA', 'SETUP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TurnoManufatura" AS ENUM ('COMERCIAL', 'SEGUNDO_TURNO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- tabelas
CREATE TABLE IF NOT EXISTS "Maquina" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "area" "AreaManufatura" NOT NULL DEFAULT 'FABRICACAO',
    "classificacao" "Classificacao" NOT NULL DEFAULT 'C',
    "frequenciaProducaoN" INTEGER NOT NULL DEFAULT 1,
    "contadorSetups" INTEGER NOT NULL DEFAULT 0,
    "setupsRealizados" INTEGER NOT NULL DEFAULT 0,
    "producoesRealizadas" INTEGER NOT NULL DEFAULT 0,
    "inspecoesReprovadas" INTEGER NOT NULL DEFAULT 0,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Maquina_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProducaoDiaria" (
    "id" SERIAL NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "qtdProduzida" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtdDefeito" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "registradoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProducaoDiaria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TipoDefeito" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TipoDefeito_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InspecaoManufatura" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoInspecaoManufatura" NOT NULL,
    "numero" TEXT NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "itemCodigo" TEXT,
    "itemDescricao" TEXT,
    "po" TEXT,
    "setupId" INTEGER,
    "extra" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusInspecaoManufatura" NOT NULL DEFAULT 'PENDENTE',
    "dataInspecao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "semana" TEXT,
    "ano" INTEGER,
    "inspetorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspecaoManufatura_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RelatorioDimensional" (
    "id" SERIAL NOT NULL,
    "inspecaoId" INTEGER NOT NULL,
    "tipo" "TipoInspecaoManufatura" NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "tentativa" INTEGER NOT NULL DEFAULT 1,
    "revisao" TEXT NOT NULL DEFAULT '01',
    "dataInspecao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" "OrigemInspecao" NOT NULL DEFAULT 'LIBERACAO_SETUP',
    "origemOutros" TEXT,
    "itemCodigo" TEXT,
    "itemDescricao" TEXT,
    "desenhoRev" TEXT,
    "po" TEXT,
    "qtdInspecionada" DOUBLE PRECISION,
    "qtdTotal" DOUBLE PRECISION,
    "cotas" JSONB NOT NULL,
    "observacoesFinais" TEXT,
    "resultado" "ResultadoManufatura" NOT NULL DEFAULT 'APROVADO',
    "observacaoResultado" TEXT,
    "defeitos" JSONB,
    "qtdAfetada" DOUBLE PRECISION,
    "descricaoDesvio" TEXT,
    "elaboradoPor" TEXT,
    "inspecionadoPor" TEXT,
    "inspetorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioDimensional_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Cnq" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "itemCodigo" TEXT NOT NULL,
    "itemDescricao" TEXT,
    "tipoDefeitoId" INTEGER NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,
    "valorUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "acao" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cnq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OitoD" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "inspecaoId" INTEGER,
    "cnqId" INTEGER,
    "empresaUnidade" TEXT NOT NULL DEFAULT 'Big Dutchman Brasil',
    "dataAbertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusOitoD" NOT NULL DEFAULT 'AGUARDANDO',
    "produtoItem" TEXT,
    "codigoDesenho" TEXT,
    "origem" "OrigemOitoD" NOT NULL DEFAULT 'PRODUCAO',
    "local" TEXT,
    "processoOperacao" TEXT,
    "equipamento" TEXT,
    "turno" "TurnoManufatura" NOT NULL DEFAULT 'COMERCIAL',
    "qtdAfetada" TEXT,
    "responsavel" TEXT,
    "equipe" TEXT,
    "descricaoProblema" TEXT,
    "efeito" TEXT,
    "causas6M" JSONB,
    "porques" JSONB,
    "causaRaiz" TEXT,
    "planoAcao" JSONB,
    "padronizacao" JSONB,
    "verificacaoEficacia" JSONB,
    "aprovadoPorId" INTEGER,
    "aprovadoEm" TIMESTAMP(3),
    "aprovacaoProducao" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OitoD_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HistoricoMaquina" (
    "id" SERIAL NOT NULL,
    "maquinaId" INTEGER NOT NULL,
    "trimestreFiscal" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3) NOT NULL,
    "classificacao" "Classificacao" NOT NULL,
    "pecasProduzidas" DOUBLE PRECISION NOT NULL,
    "pecasComDefeito" DOUBLE PRECISION NOT NULL,
    "ppm" DOUBLE PRECISION NOT NULL,
    "cnqTotal" DOUBLE PRECISION NOT NULL,
    "setupsRealizados" INTEGER NOT NULL,
    "producoesRealizadas" INTEGER NOT NULL,
    "inspecoesReprovadas" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoMaquina_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------- indices
CREATE UNIQUE INDEX IF NOT EXISTS "Maquina_codigo_key" ON "Maquina"("codigo");
CREATE INDEX IF NOT EXISTS "ProducaoDiaria_data_idx" ON "ProducaoDiaria"("data");
CREATE UNIQUE INDEX IF NOT EXISTS "ProducaoDiaria_maquinaId_data_key" ON "ProducaoDiaria"("maquinaId", "data");
CREATE UNIQUE INDEX IF NOT EXISTS "TipoDefeito_nome_key" ON "TipoDefeito"("nome");
CREATE UNIQUE INDEX IF NOT EXISTS "InspecaoManufatura_numero_key" ON "InspecaoManufatura"("numero");
CREATE INDEX IF NOT EXISTS "InspecaoManufatura_tipo_dataInspecao_idx" ON "InspecaoManufatura"("tipo", "dataInspecao");
CREATE UNIQUE INDEX IF NOT EXISTS "RelatorioDimensional_numero_key" ON "RelatorioDimensional"("numero");
CREATE INDEX IF NOT EXISTS "RelatorioDimensional_inspecaoId_idx" ON "RelatorioDimensional"("inspecaoId");
CREATE UNIQUE INDEX IF NOT EXISTS "RelatorioDimensional_tipo_ano_sequencial_key" ON "RelatorioDimensional"("tipo", "ano", "sequencial");
CREATE UNIQUE INDEX IF NOT EXISTS "Cnq_numero_key" ON "Cnq"("numero");
CREATE INDEX IF NOT EXISTS "Cnq_data_idx" ON "Cnq"("data");
CREATE UNIQUE INDEX IF NOT EXISTS "Cnq_ano_sequencial_key" ON "Cnq"("ano", "sequencial");
CREATE UNIQUE INDEX IF NOT EXISTS "OitoD_numero_key" ON "OitoD"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "OitoD_ano_sequencial_key" ON "OitoD"("ano", "sequencial");
CREATE INDEX IF NOT EXISTS "HistoricoMaquina_maquinaId_idx" ON "HistoricoMaquina"("maquinaId");

-- --------------------------------------------------- chaves estrangeiras
ALTER TABLE "ProducaoDiaria" DROP CONSTRAINT IF EXISTS "ProducaoDiaria_maquinaId_fkey";
ALTER TABLE "ProducaoDiaria" ADD CONSTRAINT "ProducaoDiaria_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProducaoDiaria" DROP CONSTRAINT IF EXISTS "ProducaoDiaria_registradoPorId_fkey";
ALTER TABLE "ProducaoDiaria" ADD CONSTRAINT "ProducaoDiaria_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspecaoManufatura" DROP CONSTRAINT IF EXISTS "InspecaoManufatura_maquinaId_fkey";
ALTER TABLE "InspecaoManufatura" ADD CONSTRAINT "InspecaoManufatura_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InspecaoManufatura" DROP CONSTRAINT IF EXISTS "InspecaoManufatura_setupId_fkey";
ALTER TABLE "InspecaoManufatura" ADD CONSTRAINT "InspecaoManufatura_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "InspecaoManufatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspecaoManufatura" DROP CONSTRAINT IF EXISTS "InspecaoManufatura_inspetorId_fkey";
ALTER TABLE "InspecaoManufatura" ADD CONSTRAINT "InspecaoManufatura_inspetorId_fkey" FOREIGN KEY ("inspetorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RelatorioDimensional" DROP CONSTRAINT IF EXISTS "RelatorioDimensional_inspecaoId_fkey";
ALTER TABLE "RelatorioDimensional" ADD CONSTRAINT "RelatorioDimensional_inspecaoId_fkey" FOREIGN KEY ("inspecaoId") REFERENCES "InspecaoManufatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RelatorioDimensional" DROP CONSTRAINT IF EXISTS "RelatorioDimensional_inspetorId_fkey";
ALTER TABLE "RelatorioDimensional" ADD CONSTRAINT "RelatorioDimensional_inspetorId_fkey" FOREIGN KEY ("inspetorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Cnq" DROP CONSTRAINT IF EXISTS "Cnq_maquinaId_fkey";
ALTER TABLE "Cnq" ADD CONSTRAINT "Cnq_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Cnq" DROP CONSTRAINT IF EXISTS "Cnq_tipoDefeitoId_fkey";
ALTER TABLE "Cnq" ADD CONSTRAINT "Cnq_tipoDefeitoId_fkey" FOREIGN KEY ("tipoDefeitoId") REFERENCES "TipoDefeito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Cnq" DROP CONSTRAINT IF EXISTS "Cnq_criadoPorId_fkey";
ALTER TABLE "Cnq" ADD CONSTRAINT "Cnq_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OitoD" DROP CONSTRAINT IF EXISTS "OitoD_inspecaoId_fkey";
ALTER TABLE "OitoD" ADD CONSTRAINT "OitoD_inspecaoId_fkey" FOREIGN KEY ("inspecaoId") REFERENCES "InspecaoManufatura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OitoD" DROP CONSTRAINT IF EXISTS "OitoD_cnqId_fkey";
ALTER TABLE "OitoD" ADD CONSTRAINT "OitoD_cnqId_fkey" FOREIGN KEY ("cnqId") REFERENCES "Cnq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OitoD" DROP CONSTRAINT IF EXISTS "OitoD_aprovadoPorId_fkey";
ALTER TABLE "OitoD" ADD CONSTRAINT "OitoD_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OitoD" DROP CONSTRAINT IF EXISTS "OitoD_criadoPorId_fkey";
ALTER TABLE "OitoD" ADD CONSTRAINT "OitoD_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HistoricoMaquina" DROP CONSTRAINT IF EXISTS "HistoricoMaquina_maquinaId_fkey";
ALTER TABLE "HistoricoMaquina" ADD CONSTRAINT "HistoricoMaquina_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
