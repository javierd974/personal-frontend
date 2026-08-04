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
    set VCREDIST=vc_redist.x64.exe
) else (
    set BWAPI_FILE=SGI_BWAPI_WIN_32bit.exe
    set DRIVER_MSI=sgdrvsetupu20x86.msi
    set VCREDIST=vc_redist.x86.exe
)
echo.

:: -- PASO 0: Visual C++ Runtime (UCRT) ---------------------------------------
:: Necesario para que sgibiosrv arranque. Windows 7 y equipos sin actualizar
:: NO traen api-ms-win-crt-*.dll; sin esto el WebAPI no inicia.
echo  [1/6] Instalando Visual C++ Runtime (%VCREDIST%)...
if exist "%DRIVERS_DIR%\%VCREDIST%" (
    "%DRIVERS_DIR%\%VCREDIST%" /install /quiet /norestart
    echo        Runtime instalado ^(o ya presente^).
) else (
    echo        [ADVERTENCIA] Falta drivers\%VCREDIST% - si sgibiosrv no arranca,
    echo        instalar el Visual C++ Redistributable manualmente.
)
echo.

:: -- PASO 1: Driver SecuGen ---------------------------------------------------
echo  [2/6] Instalando driver SecuGen (%DRIVER_MSI%)...
if exist "%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip" (
    set DRIVER_TEMP=%TEMP%\SecuGenDriver
    if exist "!DRIVER_TEMP!" rmdir /s /q "!DRIVER_TEMP!"
    powershell -NoProfile -Command "Add-Type -Assembly 'System.IO.Compression.FileSystem'; [System.IO.Compression.ZipFile]::ExtractToDirectory('%DRIVERS_DIR%\WinDrivers_v3001_Installer.zip', '!DRIVER_TEMP!')" 2>nul
    set MSIPATH=
    for /r "!DRIVER_TEMP!" %%f in (%DRIVER_MSI%) do set MSIPATH=%%f
    if defined MSIPATH (
        msiexec /i "!MSIPATH!" /qn /norestart

        :: Registrar los INF en el almacen de drivers de Windows.
        :: OJO: los INF NO estan sueltos en el zip (ahi solo hay MSI + PDF);
        :: estan DENTRO del MSI. Por eso hay que hacer una instalacion
        :: administrativa (msiexec /a) que los extrae, y recien ahi correr
        :: pnputil. Sin esto el lector queda con error 28 (CM_PROB_FAILED_INSTALL):
        :: los archivos se copian pero ningun driver queda registrado.
        set DRIVER_ADMIN=%TEMP%\SecuGenDriverAdmin
        if exist "!DRIVER_ADMIN!" rmdir /s /q "!DRIVER_ADMIN!"
        echo        Extrayendo los INF del MSI...
        msiexec /a "!MSIPATH!" /qn TARGETDIR="!DRIVER_ADMIN!"
        ping -n 21 127.0.0.1 >nul

        set INFCOUNT=0
        for /r "!DRIVER_ADMIN!" %%f in (*.inf) do (
            pnputil /add-driver "%%f" /install >nul 2>&1
            set /a INFCOUNT+=1
        )
        pnputil /scan-devices >nul 2>&1

        if !INFCOUNT! GTR 0 (
            echo        Driver instalado - !INFCOUNT! INF registrados en el almacen.
        ) else (
            echo        [ERROR] No se extrajo ningun INF del MSI. El lector va a
            echo        quedar con error 28. Correr "reparar_driver.bat".
            set /a ERRORES+=1
        )
        rmdir /s /q "!DRIVER_ADMIN!" 2>nul
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
echo  [3/6] Instalando SecuGen WebAPI (%BWAPI_FILE%)...
if not exist "%DRIVERS_DIR%\%BWAPI_FILE%" (
    echo        [ERROR] Falta drivers\%BWAPI_FILE%
    set /a ERRORES+=1
    goto :FIN_WEBAPI
)

:: IMPORTANTE: si el servicio "SecuGen Web API Service" ya esta corriendo, el
:: asistente muestra la pantalla "The following applications are using files
:: that need to be updated by Setup". Aunque se elija cerrar las aplicaciones,
:: el servicio queda sin re-registrar y la instalacion termina a medias (el
:: kiosco no reconoce el lector). Por eso lo bajamos ANTES de correr el setup.
echo        Cerrando servicio/proceso previo de SecuGen ^(si existe^)...
powershell -NoProfile -Command "Get-Service | Where-Object { $_.DisplayName -match 'SecuGen' -or $_.Name -match 'sgibio|secugen' } | ForEach-Object { Stop-Service -Name $_.Name -Force -ErrorAction SilentlyContinue }" >nul 2>&1
sc stop SgiBioSrv >nul 2>&1
taskkill /F /IM sgibiosrv.exe >nul 2>&1
ping -n 4 127.0.0.1 >nul

echo        Ejecutando el asistente del WebAPI...
start /wait "" "%DRIVERS_DIR%\%BWAPI_FILE%" /SP- /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS

set "SGDIR="
if exist "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe" set "SGDIR=C:\Program Files\SecuGen\SgiBioSrv"
if exist "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgibiosrv.exe" set "SGDIR=C:\Program Files (x86)\SecuGen\SgiBioSrv"

if not defined SGDIR (
    echo        [AVISO] La instalacion quedo incompleta. Desinstalando version
    echo        previa y reintentando una sola vez...
    for %%D in ("C:\Program Files\SecuGen\SgiBioSrv" "C:\Program Files (x86)\SecuGen\SgiBioSrv") do (
        if exist "%%~D\unins000.exe" start /wait "" "%%~D\unins000.exe" /VERYSILENT /NORESTART
    )
    taskkill /F /IM sgibiosrv.exe >nul 2>&1
    ping -n 6 127.0.0.1 >nul
    start /wait "" "%DRIVERS_DIR%\%BWAPI_FILE%" /SP- /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS
    if exist "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe" set "SGDIR=C:\Program Files\SecuGen\SgiBioSrv"
    if exist "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgibiosrv.exe" set "SGDIR=C:\Program Files (x86)\SecuGen\SgiBioSrv"
)

if defined SGDIR (
    echo        WebAPI instalado en !SGDIR!
) else (
    echo        [ADVERTENCIA] No se detecto sgibiosrv tras la instalacion.
    echo        Correr "reparar_webapi.bat" como administrador y reintentar.
    set /a ERRORES+=1
    goto :FIN_WEBAPI
)

:: -- Garantizar que el WebAPI arranque solo despues de un reinicio ------------
:: En varias instalaciones el setup dejo los archivos pero NO registro ningun
:: servicio: sgibiosrv quedaba corriendo suelto (lo levantaba diagnostico.ps1)
:: y al reiniciar la PC el kiosco se quedaba sin lector. Si no hay servicio,
:: creamos una tarea programada al inicio de sesion.
set SVC_OK=0
for /f %%s in ('powershell -NoProfile -Command "@(Get-Service ^| Where-Object { $_.DisplayName -match 'SecuGen' -or $_.Name -match 'sgibio' }).Count" 2^>nul') do set SVC_OK=%%s

if "!SVC_OK!"=="0" (
    echo        Sin servicio registrado - creando tarea de arranque automatico...
    schtasks /create /tn "SmartDom-SgiBioSrv" /tr "\"!SGDIR!\sgibiosrv.exe\" -s -p:8443" /sc onlogon /rl highest /f >nul 2>&1
    if errorlevel 1 (
        echo        [ADVERTENCIA] No se pudo crear la tarea de arranque.
        set /a ERRORES+=1
    ) else (
        echo        Tarea "SmartDom-SgiBioSrv" creada ^(arranca al iniciar sesion^).
    )
) else (
    echo        Servicio de SecuGen registrado correctamente.
)

:: Dejarlo corriendo ya mismo, sin esperar al proximo reinicio.
:: OJO: sin los argumentos -s -p:8443 arranca en HTTP 8000 y la app no lo alcanza.
tasklist /FI "IMAGENAME eq sgibiosrv.exe" 2>nul | find /i "sgibiosrv.exe" >nul || start "" /D "!SGDIR!" "!SGDIR!\sgibiosrv.exe" -s -p:8443
:FIN_WEBAPI
echo.

:: -- PASO 3: Certificado ------------------------------------------------------
echo  [4/6] Instalando certificado SecuGen...
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
echo  [5/6] Configurando el kiosco...
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
echo  [6/6] Creando acceso directo en el escritorio...
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

:: Politica de Chrome: autorizar a la app (publica) a hablar con el lector en
:: localhost. Sin esto, Chrome bloquea el fetch (Private/Local Network Access).
:: Se setean los 3 nombres segun version de Chrome (los que no apliquen se ignoran):
::  - InsecurePrivateNetworkRequestsAllowedForUrls (Chrome viejos, PNA)
::  - LoopbackNetworkAllowedForUrls / LocalNetworkAccessAllowedForUrls (Chrome nuevos, LNA)
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\InsecurePrivateNetworkRequestsAllowedForUrls" /v 1 /t REG_SZ /d "https://personal.losnotables.cloud" /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\LoopbackNetworkAllowedForUrls" /v 1 /t REG_SZ /d "https://personal.losnotables.cloud" /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\LocalNetworkAccessAllowedForUrls" /v 1 /t REG_SZ /d "https://personal.losnotables.cloud" /f >nul 2>&1
echo        Politicas de Chrome aplicadas (acceso al lector en localhost).
echo.

:: -- PASO FINAL: Diagnostico del lector + reporte al tablero -----------------
echo  Ejecutando diagnostico del lector y reportando estado...
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%diagnostico.ps1" -LocalNombre "!SELNOMBRE!"
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
