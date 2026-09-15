@echo off
setlocal enableextensions enabledelayedexpansion
cd /d "%~dp0"
set "BASE=%cd%"
set "PGBIN=%BASE%\pgsql\bin"
set "CONFIG=%BASE%\config"
set "ANEXOS=%BASE%\uploads"
set "DESTINO=%BASE%\backups"

rem ===== Restauracao do backup =====
rem
rem Usar quando o banco foi perdido ou corrompido. Devolve o sistema ao estado
rem do dia do backup escolhido.
rem
rem   restaurar.bat                        -> usa o backup mais recente
rem   restaurar.bat qualidade-2026-09-14_02-00.sql
rem
rem ATENCAO: o banco atual e APAGADO e trocado pelo do backup. Tudo que foi
rem lancado depois daquele backup se perde. Por isso o script pede que se
rem digite RESTAURAR por extenso - nao existe desfazer.
rem
rem Os arquivos anexados sao apenas COMPLETADOS, nunca apagados: o que estiver
rem na pasta uploads e mais novo que o backup continua onde esta.

echo(
echo ============================================================
echo   Sistema de Qualidade (SQE) - RESTAURACAO DE BACKUP
echo ============================================================
echo(

if not exist "%CONFIG%\pgport.txt" (
  echo [ERRO] Sistema nunca foi iniciado neste servidor. Rode start.bat antes.
  goto :fim
)
set /p PGPORT=<"%CONFIG%\pgport.txt"

rem ---- 1) Escolhe o arquivo --------------------------------------------
if not "%~1"=="" (
  set "ARQ=%DESTINO%\%~nx1"
  if not exist "!ARQ!" set "ARQ=%~f1"
) else (
  rem Sem argumento: pega o dump mais recente da pasta de backups.
  for /f "delims=" %%F in ('dir /b /o-d "%DESTINO%\qualidade-*.sql" 2^>nul') do (
    if not defined ARQ set "ARQ=%DESTINO%\%%F"
  )
)

if not defined ARQ (
  echo [ERRO] Nenhum backup encontrado em %DESTINO%
  goto :fim
)
if not exist "%ARQ%" (
  echo [ERRO] Backup nao encontrado: %ARQ%
  goto :fim
)

findstr /c:"PostgreSQL database dump complete" "%ARQ%" >nul
if errorlevel 1 (
  echo [ERRO] Este arquivo nao e um backup completo e nao sera usado:
  echo        %ARQ%
  goto :fim
)

echo Backup escolhido: %ARQ%
for %%A in ("%ARQ%") do echo Gravado em:       %%~tA
echo(
echo Isto APAGA o banco de dados atual e coloca o do backup no lugar.
echo Tudo que foi lancado no sistema depois dessa data sera perdido.
echo(
set "CONFIRMA="
set /p CONFIRMA=Para continuar, digite RESTAURAR e tecle Enter:
if /i not "%CONFIRMA%"=="RESTAURAR" (
  echo(
  echo Cancelado. Nada foi alterado.
  goto :fim
)

rem ---- 2) Para o sistema (o banco nao troca com gente conectada) --------
echo(
echo Parando o sistema...
taskkill /IM node.exe /F >nul 2>&1

rem ---- 3) Guarda o banco atual antes de apagar --------------------------
rem Rede de seguranca do proprio socorro: se a restauracao for do arquivo
rem errado, ainda existe de onde voltar.
for /f %%D in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "STAMP=%%D"
set "ANTES=%DESTINO%\antes-de-restaurar-%STAMP%.sql"
echo Guardando o banco atual em: %ANTES%
"%PGBIN%\pg_dump.exe" -h 127.0.0.1 -p %PGPORT% -U qualidade -f "%ANTES%" qualidade >nul 2>&1

rem ---- 4) Recria o banco vazio e carrega o backup -----------------------
echo Recriando o banco...
"%PGBIN%\dropdb.exe" -h 127.0.0.1 -p %PGPORT% -U qualidade --if-exists qualidade
if errorlevel 1 (
  echo [ERRO] Nao foi possivel apagar o banco atual. Feche o sistema e tente de novo.
  goto :fim
)
"%PGBIN%\createdb.exe" -h 127.0.0.1 -p %PGPORT% -U qualidade qualidade
if errorlevel 1 (
  echo [ERRO] Nao foi possivel criar o banco.
  goto :fim
)

echo Carregando o backup...
"%PGBIN%\psql.exe" -h 127.0.0.1 -p %PGPORT% -U qualidade -d qualidade -v ON_ERROR_STOP=1 -f "%ARQ%" >"%BASE%\logs\restauracao.log" 2>&1
if errorlevel 1 (
  echo [ERRO] Falha ao carregar o backup. Detalhes em logs\restauracao.log
  echo        O banco de antes esta salvo em: %ANTES%
  goto :fim
)

rem ---- 5) Devolve os arquivos anexados que faltarem ---------------------
if exist "%DESTINO%\anexos" (
  echo Repondo os arquivos anexados...
  if not exist "%ANEXOS%" mkdir "%ANEXOS%"
  robocopy "%DESTINO%\anexos" "%ANEXOS%" /E /XO /R:2 /W:2 /NFL /NDL /NP >nul
  if errorlevel 8 echo [AVISO] Alguns arquivos anexados nao puderam ser copiados.
)

echo(
echo ============================================================
echo   RESTAURACAO CONCLUIDA.
echo   Rode start.bat para subir o sistema.
echo ============================================================

:fim
echo(
pause
endlocal
