# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  RESTAURAR UM BACKUP
#
#  ESTE SCRIPT SUBSTITUI O BANCO E OS ANEXOS DESTA MAQUINA.
#  Tudo que foi lancado depois da data do backup e PERDIDO.
#
#  Ele existe para duas situacoes:
#    - a maquina do sistema morreu e esta sendo refeita;
#    - alguem precisa de uma copia dos dados em outra maquina.
#
#  COMO USAR:
#     # 1. ver o que existe
#     powershell -ExecutionPolicy Bypass -File .\restaurar.ps1 -Listar
#
#     # 2. restaurar (pede confirmacao digitada)
#     powershell -ExecutionPolicy Bypass -File .\restaurar.ps1 `
#       -Arquivo C:\QualidadeSQE\backups\qualidade_2026-10-31_2000.zip
#
#  Ele NAO roda sozinho em tarefa agendada, de proposito: nao existe motivo
#  legitimo para uma restauracao acontecer sem alguem olhando.
# ============================================================

param(
  [string]$Arquivo = '',
  [switch]$Listar,
  [string]$Base = 'C:\QualidadeSQE'
)

$ErrorActionPreference = 'Continue'

. (Join-Path $PSScriptRoot 'comum.ps1')

$backend = Join-Path $Base 'app\backend'
$destino = Join-Path $Base 'backups'
$log     = Join-Path $Base 'logs\restauracao.log'

# ------------------------------------------------------------
# Listar
# ------------------------------------------------------------
if ($Listar -or -not $Arquivo) {
  Titulo "Backups disponiveis em $destino"
  $copias = Get-ChildItem $destino -Filter 'qualidade_*.zip' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending

  if (-not $copias) {
    Aviso 'Nenhum backup encontrado.'
    Write-Host "  Gere um com: powershell -File $PSScriptRoot\backup.ps1"
    exit 1
  }

  foreach ($c in $copias) {
    Write-Host ("  {0,-42} {1,8} MB   {2}" -f $c.Name,
      [math]::Round($c.Length / 1MB, 2), $c.LastWriteTime.ToString('dd/MM/yyyy HH:mm'))
  }

  if (-not $Arquivo) {
    Write-Host ''
    Write-Host '  Para restaurar, repita o comando com -Arquivo e o caminho completo.' -ForegroundColor Cyan
    exit 0
  }
}

if (-not (Test-Path $Arquivo)) { Erro "Arquivo nao encontrado: $Arquivo"; exit 1 }

# ------------------------------------------------------------
# TRAVA: o banco de destino tem de ser o desta maquina
#
#    Sem isto, um .env apontando para a nuvem transformaria esta
#    restauracao em uma escrita no banco de producao da empresa.
# ------------------------------------------------------------
Titulo 'Conferindo o banco de destino'

$env_ = Ler-Env (Join-Path $backend '.env')
if (-not $env_['DATABASE_URL']) { Erro 'DATABASE_URL nao encontrada no .env'; exit 1 }

$url = $env_['DATABASE_URL']
if (($url -notmatch '@(127\.0\.0\.1|localhost):5432/') -or
    ($url -match 'supabase|amazonaws|render\.com|neon\.tech|\.com:6543')) {
  Erro 'A DATABASE_URL NAO e um banco local desta maquina.'
  Erro 'ABORTADO. Restaurar aqui escreveria em um banco remoto.'
  exit 1
}

$b = Partes-Do-Banco $url
Ok "Destino: $($b.Usuario)@$($b.Servidor):$($b.Porta)/$($b.Banco)"

# ------------------------------------------------------------
# Confirmacao digitada
#
#    O nome da maquina tem de ser digitado. Um "s" ou um Enter batido sem
#    ler nao e confirmacao - e exatamente como se apaga o banco errado.
# ------------------------------------------------------------
$info = Get-Item $Arquivo
Write-Host ''
Write-Host '============================================================' -ForegroundColor Red
Write-Host '  ATENCAO - OPERACAO QUE APAGA DADOS' -ForegroundColor Red
Write-Host '============================================================' -ForegroundColor Red
Write-Host "  Backup   : $($info.Name)"
Write-Host "  Gerado em: $($info.LastWriteTime.ToString('dd/MM/yyyy HH:mm'))"
Write-Host "  Maquina  : $env:COMPUTERNAME"
Write-Host "  Banco    : $($b.Banco) em $($b.Servidor)"
Write-Host ''
Write-Host '  O banco e os anexos atuais serao SUBSTITUIDOS.' -ForegroundColor Yellow
Write-Host "  Tudo lancado depois de $($info.LastWriteTime.ToString('dd/MM/yyyy HH:mm')) sera perdido." -ForegroundColor Yellow
Write-Host ''
$resposta = Read-Host "  Para confirmar, digite o nome da maquina ($env:COMPUTERNAME)"

if ($resposta -ne $env:COMPUTERNAME) {
  Write-Host ''
  Aviso 'Nome diferente. NADA foi alterado.'
  exit 1
}

Registrar "--- Restauracao iniciada: $($info.Name) ---" $log

$temp = Join-Path $env:TEMP "sqe-restaurar-$([guid]::NewGuid().ToString('N'))"

try {
  # ----------------------------------------------------------
  # 1. Abrir o backup
  # ----------------------------------------------------------
  Titulo 'Abrindo o backup'
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  Expand-Archive -Path $Arquivo -DestinationPath $temp -Force

  $dump = Join-Path $temp 'banco.dump'
  if (-not (Test-Path $dump)) { throw 'O backup nao contem banco.dump.' }
  Ok "banco.dump ($([math]::Round((Get-Item $dump).Length/1MB,2)) MB)"

  # ----------------------------------------------------------
  # 2. Rede de seguranca
  #
  #    Backup do estado ATUAL antes de substituir. Se a restauracao vier de
  #    um arquivo errado, ainda da para voltar.
  # ----------------------------------------------------------
  Titulo 'Guardando o estado atual antes de substituir'

  # Nao se confia em $LASTEXITCODE aqui: um script PowerShell que termina
  # normalmente nao mexe nessa variavel, e ela ainda teria o codigo do ultimo
  # programa externo. A prova e um arquivo NOVO na pasta de backups.
  $antes = (Get-ChildItem $destino -Filter 'qualidade_*.zip' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1)
  $marca = if ($antes) { $antes.LastWriteTime } else { [datetime]::MinValue }

  & (Join-Path $PSScriptRoot 'backup.ps1') -Base $Base

  $novo = Get-ChildItem $destino -Filter 'qualidade_*.zip' -ErrorAction SilentlyContinue |
          Where-Object { $_.LastWriteTime -gt $marca } |
          Sort-Object LastWriteTime -Descending | Select-Object -First 1

  if (-not $novo) {
    Erro 'O backup do estado atual nao foi gerado.'
    Erro 'ABORTADO: sem rede de seguranca, a restauracao nao prossegue.'
    exit 1
  }
  Ok "Estado atual guardado em $($novo.Name)"
  $redeDeSeguranca = $novo.FullName

  # ----------------------------------------------------------
  # 3. Parar o sistema
  #
  #    Restaurar com o sistema no ar deixaria o Prisma falando com tabelas
  #    que estao sendo recriadas embaixo dele.
  # ----------------------------------------------------------
  Titulo 'Parando o sistema'
  $tarefa = Get-ScheduledTask -TaskName 'QualidadeSQE' -ErrorAction SilentlyContinue
  if ($tarefa) { Stop-ScheduledTask -TaskName 'QualidadeSQE' -ErrorAction SilentlyContinue }

  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.CommandLine -like "*$backend\dist\src\main.js*") {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      Write-Host "  encerrado PID $($_.ProcessId)"
    }
  }
  Start-Sleep -Seconds 3
  Ok 'Sistema parado.'

  # ----------------------------------------------------------
  # 4. Restaurar o banco
  #
  #    --clean --if-exists apaga cada objeto antes de recriar. Sem isso o
  #    pg_restore reclamaria de tudo que ja existe e deixaria o banco pela
  #    metade - parte dado novo, parte dado velho.
  # ----------------------------------------------------------
  Titulo 'Restaurando o banco'
  $pgrestore = Achar-Ferramenta-Postgres 'pg_restore'

  try {
    $env:PGPASSWORD = $b.Senha
    & $pgrestore -h $b.Servidor -p $b.Porta -U $b.Usuario -d $b.Banco `
                 --clean --if-exists --no-owner --no-privileges $dump 2>&1 |
      ForEach-Object { Registrar "  pg_restore: $_" $log }
    $codigo = $LASTEXITCODE
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }

  # O pg_restore devolve codigo diferente de zero por avisos que nao sao
  # falha (ex.: "nao existe" ao tentar apagar objeto que nunca existiu). A
  # prova de verdade e a contagem de tabelas abaixo, nao o codigo de saida.
  if ($codigo -ne 0) {
    Aviso "pg_restore devolveu $codigo. Conferindo se o banco ficou utilizavel..."
  }

  # Via Consultar-Banco (SQL em arquivo): "Usuario" tem U maiusculo e as
  # aspas duplas precisam chegar inteiras ate o psql. Ver comum.ps1.
  $r = Consultar-Banco $b @'
select
  (select count(*) from information_schema.tables where table_schema = 'public'),
  (select count(*) from "Usuario");
'@

  if (-not $r.Ok) { throw "Nao foi possivel conferir o banco restaurado: $($r.Saida)" }

  $partes   = $r.Linhas[0] -split '\s*\|\s*'
  $tabelas  = $partes[0] -as [int]
  $usuarios = $partes[1] -as [int]

  if ($tabelas -lt 10 -or $usuarios -lt 1) {
    throw "O banco restaurado nao parece utilizavel (tabelas=$tabelas, usuarios=$usuarios)."
  }
  Ok "Banco restaurado: $tabelas tabelas, $usuarios usuario(s)."

  # ----------------------------------------------------------
  # 5. Restaurar os anexos
  #
  #    Os arquivos do backup SOMAM com o que ja existe. Nada e apagado: um
  #    anexo a mais e inofensivo, um anexo que desaparece deixa a RNC
  #    apontando para o vazio.
  # ----------------------------------------------------------
  Titulo 'Restaurando os anexos'
  $uploadsBackup = Join-Path $temp 'uploads'
  $uploads = $env_['UPLOAD_DIR']
  if (-not $uploads) { $uploads = Join-Path $Base 'uploads' }

  if (Test-Path $uploadsBackup) {
    $n = (Get-ChildItem $uploadsBackup -Recurse -File -ErrorAction SilentlyContinue).Count
    if ($n -gt 0) {
      if (-not (Test-Path $uploads)) { New-Item -ItemType Directory -Path $uploads -Force | Out-Null }
      Copy-Item (Join-Path $uploadsBackup '*') -Destination $uploads -Recurse -Force
      Ok "$n anexo(s) restaurado(s) em $uploads"
    } else {
      Aviso 'O backup nao tinha anexos.'
    }
  } else {
    Aviso 'O backup nao tinha a pasta de anexos.'
  }

  # ----------------------------------------------------------
  # 6. Subir de volta
  # ----------------------------------------------------------
  Titulo 'Subindo o sistema'
  if ($tarefa) {
    Start-ScheduledTask -TaskName 'QualidadeSQE'
    $ok = $false
    foreach ($i in 1..60) {
      Start-Sleep -Seconds 1
      if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { $ok = $true; break }
    }
    if ($ok) { Ok 'Sistema no ar.' } else { Aviso 'O sistema nao subiu. Veja logs\backend.log' }
  } else {
    Aviso 'A tarefa QualidadeSQE nao existe. Rode o passo 3.'
  }

  Registrar "--- Restauracao concluida: $($info.Name) ---" $log

  Write-Host ''
  Write-Host '============================================================' -ForegroundColor Green
  Write-Host '  RESTAURACAO CONCLUIDA' -ForegroundColor Green
  Write-Host '============================================================' -ForegroundColor Green
  Write-Host "  Os dados agora sao os de $($info.LastWriteTime.ToString('dd/MM/yyyy HH:mm'))."
  Write-Host '  As senhas de login voltaram a ser as daquela data.'
  Write-Host ''
}
catch {
  Erro $_.Exception.Message
  Registrar "ERRO: $($_.Exception.Message)" $log
  Write-Host ''
  if ($redeDeSeguranca) {
    Aviso 'O estado ANTERIOR a esta tentativa esta guardado em:'
    Aviso "  $redeDeSeguranca"
    Aviso 'Para voltar atras, restaure esse arquivo.'
  } else {
    Aviso 'A falha aconteceu antes de qualquer alteracao no banco.'
  }
  exit 1
}
finally {
  Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
}
