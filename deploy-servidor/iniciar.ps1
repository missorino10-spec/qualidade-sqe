# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  LIGAR / MANTER O SISTEMA NO AR
#
#  Este script e o coracao do "volta sozinho". Ele e chamado:
#    - toda vez que o servidor liga            (tarefa QualidadeSQE-Iniciar)
#    - a cada 10 minutos, o dia inteiro        (tarefa QualidadeSQE-Vigia)
#
#  Ele NAO estraga nada se o sistema ja estiver no ar: confere e sai.
#  E cada passo cobre um jeito diferente de cair:
#    - conteiner morreu         -> o proprio Docker religa (restart: unless-stopped)
#    - servico do Docker caiu   -> o systemd da distribuicao religa
#    - a distribuicao desligou  -> este script acorda ela
#    - o servidor reiniciou     -> este script roda no boot
#    - o IP interno do Linux mudou -> este script refaz o encaminhamento da porta
#
#  Tambem pode ser chamado a mao:
#     powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
# ============================================================

param(
  [string]$Distro = 'Ubuntu-22.04',
  [int]$Porta = 8080,
  [string]$Pasta = '/opt/qualidade-sqe',
  [string]$Log = 'C:\QualidadeSQE\logs\inicio.log'
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ------------------------------------------------------------
# Log: uma linha por evento, com data e hora. E o primeiro lugar
# onde o TI olha quando alguem diz "o sistema sumiu".
# ------------------------------------------------------------
$pastaLog = Split-Path $Log -Parent
if (-not (Test-Path $pastaLog)) { New-Item -ItemType Directory -Path $pastaLog -Force | Out-Null }

function Registrar($texto) {
  $linha = "[{0}] {1}" -f (Get-Date -Format 'dd/MM/yyyy HH:mm:ss'), $texto
  Write-Host $linha
  Add-Content -Path $Log -Value $linha -Encoding UTF8
}

# O log nao pode crescer para sempre em um servidor que fica anos ligado.
if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 5MB)) {
  Move-Item $Log "$Log.antigo" -Force
}

function DentroDoLinux($comando) {
  # 2>&1 junta o erro na saida para que ele caia no log em vez de sumir.
  $saida = & wsl.exe -d $Distro -u root -e bash -lc $comando 2>&1
  return ($saida | Out-String).Replace("`0", '').Trim()
}

# ------------------------------------------------------------
# 1. Acordar a distribuicao
# ------------------------------------------------------------
$ipLinux = DentroDoLinux 'hostname -I'
$ipLinux = ($ipLinux -split '\s+')[0]

if ($ipLinux -notmatch '^\d+\.\d+\.\d+\.\d+$') {
  Registrar "ERRO: a distribuicao $Distro nao respondeu. Saida: $ipLinux"
  Registrar 'Confira se esta tarefa roda com a MESMA conta que instalou o WSL.'
  exit 1
}

# ------------------------------------------------------------
# 2. Garantir o Docker
# ------------------------------------------------------------
$docker = DentroDoLinux 'docker info >/dev/null 2>&1 && echo NOAR || echo PARADO'

if ($docker -notmatch 'NOAR') {
  Registrar 'Docker parado - religando...'
  DentroDoLinux 'systemctl start docker 2>/dev/null || ( dockerd >/var/log/dockerd.log 2>&1 & ); sleep 5' | Out-Null
  $docker = DentroDoLinux 'docker info >/dev/null 2>&1 && echo NOAR || echo PARADO'
  if ($docker -notmatch 'NOAR') {
    Registrar 'ERRO: o Docker nao subiu. Veja /var/log/dockerd.log dentro do Linux.'
    exit 1
  }
  Registrar 'Docker religado.'
}

# ------------------------------------------------------------
# 3. Garantir os conteineres
# ------------------------------------------------------------
$noAr = DentroDoLinux "cd $Pasta && docker compose ps --status running --format '{{.Name}}' | wc -l"

if ($noAr -ne '3') {
  Registrar "Faltam conteineres no ar ($noAr de 3) - subindo a stack..."
  DentroDoLinux "cd $Pasta && docker compose up -d" | Out-Null
  Start-Sleep -Seconds 10
}

# ------------------------------------------------------------
# 4. Encaminhar a porta para dentro do WSL
#    O WSL2 fica atras de uma rede NAT propria: sem este encaminhamento o
#    sistema abre no proprio servidor mas NAO abre nos computadores da
#    fabrica. E o IP interno do Linux MUDA a cada reinicializacao, por isso
#    isto e refeito toda vez em vez de ser configurado uma unica vez.
# ------------------------------------------------------------
$ipsDoWindows = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress

if ($ipsDoWindows -contains $ipLinux) {
  # Rede em modo espelhado (Windows 11 22H2+ / Server 2025): o Linux usa o
  # mesmo IP do Windows e nao existe NAT no meio. Encaminhar aqui criaria
  # um laco da porta para ela mesma.
  $atual = netsh interface portproxy show v4tov4 | Out-String
  if ($atual -match "\s$Porta\s") {
    netsh interface portproxy delete v4tov4 listenport=$Porta listenaddress=0.0.0.0 | Out-Null
    Registrar 'Rede em modo espelhado: encaminhamento antigo removido.'
  }
} else {
  $regras = netsh interface portproxy show v4tov4 | Out-String
  $jaCerto = $regras -match [regex]::Escape($ipLinux)

  if (-not $jaCerto) {
    netsh interface portproxy delete v4tov4 listenport=$Porta listenaddress=0.0.0.0 2>$null | Out-Null
    netsh interface portproxy add v4tov4 listenport=$Porta listenaddress=0.0.0.0 `
      connectport=$Porta connectaddress=$ipLinux | Out-Null
    Registrar "Porta $Porta encaminhada para o Linux ($ipLinux)."
  }
}

# ------------------------------------------------------------
# 5. Conferir que a fabrica consegue abrir
#    O teste e feito pelo IP do servidor, e nao por localhost: e o caminho
#    que o computador da fabrica percorre (firewall + encaminhamento).
# ------------------------------------------------------------
$ipServidor = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.IPAddress -ne $ipLinux
  } | Select-Object -First 1).IPAddress

$respondeu = $false
foreach ($tentativa in 1..12) {
  try {
    $r = Invoke-WebRequest -Uri "http://$ipServidor`:$Porta/" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $respondeu = $true; break }
  } catch { Start-Sleep -Seconds 5 }
}

if ($respondeu) {
  # Em regime normal (vigia de 10 em 10 minutos) nao vale poluir o log
  # dizendo "esta tudo bem" 144 vezes por dia. So registra se mexeu em algo.
  if ($noAr -ne '3' -or $docker -notmatch 'NOAR') {
    Registrar "Sistema restabelecido: http://$ipServidor`:$Porta"
  }
} else {
  Registrar "ERRO: o sistema nao respondeu em http://$ipServidor`:$Porta"
  Registrar (DentroDoLinux "cd $Pasta && docker compose ps")
  exit 1
}
