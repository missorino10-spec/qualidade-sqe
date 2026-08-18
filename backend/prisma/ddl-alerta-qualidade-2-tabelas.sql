-- DDL do Alerta da Qualidade (Manufatura), parte 2 de 2: tabelas.
--
-- Espelha o formulario "Alerta da Qualidade" (.docx): titulo + data,
-- "Descricao do problema", texto da acao obrigatoria, dois paineis de foto
-- (ERRADO / CERTO) e "Elaborado por". As fotos ficam na tabela Anexo, pelos
-- entidadeTipo ALERTA_QUALIDADE_ERRADO e ALERTA_QUALIDADE_CERTO.
--
-- 100% aditivo: so cria tabelas, indices e chaves estrangeiras novas.
-- Idempotente: pode ser executado mais de uma vez sem erro.
--
-- Rodar DEPOIS da parte 1, com o DIRECT_URL (porta 5432, que aceita DDL):
--   npx prisma db execute --file prisma/ddl-alerta-qualidade-2-tabelas.sql --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS "AlertaQualidade" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "sequencial" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "titulo" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "setor" TEXT,
    "maquinaId" INTEGER,
    "legendaErrado" TEXT,
    "legendaCerto" TEXT,
    "prazo" DATE NOT NULL,
    "status" "StatusAlertaQualidade" NOT NULL DEFAULT 'ABERTO',
    "elaboradoPor" TEXT,
    "dataEncerramento" DATE,
    "observacaoEncerramento" TEXT,
    "encerradoPorId" INTEGER,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertaQualidade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RenovacaoAlerta" (
    "id" SERIAL NOT NULL,
    "alertaId" INTEGER NOT NULL,
    "prazoAnterior" DATE NOT NULL,
    "prazoNovo" DATE NOT NULL,
    "motivo" TEXT,
    "criadoPorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenovacaoAlerta_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------- indices
CREATE UNIQUE INDEX IF NOT EXISTS "AlertaQualidade_numero_key" ON "AlertaQualidade"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "AlertaQualidade_ano_sequencial_key" ON "AlertaQualidade"("ano", "sequencial");
CREATE INDEX IF NOT EXISTS "AlertaQualidade_data_idx" ON "AlertaQualidade"("data");
CREATE INDEX IF NOT EXISTS "RenovacaoAlerta_alertaId_idx" ON "RenovacaoAlerta"("alertaId");

-- --------------------------------------------------- chaves estrangeiras
ALTER TABLE "AlertaQualidade" DROP CONSTRAINT IF EXISTS "AlertaQualidade_maquinaId_fkey";
ALTER TABLE "AlertaQualidade" ADD CONSTRAINT "AlertaQualidade_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlertaQualidade" DROP CONSTRAINT IF EXISTS "AlertaQualidade_criadoPorId_fkey";
ALTER TABLE "AlertaQualidade" ADD CONSTRAINT "AlertaQualidade_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlertaQualidade" DROP CONSTRAINT IF EXISTS "AlertaQualidade_encerradoPorId_fkey";
ALTER TABLE "AlertaQualidade" ADD CONSTRAINT "AlertaQualidade_encerradoPorId_fkey" FOREIGN KEY ("encerradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RenovacaoAlerta" DROP CONSTRAINT IF EXISTS "RenovacaoAlerta_alertaId_fkey";
ALTER TABLE "RenovacaoAlerta" ADD CONSTRAINT "RenovacaoAlerta_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "AlertaQualidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RenovacaoAlerta" DROP CONSTRAINT IF EXISTS "RenovacaoAlerta_criadoPorId_fkey";
ALTER TABLE "RenovacaoAlerta" ADD CONSTRAINT "RenovacaoAlerta_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
