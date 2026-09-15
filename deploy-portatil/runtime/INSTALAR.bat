@echo off
setlocal enableextensions enabledelayedexpansion
cd /d "%~dp0"
set "BASE=%cd%"

rem ==========================================================================
rem  Sistema de Qualidade (SQE) - INSTALAR (executar UMA vez, como Administrador)
rem  Nao instala nada no Windows: apenas configura o auto-start, libera a porta
rem  na rede interna e sobe o sistema. Tudo roda de dentro desta pasta.
rem ==========================================================================

echo(
echo ============================================================
echo   Sistema de Qualidade (SQE) - Configuracao inicial
echo ============================================================
echo(

rem ---- Precisa de Administrador (para criar a tarefa e a regra de firewall) ----
net session >nul 2>&1
if errorlevel 1 (
  echo [ATENCAO] Este arquivo precisa ser executado como ADMINISTRADOR.
  echo Clique com o botao direito no INSTALAR.bat e escolha
  echo "Executar como administrador".
  echo(
  pause
  exit /b 1
)

rem ---- 1) Auto-start: sobe o sistema sozinho sempre que o servidor ligar ----
echo [1/4] Configurando o inicio automatico...
schtasks /Create /TN "QualidadeSQE" /TR "cmd /c \"%BASE%\start.bat\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F >nul
if errorlevel 1 (echo    [ERRO] Nao foi possivel criar a tarefa de inicio automatico.) else (echo    OK.)

rem ---- 2) Backup diario automatico (20:00) ----
echo [2/4] Configurando o backup diario (20:00)...
schtasks /Create /TN "QualidadeSQE-Backup" /TR "cmd /c \"%BASE%\backup.bat\"" /SC DAILY /ST 20:00 /RU SYSTEM /RL HIGHEST /F >nul
if errorlevel 1 (echo    [ERRO] Nao foi possivel criar a tarefa de backup.) else (echo    OK.)

rem ---- 3) Firewall: libera as portas 8090-8100 apenas na rede interna ----
echo [3/4] Liberando a porta na rede interna (firewall)...
netsh advfirewall firewall delete rule name="Qualidade SQE" >nul 2>&1
netsh advfirewall firewall add rule name="Qualidade SQE" dir=in action=allow protocol=TCP localport=8090-8100 profile=domain,private >nul
if errorlevel 1 (echo    [ERRO] Nao foi possivel criar a regra de firewall.) else (echo    OK.)

rem ---- 4) Sobe o sistema agora (sem esperar reiniciar) ----
echo [4/4] Iniciando o sistema agora...
start "Qualidade SQE" /min cmd /c "%BASE%\start.bat"

rem Aguarda o start escrever a porta escolhida
set "APPPORT=8090"
for /l %%i in (1,1,20) do (
  if exist "%BASE%\config\porta.txt" (
    set /p APPPORT=<"%BASE%\config\porta.txt"
    goto :tem_porta
  )
  timeout /t 1 >nul
)
:tem_porta

echo(
echo ============================================================
echo   TUDO PRONTO!
echo(
echo   O sistema ja esta no ar e subira sozinho a cada reinicio.
echo   Acesse pela rede interna em:
echo(
echo       http://IP-DO-SERVIDOR:%APPPORT%
echo(
echo   (troque IP-DO-SERVIDOR pelo IP fixo deste servidor)
echo   Login inicial: admin@bigdutchman.com.br  /  123456
echo ============================================================
echo(
pause
endlocal
