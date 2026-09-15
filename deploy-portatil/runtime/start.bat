@echo off
setlocal enableextensions enabledelayedexpansion
cd /d "%~dp0"
set "BASE=%cd%"

rem ===== Sistema de Qualidade (SQE) - Build A (portatil, sem instalacao) =====
rem Sobe o PostgreSQL portatil e o sistema, escolhendo portas livres.

set "NODE=%BASE%\node\node.exe"
set "PGBIN=%BASE%\pgsql\bin"
set "PGDATA=%BASE%\dados\pgdata"
set "APPDIR=%BASE%\app"
set "LOGS=%BASE%\logs"
set "CONFIG=%BASE%\config"

if not exist "%BASE%\dados"   mkdir "%BASE%\dados"
if not exist "%BASE%\uploads" mkdir "%BASE%\uploads"
if not exist "%BASE%\backups" mkdir "%BASE%\backups"
if not exist "%LOGS%"   mkdir "%LOGS%"
if not exist "%CONFIG%" mkdir "%CONFIG%"

echo(
echo ============================================================
echo   Sistema de Qualidade (SQE) - iniciando...
echo ============================================================

rem ---- 1) Chave JWT (gerada uma unica vez) ----
if not exist "%CONFIG%\jwt.txt" (
  "%NODE%" -e "console.log(require('crypto').randomBytes(48).toString('hex'))" > "%CONFIG%\jwt.txt"
)
set /p JWT_SECRET=<"%CONFIG%\jwt.txt"

rem ---- 2) Porta do banco (loopback), a partir de 55432 ----
for /f %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%BASE%\buscar-porta.ps1" -Inicio 55432') do set "PGPORT=%%P"
if exist "%CONFIG%\pgport.txt" set /p PGPORT=<"%CONFIG%\pgport.txt"
echo %PGPORT%> "%CONFIG%\pgport.txt"
echo   Banco de dados na porta interna: %PGPORT%

rem ---- 3) Inicializa o banco na primeira execucao ----
if not exist "%PGDATA%\PG_VERSION" (
  echo   Primeira execucao: preparando o banco de dados...
  "%PGBIN%\initdb.exe" -U qualidade -A trust -E UTF8 --locale=C -D "%PGDATA%" >> "%LOGS%\pg-init.log" 2>&1
)

rem ---- 4) Sobe o PostgreSQL (somente localhost) ----
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -o "-p %PGPORT% -c listen_addresses=127.0.0.1" -l "%LOGS%\pg.log" -w start
if errorlevel 1 (
  echo   [AVISO] Banco pode ja estar rodando. Continuando...
)

rem ---- 5) Garante o banco "qualidade" criado ----
"%PGBIN%\psql.exe" -h 127.0.0.1 -p %PGPORT% -U qualidade -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='qualidade'" | findstr "1" >nul
if errorlevel 1 (
  "%PGBIN%\createdb.exe" -h 127.0.0.1 -p %PGPORT% -U qualidade qualidade
  echo   Banco "qualidade" criado.
)

rem ---- 6) Porta do sistema (a que os usuarios acessam), a partir de 8090 ----
set "PORTA_INI=8090"
if exist "%CONFIG%\porta.txt" set /p PORTA_INI=<"%CONFIG%\porta.txt"
for /f %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%BASE%\buscar-porta.ps1" -Inicio %PORTA_INI%') do set "APPPORT=%%P"
echo %APPPORT%> "%CONFIG%\porta.txt"
echo   Sistema na porta: %APPPORT%

rem ---- 7) Variaveis do backend ----
set "DATABASE_URL=postgresql://qualidade:qualidade@127.0.0.1:%PGPORT%/qualidade?schema=public"
set "UPLOAD_DIR=%BASE%\uploads"
set "FRONTEND_DIR=%APPDIR%\public"
set "PORT=%APPPORT%"
set "NODE_ENV=production"

rem ---- 8) Cria/atualiza as tabelas e roda o seed inicial ----
cd /d "%APPDIR%"
echo   Preparando as tabelas do sistema...
"%NODE%" "%APPDIR%\node_modules\prisma\build\index.js" db push --skip-generate --accept-data-loss >> "%LOGS%\backend.log" 2>&1
"%NODE%" "%APPDIR%\dist\prisma\seed.js" >> "%LOGS%\backend.log" 2>&1

echo(
echo ============================================================
echo   PRONTO! Sistema disponivel na rede em:
echo       http://IP-DO-SERVIDOR:%APPPORT%
echo   (troque IP-DO-SERVIDOR pelo IP fixo do servidor)
echo ============================================================
echo(

rem ---- 9) Sobe o sistema (fica rodando nesta janela / tarefa) ----
"%NODE%" "%APPDIR%\dist\src\main.js" >> "%LOGS%\backend.log" 2>&1

endlocal
