#!/usr/bin/env bash
# ============================================================
#  Sistema de Qualidade (SQE) - BACKUP AUTOMATICO (Windows Server)
#
#  Gera 1 arquivo unico por dia contendo:
#    - o banco de dados inteiro (RNCs, inspecoes, fornecedores, historico)
#    - todos os anexos e fotos enviados pela Qualidade
#
#  O arquivo e gravado em C:\QualidadeSQE\backups, no disco do WINDOWS.
#  Isso e proposital: fica visivel para o TI e entra no backup corporativo
#  da empresa junto com o resto do servidor, sem ninguem precisar saber que
#  existe um Linux no meio.
#
#  Roda sozinho todo dia as 20:00 (tarefa QualidadeSQE-Backup).
#  Tambem pode ser rodado a mao, a qualquer hora, com o sistema no ar:
#     wsl -d Ubuntu-22.04 -u root -e bash -lc /opt/qualidade-sqe/deploy-servidor/backup.sh
# ============================================================

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${DESTINO_BACKUP:-/mnt/c/QualidadeSQE/backups}"
LOG="${LOG_BACKUP:-/mnt/c/QualidadeSQE/logs/backup.log}"
RETENCAO_DIAS="${RETENCAO_DIAS:-30}"
DATA="$(date '+%Y-%m-%d_%H%M')"
ARQUIVO="$DESTINO/qualidade_$DATA.tar.gz"
TEMP="$(mktemp -d)"

trap 'rm -rf "$TEMP"' EXIT

mkdir -p "$DESTINO" "$(dirname "$LOG")"

# Tudo que este script fala vai para a tela E para o log do Windows: quando
# ele roda agendado, de madrugada, o log e a unica testemunha.
exec > >(tee -a "$LOG") 2>&1

echo ""
echo "[$(date '+%d/%m/%Y %H:%M:%S')] Iniciando backup..."

# Le usuario/banco do .env
if [ -f "$RAIZ/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$RAIZ/.env"; set +a
fi
PGUSER="${POSTGRES_USER:-qualidade}"
PGDB="${POSTGRES_DB:-qualidade}"

# ---- 1. Banco de dados ----
if ! docker ps --format '{{.Names}}' | grep -q '^qualidade-postgres$'; then
  echo "  ERRO: o banco nao esta no ar. Backup ABORTADO."
  echo "  Rode no PowerShell: powershell -File C:\\QualidadeSQE\\iniciar.ps1"
  exit 1
fi

echo "  - Exportando o banco de dados..."
docker exec qualidade-postgres pg_dump -U "$PGUSER" -d "$PGDB" -F c -f /tmp/banco.dump
docker cp qualidade-postgres:/tmp/banco.dump "$TEMP/banco.dump" >/dev/null
docker exec qualidade-postgres rm -f /tmp/banco.dump

# ---- 2. Anexos / fotos ----
echo "  - Exportando os anexos e fotos..."
if docker ps --format '{{.Names}}' | grep -q '^qualidade-backend$'; then
  docker exec qualidade-backend sh -c 'tar -cf - -C /app/uploads . 2>/dev/null' > "$TEMP/uploads.tar" || true
else
  echo "    (a API esta parada - anexos nao entraram neste backup)"
  : > "$TEMP/uploads.tar"
fi

# ---- 3. Empacota ----
echo "  - Compactando..."
tar -czf "$ARQUIVO" -C "$TEMP" banco.dump uploads.tar
TAMANHO="$(du -h "$ARQUIVO" | cut -f1)"
echo "  - Backup criado: $ARQUIVO ($TAMANHO)"

# ---- 4. Conferencia: um backup que nao abre nao e backup ----
if tar -tzf "$ARQUIVO" >/dev/null 2>&1; then
  echo "  - Arquivo conferido: abre corretamente."
else
  echo "  ERRO: o arquivo gerado esta corrompido. NAO conte com este backup."
  exit 1
fi

# ---- 5. Retencao ----
APAGADOS=$(find "$DESTINO" -name 'qualidade_*.tar.gz' -mtime "+$RETENCAO_DIAS" -print -delete 2>/dev/null | wc -l)
[ "$APAGADOS" -gt 0 ] && echo "  - $APAGADOS backup(s) com mais de $RETENCAO_DIAS dias removido(s)."

TOTAL=$(find "$DESTINO" -name 'qualidade_*.tar.gz' | wc -l)
echo "[$(date '+%d/%m/%Y %H:%M:%S')] Backup concluido. Guardados: $TOTAL arquivo(s)."
