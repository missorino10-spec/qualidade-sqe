# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  BACKUP DO BANCO E DOS ANEXOS
#
#  Gera UM arquivo .zip por execucao, em C:\QualidadeSQE\backups, contendo:
#    banco.dump   - o banco inteiro (formato "custom" do PostgreSQL)
#    uploads\     - as fotos, certificados e laudos anexados
#
#  Os dois juntos de proposito: um banco sem os anexos deixa a RNC
#  apontando para foto que nao existe mais.
#
#  COMO USAR:
#     powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\app\deploy-servidor\backup.ps1
#
#  Para rodar todo dia as 20:00 (PowerShell como administrador):
#     $a = New-ScheduledTaskAction -Execute 'powershell.exe' `
#       -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\QualidadeSQE\app\deploy-servidor\backup.ps1"'
#     $g = New-ScheduledTaskTrigger -Daily -At 20:00
#     Register-ScheduledTask -TaskName 'QualidadeSQE-Backup' -Action $a -Trigger $g `
#       -User 'SYSTEM' -RunLevel Highest -Force
#
#  IMPORTANTE: a pasta de backups fica no MESMO disco do sistema. Isso nao
#  protege contra o disco falhar. Peca ao TI para incluir
#  C:\QualidadeSQE\backups no backup corporativo que sai da maquina.
# ============================================================

param(
  [string]$Base = 'C:\QualidadeSQE',
  [int]$RetencaoDias = 30
)

$ErrorActionPreference = 'Continue'

. (Join-Path $PSScriptRoot 'comum.ps1')

$backend = Join-Path $Base 'app\backend'
$destino = Join-Path $Base 'backups'
$log     = Join-Path $Base 'logs\backup.log'
$data    = Get-Date -Format 'yyyy-MM-dd_HHmm'
$arquivo = Join-Path $destino "qualidade_$data.zip"

if (-not (Test-Path $destino)) { New-Item -ItemType Directory -Path $destino -Force | Out-Null }

Registrar '--- Iniciando backup ---' $log

# Pasta temporaria propria. Se duas execucoes se cruzarem (backup diario e
# um backup manual), elas nao podem escrever no mesmo lugar.
$temp = Join-Path $env:TEMP "sqe-backup-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $temp -Force | Out-Null

try {
  # ----------------------------------------------------------
  # 1. De onde vem o banco
  #
  #    Lido do .env, nunca cravado: e o .env que sabe qual banco esta em uso
  #    nesta maquina.
  # ----------------------------------------------------------
  $env_ = Ler-Env (Join-Path $backend '.env')
  if (-not $env_['DATABASE_URL']) { throw 'DATABASE_URL nao encontrada no .env' }

  $b = Partes-Do-Banco $env_['DATABASE_URL']
  Registrar "Banco: $($b.Usuario)@$($b.Servidor):$($b.Porta)/$($b.Banco)" $log

  $pgdump = Achar-Ferramenta-Postgres 'pg_dump'

  # ----------------------------------------------------------
  # 2. O banco
  #
  #    Formato "custom" (-F c): comprime, e o pg_restore consegue restaurar
  #    parte dele se precisar. O .sql puro so serve de arquivo morto.
  # ----------------------------------------------------------
  Registrar 'Exportando o banco...' $log
  $dump = Join-Path $temp 'banco.dump'

  try {
    # Senha por variavel de ambiente do processo: na linha de comando ela
    # ficaria visivel para qualquer processo da maquina.
    $env:PGPASSWORD = $b.Senha
    & $pgdump -h $b.Servidor -p $b.Porta -U $b.Usuario -d $b.Banco -F c -f $dump 2>&1 |
      ForEach-Object { Registrar "  pg_dump: $_" $log }
    $codigo = $LASTEXITCODE
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }

  if ($codigo -ne 0 -or -not (Test-Path $dump)) {
    throw "pg_dump falhou (codigo $codigo). O banco esta no ar?"
  }
  if ((Get-Item $dump).Length -lt 1KB) {
    throw 'O arquivo do banco saiu vazio. NAO conte com este backup.'
  }
  Registrar "Banco exportado: $([math]::Round((Get-Item $dump).Length/1MB,2)) MB" $log

  # ----------------------------------------------------------
  # 3. Os anexos
  # ----------------------------------------------------------
  $uploads = $env_['UPLOAD_DIR']
  if (-not $uploads) { $uploads = Join-Path $Base 'uploads' }

  if (Test-Path $uploads) {
    $n = (Get-ChildItem $uploads -Recurse -File -ErrorAction SilentlyContinue).Count
    if ($n -gt 0) {
      Registrar "Copiando $n anexo(s)..." $log
      Copy-Item $uploads (Join-Path $temp 'uploads') -Recurse -Force
    } else {
      Registrar 'Nenhum anexo ainda.' $log
      New-Item -ItemType Directory -Path (Join-Path $temp 'uploads') -Force | Out-Null
    }
  } else {
    Registrar "AVISO: pasta de anexos nao encontrada ($uploads)" $log
    New-Item -ItemType Directory -Path (Join-Path $temp 'uploads') -Force | Out-Null
  }

  # ----------------------------------------------------------
  # 4. Compactar
  # ----------------------------------------------------------
  Registrar 'Compactando...' $log
  if (Test-Path $arquivo) { Remove-Item $arquivo -Force }
  Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $arquivo -CompressionLevel Optimal

  if (-not (Test-Path $arquivo)) { throw 'O arquivo de backup nao foi criado.' }
  $mb = [math]::Round((Get-Item $arquivo).Length / 1MB, 2)

  # ----------------------------------------------------------
  # 5. Conferir que o arquivo ABRE
  #
  #    Um backup que ninguem abriu nao e um backup. Esta conferencia e o que
  #    separa "existe um .zip" de "existe um backup".
  # ----------------------------------------------------------
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = $null
  try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($arquivo)
    $temBanco = $zip.Entries | Where-Object { $_.FullName -eq 'banco.dump' -and $_.Length -gt 1KB }
    $itens = $zip.Entries.Count
  } finally {
    if ($zip) { $zip.Dispose() }
  }

  if (-not $temBanco) { throw 'O arquivo gerado nao contem o banco. NAO conte com este backup.' }

  Registrar "Backup OK: $arquivo ($mb MB, $itens itens)" $log

  # ----------------------------------------------------------
  # 6. Apagar os antigos
  # ----------------------------------------------------------
  $velhos = Get-ChildItem $destino -Filter 'qualidade_*.zip' -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetencaoDias) }

  foreach ($v in $velhos) {
    Remove-Item $v.FullName -Force -ErrorAction SilentlyContinue
    Registrar "Apagado por idade (> $RetencaoDias dias): $($v.Name)" $log
  }

  $restam = (Get-ChildItem $destino -Filter 'qualidade_*.zip' -ErrorAction SilentlyContinue).Count
  Registrar "--- Backup concluido. $restam copia(s) em $destino ---" $log
}
catch {
  Registrar "ERRO: $($_.Exception.Message)" $log
  # Arquivo pela metade engana mais que arquivo nenhum: quem olhasse a pasta
  # veria um backup do dia que nao restaura.
  if (Test-Path $arquivo) {
    Remove-Item $arquivo -Force -ErrorAction SilentlyContinue
    Registrar 'O arquivo incompleto foi apagado.' $log
  }
  exit 1
}
finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
