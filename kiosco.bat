@echo off
title SmartDom Kiosco
:: ===========================================================================
:: Lanzador del kiosco biometrico (modelo por URL de produccion).
:: - PROD_URL viene precargada (produccion).
:: - LOCAL_ID lo setea el instalador; si quedo vacio, editar la linea de abajo
::   pegando el UUID del local correspondiente (ver LEER_PRIMERO.txt).
:: ===========================================================================
set LOCAL_ID=__LOCAL_ID__
set PROD_URL=https://personal.losnotables.cloud

set URL=%PROD_URL%/kiosco?local=%LOCAL_ID%

:: -- 1. Asegurar que el WebAPI SecuGen escuche en HTTPS 8443 -----------------
:: IMPORTANTE: sgibiosrv necesita los argumentos "-s -p:8443" para servir HTTPS.
:: Sin argumentos arranca en HTTP 8000 y la app (que usa 8443) no lo alcanza.
netstat -ano | findstr ":8443" | findstr LISTENING >NUL
if errorlevel 1 (
    :: 8443 no esta escuchando: matar cualquier instancia (por si quedo en 8000) y relanzar bien
    taskkill /F /IM sgibiosrv.exe >NUL 2>&1
    if exist "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe" start "" /D "C:\Program Files\SecuGen\SgiBioSrv" "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe" -s -p:8443
    if exist "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgibiosrv.exe" start "" /D "C:\Program Files (x86)\SecuGen\SgiBioSrv" "C:\Program Files (x86)\SecuGen\SgiBioSrv\sgibiosrv.exe" -s -p:8443
    timeout /t 3 /nobreak >NUL
)

:: -- 2. Abrir Chrome en modo kiosco -----------------------------------------
set C1="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set C2="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set C3="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if exist %C1% ( start "" %C1% --kiosk "%URL%" & goto END )
if exist %C2% ( start "" %C2% --kiosk "%URL%" & goto END )
if exist %C3% ( start "" %C3% --kiosk "%URL%" & goto END )

:: -- 3. Fallback: Edge en modo kiosco ---------------------------------------
where msedge >NUL 2>&1
if not errorlevel 1 ( start "" msedge --kiosk "%URL%" --edge-kiosk-type=fullscreen & goto END )

:: -- 4. Ultimo fallback: navegador por defecto ------------------------------
start "" "%URL%"

:END
exit
