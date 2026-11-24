#requires -Version 5.1
<#
.SYNOPSIS
  Joynexa Core - conservative, reversible per-user Windows profile.
.DESCRIPTION
  Audit reports system information. Apply changes only two current-user visual
  preferences and exports registry backups first. Restore imports those backups.
  Windows Update, Microsoft Defender, firewall, drivers, and system services are
  intentionally left untouched.
.EXAMPLE
  .\Joynexa-Core.ps1 -Mode Audit
  .\Joynexa-Core.ps1 -Mode Apply
  .\Joynexa-Core.ps1 -Mode Restore
#>
[CmdletBinding()]
param(
    [ValidateSet('Audit','Apply','Restore')]
    [string]$Mode = 'Audit'
)

$ErrorActionPreference = 'Stop'
$BackupRoot = Join-Path $env:LOCALAPPDATA 'Joynexa\Backups\Core-v0.1'
$Targets = @(
    [pscustomobject]@{
        Path = 'HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
        File = 'personalize.reg'
        Name = 'EnableTransparency'
        Value = '0'
    },
    [pscustomobject]@{
        Path = 'HKCU\Control Panel\Desktop\WindowMetrics'
        File = 'windowmetrics.reg'
        Name = 'MinAnimate'
        Value = '0'
    }
)

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Get-SystemAudit {
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $ramGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    $freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)

    [pscustomobject]@{
        Computer       = $env:COMPUTERNAME
        Manufacturer   = (Get-CimInstance Win32_ComputerSystem).Manufacturer
        Model          = (Get-CimInstance Win32_ComputerSystem).Model
        CPU            = $cpu.Name
        Architecture   = $os.OSArchitecture
        Windows        = $os.Caption
        Version        = $os.Version
        Build          = $os.BuildNumber
        RAM_Total_GB   = $ramGB
        RAM_Free_GB    = $freeGB
        SystemDrive    = $env:SystemDrive
    } | Format-List

    Write-Host 'Startup inventory (read-only):'
    Get-CimInstance Win32_StartupCommand |
        Select-Object Name, Location, User |
        Format-Table -AutoSize
}

function Export-Backups {
    New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
    foreach ($target in $Targets) {
        $destination = Join-Path $BackupRoot $target.File
        & reg.exe export $target.Path $destination /y | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Could not back up $($target.Path). No settings were changed."
        }
    }
    Write-Host "Registry backups saved to: $BackupRoot" -ForegroundColor Green
}

function Set-UserPreference([string]$Path, [string]$Name, [string]$Value) {
    $parts = $Path -split '\\', 2
    $hive = $parts[0]
    $subKey = $parts[1]
    $registryPath = "Registry::$hive\$subKey"
    if (-not (Test-Path $registryPath)) {
        New-Item -Path $registryPath -Force | Out-Null
    }
    New-ItemProperty -Path $registryPath -Name $Name -PropertyType DWord -Value ([int]$Value) -Force | Out-Null
}

switch ($Mode) {
    'Audit' {
        Write-Section 'Joynexa Core - system audit (read-only)'
        Get-SystemAudit
        Write-Host 'No changes were made.'
    }
    'Apply' {
        Write-Section 'Joynexa Core - safe profile'
        if (Test-Path $BackupRoot) {
            Write-Host "A backup folder already exists: $BackupRoot" -ForegroundColor Yellow
            Write-Host 'Restore or move that backup before applying again.'
            exit 2
        }
        Export-Backups
        foreach ($target in $Targets) {
            Set-UserPreference -Path $target.Path -Name $target.Name -Value $target.Value
        }
        Write-Host 'Applied: reduced transparency and window animation for the current user.' -ForegroundColor Green
        Write-Host 'Sign out and back in if Windows does not refresh the visual settings.'
        Write-Host 'No security, update, driver, or system services were disabled.'
    }
    'Restore' {
        Write-Section 'Joynexa Core - restore'
        if (-not (Test-Path $BackupRoot)) {
            throw "No backup found at $BackupRoot. Nothing was restored."
        }
        foreach ($target in $Targets) {
            $backup = Join-Path $BackupRoot $target.File
            if (-not (Test-Path $backup)) {
                throw "Missing backup $backup. Restore stopped."
            }
        }
        foreach ($target in $Targets) {
            & reg.exe import (Join-Path $BackupRoot $target.File) | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Could not import $($target.File)."
            }
        }
        Write-Host 'Original registry settings imported. Sign out and back in if needed.' -ForegroundColor Green
    }
}
