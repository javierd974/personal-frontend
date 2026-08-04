@echo off
title SmartDom Kiosco - Reparar SecuGen WebAPI
color 0E
setlocal enabledelayedexpansion

echo.
echo  ============================================================
echo   REPARAR SECUGEN WEBAPI
echo   Usar cuando el instalador quedo a medias por el aviso
echo   "applications are using files that need to be updated".
echo  ============================================================
echo.

net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Ejecutar como Administrador.
    pause & exit /b 1
)

set SCRIPT_DIR=%~dp0
set DRIVERS_DIR=%SCRIPT_DIR%drivers

set ARCH=x86
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" set ARCH=x64
if "%PROCESSOR_ARCHITEW6432%"=="AMD64" set ARCH=x64
if "%ARCH%"=="x64" (set BWAPI_FILE=SGI_BWAPI_WIN_64bit.exe) else (set BWAPI_FILE=SGI_BWAPI_WIN_32bit.exe)
echo  Arquitectura: %ARCH%   Instalador: %BWAPI_FILE%
echo.

:: -- PASO 1: bajar servicio y proceso ---------------------------------------
echo  [1/4] Deteniendo servicio y proceso de SecuGen...
powershell -NoProfile -Command "Get-Service | Where-Object { $_.DisplayName -match 'SecuGen' -or $_.Name -match 'sgibio|secugen' } | ForEach-Object { Write-Host ('       servicio: ' + $_.Name + ' (' + $_.Status + ')'); Stop-Service -Name $_.Name -Force -ErrorAction SilentlyContinue }"
sc stop SgiBioSrv >nul 2>&1
taskkill /F /IM sgibiosrv.exe >nul 2>&1
ping -n 4 127.0.0.1 >nul
echo        Detenido.
echo.

:: -- PASO 2: desinstalar la version rota -------------------------------------
echo  [2/4] Desinstalando la instalacion incompleta...
set DESINST=0
for %%D in ("C:\Program Files\SecuGen\SgiBioSrv" "C:\Program Files (x86)\SecuGen\SgiBioSrv") do (
    if exist "%%~D\unins000.exe" (
        echo        Desinstalando desde %%~D ...
        start /wait "" "%%~D\unins000.exe" /VERYSILENT /NORESTART
        set DESINST=1
    )
)
if "!DESINST!"=="0" echo        No habia desinstalador; sigo igual.
taskkill /F /IM sgibiosrv.exe >nul 2>&1
ping -n 6 127.0.0.1 >nul
echo.

:: -- PASO 3: instalar de nuevo, limpio ---------------------------------------
echo  [3/4] Instalando el WebAPI de cero...
if not exist "%DRIVERS_DIR%\%BWAPI_FILE%" (
    echo        [ERROR] Falta drivers\%BWAPI_FILE% junto a este script.
    pause & exit /b 1
)
start /wait "" "%DRIVERS_DIR%\%BWAPI_FILE%" /SP- /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS

set "SGDIR="
if exist "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe" set "SGDIR=C:\Program Files\SecuGen\SgiBioSrv"
if exist "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgibiosrv.exe" set "SGDIR=C:\Program Files (x86)\SecuGen\SgiBioSrv"
if not defined SGDIR (
    echo        [ERROR] Sigue sin instalarse. Reiniciar la PC y correr este
    echo        script de nuevo ANTES de abrir el kiosco.
    pause & exit /b 1
)
echo        Instalado en !SGDIR!

:: Certificado en la raiz de confianza
if exist "!SGDIR!\sgca.crt" (
    certutil -addstore "Root" "!SGDIR!\sgca.crt" >nul 2>&1
    echo        Certificado sgca.crt instalado.
)
echo.

:: -- PASO 4: diagnostico (levanta 8443 si quedo en 8000) ---------------------
echo  [4/4] Verificando el lector y el WebAPI en 8443...
if exist "%SCRIPT_DIR%diagnostico.ps1" (
    powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%diagnostico.ps1"
) else (
    netstat -ano ^| findstr ":8443"
)
echo.
echo  ============================================================
echo   Si el diagnostico dice LECTOR OK, abri el icono del kiosco.
echo   Si no, reinicia la PC y corre diagnostico.bat como admin.
echo  ============================================================
echo.
pause
endlocal
