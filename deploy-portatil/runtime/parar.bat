@echo off
setlocal enableextensions
cd /d "%~dp0"
set "BASE=%cd%"
set "PGBIN=%BASE%\pgsql\bin"
set "PGDATA=%BASE%\dados\pgdata"

echo Parando o Sistema de Qualidade (SQE)...

rem Encerra o sistema (backend Node)
taskkill /IM node.exe /F >nul 2>&1

rem Encerra o banco de dados
if exist "%PGDATA%\PG_VERSION" (
  "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -m fast stop >nul 2>&1
)

echo Sistema parado.
echo (Ele voltara a subir sozinho no proximo reinicio do servidor.)
timeout /t 3 >nul
endlocal
