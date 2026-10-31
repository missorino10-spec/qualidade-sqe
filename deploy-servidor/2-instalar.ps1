# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  PASSO 2 de 3  -  BAIXAR E PREPARAR O SISTEMA
#
#  O que este script faz:
#    1. Baixa o codigo do GitHub (ou atualiza o que ja esta na maquina)
#    2. Cria o usuario e o banco "qualidade" no PostgreSQL local
#    3. Escreve o backend\.env desta maquina
#    4. TRAVA: nenhum comando de banco roda se a conexao nao for local
#    5. Instala as dependencias, cria as tabelas e a primeira carga
#    6. Compila o backend e a tela
#
#  COMO USAR (PowerShell "Executar como administrador"):
#     powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\2-instalar.ps1
#
#  Pode ser executado varias vezes. Em uma maquina que ja esta no ar ele
#  atualiza o codigo e recompila, mas NAO mexe no .env nem refaz a primeira
#  carga - os dados da fabrica ficam onde estao.
#
#  ATENCAO: este e o unico script que escreve no banco de dados. Por isso a
#  trava do item 4 e conferida duas vezes, antes de cada bloco de escrita.
# ============================================================

param(
  [string]$Repo = 'https://github.com/missorino10-spec/qualidade-sqe.git',
  [string]$Ramo = 'main',
  [string]$Base = 'C:\QualidadeSQE',
  [int]$Porta = 8080,
  [string]$EmailAdmin = ''
)

# 'Continue' de proposito: git e npm escrevem progresso normal no stderr e,
# com 'Stop', o PowerShell trata isso como erro fatal. Foi exatamente assim
# que um "git clone" morreu no meio e deixou uma pasta .git vazia para tras.
# Aqui se confere $LASTEXITCODE depois de cada comando.
$ErrorActionPreference = 'Continue'

# As pecas comuns (Titulo/Ok/Aviso/Erro e Achar-Ferramenta-Postgres) moram em
# comum.ps1. Este script tambem roda baixado solto em C:\QualidadeSQE, antes
# de o codigo existir na maquina - nesse caso o comum.ps1 nao esta do lado e
# as quatro funcoes de mensagem sao definidas aqui mesmo.
$comum = Join-Path $PSScriptRoot 'comum.ps1'
if (Test-Path $comum) { . $comum }

if (-not (Get-Command Titulo -ErrorAction SilentlyContinue)) {
  function Titulo($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
  function Ok($t)     { Write-Host "  [OK] $t" -ForegroundColor Green }
  function Aviso($t)  { Write-Host "  [!] $t" -ForegroundColor Yellow }
  function Erro($t)   { Write-Host "  [ERRO] $t" -ForegroundColor Red }
}

$app      = Join-Path $Base 'app'
$backend  = Join-Path $app 'backend'
$frontend = Join-Path $app 'frontend'
$arqEnv   = Join-Path $backend '.env'
$arqCred  = Join-Path $Base 'CREDENCIAIS.txt'
$npm = 'C:\Program Files\nodejs\npm.cmd'
$npx = 'C:\Program Files\nodejs\npx.cmd'

# O instalador do Node poe a pasta no PATH da MAQUINA, mas um terminal que ja
# estava aberto continua com o PATH antigo. Sem esta linha o "npm ci" chama o
# "node" pelo cmd e falha com "node nao e reconhecido" - o erro mais confuso
# desta instalacao, porque o node esta instalado e funcionando.
if ($env:Path -notlike '*nodejs*') { $env:Path = 'C:\Program Files\nodejs;' + $env:Path }

if (-not (Test-Path 'C:\Program Files\nodejs\node.exe')) {
  Erro 'Node nao encontrado. Rode o passo 1 primeiro.'
  exit 1
}
if (-not (Test-Path $arqCred)) {
  Erro "$arqCred nao existe. Rode o passo 1 primeiro."
  exit 1
}

Titulo 'Preparando o Sistema de Qualidade (SQE)'
Write-Host "  node : $(& 'C:\Program Files\nodejs\node.exe' -v)  /  npm $(& $npm -v)"
Write-Host "  pasta: $app"
Write-Host "  ramo : $Ramo"

# ------------------------------------------------------------
# Senhas geradas no passo 1
# ------------------------------------------------------------
$cred = @{}
Get-Content $arqCred -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*([A-Z]+)=(.+)$') { $cred[$matches[1]] = $matches[2].Trim() }
}
foreach ($k in 'PGSUPER', 'PGAPP', 'ADMINPW', 'JWT') {
  if (-not $cred[$k]) { Erro "$k nao encontrado em $arqCred"; exit 1 }
}
Ok 'Senhas desta maquina carregadas.'

# ------------------------------------------------------------
# 1. Codigo
#
#    O GitHub e a fonte de verdade do codigo. O que ele NAO traz: o .env, os
#    dados do banco, a pasta uploads e a tarefa agendada.
# ------------------------------------------------------------
Titulo 'Baixando o codigo do GitHub'

if (Test-Path (Join-Path $app '.git')) {
  Set-Location $app
  $sujo = git status --porcelain
  # "backend/public" e a tela compilada, que nasce aqui mesmo e nao esta no
  # Git. Nao conta como alteracao feita por gente.
  $mexido = $sujo | Where-Object { $_ -notmatch 'backend/public' }

  if ($mexido) {
    Aviso 'Existem alteracoes locais nesta pasta que NAO estao no GitHub:'
    foreach ($l in $mexido) { Write-Host "      $l" }
    Aviso 'Elas serao PRESERVADAS: o script nao vai sobrescrever nada.'
    Aviso 'Guarde-as no GitHub (git add/commit/push) ou elas vao se perder'
    Aviso 'na proxima vez que esta maquina for reinstalada.'
  }

  git fetch origin 2>&1 | Out-Null
  $atras = (git rev-list --count "HEAD..origin/$Ramo") -as [int]

  if ($atras -gt 0 -and -not $mexido) {
    Write-Host "  Esta pasta esta $atras commit(s) atras. Atualizando ..."
    # --ff-only: avanca so se der para avancar em linha reta. Se tiver commit
    # local que nao esta no GitHub, ele PARA em vez de criar merge ou de
    # jogar trabalho fora.
    git merge --ff-only "origin/$Ramo" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Aviso 'Nao foi possivel avancar em linha reta (existe commit local).'
      Aviso 'O codigo foi MANTIDO como esta. Resolva no Git antes de seguir.'
    }
  } elseif ($mexido) {
    Aviso 'Atualizacao do codigo pulada para nao atropelar as alteracoes locais.'
  } else {
    Ok 'Codigo ja na ultima versao.'
  }
} else {
  if (Test-Path $app) {
    # Tentativa anterior que morreu no meio deixa pasta pela metade. Comecar
    # do zero e mais barato que adivinhar o que ficou faltando.
    Aviso "$app existe mas nao e um repositorio Git. Renomeando para .antigo ..."
    $antigo = "$app.antigo-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item $app $antigo
    Aviso "Pasta antiga guardada em $antigo"
  }
  Set-Location $Base
  git clone --branch $Ramo $Repo app 2>&1 | ForEach-Object { Write-Host "    $_" }
  if (-not (Test-Path (Join-Path $app '.git'))) { Erro 'O clone falhou.'; exit 1 }
}

Set-Location $app
$commit = git rev-parse HEAD
Ok "commit $commit"
if (-not (Test-Path (Join-Path $backend 'package.json'))) {
  Erro "Nao achei $backend\package.json - o codigo nao veio completo."
  exit 1
}

# ------------------------------------------------------------
# 2. Usuario e banco no PostgreSQL
#
#    Somente CREATE. Nenhum DROP, nunca: este script roda tambem em maquina
#    que ja atende a fabrica.
# ------------------------------------------------------------
Titulo 'Criando o usuario e o banco no PostgreSQL local'

$psql = $null
if (Get-Command Achar-Ferramenta-Postgres -ErrorAction SilentlyContinue) {
  $psql = Achar-Ferramenta-Postgres 'psql'
} else {
  $psql = (Get-ChildItem 'C:\Program Files\PostgreSQL' -Filter 'psql.exe' -Recurse -ErrorAction SilentlyContinue |
           Select-Object -First 1).FullName
}
if (-not $psql) { Erro 'psql.exe nao encontrado. O PostgreSQL esta instalado?'; exit 1 }
Write-Host "  usando $psql"

# A senha vai pela variavel de ambiente do processo e o SQL vai em arquivo:
# na linha de comando, os dois ficariam visiveis para qualquer processo da
# maquina e cairiam no historico do console.
$sqlFile = Join-Path $env:TEMP "sqe-criar-$([guid]::NewGuid().ToString('N')).sql"
try {
  # A senha e interpolada em SQL. O passo 1 gera somente letras e numeros,
  # mas a aspa simples e dobrada aqui de qualquer jeito: se um dia alguem
  # trocar a senha na mao e puser uma aspa, isto evita o SQL quebrado.
  $pgapp = $cred['PGAPP'].Replace("'", "''")
  Set-Content $sqlFile @"
-- Cria o usuario do sistema so se ele ainda nao existir.
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qualidade') THEN
    CREATE ROLE qualidade WITH LOGIN PASSWORD '$pgapp';
  END IF;
END
`$`$;

-- CREATE DATABASE nao funciona dentro de bloco; o \gexec roda a linha
-- montada somente quando o banco realmente nao existe.
SELECT 'CREATE DATABASE qualidade OWNER qualidade'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'qualidade')\gexec
"@ -Encoding UTF8

  $env:PGPASSWORD = $cred['PGSUPER']
  & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f $sqlFile 2>&1 |
    ForEach-Object { Write-Host "    $_" }
  $codigo = $LASTEXITCODE
} finally {
  Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

if ($codigo -ne 0) {
  Erro "psql devolveu $codigo. A senha PGSUPER confere com a do PostgreSQL desta maquina?"
  exit 1
}

# Prova que o usuario do sistema realmente consegue entrar. Sem esta prova, o
# erro so apareceria la na frente, no meio do Prisma.
try {
  $env:PGPASSWORD = $cred['PGAPP']
  $quem = (& $psql -h 127.0.0.1 -p 5432 -U qualidade -d qualidade -At -c 'select current_user') 2>&1
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
if ($quem -ne 'qualidade') { Erro "O usuario qualidade nao conseguiu entrar: $quem"; exit 1 }
Ok 'Usuario e banco "qualidade" prontos em 127.0.0.1:5432.'

# ------------------------------------------------------------
# 3. backend\.env
#
#    Nunca sobrescreve. Em um servidor que ja esta no ar, trocar o
#    JWT_SECRET desloga todo mundo e trocar a senha do banco derruba o
#    sistema na hora.
# ------------------------------------------------------------
Titulo 'Escrevendo a configuracao desta maquina'

if (Test-Path $arqEnv) {
  Aviso "$arqEnv ja existe - MANTIDO como esta."
} else {
  if (-not $EmailAdmin) {
    $EmailAdmin = Read-Host 'E-mail do administrador da Qualidade (primeiro acesso)'
  }
  if ($EmailAdmin -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    Erro "E-mail invalido: $EmailAdmin"
    exit 1
  }

  $conexao = "postgresql://qualidade:$($cred['PGAPP'])@127.0.0.1:5432/qualidade?schema=public"

  $texto = @"
# ============================================================
# Sistema de Qualidade (SQE) - instalacao nativa no Windows
# Gerado em $(Get-Date -Format 'dd/MM/yyyy HH:mm') na maquina $env:COMPUTERNAME
#
# Este arquivo NAO esta no GitHub e nao deve ser copiado para outra
# maquina: as senhas aqui valem so para esta instalacao.
#
# NAO use aspas nos valores. O iniciar-sqe.ps1 le este arquivo com
# ^([^#=\s]+)=(.*)`$ e nao remove aspas: elas virariam parte do valor
# e a senha e a porta sairiam erradas.
# ============================================================

# --- Banco: PostgreSQL LOCAL desta maquina ---
# Sem pooler, entao as duas apontam para a porta 5432 e sao iguais. Na
# instalacao em nuvem a DATABASE_URL vai para o pooler (6543) e a
# DIRECT_URL para a 5432; aqui essa distincao nao existe.
DATABASE_URL=$conexao
DIRECT_URL=$conexao

# --- Chave que assina o login ---
# Trocar desloga todo mundo na hora.
JWT_SECRET=$($cred['JWT'])

# --- Administrador criado na primeira carga ---
SEED_ADMIN_EMAIL=$EmailAdmin
SEED_ADMIN_PASSWORD=$($cred['ADMINPW'])

# --- Endereco ---
PORT=$Porta

# --- Anexos ---
# Preenchida = anexo vai para pasta em disco. Em branco, o sistema tentaria
# o Supabase Storage, que e a instalacao em nuvem. Ver storage.service.ts.
UPLOAD_DIR=$Base\uploads

# --- Relogio ---
# O sistema guarda data em UTC mas pergunta "que dia e hoje" no relogio
# local. Sem esta variavel, das 21h a meia-noite o sistema enxergaria o dia
# seguinte em prazo de RNC, vencimento de calibracao e competencia do IDF.
TZ=America/Sao_Paulo

# Em branco a API aceita qualquer origem, que e como sempre funcionou.
# Preencha com o endereco pelo qual as pessoas abrem o sistema para fechar.
CORS_ORIGINS=
"@

  # UTF8 SEM BOM. Com BOM, a primeira variavel viraria "\ufeffDATABASE_URL" e
  # o sistema subiria sem saber onde esta o banco. O
  # Set-Content -Encoding UTF8 do PowerShell 5.1 escreve BOM - por isso o
  # caminho mais longo aqui.
  [System.IO.File]::WriteAllText($arqEnv, $texto, (New-Object System.Text.UTF8Encoding($false)))

  icacls $arqEnv /inheritance:r /grant:r "$($env:USERNAME):(R,W)" `
    '*S-1-5-18:(R)' '*S-1-5-32-544:(R)' 2>&1 | Out-Null

  Ok "$arqEnv criado e protegido."
}

# ------------------------------------------------------------
# 4. TRAVA DE SEGURANCA
#
#    Daqui para baixo existem comandos que ESCREVEM no banco. Se a
#    DATABASE_URL nao for a desta maquina, o script para aqui.
#
#    Isto nao e paranoia: o .env de uma maquina de desenvolvimento aponta
#    para o banco de producao na nuvem. Um .env copiado de um lugar para o
#    outro fez "prisma db push" virar escrita no banco da fabrica.
# ------------------------------------------------------------
Titulo 'TRAVA: conferindo que o banco e o desta maquina'

function Conferir-Trava {
  $url = (Get-Content $arqEnv | Where-Object { $_ -match '^DATABASE_URL=' } |
          Select-Object -First 1) -replace '^DATABASE_URL=', ''

  $ehLocal = $url -match '@(127\.0\.0\.1|localhost):5432/'
  $ehNuvem = $url -match 'supabase|amazonaws|render\.com|neon\.tech|\.com:6543'

  Write-Host "  aponta para 127.0.0.1:5432 : $ehLocal"
  Write-Host "  parece banco remoto/nuvem  : $ehNuvem"

  if (-not $ehLocal -or $ehNuvem) {
    Erro 'A DATABASE_URL nao e o banco local desta maquina.'
    Erro 'ABORTADO. Nenhum comando de banco foi executado.'
    exit 1
  }
  Ok 'Banco local confirmado.'
}
Conferir-Trava

# ------------------------------------------------------------
# 5. Dependencias, tabelas e primeira carga
# ------------------------------------------------------------
Titulo 'Instalando as dependencias do backend'
Set-Location $backend

if (Test-Path (Join-Path $backend 'node_modules')) {
  Ok 'node_modules ja existe - "npm ci" vai refazer do zero mesmo assim.'
}
& $npm ci
if ($LASTEXITCODE -ne 0) { Erro "npm ci falhou ($LASTEXITCODE)"; exit 1 }
Ok 'Dependencias do backend instaladas.'

Titulo 'Preparando o banco'
Conferir-Trava   # conferida de novo: e aqui que a escrita acontece

# O npm 11 nao roda o postinstall dos pacotes por padrao, e o cliente do
# Prisma e gerado justamente no postinstall. Sem este comando explicito, o
# sistema compila e depois nao acha o cliente do banco.
& $npx prisma generate
if ($LASTEXITCODE -ne 0) { Erro "prisma generate falhou ($LASTEXITCODE)"; exit 1 }
Ok 'Cliente do Prisma gerado.'

# Sem --accept-data-loss de proposito: se o Prisma precisar destruir dado
# para chegar ao schema, e melhor ele parar e reclamar do que fazer calado.
& $npx prisma db push
if ($LASTEXITCODE -ne 0) {
  Erro "prisma db push falhou ($LASTEXITCODE)"
  Aviso 'Se a mensagem fala em perda de dados, PARE e chame quem cuida do sistema.'
  exit 1
}
Ok 'Tabelas criadas/atualizadas.'

# A primeira carga so roda em banco vazio. O seed usa upsert e nao apagaria
# nada, mas rodar em banco com dado da fabrica e risco sem beneficio.
# Pelo Consultar-Banco, e nao por "psql -c": o PowerShell engole as aspas
# duplas de "Usuario" ao chamar programa externo e a consulta falharia
# dizendo que a tabela nao existe. Ver comum.ps1.
$banco = @{ Servidor = '127.0.0.1'; Porta = 5432; Banco = 'qualidade'
            Usuario = 'qualidade'; Senha = $cred['PGAPP'] }

$r = Consultar-Banco $banco 'select count(*) from "Usuario";'
if (-not $r.Ok) { Erro "Nao foi possivel consultar o banco: $($r.Saida)"; exit 1 }
$temUsuario = ($r.Linhas[0] -as [int]) -gt 0

if ($temUsuario) {
  Ok 'Banco ja tem usuario cadastrado - primeira carga PULADA.'
} else {
  & $npx prisma db seed
  if ($LASTEXITCODE -ne 0) { Erro "prisma db seed falhou ($LASTEXITCODE)"; exit 1 }
  Ok 'Primeira carga feita (administrador, periodicidades, maquinas, defeitos).'
}

Titulo 'Compilando o backend'
& $npm run build
if ($LASTEXITCODE -ne 0) { Erro "build do backend falhou ($LASTEXITCODE)"; exit 1 }
if (-not (Test-Path (Join-Path $backend 'dist\src\main.js'))) {
  Erro 'dist\src\main.js nao foi gerado.'
  exit 1
}
Ok 'Backend compilado.'

# ------------------------------------------------------------
# 6. A tela
#
#    VITE_API_URL NAO e definida de proposito: sem ela o frontend chama
#    "/api" no mesmo endereco de onde foi aberto. Como o proprio backend
#    serve a tela, front e back sao o mesmo host e a mesma porta.
# ------------------------------------------------------------
Titulo 'Compilando a tela'
Set-Location $frontend

& $npm ci
if ($LASTEXITCODE -ne 0) { Erro "npm ci do frontend falhou ($LASTEXITCODE)"; exit 1 }
& $npm run build
if ($LASTEXITCODE -ne 0) { Erro "build do frontend falhou ($LASTEXITCODE)"; exit 1 }
if (-not (Test-Path (Join-Path $frontend 'dist\index.html'))) {
  Erro 'dist\index.html nao foi gerado.'
  exit 1
}

# O backend procura a tela em "public" dentro da pasta de onde foi iniciado
# (process.cwd()) - por isso o iniciar-sqe.ps1 faz Set-Location no backend.
$publico = Join-Path $backend 'public'
# Limpa antes: sobra de build antigo aqui faria o navegador baixar um arquivo
# de JavaScript velho junto com o novo.
if (Test-Path $publico) { Remove-Item $publico -Recurse -Force }
New-Item -ItemType Directory -Path $publico -Force | Out-Null
Copy-Item (Join-Path $frontend 'dist\*') -Destination $publico -Recurse -Force

if (-not (Test-Path (Join-Path $publico 'index.html'))) { Erro 'A tela nao foi copiada.'; exit 1 }
Ok "Tela copiada para $publico"

# ------------------------------------------------------------
# Conferencia
# ------------------------------------------------------------
Titulo 'CONFERENCIA'
Write-Host "  commit            : $commit"
Write-Host "  backend compilado : $(Test-Path (Join-Path $backend 'dist\src\main.js'))"
Write-Host "  tela compilada    : $(Test-Path (Join-Path $publico 'index.html'))"
Write-Host "  anexos            : $Base\uploads"

$url = (Get-Content $arqEnv | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
Write-Host "  banco             : $($url -replace '://[^:]+:[^@]+@', '://qualidade:***@')"

# Prova independente do que entrou no banco. Contagem EXATA com count(*): o
# n_live_tup do pg_stat_user_tables e ESTIMATIVA e pode mostrar zero numa
# tabela cheia que ainda nao passou pelo autovacuum.
$r = Consultar-Banco $banco @'
select
  (select count(*) from "Usuario"),
  (select count(*) from "Maquina"),
  (select count(*) from "TipoDefeito"),
  (select count(*) from "PeriodicidadeConfig");
'@
if ($r.Ok) {
  Write-Host '  usuarios | maquinas | tipos de defeito | periodicidades'
  Write-Host "  $($r.Linhas[0])"
} else {
  Aviso "Nao foi possivel contar os registros: $($r.Saida)"
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  PASSO 2 CONCLUIDO' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  O sistema esta pronto, mas ainda NAO sobe sozinho.'
Write-Host ''
Write-Host '  PROXIMO PASSO (passo 3) - ligar o inicio automatico:' -ForegroundColor Cyan
Write-Host "     powershell -ExecutionPolicy Bypass -File $app\deploy-servidor\3-ativar-inicio-automatico.ps1"
Write-Host ''
