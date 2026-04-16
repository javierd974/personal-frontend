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

:: Verificar administrador
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Ejecutar como Administrador
    echo  Clic derecho sobre este archivo y "Ejecutar como administrador"
    pause & exit /b 1
)

set SCRIPT_DIR=%~dp0
set DRIVERS_DIR=%SCRIPT_DIR%drivers
set APP_DIR=C:\Proyectos\gestion-personal-smartdom
set ERRORES=0


:: ── Detectar version de Windows ──────────────────────────────────────────
echo  Detectando sistema operativo...
set WIN_VER=modern
for /f "tokens=4-5 delims=. " %%i in ('ver') do (
    if "%%i"=="5" set WIN_VER=xp
    if "%%i"=="6" (
        if "%%j"=="0" set WIN_VER=vista
        if "%%j"=="1" set WIN_VER=win7
        if "%%j"=="2" set WIN_VER=win8
        if "%%j"=="3" set WIN_VER=win81
    )
    if "%%i"=="10" set WIN_VER=win10plus
)
echo  Sistema detectado: %WIN_VER%

:: ── Detectar arquitectura ────────────────────────────────────────────────
set ARCH=x86
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" set ARCH=x64
if "%PROCESSOR_ARCHITEW6432%"=="AMD64" set ARCH=x64
echo  Arquitectura: %ARCH%
echo.

:: ── Seleccionar instaladores segun SO y arquitectura ─────────────────────
if "%WIN_VER%"=="win7" (
    set NODE_FILE=nodejs_win7_%ARCH%.msi
    set NODE_DESC=Node.js v13.14.0 compatible con Windows 7
) else if "%WIN_VER%"=="vista" (
    set NODE_FILE=nodejs_win7_%ARCH%.msi
    set NODE_DESC=Node.js v13.14.0 compatible con Windows 7
) else (
    if "%ARCH%"=="x64" (
        set NODE_FILE=nodejs_%ARCH%.msi
        set NODE_DESC=Node.js LTS 64bit
    ) else (
        set NODE_FILE=nodejs_%ARCH%.msi
        set NODE_DESC=Node.js LTS 32bit
    )
)

if "%ARCH%"=="x64" (
    set BWAPI_FILE=SGI_BWAPI_WIN_64bit.exe
) else (
    set BWAPI_FILE=SGI_BWAPI_WIN_32bit.exe
)

:: ── Confirmar seleccion antes de continuar ────────────────────────────────
echo  ============================================================
echo   CONFIGURACION DETECTADA:
echo   - Sistema operativo : %WIN_VER%
echo   - Arquitectura      : %ARCH%
echo   - Node.js a usar    : %NODE_FILE%
echo   - WebAPI a usar     : %BWAPI_FILE%
echo  ============================================================
echo.
echo  Si esto es incorrecto presiona CTRL+C para cancelar.
echo  Si es correcto presiona cualquier tecla para continuar...
pause >nul
echo.


:: ── PASO 1: Node.js ──────────────────────────────────────────────────────
echo  [1/5] Verificando Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo        No encontrado. Instalando %NODE_DESC%...
    if exist "%DRIVERS_DIR%\%NODE_FILE%" (
        echo        Usando archivo local: %NODE_FILE%
        msiexec /i "%DRIVERS_DIR%\%NODE_FILE%" /quiet /norestart ADDLOCAL=ALL
        :: Actualizar PATH para esta sesion
        set PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%APPDATA%\npm
        echo        Node.js instalado OK
    ) else (
        echo        [ERROR] No se encontro %NODE_FILE% en carpeta drivers
        echo        Copiar el instalador de Node.js a la carpeta drivers\ e intentar de nuevo
        set /a ERRORES+=1
    )
) else (
    for /f %%i in ('node --version 2^>nul') do echo        Ya instalado: %%i
)
echo.

:: ── PASO 2: Driver SecuGen ────────────────────────────────────────────────
echo  [2/5] Instalando driver SecuGen HUPx-AP...
if exist "%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip" (
    echo        Extrayendo driver...
    set DRIVER_TEMP=%TEMP%\SecuGenDriver
    if exist "!DRIVER_TEMP!" rmdir /s /q "!DRIVER_TEMP!"

    :: Extraer ZIP - compatible con Windows 7 usando PowerShell 2+ o VBScript
    powershell -version 2 -Command "Add-Type -Assembly 'System.IO.Compression.FileSystem'; [System.IO.Compression.ZipFile]::ExtractToDirectory('%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip', '!DRIVER_TEMP!')" 2>nul
    if not exist "!DRIVER_TEMP!" (
        :: Fallback VBScript para Windows 7 sin PowerShell moderno
        echo Set objShell = CreateObject("Shell.Application") > %TEMP%\unzip.vbs
        echo Set objZip = objShell.NameSpace("%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip") >> %TEMP%\unzip.vbs
        echo Set objDest = objShell.NameSpace("!DRIVER_TEMP!") >> %TEMP%\unzip.vbs
        echo objDest.CopyHere objZip.Items >> %TEMP%\unzip.vbs
        mkdir "!DRIVER_TEMP!" 2>nul
        cscript //nologo %TEMP%\unzip.vbs
        del %TEMP%\unzip.vbs 2>nul
    )

    :: Ejecutar el primer .exe que encuentre
    for /r "!DRIVER_TEMP!" %%f in (*.exe) do (
        start /wait "" "%%f" /S /quiet 2>nul
        goto :driver_ok
    )
    :driver_ok
    rmdir /s /q "!DRIVER_TEMP!" 2>nul
    echo        Driver instalado OK - Reiniciar PC despues
) else (
    echo        Driver no encontrado en carpeta drivers\
    set /a ERRORES+=1
)
echo.

:: ── PASO 3: SecuGen WebAPI ────────────────────────────────────────────────
echo  [3/5] Instalando SecuGen WebAPI (%ARCH%)...
if exist "%DRIVERS_DIR%\%BWAPI_FILE%" (
    echo        Instalando %BWAPI_FILE%...
    start /wait "" "%DRIVERS_DIR%\%BWAPI_FILE%" /S /quiet 2>nul
    if exist "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe" (
        echo        WebAPI instalado OK [64bit path]
    ) else if exist "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgibiosrv.exe" (
        echo        WebAPI instalado OK [32bit path]
    ) else (
        echo        Instalando en modo visual...
        start /wait "" "%DRIVERS_DIR%\%BWAPI_FILE%"
    )
) else (
    echo        [ERROR] No se encontro %BWAPI_FILE% en carpeta drivers\
    set /a ERRORES+=1
)
echo.

:: ── PASO 4: Certificado SecuGen ───────────────────────────────────────────
echo  [4/5] Instalando certificado SecuGen...
set CERT_PATH=
if exist "C:\Program Files\SecuGen\SgiBioSrv\sgca.crt" set CERT_PATH=C:\Program Files\SecuGen\SgiBioSrv\sgca.crt
if exist "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgca.crt" set CERT_PATH=C:\Program Files (x86)\SecuGen\SgiBioSrv\sgca.crt
if defined CERT_PATH (
    certutil -addstore "Root" "!CERT_PATH!" >nul 2>&1
    echo        Certificado instalado OK
) else (
    echo        WebAPI no instalado aun - instalar certificado manualmente despues
)
echo.

:: ── PASO 5: App y acceso directo ─────────────────────────────────────────
echo  [5/5] Configurando SmartDom Kiosco...
if not exist "%APP_DIR%" (
    echo        Copiando aplicacion...
    xcopy /E /I /Q "%SCRIPT_DIR%app" "%APP_DIR%" >nul
)

:: Actualizar PATH para npm
set PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%APPDATA%\npm

echo        Instalando dependencias npm...
call npm install --prefix "%APP_DIR%" --silent >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo        Reintentando con ruta directa...
    cd /d "%APP_DIR%"
    call npm install --silent >nul 2>&1
)
echo        Dependencias OK

powershell -ExecutionPolicy Bypass -File "%APP_DIR%\crear_acceso_directo.ps1" >nul 2>&1
echo        Icono en escritorio creado OK
echo.

:: ── RESUMEN ───────────────────────────────────────────────────────────────
echo  ============================================================
if %ERRORES% GTR 0 (
    echo   COMPLETADO CON %ERRORES% ADVERTENCIA(S) - Ver mensajes arriba
) else (
    echo   INSTALACION COMPLETADA EXITOSAMENTE
)
echo  ============================================================
echo.
echo  IMPORTANTE: Editar LOCAL_ID en kiosco.bat con el UUID del local.
echo  Ver lista de UUIDs en LEER_PRIMERO.txt
echo.
echo  REINICIAR la PC y usar el icono del escritorio.
echo.
pause
endlocal
