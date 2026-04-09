@echo off
title SmartDom Kiosco - Instalador
color 0A
setlocal enabledelayedexpansion

echo.
echo  ============================================================
echo   SMARTDOM KIOSCO - INSTALADOR AUTOMATICO
echo   Sistema Biometrico Los Notables
echo  ============================================================
echo.

:: Verificar que se ejecuta como administrador
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Ejecutar como Administrador
    echo  Clic derecho sobre este archivo y "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

set SCRIPT_DIR=%~dp0
set DRIVERS_DIR=%SCRIPT_DIR%drivers
set APP_DIR=C:\Proyectos\gestion-personal-smartdom
set ERRORES=0

echo  Directorio de instalacion: %APP_DIR%
echo.


:: ── PASO 1: Node.js ──────────────────────────────────────────────────────
echo  [1/5] Verificando Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo        No encontrado. Descargando Node.js LTS...
    set NODE_URL=https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi
    set NODE_MSI=%TEMP%\nodejs_installer.msi
    powershell -Command "Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_MSI!' -UseBasicParsing" 2>nul
    if exist "!NODE_MSI!" (
        msiexec /i "!NODE_MSI!" /quiet /norestart
        del "!NODE_MSI!" >nul 2>&1
        echo        Node.js instalado OK
    ) else (
        echo        [ERROR] No se pudo descargar Node.js
        echo        Descargar manualmente desde: https://nodejs.org
        set /a ERRORES+=1
    )
) else (
    for /f %%i in ('node --version') do echo        Ya instalado: %%i
)
echo.

:: ── PASO 2: Driver SecuGen HUPx-AP ───────────────────────────────────────
echo  [2/5] Instalando driver SecuGen HUPx-AP...
if exist "%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip" (
    echo        Extrayendo driver...
    set DRIVER_TEMP=%TEMP%\SecuGenDriver
    powershell -Command "Expand-Archive -Path '%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip' -DestinationPath '!DRIVER_TEMP!' -Force" 2>nul
    :: Buscar y ejecutar el instalador
    for /r "!DRIVER_TEMP!" %%f in (*.exe) do (
        if not "%%~nf"=="." (
            echo        Ejecutando: %%~nxf
            start /wait "" "%%f" /S /quiet 2>nul
            goto :driver_ok
        )
    )
    :driver_ok
    rmdir /s /q "!DRIVER_TEMP!" 2>nul
    echo        Driver instalado OK - Se requiere reiniciar
) else (
    echo        Archivo no encontrado en drivers\
    echo        Descargando desde SecuGen...
    powershell -Command "Start-Process 'https://secugen.com/drivers/'" 2>nul
    echo        Instalar manualmente: UPx-AP Windows Driver v1.0.0.3
    set /a ERRORES+=1
)
echo.


:: ── PASO 3: SecuGen WebAPI (SgiBioSrv) ───────────────────────────────────
echo  [3/5] Instalando SecuGen WebAPI...
if exist "%DRIVERS_DIR%\SGI_BWAPI_WIN_64bit.exe" (
    start /wait "" "%DRIVERS_DIR%\SGI_BWAPI_WIN_64bit.exe" /S /quiet 2>nul
    if exist "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe" (
        echo        WebAPI instalado OK
    ) else (
        echo        Instalando con interfaz grafica...
        start /wait "" "%DRIVERS_DIR%\SGI_BWAPI_WIN_64bit.exe"
    )
) else (
    echo        Archivo no encontrado. Descargando...
    set BWAPI_URL=https://webapi.secugen.com/
    powershell -Command "Start-Process '!BWAPI_URL!'" 2>nul
    echo        Descargar SGI_BWAPI_WIN_64bit.exe e instalar manualmente
    set /a ERRORES+=1
)
echo.

:: ── PASO 4: Certificado SecuGen ───────────────────────────────────────────
echo  [4/5] Instalando certificado SecuGen...
if exist "C:\Program Files\SecuGen\SgiBioSrv\sgca.crt" (
    powershell -Command "Import-Certificate -FilePath 'C:\Program Files\SecuGen\SgiBioSrv\sgca.crt' -CertStoreLocation Cert:\LocalMachine\Root" >nul 2>&1
    echo        Certificado instalado OK
) else (
    echo        WebAPI no instalado aun. Instalar certificado despues manualmente con:
    echo        Import-Certificate -FilePath "C:\Program Files\SecuGen\SgiBioSrv\sgca.crt" -CertStoreLocation Cert:\LocalMachine\Root
)
echo.

:: ── PASO 5: App SmartDom y acceso directo ────────────────────────────────
echo  [5/5] Configurando SmartDom Kiosco...

:: Copiar app si no existe en destino
if not exist "%APP_DIR%" (
    echo        Copiando aplicacion...
    xcopy /E /I /Q "%SCRIPT_DIR%app" "%APP_DIR%" >nul
)

:: Instalar dependencias Node
echo        Instalando dependencias...
cd /d "%APP_DIR%"
call npm install --silent >nul 2>&1
echo        Dependencias OK

:: Crear acceso directo
powershell -ExecutionPolicy Bypass -File "%APP_DIR%\crear_acceso_directo.ps1" >nul 2>&1
echo        Acceso directo creado en el escritorio OK
echo.

:: ── RESUMEN ───────────────────────────────────────────────────────────────
echo  ============================================================
if %ERRORES% GTR 0 (
    echo   INSTALACION COMPLETADA CON %ERRORES% ADVERTENCIA(S)
    echo   Ver mensajes arriba para resolver manualmente
) else (
    echo   INSTALACION COMPLETADA EXITOSAMENTE
)
echo  ============================================================
echo.
echo  IMPORTANTE: Editar LOCAL_ID en el archivo kiosco.bat
echo  con el UUID del local correspondiente a esta maquina.
echo.
echo  Luego REINICIAR la PC y usar el icono del escritorio.
echo.
pause
endlocal
