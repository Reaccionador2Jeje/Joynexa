# Joynexa Windows Optimization — current-user, reversible settings only.
[CmdletBinding()]
param(
    [ValidateSet('Balanced','Performance','Restore')]
    [string]$Mode = 'Balanced'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$backupRoot = Join-Path $env:LOCALAPPDATA 'Joynexa'
$backupPath = Join-Path $backupRoot 'optimization-backup.json'
$targets = @(
    @{ Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'; Name='TaskbarAnimations'; Kind='DWord' },
    @{ Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'; Name='ListviewAlphaSelect'; Kind='DWord' },
    @{ Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'; Name='ListviewShadow'; Kind='DWord' },
    @{ Path='HKCU:\Control Panel\Desktop'; Name='MenuShowDelay'; Kind='String' },
    @{ Path='HKCU:\Control Panel\Desktop\WindowMetrics'; Name='MinAnimate'; Kind='String' },
    @{ Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'; Name='EnableTransparency'; Kind='DWord' }
)

if ($Mode -eq 'Restore') {
    if (-not (Test-Path -LiteralPath $backupPath)) { throw "No Joynexa optimization backup exists at $backupPath." }
    $saved = Get-Content -LiteralPath $backupPath -Raw | ConvertFrom-Json
    foreach ($entry in $saved) {
        if (-not (Test-Path -LiteralPath $entry.Path)) { New-Item -Path $entry.Path -Force | Out-Null }
        if ($entry.Existed) {
            New-ItemProperty -LiteralPath $entry.Path -Name $entry.Name -PropertyType $entry.Kind -Value $entry.Value -Force | Out-Null
        } else {
            Remove-ItemProperty -LiteralPath $entry.Path -Name $entry.Name -ErrorAction SilentlyContinue
        }
    }
    Write-Host 'Original Joynexa user-interface settings restored.'
    exit 0
}

if (-not (Test-Path -LiteralPath $backupPath)) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $saved = foreach ($item in $targets) {
        $exists = Test-Path -LiteralPath $item.Path
        $key = if ($exists) { Get-Item -LiteralPath $item.Path } else { $null }
        $hasValue = $false
        $value = $null
        if ($null -ne $key -and $key.GetValueNames() -contains $item.Name) {
            $hasValue = $true
            $value = $key.GetValue($item.Name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        }
        [pscustomobject]@{ Path=$item.Path; Name=$item.Name; Kind=$item.Kind; Existed=$hasValue; Value=$value }
    }
    $saved | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $backupPath -Encoding UTF8
}

$values = if ($Mode -eq 'Performance') {
    @{ TaskbarAnimations=0; ListviewAlphaSelect=0; ListviewShadow=0; MenuShowDelay='80'; MinAnimate='0'; EnableTransparency=0 }
} else {
    @{ TaskbarAnimations=1; ListviewAlphaSelect=1; ListviewShadow=1; MenuShowDelay='120'; MinAnimate='1'; EnableTransparency=0 }
}
foreach ($item in $targets) {
    if (-not (Test-Path -LiteralPath $item.Path)) { New-Item -Path $item.Path -Force | Out-Null }
    New-ItemProperty -LiteralPath $item.Path -Name $item.Name -PropertyType $item.Kind -Value $values[$item.Name] -Force | Out-Null
}
Write-Host "Joynexa $Mode profile applied to the current Windows user."
Write-Host "Backup: $backupPath"
Write-Host 'No services, startup entries, Windows Update, Defender, drivers, or security policies were changed.'
Write-Host 'Sign out and back in (or restart Explorer) for all visual changes to appear.'
