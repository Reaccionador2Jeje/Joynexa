#requires -Version 5.1
<#
.SYNOPSIS
  Installs curated Joynexa driver packages from a local folder.
.DESCRIPTION
  Uses Windows PnPUtil to stage signed INF driver packages and install matching
  devices. Does not download drivers, disable signature enforcement, or force
  unsigned packages. This runs after Windows is installed; WinPE storage
  drivers must be integrated into boot.wim separately.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$DriverPath,

    [Parameter()]
    [string]$LogPath = "$env:ProgramData\Joynexa\Logs\driver-install.log"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    throw "Run this script from an elevated PowerShell session."
}

$resolvedDriverPath = (Resolve-Path -LiteralPath $DriverPath -ErrorAction Stop).Path
$infFiles = @(Get-ChildItem -LiteralPath $resolvedDriverPath -Filter "*.inf" -File -Recurse)
if ($infFiles.Count -eq 0) {
    throw "No INF driver packages were found in: $resolvedDriverPath"
}

$logDirectory = Split-Path -Parent $LogPath
if (-not (Test-Path -LiteralPath $logDirectory)) {
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
}

Start-Transcript -Path $LogPath -Append | Out-Null
try {
    Write-Host "Joynexa driver installation"
    Write-Host "Source: $resolvedDriverPath"
    Write-Host "INF packages discovered: $($infFiles.Count)"
    Write-Host "Windows will enforce driver package signature policy."

    $pnputil = Join-Path $env:WINDIR "System32\pnputil.exe"
    if (-not (Test-Path -LiteralPath $pnputil)) {
        throw "pnputil.exe was not found."
    }

    & $pnputil /add-driver (Join-Path $resolvedDriverPath "*.inf") /subdirs /install
    $installExitCode = $LASTEXITCODE
    if ($installExitCode -ne 0) {
        throw "PnPUtil reported exit code $installExitCode. Review this log and Windows SetupAPI logs."
    }

    & $pnputil /scan-devices
    $scanExitCode = $LASTEXITCODE
    if ($scanExitCode -ne 0) {
        throw "PnPUtil device rescan failed with exit code $scanExitCode."
    }

    Write-Host "Driver package staging and device rescan completed."
    Write-Host "Some devices may still need a newer OEM driver or a restart."
}
finally {
    Stop-Transcript | Out-Null
}
