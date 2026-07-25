#!/usr/bin/env bash
# ============================================================
# Sistema de Qualidade (SQE) - BACKUP AUTOMATICO
#
# Gera 1 arquivo unico por dia contendo:
#   - o banco de dados inteiro (historico, RNCs, inspecoes, fornecedores)
#   - todos os anexos/fotos enviados
#
# Roda sozinho todo dia as 02:00 (agendado pelo instalador).
# Tambem pode ser executado a mao:   sudo ./deploy-nuvem/backup.sh
#
# COPIA PARA FORA DO SERVIDOR (fortemente recomendado):
#   Se o servidor morrer, o backup morre junto. Para enviar a copia
#   para Google Drive / OneDrive / S3, instale o rclone e configure
#   um destino chamado "backup" (rclone config). O script detecta
#   sozinho e envia. Sem rclone, o backup fica apenas local.
# ============================================================

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="/var/backups/qualidade"
RETENCAO_DIAS=14
DATA="$(date '+%Y-%m-%d_%H%M')"
TEMP="$(mktemp -d)"
ARQUIVO="$DESTINO/qualidade_$DATA.tar.gz"

limpar() { rm -rf "$TEMP"; }
trap limpar EXIT

echo "[$(date '+%d/%m/%Y %H:%M:%S')] Iniciando backup..."

mkdir -p "$DESTINO"

# Le usuario/banco do .env
if [ -f "$RAIZ/.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$RAIZ/.env"; set +a
fi
PGUSER="${POSTGRES_USER:-qualidade}"
PGDB="${POSTGRES_DB:-qualidade}"

# ---- 1. Banco de dados ----
if ! docker ps --format '{{.Names}}' | grep -q '^qualidade-postgres$'; then
  echo "ERRO: conteiner qualidade-postgres nao esta rodando. Backup abortado."
  exit 1
fi
echo "  - Exportando banco de dados..."
docker exec qualidade-postgres pg_dump -U "$PGUSER" -d "$PGDB" -F c -f /tmp/banco.dump
docker cp qualidade-postgres:/tmp/banco.dump "$TEMP/banco.dump" >/dev/null
docker exec qualidade-postgres rm -f /tmp/banco.dump

# ---- 2. Anexos / fotos ----
echo "  - Exportando anexos..."
if docker ps --format '{{.Names}}' | grep -q '^qualidade-backend$'; then
  docker exec qualidade-backend sh -c 'tar -cf - -C /app/uploads . 2>/dev/null' > "$TEMP/uploads.tar" || true
else
  echo "    (backend parado - anexos ignorados)"
  : > "$TEMP/uploads.tar"
fi

# ---- 3. Empacota tudo ----
echo "  - Compactando..."
tar -czf "$ARQUIVO" -C "$TEMP" banco.dump uploads.tar
chmod 600 "$ARQUIVO"
TAMANHO="$(du -h "$ARQUIVO" | cut -f1)"
echo "  - Backup criado: $ARQUIVO ($TAMANHO)"

# ---- 4. Copia para fora do servidor (se rclone estiver configurado) ----
if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -q '^backup:'; then
  echo "  - Enviando copia para a nuvem externa (rclone)..."
  if rclone copy "$ARQUIVO" backup:qualidade-sqe/ 2>/dev/null; then
    echo "    Copia externa enviada com sucesso."
  else
    echo "    AVISO: falha ao enviar copia externa (backup local esta salvo)."
  fi
else
  echo "  - rclone nao configurado: backup somente LOCAL."
  echo "    Recomendado configurar copia externa (veja o GUIA-NUVEM.md)."
fi

# ---- 5. Retencao: apaga backups antigos ----
APAGADOS=$(find "$DESTINO" -name 'qualidade_*.tar.gz' -mtime +$RETENCAO_DIAS -print -delete 2>/dev/null | wc -l)
[ "$APAGADOS" -gt 0 ] && echo "  - $APAGADOS backup(s) com mais de $RETENCAO_DIAS dias removido(s)."

TOTAL=$(find "$DESTINO" -name 'qualidade_*.tar.gz' | wc -l)
echo "[$(date '+%d/%m/%Y %H:%M:%S')] Backup concluido. Total guardado: $TOTAL arquivo(s)."
