@echo off
title Exportar SmartDom Kiosco (instalador liviano)
echo.
echo  Generando paquete de instalacion del kiosco...
echo.

set SRC=C:\Proyectos\gestion-personal-smartdom
set DEST=C:\Proyectos\SmartDom-Kiosco-Installer
set ZIP=C:\Proyectos\SmartDom-Kiosco-Installer.zip

:: Limpiar destino anterior
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
mkdir "%DEST%\drivers"

:: Copiar SOLO lo necesario de drivers (driver + WebAPI 32/64). Sin Node.
echo  Copiando drivers SecuGen...
copy /Y "%SRC%\drivers\WinDrivers_v3001_Installer.zip" "%DEST%\drivers\" >nul
copy /Y "%SRC%\drivers\SGI_BWAPI_WIN_32bit.exe" "%DEST%\drivers\" >nul
copy /Y "%SRC%\drivers\SGI_BWAPI_WIN_64bit.exe" "%DEST%\drivers\" >nul
copy /Y "%SRC%\drivers\vc_redist.x86.exe" "%DEST%\drivers\" >nul
copy /Y "%SRC%\drivers\vc_redist.x64.exe" "%DEST%\drivers\" >nul

:: Copiar scripts del instalador
echo  Copiando scripts...
copy /Y "%SRC%\instalar.bat" "%DEST%\" >nul
copy /Y "%SRC%\kiosco.bat" "%DEST%\" >nul
copy /Y "%SRC%\crear_acceso_directo.ps1" "%DEST%\" >nul
copy /Y "%SRC%\diagnostico.ps1" "%DEST%\" >nul
copy /Y "%SRC%\diagnostico.bat" "%DEST%\" >nul
copy /Y "%SRC%\reparar_webapi.bat" "%DEST%\" >nul
copy /Y "%SRC%\reparar_driver.bat" "%DEST%\" >nul
copy /Y "%SRC%\GUIA_INSTALACION.txt" "%DEST%\" >nul
copy /Y "%SRC%\GUIA_IMPRIMIBLE.html" "%DEST%\" >nul

:: Crear guia
echo  Creando guia...
(
echo SMARTDOM KIOSCO - GUIA RAPIDA DE INSTALACION
echo =============================================
echo.
echo QUE HACE ESTE INSTALADOR:
echo   - Instala el Visual C++ Runtime ^(necesario en Windows 7 y equipos sin
echo     actualizar; sin el, sgibiosrv no arranca^)
echo   - Instala el driver del lector SecuGen
echo   - Instala el WebAPI de SecuGen ^(servicio local sgibiosrv, https://localhost:8443^)
echo   - Instala el certificado en Windows
echo   - Crea el icono "SmartDom Kiosco" en el escritorio
echo   El kiosco abre la app en la NUBE ^(no instala la app localmente^).
echo.
echo REQUISITOS:
echo   - Windows 7, 8, 10 u 11 ^(32 o 64 bits^)
echo   - Google Chrome instalado ^(en Windows 7: Chrome 109, la ultima compatible^)
echo   - Lector SecuGen conectado por USB
echo   - Conexion a internet
echo.
echo PASOS:
echo   1. Copiar esta carpeta a la PC ^(por ejemplo al Escritorio^).
echo   2. Clic derecho en "instalar.bat" -^> "Ejecutar como administrador".
echo   3. Cuando lo pida, elegir el NUMERO del local de esta PC.
echo   4. Si el asistente del WebAPI igual muestra la pantalla "applications
echo      are using files that need to be updated", cancelar el asistente y
echo      correr "reparar_webapi.bat" como administrador ^(limpia la instalacion
echo      previa y reinstala el WebAPI de cero^).
echo   5. Al terminar, doble clic en el icono "SmartDom Kiosco".
echo      ^(Para salir del modo pantalla completa: Alt+F4^)
echo.
echo SI TU LOCAL NO APARECIO / ELEGISTE MAL:
echo   Editar C:\SmartDomKiosco\kiosco.bat y poner el UUID en la linea:
echo       set LOCAL_ID=PEGAR-UUID-AQUI
echo   UUIDs de los locales:
echo     Cao:        f2c46927-4759-40fe-8b32-f8df08a3a90f
echo     Celta:      61f1a919-4f85-4da8-9f81-71a2835e41ef
echo     Cortazar:   9ab2f3c0-b05e-43cc-8c19-d9cbbf93c1fe
echo     Deposito:   df218cef-def2-4f69-bc3b-64b06b6fd200
echo     Dorrego:    543a91dc-3f00-4d02-866a-5fed9e02b089
echo     El Octavo:  f31f650a-1f20-421f-8233-f32008ea1c18
echo     Federal:    efa521ad-b5fd-44e4-809b-2a8f48e747a8
echo     Hipopotamo: bda52bba-5fb7-4a5e-897f-8d37eb8f52f2
echo     Lavalle:    ad179865-e087-4a67-b923-1f9713c842d6
echo     Margot:     f23f85f1-f741-4ce7-9c72-9ab995aa12d6
echo     Miramar:    399e8bd2-b1ad-44b7-b0e6-c793ba323068
echo     Oficina:    c18343eb-acf8-4aa1-abe7-c4674c25f8a8
echo     Pasteleria: c3da51f5-e1e8-40fd-83fb-36cee9576e2b
echo     Poesia:     2d9ee9f4-894b-415a-9180-3ad0605909ec
echo     Zarpada:    f34b617c-33e4-4e83-9d25-f0c114837881
echo.
echo NOTA - Windows 7 de 32 bits con instalacion previa de SecuGen:
echo   Si el WebAPI da error 216 ^("no es compatible con la version de Windows"^),
echo   hay binarios viejos de 64-bit trabados. Cerrar sgibiosrv.exe ^(Ctrl+Shift+Esc^),
echo   desinstalar "SecuGen WebAPI over HTTPS", borrar C:\Program Files\SecuGen\SgiBioSrv,
echo   reiniciar y volver a correr instalar.bat.
echo.
echo SOPORTE: SmartDom - smartdom.io
) > "%DEST%\LEER_PRIMERO.txt"

:: Comprimir
echo  Comprimiendo...
powershell -NoProfile -Command "Compress-Archive -Path '%DEST%\*' -DestinationPath '%ZIP%' -Force"
rmdir /s /q "%DEST%"

echo.
echo  ============================================================
echo   PAQUETE GENERADO
echo  ============================================================
echo  Archivo: %ZIP%
powershell -NoProfile -Command "'{0:N1} MB' -f ((Get-Item '%ZIP%').Length/1MB)"
echo.
echo  Llevar el ZIP en pendrive a cada PC. Descomprimir y ejecutar
echo  instalar.bat como administrador.
echo.
pause
