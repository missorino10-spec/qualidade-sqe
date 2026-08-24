-- Controle de acesso por modulo + ficha do colaborador.
-- Tudo aditivo e idempotente: roda quantas vezes precisar sem perder dado.

-- Ficha do colaborador na propria tabela de usuario: o e-mail daqui e o login.
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "matricula" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "cargo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "setor" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "telefone" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "dataAdmissao" TIMESTAMP(3);

-- Senha provisoria do primeiro acesso. Quem ja existe entra normal (false).
ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS "precisaTrocarSenha" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  CREATE TYPE "ModuloSistema" AS ENUM (
    'SQE', 'MANUFATURA', 'SQD',
    'CAD_FORNECEDORES', 'CAD_ITENS', 'CAD_MAQUINAS', 'CAD_INSTRUMENTOS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NivelAcesso" AS ENUM ('VISUALIZAR', 'EDITAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Sem acesso = sem linha aqui. Ninguem nasce com permissao.
CREATE TABLE IF NOT EXISTS "AcessoModulo" (
  "id"        SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL,
  "modulo"    "ModuloSistema" NOT NULL,
  "nivel"     "NivelAcesso" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcessoModulo_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcessoModulo_usuarioId_modulo_key"
  ON "AcessoModulo" ("usuarioId", "modulo");
CREATE INDEX IF NOT EXISTS "AcessoModulo_usuarioId_idx"
  ON "AcessoModulo" ("usuarioId");
