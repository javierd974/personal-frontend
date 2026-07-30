# ============================================================================
# SmartDom Kiosco - Diagnostico y reporte de instalacion del lector biometrico
# Compatible con PowerShell 2.0 (Windows 7) hasta 5.1 (Windows 11).
# - Chequea: dispositivo SecuGen, driver, sgibiosrv, WebAPI (localhost:8443).
# - Da un veredicto claro, escribe log y reporta al tablero (best-effort).
# Uso: powershell -ExecutionPolicy Bypass -File diagnostico.ps1 [-LocalNombre "Cao"]
# ============================================================================
param([string]$LocalId = '', [string]$LocalNombre = '')

$ErrorActionPreference = 'SilentlyContinue'

$APP_VERSION = 'kiosco-installer-2.0'
$SUPA_URL    = 'https://ddpjzfltfmfoenkxynpu.supabase.co/rest/v1/rpc/registrar_instalacion'
$SUPA_KEY    = 'sb_publishable_W2iHnIBQ-ed6ffjdcqfZ8g_V7CpfQ-e'
$SECRET      = 'kio_sd_7Xr2Fq9pLmZ4'
$INSTALL_DIR = 'C:\SmartDomKiosco'
$LOG         = Join-Path $INSTALL_DIR 'install.log'

# --- Helpers de JSON (PS 2.0 no tiene ConvertTo-Json) -----------------------
function JStr($s) {
  if ($null -eq $s) { return 'null' }
  $t = [string]$s
  $t = $t.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", ' ').Replace("`t", ' ')
  return '"' + $t + '"'
}
function JBool($b) { if ($b) { 'true' } else { 'false' } }
function JInt($n)  { if ($null -eq $n -or "$n" -eq '') { 'null' } else { [string]([int]$n) } }

# --- Local (si no vino por parametro, leerlo de kiosco.bat) ------------------
if (-not $LocalId) {
  $kb = Join-Path $INSTALL_DIR 'kiosco.bat'
  if (Test-Path $kb) {
    foreach ($ln in (Get-Content $kb)) {
      if ($ln -match 'set\s+LOCAL_ID=(.+)') { $LocalId = $matches[1].Trim() }
    }
  }
}
if ($LocalId -notmatch '^[0-9a-fA-F]{8}-') { $LocalId = '' }   # placeholder o vacio -> null

# --- Datos de la maquina ----------------------------------------------------
$os          = Get-WmiObject Win32_OperatingSystem
$osCaption   = $os.Caption
$osArch      = "$($os.OSArchitecture)"
$machineName = $env:COMPUTERNAME
$machineId   = $machineName

# --- Dispositivo SecuGen (VID_1162 = SecuGen) -------------------------------
$dev = Get-WmiObject Win32_PnPEntity | Where-Object { $_.DeviceID -match 'VID_1162' } | Select-Object -First 1
if (-not $dev) {
  $dev = Get-WmiObject Win32_PnPEntity | Where-Object { $_.Name -match 'SecuGen|Hamster|UPx' } | Select-Object -First 1
}
$readerName = ''
$errCode    = $null
$driverSvc  = ''
if ($dev) {
  $readerName = $dev.Name
  $errCode    = [int]$dev.ConfigManagerErrorCode
  $driverSvc  = "$($dev.Service)"
}

# --- Servicio sgibiosrv -----------------------------------------------------
$sgOk = $false
if (Get-Process sgibiosrv -ErrorAction SilentlyContinue) { $sgOk = $true }

# --- WebAPI: sgibiosrv debe escuchar en 8443 (HTTPS = lo que usa la app).
#     Sin los argumentos "-s -p:8443" arranca en HTTP 8000 y la app no lo alcanza.
#     AUTO-REPARACION: si 8443 no esta, relanzamos sgibiosrv con los args correctos. ---
function Test-P8443 { return ((@((netstat -ano) | Where-Object { $_ -match ':8443\s' -and $_ -match 'LISTENING' })).Count -gt 0) }
$p8443 = Test-P8443
$autoreparado = $false
if (-not $p8443) {
  $sgdir = $null
  foreach ($d in @('C:\Program Files\SecuGen\SgiBioSrv','C:\Program Files (x86)\SecuGen\SgiBioSrv')) {
    if (Test-Path (Join-Path $d 'sgibiosrv.exe')) { $sgdir = $d }
  }
  if ($sgdir) {
    Get-Process sgibiosrv -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process -FilePath (Join-Path $sgdir 'sgibiosrv.exe') -ArgumentList '-s','-p:8443' -WorkingDirectory $sgdir -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 4
    $p8443 = Test-P8443
    if ($p8443) { $autoreparado = $true }
  }
}
$p8000 = ((@((netstat -ano) | Where-Object { $_ -match ':8000\s' -and $_ -match 'LISTENING' })).Count -gt 0)
if (Get-Process sgibiosrv -ErrorAction SilentlyContinue) { $sgOk = $true }
$webOk = $p8443
$certMal = $false

# --- Veredicto --------------------------------------------------------------
# El WebAPI HTTPS (8443) se auto-repara arriba (relanzando sgibiosrv con -s -p:8443).
# Si aun asi 8443 no levanta, suele ser por permisos (correr como admin) o falta reiniciar.
$readerPresent = ($dev -ne $null)
$readerOk = ($readerPresent -and $errCode -eq 0 -and $webOk)
if     ($readerOk)               { $veredicto = 'OK';            $detalle = 'Lector reconocido y WebAPI HTTPS activo.' + $(if ($autoreparado) { ' (WebAPI reiniciado en 8443 automaticamente.)' } else { '' }) }
elseif (-not $readerPresent)     { $veredicto = 'FALTA_LECTOR';  $detalle = 'Software instalado y WebAPI OK. Falta enchufar el lector SecuGen; con el lector puesto corre diagnostico.bat para validar.' }
elseif ($errCode -eq 28)         { $veredicto = 'SIN_DRIVER';    $detalle = 'Lector conectado pero sin driver (28). Actualizar el controlador apuntando a la carpeta drivers, o reconectar tras instalar.' }
elseif ($errCode -ne 0)          { $veredicto = 'DRIVER_ERROR';  $detalle = "Lector con problema de driver (errorCode $errCode). Reasignar el driver a SecuGen." }
elseif (-not $sgOk)              { $veredicto = 'SGIBIOSRV_OFF'; $detalle = 'No se pudo iniciar sgibiosrv. Correr diagnostico.bat como administrador o reiniciar la PC.' }
elseif (-not $p8443)             { $veredicto = 'WEBAPI_OFF';    $detalle = 'El WebAPI no pudo levantar en HTTPS 8443 (quedo en 8000 o caido). Correr diagnostico.bat como ADMINISTRADOR, o reiniciar la PC (el autoarranque lo pone en 8443).' }
else                             { $veredicto = 'REVISAR';       $detalle = "Lector presente (driver=$driverSvc) pero el WebAPI no responde bien en 8443." }

# --- Log --------------------------------------------------------------------
if (-not (Test-Path $INSTALL_DIR)) { New-Item -ItemType Directory -Path $INSTALL_DIR | Out-Null }
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path $LOG -Value "[$stamp] $machineName | $osCaption $osArch | reader=$readerOk err=$errCode sg=$sgOk web=$webOk | $veredicto | $detalle"

# --- Salida en pantalla -----------------------------------------------------
Write-Host ''
if ($readerOk) {
  Write-Host '  ============================================================' -ForegroundColor Green
  Write-Host ("   LECTOR OK" + $(if ($LocalNombre) { " - $LocalNombre" } else { '' })) -ForegroundColor Green
  Write-Host '   El kiosco esta listo para usar en esta maquina.' -ForegroundColor Green
  Write-Host '  ============================================================' -ForegroundColor Green
} elseif ($veredicto -eq 'FALTA_LECTOR') {
  Write-Host '  ============================================================' -ForegroundColor Cyan
  Write-Host '   SOFTWARE OK - FALTA ENCHUFAR EL LECTOR' -ForegroundColor Cyan
  Write-Host '   Enchufa el lector y corre diagnostico.bat para validar.' -ForegroundColor Cyan
  Write-Host '  ============================================================' -ForegroundColor Cyan
} else {
  Write-Host '  ============================================================' -ForegroundColor Yellow
  Write-Host "   FALTA REVISAR:  $veredicto" -ForegroundColor Yellow
  Write-Host "   $detalle" -ForegroundColor Yellow
  Write-Host '  ============================================================' -ForegroundColor Yellow
}
Write-Host ("   SO: $osCaption $osArch  |  Lector: " + $(if ($readerName) { $readerName } else { 'no detectado' })) -ForegroundColor Gray

# --- Reporte al tablero (best-effort; nunca frena el instalador) ------------
$dataJson =
  '{' +
  '"machine_id":'        + (JStr $machineId)   + ',' +
  '"local_id":'          + (JStr $LocalId)     + ',' +
  '"local_nombre":'      + (JStr $LocalNombre) + ',' +
  '"machine_name":'      + (JStr $machineName) + ',' +
  '"os_caption":'        + (JStr $osCaption)   + ',' +
  '"os_arch":'           + (JStr $osArch)      + ',' +
  '"app_version":'       + (JStr $APP_VERSION) + ',' +
  '"reader_ok":'         + (JBool $readerOk)   + ',' +
  '"reader_error_code":' + (JInt $errCode)     + ',' +
  '"reader_name":'       + (JStr $readerName)  + ',' +
  '"driver_service":'    + (JStr $driverSvc)   + ',' +
  '"sgibiosrv_ok":'      + (JBool $sgOk)       + ',' +
  '"webapi_ok":'         + (JBool $webOk)      + ',' +
  '"veredicto":'         + (JStr $veredicto)   + ',' +
  '"detalle":'           + (JStr $detalle)     +
  '}'
$body = '{"p_secret":' + (JStr $SECRET) + ',"p_data":' + $dataJson + '}'

try {
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('Content-Type', 'application/json')
  $wc.Headers.Add('apikey', $SUPA_KEY)
  $wc.Headers.Add('Authorization', 'Bearer ' + $SUPA_KEY)
  [void]$wc.UploadString($SUPA_URL, 'POST', $body)
  Write-Host '   Reporte enviado al tablero de instalaciones.' -ForegroundColor Gray
} catch {
  Write-Host '   (No se pudo enviar el reporte al tablero; el estado local igual quedo en el log.)' -ForegroundColor Gray
}
Write-Host ''
