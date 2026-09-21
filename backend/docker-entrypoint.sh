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
# "exec" e obrigatorio: sem ele o node fica sendo FILHO deste shell, e quem
# recebe o pedido de desligar (SIGTERM) e o shell, que nao repassa nada. O
# resultado era o servidor ser desligado no grito depois de 10 segundos de
# espera, cortando no meio qualquer gravacao em andamento - uma importacao de
# planilha, por exemplo. Com "exec" o node vira o processo principal, recebe o
# sinal e fecha as conexoes e as gravacoes antes de sair.
exec node dist/src/main.js
