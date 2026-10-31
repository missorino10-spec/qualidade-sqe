# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  PASSO 3 de 3  -  INICIO AUTOMATICO
#
#  O que este script cria:
#    QualidadeSQE  -> ao ligar a maquina, sobe o sistema (como SYSTEM)
#    e deixa o servico do PostgreSQL em "Automatico"
#
#  COMO USAR (PowerShell "Executar como administrador"):
#     powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\app\deploy-servidor\3-ativar-inicio-automatico.ps1
#
#  CONTA: a tarefa roda como SYSTEM, nao como uma pessoa. Isso e de
#  proposito e resolve tres problemas de uma vez:
#    - o sistema sobe sem ninguem fazer login na maquina;
#    - nao para no dia em que a senha de um funcionario vencer;
#    - nao depende de a pessoa continuar na empresa.
#  Em troca, o SYSTEM precisa poder escrever na pasta de anexos - o passo 1
#  cuida disso, e este script confere.
#
#  Pode ser executado varias vezes (-Force refaz a tarefa).
# ============================================================

param(
  [string]$Base = 'C:\QualidadeSQE',
  [int]$Porta = 8080
)

$ErrorActionPreference = 'Continue'

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

$backend = Join-Path $Base 'app\backend'
$destino = Join-Path $Base 'iniciar-sqe.ps1'

Titulo 'Ativando o inicio automatico do Sistema de Qualidade (SQE)'
Write-Host "  Tarefa : QualidadeSQE (conta SYSTEM)"
Write-Host "  Porta  : $Porta"

# ------------------------------------------------------------
# 0. O passo 2 foi feito?
# ------------------------------------------------------------
foreach ($arq in @("$backend\dist\src\main.js", "$backend\public\index.html", "$backend\.env")) {
  if (-not (Test-Path $arq)) {
    Erro "Nao achei $arq"
    Erro 'Rode o passo 2 antes deste.'
    exit 1
  }
}
Ok 'Sistema compilado e configurado.'

# ------------------------------------------------------------
# 1. O banco tem de subir ANTES do sistema
#
#    Em "Automatico" o servico do banco sobe no boot. O sistema tenta
#    conectar logo em seguida; se o banco ainda estiver subindo, a tarefa
#    religa o sistema (RestartCount abaixo) e na segunda tentativa funciona.
# ------------------------------------------------------------
Titulo 'Deixando o banco em Automatico'
$pg = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
if (-not $pg) { Erro 'Servico postgresql-x64-17 nao encontrado. Rode o passo 1.'; exit 1 }

Set-Service -Name postgresql-x64-17 -StartupType Automatic
if ($pg.Status -ne 'Running') { Start-Service $pg.Name; Start-Sleep -Seconds 5 }
$pg = Get-Service postgresql-x64-17
Ok "$($pg.Name): $($pg.Status) / $($pg.StartType)"

# ------------------------------------------------------------
# 2. O script de inicializacao em lugar fixo
#
#    A tarefa aponta para C:\QualidadeSQE e nao para a pasta do codigo:
#    atualizar o codigo (git pull) nao deve mexer no que sobe o sistema.
# ------------------------------------------------------------
Titulo 'Instalando o script de inicializacao'
$origem = Join-Path $PSScriptRoot 'iniciar-sqe.ps1'
if (-not (Test-Path $origem)) { Erro "Nao achei $origem"; exit 1 }

if ((Resolve-Path $origem).Path -ne (Resolve-Path -Path $destino -ErrorAction SilentlyContinue).Path) {
  Copy-Item $origem $destino -Force
}
Ok $destino

# Conferir que o SYSTEM escreve nos anexos. Sem isto o sistema sobe, as
# pessoas trabalham, e o erro aparece semanas depois na primeira foto de
# defeito que alguem tentar anexar.
$temSystem = (Get-Acl "$Base\uploads").Access |
  Where-Object { $_.IdentityReference -match 'SISTEMA|SYSTEM' -and $_.FileSystemRights -match 'FullControl|Write|Modify' }
if ($temSystem) {
  Ok 'SYSTEM pode escrever em uploads.'
} else {
  Aviso 'SYSTEM nao aparece com permissao de escrita em uploads. Corrigindo ...'
  icacls "$Base\uploads" /grant '*S-1-5-18:(OI)(CI)F' 2>&1 | Out-Null
  Ok 'Permissao concedida.'
}

# ------------------------------------------------------------
# 3. Derrubar o que estiver no ar
#
#    Duas instancias na mesma porta: a segunda morre com "address already in
#    use" e a tarefa pareceria quebrada sem estar. So e encerrado o processo
#    desta instalacao - outro Node da maquina nao e tocado.
# ------------------------------------------------------------
Titulo 'Derrubando instancia anterior, se houver'
$mortos = 0
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.CommandLine -like "*$backend\dist\src\main.js*") {
    Write-Host "  encerrando PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    $mortos++
  }
}
if ($mortos -eq 0) { Ok 'Nada rodando.' } else { Start-Sleep -Seconds 3 }

# ------------------------------------------------------------
# 4. A tarefa agendada
# ------------------------------------------------------------
Titulo 'Registrando a tarefa QualidadeSQE'

$acao = New-ScheduledTaskAction `
  -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$destino`""

$gatilho = New-ScheduledTaskTrigger -AtStartup

# RestartCount/RestartInterval: se o Node morrer, tenta de novo 3 vezes, de
#   minuto em minuto. Cobre o caso do banco ainda estar subindo no boot.
# ExecutionTimeLimit Zero: sem limite de tempo. O padrao do Windows e matar
#   a tarefa depois de 3 dias - o sistema cairia sozinho no terceiro dia.
# StartWhenAvailable: se a maquina estava desligada na hora do gatilho,
#   roda assim que ligar.
# MultipleInstances IgnoreNew: nunca duas instancias na mesma porta.
$opcoes = New-ScheduledTaskSettingsSet `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName 'QualidadeSQE' `
  -Description 'Inicia a aplicacao de Qualidade ao ligar o servidor' `
  -Action $acao -Trigger $gatilho -Settings $opcoes `
  -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
Ok 'Tarefa registrada.'

# ------------------------------------------------------------
# 5. Subir agora e PROVAR que respondeu
#
#    Registrar a tarefa nao prova nada. A prova e a tela abrindo.
# ------------------------------------------------------------
Titulo 'Subindo o sistema'
Start-ScheduledTask -TaskName 'QualidadeSQE'

$escutando = $false
foreach ($i in 1..60) {
  Start-Sleep -Seconds 1
  if (Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue) {
    $escutando = $true
    Ok "porta $Porta escutando apos $i s"
    break
  }
}

if (-not $escutando) {
  Erro "A porta $Porta nao abriu em 60 segundos."
  Write-Host ''
  Write-Host '  Ultimas linhas do log:' -ForegroundColor Yellow
  Get-Content "$Base\logs\backend.log" -Tail 25 -ErrorAction SilentlyContinue
  exit 1
}

$respondeu = $false
foreach ($i in 1..12) {
  try {
    $r = Invoke-WebRequest "http://localhost:$Porta/" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $respondeu = $true; break }
  } catch { Start-Sleep -Seconds 5 }
}

if ($respondeu) {
  Ok 'A tela respondeu HTTP 200.'
} else {
  Erro 'A porta abriu mas a tela nao respondeu.'
  Get-Content "$Base\logs\backend.log" -Tail 25 -ErrorAction SilentlyContinue
  exit 1
}

$t = Get-ScheduledTask -TaskName 'QualidadeSQE'
Ok "Tarefa QualidadeSQE: $($t.State)   (Running = sistema no ar)"

# ------------------------------------------------------------
# 6. A senha do primeiro acesso
#
#    E a unica coisa desta instalacao que nao se descobre olhando a maquina.
#    Por isso ela e escrita em arquivo separado, curto, facil de achar.
# ------------------------------------------------------------
Titulo 'Senha do primeiro acesso'

$acesso = Join-Path $Base 'PRIMEIRO-ACESSO.txt'
$valores = @{}
Get-Content "$backend\.env" | ForEach-Object {
  if ($_ -match '^(SEED_ADMIN_EMAIL|SEED_ADMIN_PASSWORD)=(.*)$') { $valores[$matches[1]] = $matches[2] }
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1).IPAddress

$conteudo = @"
============================================================
 SISTEMA DE QUALIDADE (SQE) - PRIMEIRO ACESSO
 Maquina $env:COMPUTERNAME, $(Get-Date -Format 'dd/MM/yyyy HH:mm')
============================================================

 Endereco : http://$ip`:$Porta
            http://$env:COMPUTERNAME`:$Porta

 Usuario  : $($valores['SEED_ADMIN_EMAIL'])
 Senha    : $($valores['SEED_ADMIN_PASSWORD'])

 Troque a senha no primeiro acesso.
 APAGUE ESTE ARQUIVO depois de guardar a senha no cofre do TI.

 Se este arquivo for perdido, a senha ainda esta em:
   $backend\.env            (linha SEED_ADMIN_PASSWORD)
   $Base\CREDENCIAIS.txt    (linha ADMINPW)
============================================================
"@

[System.IO.File]::WriteAllText($acesso, $conteudo, (New-Object System.Text.UTF8Encoding($false)))
icacls $acesso /inheritance:r /grant:r "$($env:USERNAME):(R,W)" `
  '*S-1-5-18:(R)' '*S-1-5-32-544:(R)' 2>&1 | Out-Null
Ok $acesso

# ------------------------------------------------------------
# Fim
# ------------------------------------------------------------
Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  INSTALACAO CONCLUIDA - O SISTEMA ESTA NO AR' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host "  Abra na fabrica: http://$ip`:$Porta" -ForegroundColor Cyan
Write-Host ''
Write-Host "  Usuario e senha: $acesso" -ForegroundColor Cyan
Write-Host '  Apague esse arquivo depois de guardar a senha no cofre do TI.'
Write-Host ''
Write-Host '  Daqui para frente o sistema sobe sozinho quando a maquina ligar.'
Write-Host ''
Write-Host '  Para conferir a qualquer momento:' -ForegroundColor Cyan
Write-Host '     Get-ScheduledTask -TaskName QualidadeSQE | Select-Object TaskName, State'
Write-Host "     Get-Content $Base\logs\backend.log -Tail 30"
Write-Host ''
