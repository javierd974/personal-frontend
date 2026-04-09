@echo off
title SmartDom Kiosco - Oficina
set LOCAL_ID=c18343eb-acf8-4aa1-abe7-c4674c25f8a8

:: ── 1. Iniciar sgibiosrv ──────────────────────────────────────────────────
tasklist /FI "IMAGENAME eq sgibiosrv.exe" 2>NUL | find /I /N "sgibiosrv.exe">NUL
if "%ERRORLEVEL%"=="1" (
    start "" "C:\Program Files\SecuGen\SgiBioSrv\sgibiosrv.exe"
    timeout /t 3 /nobreak >NUL
)

:: ── 2. Iniciar Vite si no está corriendo ──────────────────────────────────
netstat -ano | findstr ":5173" >NUL
if "%ERRORLEVEL%"=="1" (
    start "SmartDom Dev" /min cmd /c "cd /d C:\Proyectos\gestion-personal-smartdom && npm run dev"
)

:: ── 3. Esperar hasta que Vite responda (max 90 seg) ───────────────────────
set /a N=0
:LOOP
set /a N+=1
if %N% GTR 30 goto OPEN
timeout /t 3 /nobreak >NUL
netstat -ano | findstr ":5173" >NUL
if "%ERRORLEVEL%"=="1" goto LOOP

:: Esperar 2 segundos extra para que Vite termine de compilar
timeout /t 2 /nobreak >NUL

:: ── 4. Abrir en Chrome ────────────────────────────────────────────────────
:OPEN
set URL=http://localhost:5173/kiosco?local=%LOCAL_ID%

:: Chrome en modo kiosko nativo (pantalla completa, sin decoraciones)
set C1="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set C2="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set C3="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if exist %C1% ( start "" %C1% --kiosk "%URL%" & goto END )
if exist %C2% ( start "" %C2% --kiosk "%URL%" & goto END )
if exist %C3% ( start "" %C3% --kiosk "%URL%" & goto END )

:: Fallback: navegador por defecto
start %URL%

:END
exit
