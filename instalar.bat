@echo off
title SmartDom Kiosco - Instalador (modelo URL de produccion)
color 0A
setlocal enabledelayedexpansion

echo.
echo  ============================================================
echo   SMARTDOM KIOSCO - INSTALADOR
echo   Sistema Biometrico Los Notables
echo   (Driver SecuGen + WebAPI + acceso directo al kiosco)
echo  ============================================================
echo.

:: -- Verificar administrador -------------------------------------------------
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Ejecutar como Administrador.
    echo  Clic derecho sobre "instalar.bat" y "Ejecutar como administrador".
    pause & exit /b 1
)

set SCRIPT_DIR=%~dp0
set DRIVERS_DIR=%SCRIPT_DIR%drivers
set INSTALL_DIR=C:\SmartDomKiosco
set ERRORES=0

:: -- Detectar arquitectura ---------------------------------------------------
set ARCH=x86
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" set ARCH=x64
if "%PROCESSOR_ARCHITEW6432%"=="AMD64" set ARCH=x64
echo  Arquitectura detectada: %ARCH%

if "%ARCH%"=="x64" (
    set BWAPI_FILE=SGI_BWAPI_WIN_64bit.exe
    set DRIVER_MSI=sgdrvsetupu20x64.msi
) else (
    set BWAPI_FILE=SGI_BWAPI_WIN_32bit.exe
    set DRIVER_MSI=sgdrvsetupu20x86.msi
)
echo.

:: -- PASO 1: Driver SecuGen ---------------------------------------------------
echo  [1/5] Instalando driver SecuGen (%DRIVER_MSI%)...
if exist "%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip" (
    set DRIVER_TEMP=%TEMP%\SecuGenDriver
    if exist "!DRIVER_TEMP!" rmdir /s /q "!DRIVER_TEMP!"
    powershell -NoProfile -Command "Add-Type -Assembly 'System.IO.Compression.FileSystem'; [System.IO.Compression.ZipFile]::ExtractToDirectory('%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip', '!DRIVER_TEMP!')" 2>nul
    set MSIPATH=
    for /r "!DRIVER_TEMP!" %%f in (%DRIVER_MSI%) do set MSIPATH=%%f
    if defined MSIPATH (
        msiexec /i "!MSIPATH!" /qn /norestart
        echo        Driver instalado.
    ) else (
        echo        [ERROR] No se encontro %DRIVER_MSI% dentro del zip.
        set /a ERRORES+=1
    )
    rmdir /s /q "!DRIVER_TEMP!" 2>nul
) else (
    echo        [ERROR] Falta drivers\WinDrivers_v3001_Installer.zip
    set /a ERRORES+=1
)
echo.

:: -- PASO 2: WebAPI SecuGen ---------------------------------------------------
echo  [2/5] Instalando SecuGen WebAPI (%BWAPI_FILE%)...
echo        NOTA: puede abrirse una ventana del asistente. Segui los pasos y,
echo        si aparece un error de "close applications", elegi
echo        "Ignore the error and continue".
if exist "%DRIVERS_DIR%\%BWAPI_FILE%" (
    start /wait "" "%DRIVERS_DIR%\%BWAPI_FILE%"
    if exist "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe" (
        echo        WebAPI instalado [64bit].
    ) else if exist "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgibiosrv.exe" (
        echo        WebAPI instalado [32bit].
    ) else (
        echo        [ADVERTENCIA] No se detecto sgibiosrv tras la instalacion.
        set /a ERRORES+=1
    )
) else (
    echo        [ERROR] Falta drivers\%BWAPI_FILE%
    set /a ERRORES+=1
)
echo.

:: -- PASO 3: Certificado ------------------------------------------------------
echo  [3/5] Instalando certificado SecuGen...
set CERT_PATH=
if exist "C:\Program Files\SecuGen\SgiBioSrv\sgca.crt" set CERT_PATH=C:\Program Files\SecuGen\SgiBioSrv\sgca.crt
if exist "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgca.crt" set CERT_PATH=C:\Program Files (x86)\SecuGen\SgiBioSrv\sgca.crt
if defined CERT_PATH (
    certutil -addstore "Root" "!CERT_PATH!" >nul 2>&1
    echo        Certificado instalado en la raiz de confianza.
) else (
    echo        [ADVERTENCIA] No se encontro sgca.crt. Instalar el WebAPI primero.
    set /a ERRORES+=1
)
echo.

:: -- PASO 4: Copiar lanzador y elegir local ----------------------------------
echo  [4/5] Configurando el kiosco...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /Y "%SCRIPT_DIR%kiosco.bat" "%INSTALL_DIR%\kiosco.bat" >nul

echo.
echo   Elegi el LOCAL de esta PC:
echo.
set NOMBRE_1=Cao&        set UUID_1=f2c46927-4759-40fe-8b32-f8df08a3a90f
set NOMBRE_2=Celta&      set UUID_2=61f1a919-4f85-4da8-9f81-71a2835e41ef
set NOMBRE_3=Cortazar&   set UUID_3=9ab2f3c0-b05e-43cc-8c19-d9cbbf93c1fe
set NOMBRE_4=Deposito&   set UUID_4=df218cef-def2-4f69-bc3b-64b06b6fd200
set NOMBRE_5=Dorrego&    set UUID_5=543a91dc-3f00-4d02-866a-5fed9e02b089
set NOMBRE_6=El Octavo&  set UUID_6=f31f650a-1f20-421f-8233-f32008ea1c18
set NOMBRE_7=Federal&    set UUID_7=efa521ad-b5fd-44e4-809b-2a8f48e747a8
set NOMBRE_8=Hipopotamo& set UUID_8=bda52bba-5fb7-4a5e-897f-8d37eb8f52f2
set NOMBRE_9=Lavalle&    set UUID_9=ad179865-e087-4a67-b923-1f9713c842d6
set NOMBRE_10=Margot&    set UUID_10=f23f85f1-f741-4ce7-9c72-9ab995aa12d6
set NOMBRE_11=Miramar&   set UUID_11=399e8bd2-b1ad-44b7-b0e6-c793ba323068
set NOMBRE_12=Oficina&   set UUID_12=c18343eb-acf8-4aa1-abe7-c4674c25f8a8
set NOMBRE_13=Pasteleria&set UUID_13=c3da51f5-e1e8-40fd-83fb-36cee9576e2b
set NOMBRE_14=Poesia&    set UUID_14=2d9ee9f4-894b-415a-9180-3ad0605909ec
set NOMBRE_15=Zarpada&   set UUID_15=f34b617c-33e4-4e83-9d25-f0c114837881

for /l %%i in (1,1,15) do echo     %%i^) !NOMBRE_%%i!
echo.
set /p LOCNUM=  Numero de local (1-15):

set SELUUID=!UUID_%LOCNUM%!
set SELNOMBRE=!NOMBRE_%LOCNUM%!
if not defined SELUUID (
    echo        [ADVERTENCIA] Opcion invalida. Vas a tener que editar el LOCAL_ID a mano
    echo        en %INSTALL_DIR%\kiosco.bat (ver LEER_PRIMERO.txt).
) else (
    powershell -NoProfile -Command "(Get-Content '%INSTALL_DIR%\kiosco.bat') -replace '__LOCAL_ID__','!SELUUID!' | Set-Content -Encoding ASCII '%INSTALL_DIR%\kiosco.bat'"
    echo        Local seleccionado: !SELNOMBRE!  ^(!SELUUID!^)
)
echo.

:: -- PASO 5: Acceso directo + chequeo de Chrome ------------------------------
echo  [5/5] Creando acceso directo en el escritorio...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%crear_acceso_directo.ps1" >nul 2>&1
echo        Icono "SmartDom Kiosco" creado.

set CHROME_OK=0
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set CHROME_OK=1
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set CHROME_OK=1
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set CHROME_OK=1
if "%CHROME_OK%"=="0" (
    echo        [ADVERTENCIA] No se encontro Google Chrome. Instalalo para el modo kiosco
    echo        ^(en Windows 7 usar la ultima version compatible, Chrome 109^).
)
echo.

:: -- RESUMEN -----------------------------------------------------------------
echo  ============================================================
if %ERRORES% GTR 0 (
    echo   COMPLETADO CON %ERRORES% ADVERTENCIA^(S^) - revisar arriba
) else (
    echo   INSTALACION COMPLETADA
)
echo  ============================================================
echo.
echo  Probar: doble clic en el icono "SmartDom Kiosco" del escritorio.
echo  Para salir del modo kiosco de Chrome: Alt+F4.
echo.
pause
endlocal
