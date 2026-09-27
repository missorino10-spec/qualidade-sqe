# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  PASSO 1 de 3  -  PREPARAR O WINDOWS SERVER
#
#  O que este script faz (lado Windows):
#    1. Confere se a maquina aguenta virtualizacao
#    2. Liga os recursos WSL2 (Subsistema Linux + Plataforma de Maquina Virtual)
#    3. Instala a distribuicao Ubuntu
#    4. Abre a porta do sistema no firewall do Windows
#    5. Cria as pastas de backup e de log em C:\QualidadeSQE
#
#  COMO USAR (PowerShell "Executar como administrador"):
#     mkdir C:\QualidadeSQE -Force; cd C:\QualidadeSQE
#     curl.exe -fsSL -H "Authorization: token SEU_TOKEN" -o 1-preparar-windows.ps1 `
#       https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/1-preparar-windows.ps1
#     powershell -ExecutionPolicy Bypass -File .\1-preparar-windows.ps1
#
#  O repositorio e privado; o token de leitura esta no cofre de senhas do TI.
#
#  IMPORTANTE: faca login com a MESMA conta que vai rodar o sistema depois
#  (a conta de servico). O WSL registra a distribuicao por usuario: se voce
#  instalar com a sua conta e agendar com outra, a tarefa nao enxerga o Ubuntu.
#
#  Pode ser executado varias vezes sem problema (nao desfaz nada).
# ============================================================

param(
  [string]$Distro = 'Ubuntu-22.04',
  [int]$Porta = 8080
)

$ErrorActionPreference = 'Stop'

function Titulo($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "  [!] $t" -ForegroundColor Yellow }
function Erro($t)   { Write-Host "  [ERRO] $t" -ForegroundColor Red }

# ------------------------------------------------------------
# 0. Precisa ser administrador
# ------------------------------------------------------------
$souAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $souAdmin) {
  Erro 'Abra o PowerShell com "Executar como administrador" e rode de novo.'
  exit 1
}

Titulo 'Preparando o Windows Server para o Sistema de Qualidade (SQE)'
Write-Host "  Conta atual      : $env:USERDOMAIN\$env:USERNAME"
Write-Host "  Distribuicao WSL : $Distro"
Write-Host "  Porta do sistema : $Porta"

# ------------------------------------------------------------
# 1. A maquina aguenta virtualizacao?
# ------------------------------------------------------------
Titulo 'Conferindo a maquina'

$so = Get-CimInstance Win32_OperatingSystem
Write-Host "  Sistema: $($so.Caption) build $($so.BuildNumber)"
if ([int]$so.BuildNumber -lt 19041) {
  Erro 'O WSL2 exige build 19041 ou superior. Atualize o Windows antes de continuar.'
  exit 1
}
Ok 'Versao do Windows compativel com WSL2.'

# Em servidor fisico a virtualizacao vem do processador; em VM (VMware/Hyper-V)
# e preciso que o hipervisor exponha a virtualizacao aninhada para a VM.
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
if (-not $cpu.VirtualizationFirmwareEnabled -and -not (Get-CimInstance Win32_ComputerSystem).HypervisorPresent) {
  Aviso 'A virtualizacao parece DESLIGADA no BIOS/hipervisor.'
  Aviso 'Se este servidor for uma maquina virtual, peca a virtualizacao aninhada'
  Aviso '(nested virtualization) ao time que administra o hipervisor.'
} else {
  Ok 'Virtualizacao disponivel.'
}

# ------------------------------------------------------------
# 2. Ligar os recursos do WSL2
# ------------------------------------------------------------
Titulo 'Ligando os recursos do WSL2'

$precisaReiniciar = $false
foreach ($recurso in @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')) {
  $estado = (Get-WindowsOptionalFeature -Online -FeatureName $recurso -ErrorAction SilentlyContinue)
  if ($null -eq $estado) {
    Aviso "Recurso $recurso nao encontrado nesta edicao do Windows."
    continue
  }
  if ($estado.State -eq 'Enabled') {
    Ok "$recurso ja estava ligado."
  } else {
    Write-Host "  Ligando $recurso ..."
    $r = Enable-WindowsOptionalFeature -Online -FeatureName $recurso -All -NoRestart
    Ok "$recurso ligado."
    if ($r.RestartNeeded) { $precisaReiniciar = $true }
  }
}

if ($precisaReiniciar) {
  Write-Host ''
  Aviso 'O Windows precisa ser REINICIADO para terminar de ligar o WSL2.'
  Aviso 'Reinicie o servidor e rode este mesmo script outra vez.'
  exit 0
}

# ------------------------------------------------------------
# 3. Instalar / conferir a distribuicao Ubuntu
# ------------------------------------------------------------
Titulo 'Instalando a distribuicao Linux'

# wsl.exe escreve em UTF-16; sem isto o texto volta picotado e nenhum
# "match" funciona.
$codificacaoAnterior = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.Encoding]::Unicode

try {
  & wsl.exe --set-default-version 2 | Out-Null

  $instaladas = (& wsl.exe --list --quiet) -replace "`0", '' |
    ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }

  if ($instaladas -contains $Distro) {
    Ok "$Distro ja esta instalada."
  } else {
    Write-Host "  Baixando e instalando $Distro (pode demorar alguns minutos)..."
    # --no-launch evita a tela interativa que pede usuario e senha do Linux:
    # o sistema roda como root dentro da distro, nao precisa de usuario comum.
    & wsl.exe --install -d $Distro --no-launch
    if ($LASTEXITCODE -ne 0) {
      Erro 'Nao foi possivel instalar automaticamente.'
      Write-Host ''
      Write-Host '  Servidor sem loja/sem internet direta? Instale manualmente:' -ForegroundColor Yellow
      Write-Host '   1. Baixe o pacote da distribuicao em uma maquina com internet:'
      Write-Host '      https://aka.ms/wslubuntu2204'
      Write-Host '   2. Copie o arquivo .AppxBundle para o servidor'
      Write-Host '   3. No servidor:  Add-AppxPackage .\Ubuntu2204.AppxBundle'
      Write-Host '   4. Rode este script de novo'
      exit 1
    }
    Ok "$Distro instalada."
  }

  # Primeiro boot da distro (cria o sistema de arquivos).
  & wsl.exe -d $Distro -u root -e /bin/true 2>&1 | Out-Null
  $versao = (& wsl.exe --list --verbose) -replace "`0", ''
  if ($versao -match "$Distro\s+\S+\s+1") {
    Write-Host "  Convertendo $Distro para WSL 2 ..."
    & wsl.exe --set-version $Distro 2
  }
  Ok 'Distribuicao pronta e rodando em WSL 2.'
}
finally {
  [Console]::OutputEncoding = $codificacaoAnterior
}

# ------------------------------------------------------------
# 4. Abrir a porta no firewall
# ------------------------------------------------------------
Titulo 'Liberando a porta no firewall do Windows'

$regra = "Sistema de Qualidade (SQE) - porta $Porta"
if (Get-NetFirewallRule -DisplayName $regra -ErrorAction SilentlyContinue) {
  Ok 'Regra de firewall ja existia.'
} else {
  New-NetFirewallRule -DisplayName $regra -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Porta -Profile Any | Out-Null
  Ok "Porta $Porta liberada para a rede da fabrica."
}

# ------------------------------------------------------------
# 5. Pastas de apoio no disco C:
# ------------------------------------------------------------
Titulo 'Criando as pastas de apoio'

foreach ($pasta in @('C:\QualidadeSQE', 'C:\QualidadeSQE\backups', 'C:\QualidadeSQE\logs')) {
  if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Path $pasta | Out-Null }
}
Ok 'C:\QualidadeSQE\backups  (copias de seguranca - inclua no backup corporativo)'
Ok 'C:\QualidadeSQE\logs     (registro de cada inicializacao do sistema)'

# ------------------------------------------------------------
# Fim
# ------------------------------------------------------------
$ipServidor = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1).IPAddress

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  PASSO 1 CONCLUIDO' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host "  IP deste servidor: $ipServidor"
Write-Host "  O sistema vai atender em: http://$ipServidor`:$Porta"
Write-Host ''
Write-Host '  PROXIMO PASSO (passo 2) - instalar o sistema dentro do Linux:' -ForegroundColor Cyan
Write-Host "     wsl -d $Distro -u root"
Write-Host '     curl -fsSL -H "Authorization: token SEU_TOKEN" -o /tmp/instalar.sh \'
Write-Host '       https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/2-instalar.sh'
Write-Host '     bash /tmp/instalar.sh'
Write-Host ''
Write-Host '  (o mesmo token de leitura usado para baixar este script)'
Write-Host ''
