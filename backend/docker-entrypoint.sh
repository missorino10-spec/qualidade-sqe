#!/bin/sh
set -e

echo "Sincronizando o schema do banco..."
# Sem --accept-data-loss de proposito: se a mudanca for destrutiva, o deploy
# falha e avisa, em vez de apagar colunas ou tabelas silenciosamente.
npx prisma db push --skip-generate

echo "Aplicando o seed inicial..."
# Sem "|| echo": engolir o erro faria o sistema subir sem nenhum usuario e sem
# aviso no log. O seed usa upsert, entao rodar a cada boot e seguro.
node dist/prisma/seed.js

echo "Iniciando o backend..."
node dist/src/main.js
