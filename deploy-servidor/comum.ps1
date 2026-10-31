# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  PECAS COMUNS DOS SCRIPTS DO SERVIDOR
#
#  Este arquivo nao faz nada sozinho: os outros scripts o carregam com
#  ". $PSScriptRoot\comum.ps1". Ele existe porque achar o PostgreSQL e ler
#  o .env eram as duas coisas repetidas em todos eles - e repetir isso em
#  quatro arquivos e repetir o erro em quatro arquivos.
# ============================================================

function Titulo($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Ok($t)     { Write-Host "  [OK] $t"   -ForegroundColor Green }
function Aviso($t)  { Write-Host "  [!] $t"    -ForegroundColor Yellow }
function Erro($t)   { Write-Host "  [ERRO] $t" -ForegroundColor Red }

# ------------------------------------------------------------
# Ler o backend\.env
#
# O .env NAO esta no GitHub (tem senha dentro). Ele e a unica fonte de
# verdade sobre banco, porta e pasta de anexos deste servidor - por isso
# todo script le dele em vez de ter valor cravado.
# ------------------------------------------------------------
function Ler-Env {
  param([Parameter(Mandatory)][string]$Caminho)

  if (-not (Test-Path $Caminho)) {
    throw "Arquivo de configuracao nao encontrado: $Caminho"
  }

  $valores = @{}
  foreach ($linha in Get-Content $Caminho -Encoding UTF8) {
    $t = $linha.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }

    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }

    $chave = $t.Substring(0, $i).Trim()
    $valor = $t.Substring($i + 1).Trim()

    # Aspas em volta do valor sao opcionais no .env; se vierem, saem aqui.
    if ($valor.Length -ge 2 -and
        (($valor.StartsWith('"') -and $valor.EndsWith('"')) -or
         ($valor.StartsWith("'") -and $valor.EndsWith("'")))) {
      $valor = $valor.Substring(1, $valor.Length - 2)
    }

    $valores[$chave] = $valor
  }
  return $valores
}

# ------------------------------------------------------------
# Separar a DATABASE_URL em pedacos
#
# Formato: postgresql://usuario:senha@servidor:porta/banco?coisas
# A senha vem codificada para URL (um "@" virou "%40"), por isso o
# UnescapeDataString: sem ele o pg_dump recebe a senha errada e o backup
# falha de madrugada, quando ninguem esta olhando.
# ------------------------------------------------------------
function Partes-Do-Banco {
  param([Parameter(Mandatory)][string]$Url)

  if ($Url -notmatch '^postgres(ql)?://') {
    throw "DATABASE_URL nao parece uma conexao PostgreSQL: $Url"
  }

  $u = [uri]$Url
  $usuario = ''
  $senha   = ''

  if ($u.UserInfo) {
    $p = $u.UserInfo.Split(':', 2)
    $usuario = [uri]::UnescapeDataString($p[0])
    if ($p.Count -gt 1) { $senha = [uri]::UnescapeDataString($p[1]) }
  }

  return @{
    Servidor = $u.Host
    Porta    = if ($u.Port -gt 0) { $u.Port } else { 5432 }
    Banco    = $u.AbsolutePath.TrimStart('/')
    Usuario  = $usuario
    Senha    = $senha
  }
}

# ------------------------------------------------------------
# Achar as ferramentas do PostgreSQL
#
# O instalador do PostgreSQL no Windows nao coloca a pasta bin no PATH.
# Procurar e escolher a versao mais alta evita depender de o TI ter
# ajustado o PATH na mao - e continua funcionando quando a empresa
# atualizar do 17 para o 18.
# ------------------------------------------------------------
function Achar-Ferramenta-Postgres {
  param([Parameter(Mandatory)][string]$Nome)   # ex.: 'pg_dump'

  $naPath = Get-Command "$Nome.exe" -ErrorAction SilentlyContinue
  if ($naPath) { return $naPath.Source }

  $candidatos = Get-ChildItem -Path 'C:\Program Files\PostgreSQL',
                                    'C:\Program Files (x86)\PostgreSQL' `
                  -Filter "$Nome.exe" -Recurse -ErrorAction SilentlyContinue

  if (-not $candidatos) {
    throw "$Nome.exe nao encontrado. O PostgreSQL esta instalado nesta maquina?"
  }

  # Ordena pelo numero da versao na pasta (…\PostgreSQL\17\bin), nao pelo
  # texto: por texto, "9" viria depois de "17".
  return ($candidatos | Sort-Object {
    $m = [regex]::Match($_.FullName, '\\PostgreSQL\\(\d+)')
    if ($m.Success) { [int]$m.Groups[1].Value } else { 0 }
  } -Descending | Select-Object -First 1).FullName
}

# ------------------------------------------------------------
# Consultar o banco
#
# O SQL vai sempre em ARQUIVO (psql -f), nunca em "psql -c". Isso parece
# rodeio e nao e: o PowerShell NAO preserva aspas duplas quando chama um
# programa externo. Um
#     & psql -c 'select count(*) from "Usuario"'
# chega no psql como ... from Usuario (sem aspas), e o PostgreSQL entao
# procura a tabela "usuario" em minusculas - que nao existe, porque o Prisma
# cria "Usuario" com U maiusculo.
#
# O sintoma e cruel: a consulta devolve "relacao usuario nao existe" e quem
# le o script jura que o banco esta corrompido. Foi assim que a conferencia
# da restauracao acusou um banco perfeito como inutilizavel.
# ------------------------------------------------------------
function Consultar-Banco {
  param(
    [Parameter(Mandatory)][hashtable]$Banco,   # saida de Partes-Do-Banco
    [Parameter(Mandatory)][string]$Sql,
    [string]$Separador = ' | '
  )

  $psql = Achar-Ferramenta-Postgres 'psql'
  $arq = Join-Path $env:TEMP "sqe-consulta-$([guid]::NewGuid().ToString('N')).sql"

  try {
    # UTF8 sem BOM: com BOM o psql leria \ufeff como comando e falharia.
    [System.IO.File]::WriteAllText($arq, $Sql, (New-Object System.Text.UTF8Encoding($false)))

    # Senha por variavel de ambiente: na linha de comando ela ficaria visivel
    # para qualquer processo da maquina.
    $env:PGPASSWORD = $Banco.Senha
    $saida = & $psql -h $Banco.Servidor -p $Banco.Porta -U $Banco.Usuario -d $Banco.Banco `
                     -At -F $Separador -v ON_ERROR_STOP=1 -f $arq 2>&1
    $codigo = $LASTEXITCODE
  } finally {
    Remove-Item $arq -Force -ErrorAction SilentlyContinue
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }

  return @{
    Ok     = ($codigo -eq 0)
    Codigo = $codigo
    Saida  = (($saida | Out-String).Trim())
    Linhas = @($saida | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne '' })
  }
}

# ------------------------------------------------------------
# Registrar no log
#
# Um arquivo por assunto, uma linha por evento. E o primeiro lugar onde se
# olha quando alguem diz "o sistema sumiu" ou "o backup nao rodou".
# ------------------------------------------------------------
function Registrar {
  param(
    [Parameter(Mandatory)][string]$Texto,
    [Parameter(Mandatory)][string]$Log
  )

  $pasta = Split-Path $Log -Parent
  if (-not (Test-Path $pasta)) {
    New-Item -ItemType Directory -Path $pasta -Force | Out-Null
  }

  # Em servidor que fica anos ligado o log nao pode crescer para sempre.
  if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 5MB)) {
    Move-Item $Log "$Log.antigo" -Force
  }

  $linha = "[{0}] {1}" -f (Get-Date -Format 'dd/MM/yyyy HH:mm:ss'), $Texto
  Write-Host $linha
  Add-Content -Path $Log -Value $linha -Encoding UTF8
}
