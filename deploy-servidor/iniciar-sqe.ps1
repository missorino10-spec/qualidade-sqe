# ============================================================
#  Sistema de Qualidade (SQE) - Big Dutchman Brasil
#  O QUE SOBE O SISTEMA
#
#  Este arquivo e chamado pela tarefa agendada "QualidadeSQE" toda vez que a
#  maquina liga. Ele tambem pode ser chamado a mao:
#     powershell -ExecutionPolicy Bypass -File C:\QualidadeSQE\iniciar-sqe.ps1
#
#  Ele NAO volta: fica preso no processo do Node ate o sistema ser derrubado.
#  E isso que mantem a tarefa agendada em estado "Running" - se ela voltar
#  para "Ready" sozinha, o sistema caiu.
#
#  Se o Node morrer, a tarefa religa (RestartCount 3, ver passo 3).
#
#  O passo 3 copia este arquivo para C:\QualidadeSQE. A tarefa aponta para a
#  copia, e nao para a pasta do projeto: assim mover ou atualizar a pasta do
#  codigo nao derruba o sistema no meio do expediente.
# ============================================================

$ErrorActionPreference = 'Stop'
$backend = 'C:\QualidadeSQE\app\backend'
$log = 'C:\QualidadeSQE\logs\backend.log'

# Set-Location e OBRIGATORIO, nao e arrumacao: o backend procura a tela em
# "public" a partir da pasta de onde foi iniciado (process.cwd()). Iniciado
# de outro lugar, o sistema sobe servindo so a API e o navegador recebe
# "Cannot GET /".
Set-Location $backend
New-Item -ItemType Directory -Force 'C:\QualidadeSQE\logs' | Out-Null

if (-not (Test-Path "$backend\public\index.html")) {
    throw 'Frontend nao encontrado em backend\public.'
}

# Le o .env e joga cada variavel no ambiente DESTE processo.
#
# Duas coisas importantes sobre este padrao:
#  - ele NAO remove aspas. Um valor escrito como "senha" entraria no sistema
#    com as aspas dentro, e a conexao com o banco falharia.
#  - o arquivo tem de estar em UTF-8 SEM BOM. Com BOM, a primeira chave
#    viraria "\ufeffDATABASE_URL" e o sistema subiria sem saber onde esta o
#    banco.
Get-Content "$backend\.env" | ForEach-Object {
    if ($_ -match '^([^#=\s]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

# *>> junta TODAS as saidas (inclusive erro) no mesmo log. Quando o sistema
# nao sobe, a razao esta nas ultimas linhas deste arquivo.
& 'C:\Program Files\nodejs\node.exe' "$backend\dist\src\main.js" *>> $log
exit $LASTEXITCODE
