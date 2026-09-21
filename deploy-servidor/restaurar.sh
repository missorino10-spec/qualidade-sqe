#!/usr/bin/env bash
# ============================================================
#  Sistema de Qualidade (SQE) - RESTAURAR UM BACKUP
#
#  Use quando algo der muito errado: devolve o banco (historico completo)
#  e os anexos ao estado de um backup.
#
#  VER OS BACKUPS DISPONIVEIS:
#     wsl -d Ubuntu-22.04 -u root -e bash -lc \
#       "/opt/qualidade-sqe/deploy-servidor/restaurar.sh --listar"
#
#  RESTAURAR:
#     wsl -d Ubuntu-22.04 -u root
#     /opt/qualidade-sqe/deploy-servidor/restaurar.sh \
#       /mnt/c/QualidadeSQE/backups/qualidade_2026-09-21_2000.tar.gz
#
#  ATENCAO: a restauracao SUBSTITUI os dados atuais. Antes de tocar em
#  qualquer coisa o script guarda sozinho uma copia do estado de agora,
#  para o caso de voce ter restaurado o backup errado.
# ============================================================

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${DESTINO_BACKUP:-/mnt/c/QualidadeSQE/backups}"
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
  echo "Para restaurar:  $0 <caminho-do-arquivo>"
  exit 0
fi

if [ ! -f "$ARQUIVO" ]; then
  echo "ERRO: arquivo nao encontrado: $ARQUIVO"
  exit 1
fi

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

  TODOS os dados de agora (inspecoes, RNCs, historico e anexos)
  serao SUBSTITUIDOS pelo conteudo deste backup.
============================================================

EOF

read -r -p 'Digite RESTAURAR para confirmar: ' CONFIRMA
if [ "$CONFIRMA" != "RESTAURAR" ]; then
  echo "Cancelado. Nada foi alterado."
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -q '^qualidade-postgres$'; then
  echo "ERRO: o banco nao esta no ar. Suba o sistema antes de restaurar."
  exit 1
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

# Rede de seguranca: se a pessoa escolheu o backup errado, da para voltar.
echo "  - Guardando o estado atual antes de sobrescrever..."
SEGURANCA="$DESTINO/antes-da-restauracao_$(date '+%Y-%m-%d_%H%M').dump"
docker exec qualidade-postgres pg_dump -U "$PGUSER" -d "$PGDB" -F c -f /tmp/seg.dump 2>/dev/null || true
docker cp qualidade-postgres:/tmp/seg.dump "$SEGURANCA" >/dev/null 2>&1 || true
docker exec qualidade-postgres rm -f /tmp/seg.dump 2>/dev/null || true
[ -f "$SEGURANCA" ] && echo "    Estado anterior salvo em: $SEGURANCA"

echo "  - Parando a API (para ninguem escrever durante a restauracao)..."
docker stop qualidade-backend >/dev/null 2>&1 || true

echo "  - Restaurando o banco de dados..."
docker cp "$TEMP/banco.dump" qualidade-postgres:/tmp/restore.dump >/dev/null
docker exec qualidade-postgres pg_restore -U "$PGUSER" -d "$PGDB" --clean --if-exists /tmp/restore.dump
docker exec qualidade-postgres rm -f /tmp/restore.dump

echo "  - Religando a API..."
docker start qualidade-backend >/dev/null 2>&1 || true
sleep 8

echo "  - Restaurando os anexos e fotos..."
if [ -s "$TEMP/uploads.tar" ]; then
  docker cp "$TEMP/uploads.tar" qualidade-backend:/tmp/uploads.tar >/dev/null
  docker exec qualidade-backend sh -c 'mkdir -p /app/uploads && tar -xf /tmp/uploads.tar -C /app/uploads && rm -f /tmp/uploads.tar'
  echo "    Anexos restaurados."
else
  echo "    (este backup nao tinha anexos)"
fi

docker restart qualidade-backend >/dev/null 2>&1 || true

cat <<EOF

============================================================
  RESTAURACAO CONCLUIDA
============================================================
  O sistema voltou ao estado de:
  $ARQUIVO

  Aguarde uns 30 segundos e acesse normalmente.
  Se voce restaurou o arquivo errado, o estado anterior esta em:
  $SEGURANCA
============================================================
EOF
