# Script de descarga automatica de componentes SecuGen
# Ejecutar como Administrador

$driversDir = "C:\Proyectos\gestion-personal-smartdom\drivers"
New-Item -ItemType Directory -Force -Path $driversDir | Out-Null

Write-Host "Descargando componentes SecuGen..." -ForegroundColor Cyan

# WebAPI 32 bits
$url32 = "https://webapi.secugen.com/download/SGI_BWAPI_Win_32bit.exe"
$dest32 = "$driversDir\SGI_BWAPI_WIN_32bit.exe"
if (-not (Test-Path $dest32)) {
    Write-Host "  Descargando WebAPI 32bit..." -NoNewline
    try {
        Invoke-WebRequest -Uri $url32 -OutFile $dest32 -UseBasicParsing
        $size = [math]::Round((Get-Item $dest32).Length / 1MB, 1)
        Write-Host " OK ($size MB)" -ForegroundColor Green
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  WebAPI 32bit ya existe, omitiendo" -ForegroundColor Yellow
}

# Verificar WebAPI 64 bits
$dest64 = "$driversDir\SGI_BWAPI_WIN_64bit.exe"
if (-not (Test-Path $dest64)) {
    $url64 = "https://webapi.secugen.com/download/SGI_BWAPI_Win_64bit.exe"
    Write-Host "  Descargando WebAPI 64bit..." -NoNewline
    try {
        Invoke-WebRequest -Uri $url64 -OutFile $dest64 -UseBasicParsing
        $size = [math]::Round((Get-Item $dest64).Length / 1MB, 1)
        Write-Host " OK ($size MB)" -ForegroundColor Green
    } catch {
        Write-Host " ERROR: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  WebAPI 64bit ya existe, omitiendo" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Contenido de la carpeta drivers:" -ForegroundColor Cyan
Get-ChildItem $driversDir | Select-Object Name, @{N='Tamanio';E={[math]::Round($_.Length/1MB,1).ToString() + ' MB'}} | Format-Table -AutoSize

Write-Host "Listo. Ahora ejecutar exportar_instalador.bat" -ForegroundColor Green
Write-Host ""
pause
