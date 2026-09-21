#!/usr/bin/env bash
# ============================================================
# Sistema de Qualidade (SQE) - Big Dutchman Brasil
# INSTALADOR AUTOMATICO PARA SERVIDOR NA NUVEM (Ubuntu/Debian)
#
# Este script faz TUDO sozinho:
#   1. Instala o Docker
#   2. Cria memoria swap (se o servidor tiver pouca RAM)
#   3. Libera as portas no firewall (ufw + iptables do Oracle)
#   4. Gera senhas fortes e aleatorias (.env)
#   5. Configura HTTPS automatico (se voce informar um dominio)
#   6. Sobe o sistema
#   7. Agenda o backup diario do banco de dados
#
# COMO USAR (dentro do servidor, como root):
#   cd /opt/qualidade
#   sudo bash deploy-nuvem/instalar-nuvem.sh
#
# Com dominio proprio (ativa HTTPS com certificado gratis):
#   sudo DOMINIO=qualidade.suaempresa.com.br bash deploy-nuvem/instalar-nuvem.sh
#
# O script pode ser executado varias vezes sem problema (idempotente):
# ele NAO sobrescreve o .env nem apaga dados ja existentes.
# ============================================================

set -euo pipefail

DOMINIO="${DOMINIO:-}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$RAIZ/deploy-nuvem/docker-compose.nuvem.yml"
ENV_FILE="$RAIZ/.env"
CADDYFILE="$RAIZ/deploy-nuvem/Caddyfile"

azul()    { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok()      { printf '\033[1;32m  [OK] %s\033[0m\n' "$1"; }
aviso()   { printf '\033[1;33m  [!] %s\033[0m\n' "$1"; }
erro()    { printf '\033[1;31m  [ERRO] %s\033[0m\n' "$1" >&2; }

# ------------------------------------------------------------
# 0. Verificacoes iniciais
# ------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  erro "Rode como root:  sudo bash deploy-nuvem/instalar-nuvem.sh"
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  erro "Este instalador suporta Ubuntu/Debian. Sistema nao compativel."
  exit 1
fi

azul "Instalador do Sistema de Qualidade (SQE) - servidor na nuvem"
echo "  Pasta do projeto: $RAIZ"
if [ -n "$DOMINIO" ]; then
  echo "  Dominio: $DOMINIO  (HTTPS automatico sera ativado)"
else
  echo "  Dominio: nao informado (o sistema abrira por HTTP no IP do servidor)"
fi

# ------------------------------------------------------------
# 1. Docker
# ------------------------------------------------------------
azul "1/7 Instalando o Docker"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok "Docker ja instalado - pulando."
else
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl >/dev/null
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
  systemctl enable --now docker >/dev/null 2>&1 || true
  ok "Docker instalado."
fi

# ------------------------------------------------------------
# 2. Swap (evita travar em servidores de 1 GB de RAM)
# ------------------------------------------------------------
azul "2/7 Verificando memoria"
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
echo "  RAM detectada: ${RAM_MB} MB"
if [ "$RAM_MB" -lt 2048 ] && [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "Swap de 2 GB criada (compensa a RAM baixa)."
else
  ok "Memoria suficiente ou swap ja existente."
fi

# ------------------------------------------------------------
# 3. Firewall - libera 22 (SSH), 80 (HTTP) e 443 (HTTPS)
#    Atencao: imagens Ubuntu da Oracle vem com iptables BLOQUEANDO tudo.
# ------------------------------------------------------------
azul "3/7 Liberando portas no firewall"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ok "Regras aplicadas no ufw."
fi

# Oracle Cloud / imagens com iptables restritivo
if command -v iptables >/dev/null 2>&1; then
  for PORTA in 80 443; do
    if ! iptables -C INPUT -p tcp --dport "$PORTA" -j ACCEPT 2>/dev/null; then
      iptables -I INPUT 1 -p tcp --dport "$PORTA" -j ACCEPT 2>/dev/null || true
    fi
  done
  # Persiste as regras para sobreviver a reinicializacao
  if ! command -v netfilter-persistent >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent >/dev/null 2>&1 || true
  fi
  netfilter-persistent save >/dev/null 2>&1 || true
  ok "Regras aplicadas no iptables (necessario na Oracle Cloud)."
fi
aviso "Nao esqueca de liberar 80 e 443 TAMBEM no painel do provedor"
aviso "(Oracle: Security List / Hetzner: Firewall). Sem isso, nao abre."

# ------------------------------------------------------------
# 4. Arquivo .env com senhas fortes geradas automaticamente
# ------------------------------------------------------------
azul "4/7 Configurando senhas e variaveis (.env)"
if [ -f "$ENV_FILE" ]; then
  ok ".env ja existe - preservado (suas senhas atuais foram mantidas)."
else
  SENHA_BANCO="$(openssl rand -hex 24)"
  CHAVE_JWT="$(openssl rand -hex 48)"
  # O seed so cria o administrador, e aborta se estas duas faltarem. A senha e
  # sorteada aqui e aparece UMA vez no resumo final: senha fixa em instalador
  # que vai para a internet e senha publica.
  EMAIL_ADMIN="${SEED_ADMIN_EMAIL:-admin@qualidade.local}"
  SENHA_ADMIN="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  cat > "$ENV_FILE" <<EOF
# ===== Sistema de Qualidade (SQE) - PRODUCAO =====
# Gerado automaticamente em $(date '+%d/%m/%Y %H:%M')
# NAO compartilhe este arquivo. Ele NAO vai para o GitHub (.gitignore).

POSTGRES_USER=qualidade
POSTGRES_PASSWORD=$SENHA_BANCO
POSTGRES_DB=qualidade

JWT_SECRET=$CHAVE_JWT

# Unico usuario criado na instalacao. Trocar a senha pelo sistema, nao aqui:
# o seed so usa estes valores quando o usuario ainda nao existe.
SEED_ADMIN_EMAIL=$EMAIL_ADMIN
SEED_ADMIN_PASSWORD=$SENHA_ADMIN

# Fuso do servidor. O sistema le a data gravada em UTC, mas pergunta "que dia
# e hoje" no relogio local.
TZ=America/Sao_Paulo

DOMINIO=$DOMINIO
EOF
  chmod 600 "$ENV_FILE"
  ok "Senhas fortes e aleatorias geradas."
fi

# O resumo final precisa mostrar o login, e o .env pode ser de uma instalacao
# anterior (o bloco acima e pulado quando ele ja existe).
EMAIL_ADMIN="$(grep -E '^SEED_ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2-)"
SENHA_ADMIN="$(grep -E '^SEED_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
if [ -z "$EMAIL_ADMIN" ] || [ -z "$SENHA_ADMIN" ]; then
  erro "O .env nao tem SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD."
  erro "Sem elas o backend aborta no boot. Acrescente as duas em $ENV_FILE"
  erro "e rode o instalador de novo."
  exit 1
fi

# ------------------------------------------------------------
# 5. Caddy - porta de entrada (HTTPS automatico se houver dominio)
# ------------------------------------------------------------
azul "5/7 Configurando a entrada web (Caddy)"
if [ -n "$DOMINIO" ]; then
  cat > "$CADDYFILE" <<EOF
# HTTPS automatico via Let's Encrypt (certificado gratuito e renovado sozinho)
$DOMINIO {
    encode gzip
    request_body {
        max_size 25MB
    }
    reverse_proxy frontend:80
}
EOF
  ok "HTTPS ativado para $DOMINIO (certificado sera emitido no 1o acesso)."
else
  cat > "$CADDYFILE" <<'EOF'
# Sem dominio: publica em HTTP no IP do servidor.
# Assim que tiver um dominio, rode o instalador com DOMINIO=... para ativar HTTPS.
:80 {
    encode gzip
    request_body {
        max_size 25MB
    }
    reverse_proxy frontend:80
}
EOF
  aviso "Sem dominio: o acesso sera HTTP (senhas trafegam sem criptografia)."
  aviso "Recomendado apontar um dominio e reinstalar com DOMINIO=... o quanto antes."
fi

# ------------------------------------------------------------
# 6. Subir o sistema
# ------------------------------------------------------------
azul "6/7 Compilando e subindo o sistema (pode levar 5-10 min na 1a vez)"
cd "$RAIZ"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --build
ok "Conteineres no ar."

# ------------------------------------------------------------
# 7. Backup diario automatico
# ------------------------------------------------------------
azul "7/7 Agendando o backup diario"
chmod +x "$RAIZ/deploy-nuvem/backup.sh" "$RAIZ/deploy-nuvem/restaurar.sh" 2>/dev/null || true
LINHA_CRON="0 2 * * * $RAIZ/deploy-nuvem/backup.sh >> /var/log/qualidade-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'deploy-nuvem/backup.sh' ; echo "$LINHA_CRON" ) | crontab -
ok "Backup agendado todo dia as 02:00 (guardado em /var/backups/qualidade)."

# ------------------------------------------------------------
# Resumo final
# ------------------------------------------------------------
IP_PUBLICO="$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo 'IP-DO-SERVIDOR')"
if [ -n "$DOMINIO" ]; then
  ENDERECO="https://$DOMINIO"
else
  ENDERECO="http://$IP_PUBLICO"
fi

cat <<EOF

============================================================
  INSTALACAO CONCLUIDA
============================================================

  Acesse o sistema em:   $ENDERECO

  Usuario ADMIN criado na instalacao:
    E-mail: $EMAIL_ADMIN
    Senha:  $SENHA_ADMIN

  Esta senha foi sorteada agora e NAO aparece de novo. Anote.
  Ela tambem esta em $ENV_FILE (so o root le).

  *** ATENCAO - SEGURANCA ***
  O servidor esta na INTERNET. Entre e cadastre os usuarios reais
  pela tela de Colaboradores; cada um com a sua propria senha.

  Comandos uteis:
    Ver status:      docker compose -f deploy-nuvem/docker-compose.nuvem.yml ps
    Ver logs:        docker compose -f deploy-nuvem/docker-compose.nuvem.yml logs -f
    Backup manual:   sudo ./deploy-nuvem/backup.sh
    Restaurar:       sudo ./deploy-nuvem/restaurar.sh <arquivo.tar.gz>
    Atualizar:       git pull && sudo bash deploy-nuvem/instalar-nuvem.sh

  Onde ficam os dados (historico):
    Banco    -> volume Docker "postgres_data" (disco do servidor)
    Anexos   -> volume Docker "uploads_data"
    Backups  -> /var/backups/qualidade (diario, 14 dias de retencao)

============================================================
EOF
