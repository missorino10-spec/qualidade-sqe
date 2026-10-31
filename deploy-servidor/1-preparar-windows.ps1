# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  PASSO 1 de 3  -  PREPARAR O WINDOWS
#
#  Instalacao NATIVA no Windows: sem Ubuntu, sem WSL e sem Docker.
#  O sistema roda como um processo do Node servindo uma porta, e o banco e
#  o servico do PostgreSQL do proprio Windows. Foi assim que o servidor da
#  fabrica subiu, e e isso que estes tres scripts reproduzem.
#
#  O que este script faz:
#    1. Confere a maquina e se ja existe instalacao anterior
#    2. Instala o Node.js (versao fixa, conferida por SHA256)
#    3. Instala o PostgreSQL 17 (servico postgresql-x64-17)
#    4. Cria as pastas em C:\QualidadeSQE
#    5. Gera as senhas desta maquina (uma vez, e nunca mais)
#    6. Abre a porta do sistema no firewall
#
#  COMO USAR (PowerShell "Executar como administrador"):
#     mkdir C:\QualidadeSQE -Force; cd C:\QualidadeSQE
#     curl.exe -fsSL -o 1-preparar-windows.ps1 `
#       https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/1-preparar-windows.ps1
#     powershell -ExecutionPolicy Bypass -File .\1-preparar-windows.ps1
#
#  Pode ser executado varias vezes: ele confere antes de instalar e NUNCA
#  regera as senhas de uma instalacao que ja existe.
# ============================================================

param(
  [string]$VersaoNode = '24.21.0',
  [int]$Porta = 8080,
  [string]$Base = 'C:\QualidadeSQE'
)

# 'Continue' de proposito: curl, msiexec e winget escrevem mensagem normal no
# stderr e, com 'Stop', o PowerShell trata isso como falha e aborta no meio.
# Aqui se confere $LASTEXITCODE e o resultado de cada passo.
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

Titulo 'Preparando o Windows para o Sistema de Qualidade (SQE)'
$so = Get-CimInstance Win32_OperatingSystem
Write-Host "  Sistema : $($so.Caption) build $($so.BuildNumber)"
Write-Host "  Conta   : $env:USERDOMAIN\$env:USERNAME"
Write-Host "  Pasta   : $Base"
Write-Host "  Porta   : $Porta"

# ------------------------------------------------------------
# 1. Ja existe instalacao nesta maquina?
#
#    Conferir ANTES de mexer em qualquer coisa. Se alguem rodar este script
#    por engano num servidor que ja atende a fabrica, ele precisa descobrir
#    isso aqui - e nao depois de ter instalado algo por cima.
# ------------------------------------------------------------
Titulo 'Conferindo o que ja existe'

$achados = @()
if (Test-Path "$Base\app")                 { $achados += "codigo em $Base\app" }
if (Test-Path "$Base\app\backend\.env")    { $achados += "configuracao em $Base\app\backend\.env" }
if (Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue) { $achados += 'servico postgresql-x64-17' }
if (Get-ScheduledTask -TaskName 'QualidadeSQE' -ErrorAction SilentlyContinue) { $achados += 'tarefa agendada QualidadeSQE' }

if ($achados) {
  Aviso 'Esta maquina JA tem parte do sistema instalada:'
  foreach ($a in $achados) { Write-Host "      - $a" }
  Aviso 'Nada sera apagado. O script apenas completa o que falta.'
} else {
  Ok 'Maquina limpa - instalacao nova.'
}

# ------------------------------------------------------------
# 2. Node.js
#
#    Versao FIXA, e nao "a mais nova": o Prisma 5.22 esta homologado nesta
#    e trocar o Node por conta propria e trocar a base do sistema. O
#    instalador oficial em .msi e usado de proposito, porque os gerenciadores
#    de pacote entregam a versao que quiserem.
# ------------------------------------------------------------
Titulo "Instalando o Node.js $VersaoNode"

$nodeExe = 'C:\Program Files\nodejs\node.exe'

# O instalador poe a pasta no PATH da MAQUINA, mas um terminal que ja estava
# aberto continua com o PATH antigo. Sem esta linha, o "npm ci" do passo 2
# falha com "node nao e reconhecido" - o erro mais confuso desta instalacao.
if ($env:Path -notlike '*nodejs*') { $env:Path = 'C:\Program Files\nodejs;' + $env:Path }

$versaoAtual = ''
if (Test-Path $nodeExe) { $versaoAtual = (& $nodeExe -v) -replace '^v', '' }

if ($versaoAtual -eq $VersaoNode) {
  Ok "Node $VersaoNode ja instalado."
} else {
  if ($versaoAtual) { Aviso "Esta instalado o Node $versaoAtual; instalando o $VersaoNode por cima." }

  $msi = Join-Path $env:TEMP "node-v$VersaoNode-x64.msi"
  $urlMsi  = "https://nodejs.org/dist/v$VersaoNode/node-v$VersaoNode-x64.msi"
  $urlHash = "https://nodejs.org/dist/v$VersaoNode/SHASUMS256.txt"

  Write-Host "  Baixando $urlMsi ..."
  # TLS 1.2 explicito: Windows Server mais antigo ainda negocia TLS 1.0 por
  # padrao e o nodejs.org recusa a conexao.
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  try {
    Invoke-WebRequest $urlMsi -OutFile $msi -UseBasicParsing -TimeoutSec 600
  } catch {
    Erro "Nao foi possivel baixar o Node: $($_.Exception.Message)"
    Write-Host '  Servidor sem internet? Baixe o .msi em outra maquina, copie para' -ForegroundColor Yellow
    Write-Host "  $msi e rode este script de novo." -ForegroundColor Yellow
    exit 1
  }

  # Confere a impressao digital do arquivo contra a lista oficial. Instalar
  # um .msi baixado sem conferir e aceitar qualquer coisa que tenha chegado
  # pela rede.
  Write-Host '  Conferindo a assinatura SHA256 ...'
  $esperado = ((Invoke-WebRequest $urlHash -UseBasicParsing -TimeoutSec 120).Content -split "`n" |
               Where-Object { $_ -match "node-v$([regex]::Escape($VersaoNode))-x64\.msi" }) -split '\s+' |
               Select-Object -First 1
  $obtido = (Get-FileHash $msi -Algorithm SHA256).Hash

  if (-not $esperado) {
    Erro "A versao $VersaoNode nao aparece na lista oficial de assinaturas."
    exit 1
  }
  if ($obtido -ne $esperado.ToUpper()) {
    Erro 'A assinatura do arquivo NAO confere. O download sera descartado.'
    Write-Host "  esperado: $($esperado.ToUpper())"
    Write-Host "  obtido  : $obtido"
    Remove-Item $msi -Force -ErrorAction SilentlyContinue
    exit 1
  }
  Ok 'Assinatura confere.'

  Write-Host '  Instalando (silencioso) ...'
  $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
  if ($p.ExitCode -ne 0) { Erro "msiexec devolveu $($p.ExitCode)"; exit 1 }
  Remove-Item $msi -Force -ErrorAction SilentlyContinue

  if (-not (Test-Path $nodeExe)) { Erro 'O Node nao apareceu em C:\Program Files\nodejs.'; exit 1 }
  Ok "Node $(& $nodeExe -v) / npm $(& 'C:\Program Files\nodejs\npm.cmd' -v)"
}

# ------------------------------------------------------------
# 3. Git
# ------------------------------------------------------------
Titulo 'Conferindo o Git'
if (Get-Command git -ErrorAction SilentlyContinue) {
  Ok "$((git --version))"
} else {
  Aviso 'Git nao encontrado. Instalando pelo winget ...'
  & winget install --id Git.Git --exact --silent --accept-source-agreements --accept-package-agreements
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Erro 'Instale o Git manualmente: https://git-scm.com/download/win'
    exit 1
  }
  Ok 'Git instalado.'
}

# ------------------------------------------------------------
# 4. Pastas
# ------------------------------------------------------------
Titulo 'Criando as pastas'
foreach ($p in @($Base, "$Base\uploads", "$Base\logs", "$Base\backups")) {
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}
Ok "$Base\uploads   (anexos: foto de defeito, certificado, laudo)"
Ok "$Base\logs      (saida do sistema)"
Ok "$Base\backups   (copias de seguranca - inclua no backup corporativo)"

# O sistema roda como SYSTEM (ver passo 3). Se o SYSTEM nao escrever em
# uploads, todo anexo falha no momento de salvar - e o erro aparece so quando
# alguem tenta anexar uma foto, semanas depois.
icacls "$Base\uploads" /grant '*S-1-5-18:(OI)(CI)F' 2>&1 | Out-Null
Ok 'SYSTEM pode escrever em uploads.'

# ------------------------------------------------------------
# 5. Senhas desta maquina
#
#    Geradas AQUI, uma unica vez, e guardadas em um arquivo so. As senhas de
#    um servidor nao valem para outro e nao vao para o GitHub.
#
#    Somente letras e numeros: a senha do banco entra dentro da DATABASE_URL,
#    que e uma URL. Um "@" ou "/" na senha quebraria a URL em pedacos e a
#    conexao falharia com um erro que nao aponta para a causa.
# ------------------------------------------------------------
Titulo 'Gerando as senhas desta maquina'

$arqCred = "$Base\CREDENCIAIS.txt"

if (Test-Path $arqCred) {
  Aviso "$arqCred ja existe - MANTIDO como esta."
  Aviso 'Regerar as senhas agora deixaria o sistema sem acesso ao proprio banco.'
} else {
  function Senha([int]$tamanho) {
    $alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    $bytes = [byte[]]::new($tamanho * 4)
    # Gerador criptografico, nao Get-Random: Get-Random e previsivel e isto
    # aqui e a senha do banco de dados da Qualidade.
    ([System.Security.Cryptography.RandomNumberGenerator]::Create()).GetBytes($bytes)
    -join (0..($tamanho - 1) | ForEach-Object {
      $n = [BitConverter]::ToUInt32($bytes, $_ * 4)
      $alfabeto[$n % $alfabeto.Length]
    })
  }

  $texto = @"
============================================================
 SISTEMA DE QUALIDADE (SQE) - SENHAS DESTA MAQUINA
 Geradas em $(Get-Date -Format 'dd/MM/yyyy HH:mm') por $env:USERDOMAIN\$env:USERNAME
 Maquina: $env:COMPUTERNAME
============================================================

 GUARDE ESTE CONTEUDO NO COFRE DE SENHAS DO TI.

 Estas senhas valem SO para esta maquina. Nao estao no GitHub e nao
 podem ser recuperadas se este arquivo for perdido: sem elas nao da
 para fazer manutencao no banco nem restaurar um backup.

 1) PostgreSQL - administrador do banco (usuario "postgres")
    Usado so para manutencao e para criar o banco do sistema.
    PGSUPER=$(Senha 24)

 2) PostgreSQL - usuario do sistema (usuario "qualidade")
    E esta que entra na DATABASE_URL do backend\.env.
    PGAPP=$(Senha 24)

 3) Primeiro acesso ao sistema (administrador da Qualidade)
    ADMINPW=$(Senha 20)

 4) Chave que assina o login (JWT_SECRET)
    Trocar esta chave desloga todo mundo na hora.
    JWT=$(Senha 64)

============================================================
"@

  # UTF8 SEM BOM. O passo 2 le este arquivo linha por linha; com BOM a
  # primeira chave viraria "\ufeffPGSUPER" e nao seria encontrada.
  [System.IO.File]::WriteAllText($arqCred, $texto, (New-Object System.Text.UTF8Encoding($false)))

  # Fecha o arquivo: so SYSTEM, Administradores e quem instalou.
  # Os SIDs sao usados no lugar dos nomes porque "Administrators" nao existe
  # no Windows em portugues - com o nome, o icacls falha e o arquivo fica
  # legivel por "Usuarios autenticados", ou seja, por qualquer um.
  icacls $arqCred /inheritance:r /grant:r "$($env:USERNAME):(R,W)" `
    '*S-1-5-18:(R)' '*S-1-5-32-544:(R)' 2>&1 | Out-Null

  Ok "$arqCred criado e protegido."
}

# ------------------------------------------------------------
# 6. PostgreSQL 17
# ------------------------------------------------------------
Titulo 'Instalando o PostgreSQL 17'

$servico = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue

if ($servico) {
  Ok "Servico $($servico.Name) ja existe ($($servico.Status))."
} else {
  # Le a senha do superusuario do arquivo que acabou de ser gerado.
  $cred = @{}
  Get-Content $arqCred -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*([A-Z]+)=(.+)$') { $cred[$matches[1]] = $matches[2].Trim() }
  }
  if (-not $cred['PGSUPER']) { Erro "PGSUPER nao encontrado em $arqCred"; exit 1 }

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Erro 'winget nao esta disponivel nesta maquina.'
    Write-Host '  Instale o PostgreSQL 17 manualmente:' -ForegroundColor Yellow
    Write-Host '    https://www.enterprisedb.com/downloads/postgres-postgresql-downloads' -ForegroundColor Yellow
    Write-Host '    - porta 5432, local 127.0.0.1' -ForegroundColor Yellow
    Write-Host "    - senha do usuario postgres: a linha PGSUPER de $arqCred" -ForegroundColor Yellow
    Write-Host '  Depois rode este script de novo.' -ForegroundColor Yellow
    exit 1
  }

  # A senha vai em ARQUIVO, nunca na linha de comando: linha de comando fica
  # visivel para qualquer processo da maquina e cai no historico do console.
  $optFile = Join-Path $env:TEMP "sqe-pg-$([guid]::NewGuid().ToString('N')).opt"
  try {
    Set-Content $optFile "--superpassword=`"$($cred['PGSUPER'])`" --serverport=5432 --enable_acledit=1" -Encoding ASCII
    Write-Host '  Instalando (pode demorar alguns minutos) ...'
    & winget install --id PostgreSQL.PostgreSQL.17 --exact --silent `
        --accept-source-agreements --accept-package-agreements `
        --custom "--optionfile `"$optFile`""
  } finally {
    # Apaga a senha do disco mesmo se a instalacao falhar no meio.
    Remove-Item $optFile -Force -ErrorAction SilentlyContinue
  }

  $servico = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
  if (-not $servico) { Erro 'O servico postgresql-x64-17 nao apareceu.'; exit 1 }
  Ok 'PostgreSQL 17 instalado.'
}

if ($servico.Status -ne 'Running') { Start-Service $servico.Name; Start-Sleep -Seconds 5 }
Set-Service -Name postgresql-x64-17 -StartupType Automatic
$servico = Get-Service postgresql-x64-17
Ok "$($servico.Name): $($servico.Status) / $($servico.StartType)"

if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) {
  Ok 'Banco escutando na porta 5432.'
} else {
  Aviso 'A porta 5432 nao esta escutando. Confira o servico antes do passo 2.'
}

# ------------------------------------------------------------
# 7. Firewall
#
#    Somente a porta do sistema. A 5432 NAO e aberta de proposito: o banco
#    so e acessado pelo proprio servidor (127.0.0.1) e abrir o banco para a
#    rede da fabrica seria expor todo o historico da Qualidade.
# ------------------------------------------------------------
Titulo 'Liberando a porta no firewall do Windows'
$regra = "Sistema de Qualidade (SQE) - porta $Porta"
if (Get-NetFirewallRule -DisplayName $regra -ErrorAction SilentlyContinue) {
  Ok 'Regra ja existia.'
} else {
  New-NetFirewallRule -DisplayName $regra -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Porta -Profile Any | Out-Null
  Ok "Porta $Porta liberada para a rede da fabrica."
}

# ------------------------------------------------------------
# Fim
# ------------------------------------------------------------
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1).IPAddress

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  PASSO 1 CONCLUIDO' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host "  Maquina : $env:COMPUTERNAME  ($ip)"
Write-Host "  Endereco futuro do sistema: http://$ip`:$Porta"
Write-Host "  Senhas  : $arqCred  (guarde no cofre do TI)"
Write-Host ''
Write-Host '  PROXIMO PASSO (passo 2) - baixar e preparar o sistema:' -ForegroundColor Cyan
Write-Host '     curl.exe -fsSL -o C:\QualidadeSQE\2-instalar.ps1 `'
Write-Host '       https://raw.githubusercontent.com/missorino10-spec/qualidade-sqe/main/deploy-servidor/2-instalar.ps1'
Write-Host '     powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\2-instalar.ps1'
Write-Host ''
