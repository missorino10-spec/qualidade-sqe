#!/usr/bin/env bash
# ============================================================
# Sistema de Qualidade (SQE) - RESTAURACAO DE BACKUP
#
# Use quando "der merda": recupera o banco (historico completo)
# e os anexos a partir de um arquivo de backup.
#
# USO:
#   sudo ./deploy-nuvem/restaurar.sh /var/backups/qualidade/qualidade_2026-07-25_0200.tar.gz
#
# Para ver os backups disponiveis:
#   sudo ./deploy-nuvem/restaurar.sh --listar
#
# ATENCAO: a restauracao SUBSTITUI os dados atuais pelos do backup.
# O script pede confirmacao explicita antes de qualquer alteracao.
# ============================================================

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="/var/backups/qualidade"
ARQUIVO="${1:-}"

if [ "$ARQUIVO" = "--listar" ] || [ -z "$ARQUIVO" ]; then
  echo "Backups disponiveis em $DESTINO:"
  echo ""
  if ls "$DESTINO"/qualidade_*.tar.gz >/dev/null 2>&1; then
    ls -lh "$DESTINO"/qualidade_*.tar.gz | awk '{print "  " $9 "   (" $5 ")"}'
  else
    echo "  Nenhum backup encontrado."
  fi
  echo ""
  echo "Para restaurar:  sudo ./deploy-nuvem/restaurar.sh <caminho-do-arquivo>"
  exit 0
fi

if [ ! -f "$ARQUIVO" ]; then
  echo "ERRO: arquivo nao encontrado: $ARQUIVO"
  exit 1
fi

# Le usuario/banco do .env
if [ -f "$RAIZ/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$RAIZ/.env"; set +a
fi
PGUSER="${POSTGRES_USER:-qualidade}"
PGDB="${POSTGRES_DB:-qualidade}"

cat <<EOF

============================================================
  ATENCAO - OPERACAO DESTRUTIVA
============================================================
  Backup a restaurar : $ARQUIVO
  Banco de destino   : $PGDB

  TODOS os dados atuais (inspecoes, RNCs, historico e anexos)
  serao SUBSTITUIDOS pelo conteudo deste backup.
============================================================

EOF

read -r -p 'Digite "RESTAURAR" para confirmar: ' CONFIRMA
if [ "$CONFIRMA" != "RESTAURAR" ]; then
  echo "Cancelado. Nada foi alterado."
  exit 0
fi

TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

echo ""
echo "  - Abrindo o backup..."
tar -xzf "$ARQUIVO" -C "$TEMP"

if [ ! -f "$TEMP/banco.dump" ]; then
  echo "ERRO: backup invalido (banco.dump nao encontrado)."
  exit 1
fi

# Seguranca: guarda um backup do estado ATUAL antes de sobrescrever
echo "  - Guardando o estado atual antes de sobrescrever (seguranca)..."
SEGURANCA="$DESTINO/antes-da-restauracao_$(date '+%Y-%m-%d_%H%M').dump"
docker exec qualidade-postgres pg_dump -U "$PGUSER" -d "$PGDB" -F c -f /tmp/seg.dump 2>/dev/null || true
docker cp qualidade-postgres:/tmp/seg.dump "$SEGURANCA" >/dev/null 2>&1 || true
docker exec qualidade-postgres rm -f /tmp/seg.dump 2>/dev/null || true
[ -f "$SEGURANCA" ] && echo "    Estado anterior salvo em: $SEGURANCA"

# ---- Restaura o banco ----
echo "  - Parando o backend (evita escrita durante a restauracao)..."
docker stop qualidade-backend >/dev/null 2>&1 || true

echo "  - Restaurando o banco de dados..."
docker cp "$TEMP/banco.dump" qualidade-postgres:/tmp/restore.dump >/dev/null
docker exec qualidade-postgres pg_restore -U "$PGUSER" -d "$PGDB" --clean --if-exists /tmp/restore.dump
docker exec qualidade-postgres rm -f /tmp/restore.dump

# ---- Restaura os anexos ----
echo "  - Restaurando os anexos..."
docker start qualidade-backend >/dev/null 2>&1 || true
sleep 5
if [ -s "$TEMP/uploads.tar" ]; then
  docker cp "$TEMP/uploads.tar" qualidade-backend:/tmp/uploads.tar >/dev/null
  docker exec qualidade-backend sh -c 'mkdir -p /app/uploads && tar -xf /tmp/uploads.tar -C /app/uploads && rm -f /tmp/uploads.tar'
  echo "    Anexos restaurados."
else
  echo "    (backup sem anexos)"
fi

echo "  - Reiniciando o sistema..."
docker restart qualidade-backend >/dev/null 2>&1 || true

cat <<EOF

============================================================
  RESTAURACAO CONCLUIDA
============================================================
  O sistema voltou ao estado do backup:
  $ARQUIVO

  Aguarde ~30 segundos e acesse normalmente.
  Se algo deu errado, o estado anterior esta em:
  $SEGURANCA
============================================================
EOF
