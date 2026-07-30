-- DDL da Manufatura, parte 1 de 2 (executar UMA vez; rodar ANTES da parte 2).
--
-- Por que este arquivo esta separado: o Postgres nao deixa usar um valor novo
-- de enum na MESMA transacao em que ele foi adicionado. A tabela
-- "RelatorioDimensional" nasce com DEFAULT 'LIBERACAO_SETUP', entao o valor
-- precisa estar commitado antes. Uma execucao para cada arquivo resolve.
--
-- Escrito a mao de proposito: "prisma db push" exigiria --accept-data-loss por
-- causa dos indices unicos, e essa flag nunca e usada neste projeto.

ALTER TYPE "OrigemInspecao" ADD VALUE IF NOT EXISTS 'LIBERACAO_SETUP';
