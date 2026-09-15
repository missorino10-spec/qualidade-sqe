@echo off
setlocal enableextensions
cd /d "%~dp0"
set "BASE=%cd%"
set "PGBIN=%BASE%\pgsql\bin"
set "CONFIG=%BASE%\config"
set "ANEXOS=%BASE%\uploads"
set "DESTINO=%BASE%\backups"

rem ===== Backup automatico (rodado diariamente pelo Agendador de Tarefas) =====
rem
rem Salva as DUAS metades do sistema. Uma sem a outra nao restaura nada:
rem   1) o banco  -> os registros (RNC, inspecoes, 8D, R.O, cadastros...)
rem   2) a pasta uploads -> os arquivos anexados (fotos, PDFs, planilhas)
rem O banco guarda so o NOME do arquivo; a foto em si mora na pasta uploads.
rem
rem Para mandar o backup para uma pasta de rede, troque a linha "set DESTINO="
rem acima por, por exemplo:  set "DESTINO=\\servidor-backup\qualidade"
rem Guardar o backup no mesmo disco do sistema protege contra engano de usuario,
rem mas nao contra o disco queimar - a copia em outro lugar e o que fecha isso.

if not exist "%CONFIG%\pgport.txt" (
  echo [ERRO] Sistema ainda nao foi iniciado - porta do banco desconhecida.
  exit /b 1
)
set /p PGPORT=<"%CONFIG%\pgport.txt"
if not exist "%DESTINO%" mkdir "%DESTINO%"

rem Data no formato AAAA-MM-DD_HH-MM (independente de regiao)
for /f %%D in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "STAMP=%%D"
set "ARQ=%DESTINO%\qualidade-%STAMP%.sql"
set "PARCIAL=%ARQ%.parcial"

rem ---- 1) Banco de dados -------------------------------------------------
rem Grava primeiro com outro nome. So vira "qualidade-....sql" no fim, se deu
rem certo: assim um backup interrompido no meio nunca e confundido com um bom.
echo Gerando backup do banco em: %ARQ%
"%PGBIN%\pg_dump.exe" -h 127.0.0.1 -p %PGPORT% -U qualidade -f "%PARCIAL%" qualidade
if errorlevel 1 (
  echo [ERRO] Falha ao gerar o backup do banco.
  del "%PARCIAL%" >nul 2>&1
  exit /b 1
)
rem pg_dump fecha todo dump completo com esta linha. Sem ela, faltou pedaco.
findstr /c:"PostgreSQL database dump complete" "%PARCIAL%" >nul
if errorlevel 1 (
  echo [ERRO] O backup do banco saiu incompleto e foi descartado.
  del "%PARCIAL%" >nul 2>&1
  exit /b 1
)
move /y "%PARCIAL%" "%ARQ%" >nul

rem ---- 2) Arquivos anexados ---------------------------------------------
rem Copia so o que ainda nao esta la (/XO = nao regrava o que ja existe igual).
rem NAO se usa /MIR de proposito: /MIR apagaria da copia o que sumiu do
rem original, e e exatamente do sumico acidental que o backup tem que proteger.
rem Cada anexo tem nome unico, entao a copia so cresce e nunca se perde nada.
if exist "%ANEXOS%" (
  echo Copiando os arquivos anexados...
  robocopy "%ANEXOS%" "%DESTINO%\anexos" /E /XO /R:2 /W:2 /NFL /NDL /NP >nul
  rem robocopy usa 0-7 para sucesso e 8 ou mais para falha de verdade.
  if errorlevel 8 (
    echo [ERRO] Falha ao copiar os arquivos anexados.
    exit /b 1
  )
)

rem ---- 3) Limpeza --------------------------------------------------------
rem Mantem apenas os ultimos 30 dias de dump do banco. A copia dos anexos NAO
rem entra nessa limpeza: apagar foto de RNC por causa de idade seria perder
rem evidencia de um documento que continua valendo.
forfiles /p "%DESTINO%" /m "qualidade-*.sql" /d -30 /c "cmd /c del @path" >nul 2>&1
forfiles /p "%DESTINO%" /m "*.parcial" /d -1 /c "cmd /c del @path" >nul 2>&1

echo Backup concluido: banco em %ARQ% e anexos em %DESTINO%\anexos
endlocal
