# =====================================================================
#  Monta a Build A (pacote portatil, sem instalacao) do Sistema SQE.
#  Roda no PC de desenvolvimento (Windows). Baixa Node + PostgreSQL
#  portateis, compila backend e frontend e monta a pasta pronta para
#  entregar ao TI.
#
#  Uso:  botao direito em montar-build-a.bat > Executar
#        (ou:  powershell -ExecutionPolicy Bypass -File montar-build-a.ps1)
# =====================================================================
$ErrorActionPreference = 'Stop'

# ---- Versoes dos binarios portateis ----
$NodeVersion = '20.18.1'
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
$PgUrl   = 'https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip'

# ---- Pastas ----
$Deploy = $PSScriptRoot
$Raiz   = Split-Path $Deploy -Parent
$Backend  = Join-Path $Raiz 'backend'
$Frontend = Join-Path $Raiz 'frontend'
$Runtime  = Join-Path $Deploy 'runtime'
$Cache  = Join-Path $Deploy '_cache'
$Kit    = Join-Path $Deploy 'Qualidade-SQE'

function Passo($txt) { Write-Host "`n==> $txt" -ForegroundColor Cyan }

New-Item -ItemType Directory -Force -Path $Cache | Out-Null

# ---------------------------------------------------------------------
Passo 'Limpando pasta do kit anterior (mantendo dados/backups se existirem)...'
foreach ($sub in @('node','pgsql','app')) {
    $p = Join-Path $Kit $sub
    if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}
New-Item -ItemType Directory -Force -Path $Kit | Out-Null

# ---------------------------------------------------------------------
Passo 'Baixando Node.js portatil...'
$NodeZip = Join-Path $Cache "node-v$NodeVersion-win-x64.zip"
if (-not (Test-Path $NodeZip)) { Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip }
$tmpNode = Join-Path $Cache 'node-tmp'
if (Test-Path $tmpNode) { Remove-Item $tmpNode -Recurse -Force }
Expand-Archive -Path $NodeZip -DestinationPath $tmpNode -Force
$inner = Get-ChildItem $tmpNode -Directory | Select-Object -First 1
# Move a pasta interna inteira, renomeando para "node" (destino nao existe ainda)
Move-Item -Path $inner.FullName -Destination (Join-Path $Kit 'node')
$NodeExe = Join-Path $Kit 'node\node.exe'
$NpmCmd  = Join-Path $Kit 'node\npm.cmd'
$env:PATH = (Join-Path $Kit 'node') + ';' + $env:PATH

# ---------------------------------------------------------------------
Passo 'Baixando PostgreSQL portatil (pode demorar, ~300 MB)...'
$PgZip = Join-Path $Cache 'postgresql-binaries.zip'
if (-not (Test-Path $PgZip)) { Invoke-WebRequest -Uri $PgUrl -OutFile $PgZip }
$tmpPg = Join-Path $Cache 'pg-tmp'
if (Test-Path $tmpPg) { Remove-Item $tmpPg -Recurse -Force }
Expand-Archive -Path $PgZip -DestinationPath $tmpPg -Force
# O zip contem uma pasta "pgsql"
Move-Item -Path (Join-Path $tmpPg 'pgsql') -Destination (Join-Path $Kit 'pgsql') -Force

# ---------------------------------------------------------------------
Passo 'Copiando e compilando o BACKEND...'
$AppDir = Join-Path $Kit 'app'
robocopy $Backend $AppDir /E /XD node_modules dist .git /XF *.log /NFL /NDL /NJH /NJS /NP | Out-Null
Push-Location $AppDir
& $NpmCmd install
& $NodeExe (Join-Path $AppDir 'node_modules\prisma\build\index.js') generate
& $NpmCmd run build
Pop-Location

# ---------------------------------------------------------------------
Passo 'Compilando o FRONTEND...'
$FeBuild = Join-Path $Cache 'fe-build'
if (Test-Path $FeBuild) { Remove-Item $FeBuild -Recurse -Force }
robocopy $Frontend $FeBuild /E /XD node_modules dist .git /NFL /NDL /NJH /NJS /NP | Out-Null
Push-Location $FeBuild
& $NpmCmd install
& $NpmCmd run build
Pop-Location
$Public = Join-Path $AppDir 'public'
New-Item -ItemType Directory -Force -Path $Public | Out-Null
Copy-Item -Path (Join-Path $FeBuild 'dist\*') -Destination $Public -Recurse -Force

# ---------------------------------------------------------------------
Passo 'Copiando os scripts de runtime e criando as pastas...'
Copy-Item -Path (Join-Path $Runtime '*') -Destination $Kit -Recurse -Force
foreach ($sub in @('dados','uploads','backups','logs','config')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Kit $sub) | Out-Null
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  Build A montada com sucesso em:" -ForegroundColor Green
Write-Host "  $Kit"
Write-Host "  Entregue essa pasta ao TI (ou zipe-a antes)." -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green
