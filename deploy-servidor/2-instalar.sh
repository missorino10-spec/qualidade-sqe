#!/usr/bin/env bash
# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  PASSO 2 de 3  -  INSTALAR O SISTEMA DENTRO DO LINUX (WSL2)
#
#  O que este script faz:
#    1. Confere que esta rodando dentro do WSL2, como root
#    2. Liga o systemd na distribuicao (faz o Docker voltar sozinho)
#    3. Instala o Docker Engine (sem Docker Desktop, sem licenca)
#    4. BAIXA O CODIGO DO GITHUB para dentro do Linux (/opt/qualidade-sqe)
#    5. Gera o .env com senhas fortes e aleatorias
#    6. Monta e sobe o sistema (banco + API + telas)
#    7. Espera o sistema responder e mostra a senha do acesso principal
#
#  COMO USAR (depois do passo 1, no PowerShell do Windows):
#     wsl -d Ubuntu-22.04 -u root
#     curl -fsSL https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/2-instalar.sh -o /tmp/instalar.sh
#     bash /tmp/instalar.sh
#
#  O repositorio e publico: nao e preciso senha nem token para baixar.
#
#  Tambem funciona a partir de uma copia da pasta do projeto: se houver um
#  docker-compose.yml ao lado do script, ele instala dessa pasta e nem toca
#  no GitHub.
#
#  Pode ser executado varias vezes: NAO sobrescreve o .env nem apaga dados.
# ============================================================

set -euo pipefail

ALVO="${ALVO:-/opt/qualidade-sqe}"
PORTA="${APP_PORT:-8080}"
FUSO="${TZ:-America/Sao_Paulo}"
EMAIL_ADMIN="${SEED_ADMIN_EMAIL:-admin@qualidade-sqe.com}"
REPO="${REPO_GIT:-https://github.com/missorino10-spec/qualidade-sqe.git}"
RAMO="${REPO_RAMO:-main}"

azul()  { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
ok()    { printf '\033[1;32m  [OK] %s\033[0m\n' "$1"; }
aviso() { printf '\033[1;33m  [!] %s\033[0m\n' "$1"; }
erro()  { printf '\033[1;31m  [ERRO] %s\033[0m\n' "$1" >&2; }

# ------------------------------------------------------------
# 0. Verificacoes iniciais
# ------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  erro "Rode como root:  wsl -d Ubuntu-22.04 -u root"
  exit 1
fi

if ! grep -qi microsoft /proc/version 2>/dev/null; then
  aviso "Nao parece ser WSL. Este instalador foi validado em Windows Server + WSL2."
fi

if ! command -v apt-get >/dev/null 2>&1; then
  erro "Este instalador suporta Ubuntu/Debian."
  exit 1
fi

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# De onde vem o codigo. O caminho normal e o GitHub; instalar de uma pasta so
# acontece quando alguem roda o script de dentro de uma copia do projeto (foi
# assim que o pacote foi validado, e continua servindo para testar sem rede).
if [ -f "$ORIGEM/docker-compose.yml" ] && [ "$ORIGEM" != "$ALVO" ]; then
  FONTE='pasta'
else
  FONTE='github'
fi

azul "Instalador do Sistema de Qualidade (SQE) - Windows Server + WSL2"
if [ "$FONTE" = 'github' ]; then
  echo "  Origem  : $REPO (ramo $RAMO)"
else
  echo "  Origem  : $ORIGEM (pasta local)"
fi
echo "  Destino : $ALVO"
echo "  Porta   : $PORTA"
echo "  Fuso    : $FUSO"

# ------------------------------------------------------------
# 1. systemd na distribuicao
#    Com o systemd ligado o Docker sobe sozinho quando a distro acorda -
#    e e ele quem religa o Docker se o servico cair.
# ------------------------------------------------------------
azul "Configurando a distribuicao"

if [ ! -f /etc/wsl.conf ] || ! grep -q 'systemd=true' /etc/wsl.conf; then
  cat > /etc/wsl.conf <<EOF
[boot]
systemd=true

[interop]
# O sistema nao precisa chamar programas do Windows de dentro do Linux.
appendWindowsPath=false
EOF
  ok "systemd ativado (vale a partir do proximo 'wsl --shutdown')."
  REINICIAR_DISTRO=1
else
  ok "systemd ja estava configurado."
  REINICIAR_DISTRO=0
fi

ln -sf "/usr/share/zoneinfo/$FUSO" /etc/localtime
echo "$FUSO" > /etc/timezone
ok "Relogio da distribuicao em $FUSO."

# ------------------------------------------------------------
# 2. Docker Engine
# ------------------------------------------------------------
azul "Instalando o Docker Engine"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok "Docker ja instalado ($(docker --version))."
else
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg >/dev/null

  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi

  CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin >/dev/null
  ok "Docker Engine instalado ($(docker --version))."
fi

# Liga o Docker agora, com ou sem systemd no ar.
iniciar_docker() {
  if docker info >/dev/null 2>&1; then return 0; fi
  if [ -d /run/systemd/system ]; then
    systemctl enable docker >/dev/null 2>&1 || true
    systemctl start docker  >/dev/null 2>&1 || true
  else
    # Distro ainda sem systemd (so vale apos o 'wsl --shutdown'): sobe o
    # daemon na mao so para conseguir terminar esta instalacao.
    ( dockerd >/var/log/dockerd.log 2>&1 & ) || true
  fi
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

if iniciar_docker; then
  ok "Docker no ar."
else
  erro "O Docker nao subiu. Veja /var/log/dockerd.log"
  exit 1
fi

[ -d /run/systemd/system ] && systemctl enable docker >/dev/null 2>&1 || true

# ------------------------------------------------------------
# 3. Trazer o codigo para dentro do Linux
#    Sempre para /opt, nunca rodando de /mnt/c: o disco do Windows visto
#    pelo WSL e varias vezes mais lento e nao carrega permissao de Linux.
# ------------------------------------------------------------
azul "Trazendo o codigo para $ALVO"

if [ "$FONTE" = 'github' ]; then
  command -v git >/dev/null 2>&1 || {
    apt-get update -qq && apt-get install -y -qq git >/dev/null
  }

  if [ -d "$ALVO/.git" ]; then
    # Atualizacao. O checkout -B em cima do FETCH_HEAD e proposital: no
    # servidor o codigo tem de ser exatamente o do GitHub, sem remendo local.
    # Ele mexe apenas no que esta versionado - o .env nao esta (fica de fora
    # pelo .gitignore) e as fotos moram num volume do Docker, nao nesta pasta.
    git -C "$ALVO" fetch --quiet "$REPO" "$RAMO"
    git -C "$ALVO" checkout --quiet -B "$RAMO" FETCH_HEAD
    ok "Codigo atualizado para o ramo $RAMO."
  else
    rm -rf "$ALVO"
    git clone --quiet --branch "$RAMO" --depth 1 "$REPO" "$ALVO"
    ok "Codigo baixado do GitHub (ramo $RAMO)."
  fi

  echo "  Versao: $(git -C "$ALVO" log -1 --format='%h %s')"
else
  mkdir -p "$ALVO"
  tar -cf - \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    --exclude=build \
    --exclude=scripts/fotografia \
    --exclude=.env \
    -C "$ORIGEM" . | tar -xf - -C "$ALVO"
  ok "Projeto copiado da pasta (o .env existente foi preservado)."
fi

# A permissao de execucao nao atravessa o disco do Windows: vinda de la, a
# rotina de backup e a de restauracao chegariam aqui sem poder rodar, e o
# erro so apareceria meses depois, na noite em que alguem precisasse do
# backup. Devolver a permissao agora custa uma linha.
chmod +x "$ALVO"/deploy-servidor/*.sh 2>/dev/null || true

cd "$ALVO"

# Os scripts do passo 3 rodam no PowerShell, do lado do Windows. Depois que o
# codigo passou a vir do GitHub, eles so existiriam dentro do Linux, e o TI
# teria de garimpar \\wsl$\... para achar. Copiar para a pasta que ele ja usa
# resolve.
mkdir -p /mnt/c/QualidadeSQE
cp -f "$ALVO"/deploy-servidor/*.ps1 /mnt/c/QualidadeSQE/ 2>/dev/null || true

# ------------------------------------------------------------
# 4. .env com senhas fortes
# ------------------------------------------------------------
azul "Configurando as senhas do sistema"

senha() { tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "${1:-32}"; }

if [ -f "$ALVO/.env" ]; then
  ok ".env ja existe - mantido como esta (nenhuma senha foi trocada)."
  SENHA_ADMIN=''
else
  SENHA_ADMIN="$(senha 20)"
  cat > "$ALVO/.env" <<EOF
# ============================================================
# Sistema de Qualidade (SQE) - configuracao do servidor
# Gerado por deploy-servidor/2-instalar.sh em $(date '+%d/%m/%Y %H:%M')
#
# NAO APAGUE E NAO EDITE sem saber o que esta fazendo: as senhas do
# banco estao aqui. Trocar POSTGRES_PASSWORD depois do sistema no ar
# deixa o banco inacessivel.
# ============================================================

# --- Acesso principal (o primeiro usuario, que libera os demais) ---
SEED_ADMIN_EMAIL=$EMAIL_ADMIN
SEED_ADMIN_PASSWORD=$SENHA_ADMIN

# --- Banco de dados (interno, nao exposto na rede) ---
POSTGRES_USER=qualidade
POSTGRES_PASSWORD=$(senha 32)
POSTGRES_DB=qualidade

# --- Chave que assina o login dos usuarios ---
JWT_SECRET=$(senha 48)

# --- Endereco e relogio ---
APP_PORT=$PORTA
TZ=$FUSO

# Vazio = aceita qualquer endereco da rede interna (o IP do servidor pode
# mudar, e a fabrica acessa por IP). Preencha so se o sistema ganhar um
# nome fixo (ex.: http://qualidade.empresa.local).
CORS_ORIGINS=
EOF
  chmod 600 "$ALVO/.env"
  ok "Senhas geradas (.env protegido, somente root le)."
fi

# ------------------------------------------------------------
# 5. Subir o sistema
# ------------------------------------------------------------
azul "Montando e subindo o sistema (a primeira vez demora, tenha paciencia)"

docker compose build
docker compose up -d
ok "Conteineres no ar."

# ------------------------------------------------------------
# 6. Esperar o sistema responder
# ------------------------------------------------------------
azul "Conferindo se o sistema respondeu"

RESPONDEU=0
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://localhost:$PORTA/" 2>/dev/null; then
    RESPONDEU=1
    break
  fi
  sleep 5
done

if [ "$RESPONDEU" -eq 1 ]; then
  ok "As telas responderam em http://localhost:$PORTA"
else
  aviso "As telas ainda nao responderam. Veja:  docker compose logs --tail=80"
fi

# Prova de ponta a ponta: fazer login de verdade. Se o token vier, entao
# telas, API, banco e o cadastro do admin estao todos de pe - um "ping"
# simples nao provaria nada disso.
set -a; . "$ALVO/.env"; set +a
RESPOSTA="$(curl -fsS -X POST "http://localhost:$PORTA/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"senha\":\"$SEED_ADMIN_PASSWORD\"}" 2>/dev/null || true)"

if echo "$RESPOSTA" | grep -q 'access_token'; then
  ok "Login do acesso principal funcionou (API + banco + admin conferidos)."
else
  aviso "O login nao funcionou. Veja:  docker compose logs backend --tail=80"
fi

# ------------------------------------------------------------
# Fim
# ------------------------------------------------------------
IP_WSL="$(hostname -I | awk '{print $1}')"

cat <<EOF

============================================================
  PASSO 2 CONCLUIDO
============================================================
  Sistema instalado em : $ALVO
  Porta                : $PORTA
  IP interno do Linux  : $IP_WSL  (muda a cada reinicializacao -
                          quem resolve isso e o passo 3)
EOF

if [ -n "$SENHA_ADMIN" ]; then
  # Gravado no disco do WINDOWS, nao dentro do Linux: quem instala e o TI,
  # que trabalha no Windows. Deixar o arquivo em /opt obrigaria a abrir o
  # WSL so para ler a propria senha, e no aperto da instalacao e onde se
  # perde a senha. A pasta e a mesma dos backups e dos logs.
  ACESSO='/mnt/c/QualidadeSQE/PRIMEIRO-ACESSO.txt'
  mkdir -p "$(dirname "$ACESSO")"
  cat > "$ACESSO" <<EOF
Sistema de Qualidade (SQE) - acesso principal
Gerado em $(date '+%d/%m/%Y %H:%M')

  Endereco: http://$(hostname -I | awk '{print $1}'):$PORTA
            (use o IP do SERVIDOR que o passo 1 mostrou, nao este)
  Usuario : $EMAIL_ADMIN
  Senha   : $SENHA_ADMIN

Este e o unico usuario que existe. Entre com ele e cadastre o pessoal
da Qualidade em "Administracao > Colaboradores e Acessos".

Para trocar esta senha por uma sua, use o menu do seu nome no canto
superior direito, opcao "Trocar minha senha".

Depois guarde esta senha no cofre de senhas do TI e apague este arquivo.
EOF
  chmod 600 "$ACESSO"
  cat <<EOF

  ------------------------------------------------------------
  ACESSO PRINCIPAL (anote agora - so aparece nesta tela)
  ------------------------------------------------------------
    Usuario: $EMAIL_ADMIN
    Senha  : $SENHA_ADMIN

  Guardado tambem em: C:\\QualidadeSQE\\PRIMEIRO-ACESSO.txt
  Apague esse arquivo depois de guardar a senha no cofre do TI.
  ------------------------------------------------------------
EOF
else
  cat <<EOF

  O .env ja existia, entao a senha do acesso principal NAO foi trocada.
  Se precisar consultar:  grep SEED_ADMIN $ALVO/.env
EOF
fi

if [ "$REINICIAR_DISTRO" -eq 1 ]; then
  cat <<EOF

  ATENCAO: o systemd so passa a valer depois de desligar a distribuicao.
  No PowerShell do Windows rode uma vez:   wsl --shutdown
  (o passo 3 liga tudo de novo sozinho)
EOF
fi

cat <<EOF

  PROXIMO PASSO (passo 3) - no PowerShell como administrador:
     cd C:\\QualidadeSQE
     powershell -ExecutionPolicy Bypass -File .\\3-ativar-inicio-automatico.ps1

  (os scripts do passo 3 ja foram copiados para essa pasta)

============================================================
EOF
