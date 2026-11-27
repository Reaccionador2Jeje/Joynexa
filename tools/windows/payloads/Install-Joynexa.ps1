# Joynexa Windows Edition Installer
# Runs only after Windows setup, from an extracted Joynexa setup kit.
[CmdletBinding()]
param([switch]$Yes)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $root 'joynexa-setup.json'
$firstBoot = Join-Path $root 'Start-JoynexaFirstBoot.ps1'

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'joynexa-setup.json is missing. Extract the complete setup kit first.'
}
if (-not (Test-Path -LiteralPath $firstBoot -PathType Leaf)) {
    throw 'Start-JoynexaFirstBoot.ps1 is missing. Extract the complete setup kit first.'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.product -ne 'Joynexa Windows' -or $manifest.schema_version -ne 1) {
    throw 'Unsupported Joynexa setup manifest.'
}
$allowed = @('core','play','productivity','modern','retro','legacy')
$edition = [string]$manifest.edition
if ($edition -notin $allowed) { throw "Unsupported edition: $edition" }
if ($manifest.setup.oobe -ne 'interactive' -or $manifest.first_boot.scope -ne 'current_user') {
    throw 'Setup manifest violates the interactive setup safety contract.'
}
foreach ($name in @('windows_requirements_bypassed','eula_auto_accepted','account_auto_created','activation_modified','security_settings_weakened','protected_windows_files_modified')) {
    if ($manifest.safety.$name -ne $false) { throw "Unsafe manifest flag: $name" }
}
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'This installer must be run on Windows after Windows Setup is complete.'
}

Write-Host ''
Write-Host "Joynexa Windows — $($manifest.edition_name)" -ForegroundColor Cyan
Write-Host 'This applies visual personalization to your current Windows user only.'
Write-Host 'It does not install Windows, activate it, create accounts, bypass hardware requirements,'
Write-Host 'disable security features, or change Windows services or protected system files.'
Write-Host ''
if (-not $Yes) {
    $answer = Read-Host 'Apply this edition to the current user? Type YES to continue'
    if ($answer -cne 'YES') {
        Write-Host 'Cancelled. No changes were made.'
        exit 0
    }
}
& (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoProfile -ExecutionPolicy RemoteSigned -File $firstBoot
if ($LASTEXITCODE -ne 0) { throw "Joynexa first-boot personalization failed with exit code $LASTEXITCODE." }
Write-Host "Joynexa $edition installation completed for the current user." -ForegroundColor Green
