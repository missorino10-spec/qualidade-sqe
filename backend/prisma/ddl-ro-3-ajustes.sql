-- R.O - ajustes depois da primeira carga do DDL.
-- O "Nº Formulário R.O." da planilha e o proprio numero do registro, gerado
-- pelo sistema: a coluna separada era um campo duplicado.
ALTER TABLE "Reclamacao" DROP COLUMN IF EXISTS "numeroFormularioSac";

-- "updatedAt" e @updatedAt no schema: quem preenche e o Prisma, nao o banco.
-- Com o DEFAULT o "prisma db push" do boot veria diferenca todo deploy.
ALTER TABLE "Reclamacao" ALTER COLUMN "updatedAt" DROP DEFAULT;
