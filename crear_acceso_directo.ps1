$desktop = [Environment]::GetFolderPath('Desktop')
Write-Host "Escritorio encontrado en: $desktop"

$target = "C:\SmartDomKiosco\kiosco.bat"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$desktop\SmartDom Kiosco.lnk")
$Shortcut.TargetPath = $target
$Shortcut.WorkingDirectory = "C:\SmartDomKiosco"
$Shortcut.WindowStyle = 7   # minimizado (el .bat solo abre el navegador)
$Shortcut.Description = "SmartDom - Kiosco Biometrico"

# Icono de Chrome si esta disponible
$chromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
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
Write-Host "Acceso directo creado en: $desktop\SmartDom Kiosco.lnk"
