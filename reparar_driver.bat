@echo off
title SmartDom Kiosco - Reparar driver SecuGen
color 0E
setlocal enabledelayedexpansion

echo.
echo  ============================================================
echo   REPARAR DRIVER SECUGEN
echo   Usar cuando el lector aparece con error 28 en el
echo   Administrador de dispositivos (o diagnostico dice FALTA_LECTOR
echo   con el lector enchufado).
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
if "%ARCH%"=="x64" (set DRIVER_MSI=sgdrvsetupu20x64.msi) else (set DRIVER_MSI=sgdrvsetupu20x86.msi)
echo  Arquitectura: %ARCH%   MSI: %DRIVER_MSI%
echo.

:: -- PASO 1: extraer los INF del MSI -----------------------------------------
echo  [1/3] Extrayendo los INF del MSI...
if not exist "%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip" (
    echo        [ERROR] Falta drivers\WinDrivers_v3001_Installer.zip junto a este script.
    pause & exit /b 1
)

set ZIPTMP=%TEMP%\SecuGenDrvZip
set ADMTMP=%TEMP%\SecuGenDrvAdm
if exist "%ZIPTMP%" rmdir /s /q "%ZIPTMP%"
if exist "%ADMTMP%" rmdir /s /q "%ADMTMP%"

powershell -NoProfile -Command "Expand-Archive -Path '%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip' -DestinationPath '%ZIPTMP%' -Force"

set MSIPATH=
for /r "%ZIPTMP%" %%f in (%DRIVER_MSI%) do set MSIPATH=%%f
if not defined MSIPATH (
    echo        [ERROR] No se encontro %DRIVER_MSI% dentro del zip.
    pause & exit /b 1
)

msiexec /a "!MSIPATH!" /qn TARGETDIR="%ADMTMP%"
ping -n 21 127.0.0.1 >nul
echo        Listo.
echo.

:: -- PASO 2: registrar los INF en el almacen de drivers ----------------------
echo  [2/3] Registrando drivers en el almacen de Windows...
set INFCOUNT=0
for /r "%ADMTMP%" %%f in (*.inf) do (
    echo        + %%~nxf
    pnputil /add-driver "%%f" /install >nul 2>&1
    set /a INFCOUNT+=1
)
pnputil /scan-devices >nul 2>&1

if !INFCOUNT!==0 (
    echo        [ERROR] No se extrajo ningun INF. Revisar el MSI.
    pause & exit /b 1
)
echo        !INFCOUNT! INF registrados.
rmdir /s /q "%ZIPTMP%" 2>nul
rmdir /s /q "%ADMTMP%" 2>nul
echo.

:: -- PASO 3: verificar --------------------------------------------------------
echo  [3/3] Estado del lector:
echo.
powershell -NoProfile -Command "$d = Get-PnpDevice | Where-Object { $_.InstanceId -match 'VID_1162' }; if (-not $d) { Write-Host '       No hay ningun lector SecuGen enchufado.' -ForegroundColor Yellow } else { $d | Format-Table Status, Class, FriendlyName -AutoSize }"
echo.
echo  ============================================================
echo   Si el lector sigue en Error: desenchufalo, espera 5 segundos
echo   y volve a enchufarlo (en un USB trasero, sin hub). Despues
echo   corre diagnostico.bat.
echo  ============================================================
echo.
pause
endlocal
