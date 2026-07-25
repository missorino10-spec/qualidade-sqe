@echo off
rem Monta a Build A (pacote portatil). Rode no PC de desenvolvimento.
cd /d "%~dp0"
echo Montando a Build A do Sistema de Qualidade (SQE)...
echo Isso baixa Node + PostgreSQL portateis e compila o sistema (precisa de internet).
echo(
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0montar-build-a.ps1"
echo(
pause
