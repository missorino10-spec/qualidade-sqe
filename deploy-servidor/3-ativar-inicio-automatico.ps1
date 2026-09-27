# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  PASSO 3 de 3  -  INICIO AUTOMATICO E BACKUP AUTOMATICO
#
#  O que este script cria:
#    QualidadeSQE-Iniciar  -> ao ligar o servidor, sobe o sistema
#    QualidadeSQE-Vigia    -> de 10 em 10 minutos, confere e religa se caiu
#    QualidadeSQE-Backup   -> todo dia as 20:00, copia banco + anexos
#
#  COMO USAR (PowerShell "Executar como administrador"):
#     cd <pasta-do-projeto>\deploy-servidor
#     powershell -ExecutionPolicy Bypass -File .\3-ativar-inicio-automatico.ps1
#
#  CONTA: as tarefas rodam com a MESMA conta que instalou o WSL no passo 1.
#  O WSL registra a distribuicao por usuario - com outra conta a tarefa
#  simplesmente nao enxerga o Linux. Essa conta precisa de senha que NAO
#  expira, senao o sistema para de subir no dia em que a senha vencer.
# ============================================================

param(
  [string]$Distro = 'Ubuntu-22.04',
  [int]$Porta = 8080,
  [string]$Pasta = '/opt/qualidade-sqe',
  [string]$Conta = "$env:USERDOMAIN\$env:USERNAME",
  [string]$HoraBackup = '20:00'
)

$ErrorActionPreference = 'Stop'

function Titulo($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
function Aviso($t)  { Write-Host "  [!] $t" -ForegroundColor Yellow }
function Erro($t)   { Write-Host "  [ERRO] $t" -ForegroundColor Red }

$souAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $souAdmin) {
  Erro 'Abra o PowerShell com "Executar como administrador" e rode de novo.'
  exit 1
}

Titulo 'Ativando o inicio automatico do Sistema de Qualidade (SQE)'
Write-Host "  Conta das tarefas : $Conta"
Write-Host "  Distribuicao      : $Distro"
Write-Host "  Porta             : $Porta"

# ------------------------------------------------------------
# 1. Copiar os scripts para um lugar fixo
#    As tarefas apontam para C:\QualidadeSQE e nao para a pasta de origem:
#    assim mover ou apagar a pasta do projeto no Windows nao derruba o
#    sistema (o sistema mesmo mora dentro do Linux).
# ------------------------------------------------------------
Titulo 'Instalando os scripts em C:\QualidadeSQE'

$destino = 'C:\QualidadeSQE'
foreach ($p in @($destino, "$destino\backups", "$destino\logs")) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}

# Desde que o codigo passou a vir do GitHub, o passo 2 ja deixa estes scripts
# em C:\QualidadeSQE - e e de la que o TI roda este arquivo. Nesse caso origem
# e destino sao a mesma pasta, e copiar um arquivo sobre ele mesmo e erro no
# Windows. So copia quando veio de outro lugar.
$origem = $PSScriptRoot
if ((Resolve-Path $origem).Path -ne (Resolve-Path $destino).Path) {
  Copy-Item "$origem\iniciar.ps1" "$destino\iniciar.ps1" -Force
  Ok "$destino\iniciar.ps1"
} else {
  Ok "$destino\iniciar.ps1 (ja estava no lugar)"
}

$scriptIniciar = "$destino\iniciar.ps1"

# ------------------------------------------------------------
# 2. Senha da conta de servico
# ------------------------------------------------------------
Titulo 'Senha da conta de servico'
Write-Host '  A tarefa precisa rodar "estando o usuario conectado ou nao", e para'
Write-Host '  isso o Windows exige a senha da conta guardada no cofre dele.'
Write-Host "  Digite a senha de $Conta (ela nao aparece na tela):"
$senhaSegura = Read-Host -AsSecureString
$senha = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($senhaSegura)
)

if ([string]::IsNullOrWhiteSpace($senha)) {
  Erro 'Senha vazia. O Windows nao aceita tarefa sem sessao com senha em branco.'
  exit 1
}

# ------------------------------------------------------------
# 3. Criar as tarefas
# ------------------------------------------------------------
Titulo 'Criando as tarefas agendadas'

$psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$args  = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptIniciar`" -Distro $Distro -Porta $Porta -Pasta $Pasta"
$cmdIniciar = "`"$psExe`" $args"

$cmdBackup = "`"$env:SystemRoot\System32\wsl.exe`" -d $Distro -u root -e bash -lc `"$Pasta/deploy-servidor/backup.sh`""

function CriarTarefa($nome, $agenda, $comando, $descricao) {
  schtasks /Query /TN $nome 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    schtasks /Delete /TN $nome /F | Out-Null
  }

  $saida = schtasks /Create /TN $nome /TR $comando /RU $Conta /RP $senha `
    /RL HIGHEST /F @agenda 2>&1

  if ($LASTEXITCODE -ne 0) {
    Erro "Falhou ao criar '$nome':"
    Write-Host "    $saida" -ForegroundColor Red
    return $false
  }
  Ok "$nome - $descricao"
  return $true
}

$tudoOk = $true
$tudoOk = (CriarTarefa 'QualidadeSQE-Iniciar' @('/SC','ONSTART','/DELAY','0001:00') `
  $cmdIniciar 'sobe o sistema quando o servidor liga') -and $tudoOk

$tudoOk = (CriarTarefa 'QualidadeSQE-Vigia' @('/SC','MINUTE','/MO','10') `
  $cmdIniciar 'confere de 10 em 10 minutos e religa se cair') -and $tudoOk

$tudoOk = (CriarTarefa 'QualidadeSQE-Backup' @('/SC','DAILY','/ST',$HoraBackup) `
  $cmdBackup "copia banco + anexos todo dia as $HoraBackup") -and $tudoOk

$senha = $null

if (-not $tudoOk) {
  Write-Host ''
  Aviso 'Alguma tarefa nao foi criada. Causa mais comum: a conta nao tem o'
  Aviso 'direito "Fazer logon como tarefa em lote".'
  Aviso 'Corrija em: secpol.msc > Politicas Locais > Atribuicao de direitos'
  Aviso '            de usuario > Fazer logon como tarefa em lote > adicionar a conta'
  exit 1
}

# ------------------------------------------------------------
# 4. Provar agora: rodar a tarefa de inicializacao
# ------------------------------------------------------------
Titulo 'Testando a tarefa de inicializacao agora'

schtasks /Run /TN 'QualidadeSQE-Iniciar' | Out-Null
Write-Host '  Aguardando o sistema responder...'

$ipServidor = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1).IPAddress

$respondeu = $false
foreach ($t in 1..24) {
  Start-Sleep -Seconds 5
  try {
    $r = Invoke-WebRequest -Uri "http://$ipServidor`:$Porta/" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $respondeu = $true; break }
  } catch { }
}

Write-Host ''
if ($respondeu) {
  Write-Host '============================================================' -ForegroundColor Green
  Write-Host '  INSTALACAO CONCLUIDA - O SISTEMA ESTA NO AR' -ForegroundColor Green
  Write-Host '============================================================' -ForegroundColor Green
  Write-Host ''
  Write-Host "  Endereco para a fabrica:  http://$ipServidor`:$Porta" -ForegroundColor Cyan
  Write-Host ''
  Write-Host '  Acesso principal (usuario e senha): veja o final do passo 2,'
  Write-Host "  ou dentro do Linux em $Pasta/PRIMEIRO-ACESSO.txt"
  Write-Host ''
  Write-Host '  O sistema volta sozinho se: o conteiner morrer, o Docker cair,'
  Write-Host '  o Linux desligar ou o servidor reiniciar.'
  Write-Host ''
  Write-Host "  Backups diarios em: $destino\backups"
  Write-Host "  Registro de inicializacao em: $destino\logs\inicio.log"
} else {
  Erro "O sistema nao respondeu em http://$ipServidor`:$Porta"
  Write-Host ''
  Write-Host '  Onde olhar:' -ForegroundColor Yellow
  Write-Host "   1. $destino\logs\inicio.log"
  Write-Host "   2. wsl -d $Distro -u root -e bash -lc 'cd $Pasta && docker compose ps'"
  Write-Host "   3. wsl -d $Distro -u root -e bash -lc 'cd $Pasta && docker compose logs --tail=80'"
  exit 1
}
Write-Host ''
