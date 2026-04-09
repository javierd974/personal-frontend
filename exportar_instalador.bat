@echo off
title Exportar SmartDom Kiosco
echo.
echo  Generando paquete de instalacion completo...
echo  (Esto puede tardar unos minutos)
echo.

set SRC=C:\Proyectos\gestion-personal-smartdom
set DEST=C:\Proyectos\SmartDom-Kiosco-Installer
set ZIP=C:\Proyectos\SmartDom-Kiosco-Installer.zip

:: Limpiar destino anterior
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"

:: Copiar app sin node_modules, dist, .git
echo  Copiando aplicacion...
robocopy "%SRC%" "%DEST%\app" /E /XD node_modules dist .git .next /XF *.log /NFL /NDL /NJH /NJS >nul

:: Copiar drivers
echo  Copiando drivers...
if exist "%SRC%\drivers" (
    xcopy /E /I /Q "%SRC%\drivers" "%DEST%\drivers" >nul
)

:: Copiar scripts de instalacion a la raiz
copy /Y "%SRC%\instalar.bat" "%DEST%\" >nul
copy /Y "%SRC%\crear_acceso_directo.ps1" "%DEST%\" >nul

:: Crear README
echo  Creando guia de instalacion...
(
echo SMARTDOM KIOSCO - GUIA RAPIDA DE INSTALACION
echo =============================================
echo.
echo REQUISITOS PREVIOS:
echo - Windows 10 o 11 de 64 bits
echo - Lector SecuGen HUPx-AP conectado por USB
echo - Conexion a internet para la primera instalacion
echo.
echo PASOS:
echo.
echo 1. Copiar esta carpeta completa a C:\Proyectos\
echo    (Debe quedar como C:\Proyectos\SmartDom-Kiosco-Installer)
echo.
echo 2. Hacer clic derecho en "instalar.bat" y elegir
echo    "Ejecutar como administrador"
echo.
echo    El instalador hace automaticamente:
echo    - Instala Node.js si no esta instalado
echo    - Instala el driver SecuGen HUPx-AP
echo    - Instala el WebAPI de SecuGen
echo    - Instala el certificado en Windows
echo    - Crea el icono en el escritorio
echo.
echo 3. Editar el LOCAL_ID en el archivo:
echo    C:\Proyectos\gestion-personal-smartdom\kiosco.bat
echo.
echo    Reemplazar el UUID con el del local correspondiente:
echo    set LOCAL_ID=PEGAR-UUID-DEL-LOCAL-AQUI
echo.
echo    UUIDs de los locales:
echo    - Cao:        f2c46927-4759-40fe-8b32-f8df08a3a90f
echo    - Celta:      61f1a919-4f85-4da8-9f81-71a2835e41ef
echo    - Cortazar:   9ab2f3c0-b05e-43cc-8c19-d9cbbf93c1fe
echo    - Deposito:   df218cef-def2-4f69-bc3b-64b06b6fd200
echo    - Dorrego:    543a91dc-3f00-4d02-866a-5fed9e02b089
echo    - El Octavo:  f31f650a-1f20-421f-8233-f32008ea1c18
echo    - Federal:    efa521ad-b5fd-44e4-809b-2a8f48e747a8
echo    - Hipopotamo: bda52bba-5fb7-4a5e-897f-8d37eb8f52f2
echo    - Lavalle:    ad179865-e087-4a67-b923-1f9713c842d6
echo    - Margot:     f23f85f1-f741-4ce7-9c72-9ab995aa12d6
echo    - Miramar:    399e8bd2-b1ad-44b7-b0e6-c793ba323068
echo    - Oficina:    c18343eb-acf8-4aa1-abe7-c4674c25f8a8
echo    - Pasteleria: c3da51f5-e1e8-40fd-83fb-36cee9576e2b
echo    - Poesia:     2d9ee9f4-894b-415a-9180-3ad0605909ec
echo    - Zarpada:    f34b617c-33e4-4e83-9d25-f0c114837881
echo.
echo 4. Reiniciar la PC
echo.
echo 5. Doble clic en el icono "SmartDom Kiosco" del escritorio
echo.
echo SOPORTE: SmartDom - smartdom.io
) > "%DEST%\LEER_PRIMERO.txt"

:: Comprimir todo
echo  Comprimiendo en ZIP...
powershell -Command "Compress-Archive -Path '%DEST%\*' -DestinationPath '%ZIP%' -Force"

:: Limpiar carpeta temporal
rmdir /s /q "%DEST%"

echo.
echo  ============================================================
echo   PAQUETE GENERADO EXITOSAMENTE
echo  ============================================================
echo.
echo  Archivo: %ZIP%
echo  Tamanio:
powershell -Command "(Get-Item '%ZIP%').Length / 1MB | ForEach-Object { '{0:N1} MB' -f $_ }"
echo.
echo  Llevar este ZIP en un pendrive a cada PC nueva.
echo  En la PC nueva: descomprimir y ejecutar instalar.bat como administrador.
echo.
pause
