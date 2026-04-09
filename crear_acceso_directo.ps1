$desktop = [Environment]::GetFolderPath('Desktop')
Write-Host "Escritorio encontrado en: $desktop"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$desktop\SmartDom Kiosco.lnk")
$Shortcut.TargetPath = "C:\Proyectos\gestion-personal-smartdom\kiosco.bat"
$Shortcut.WorkingDirectory = "C:\Proyectos\gestion-personal-smartdom"
$Shortcut.WindowStyle = 1
$Shortcut.Description = "SmartDom - Kiosco Biometrico"

# Buscar Chrome en rutas comunes
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chromeExe) {
    $Shortcut.IconLocation = "$chromeExe,0"
    Write-Host "Chrome encontrado en: $chromeExe"
} else {
    Write-Host "Chrome no encontrado, usando icono por defecto"
}

$Shortcut.Save()
Write-Host "Acceso directo creado exitosamente en: $desktop\SmartDom Kiosco.lnk"
