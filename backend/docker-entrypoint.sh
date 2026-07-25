#!/bin/sh
set -e

echo "Aguardando o banco de dados..."
# Sincroniza o schema com o banco (cria/atualiza as tabelas) e roda o seed inicial
npx prisma db push --skip-generate --accept-data-loss
node dist/prisma/seed.js || echo "Seed ja aplicado ou ignorado."

echo "Iniciando o backend..."
node dist/src/main.js
