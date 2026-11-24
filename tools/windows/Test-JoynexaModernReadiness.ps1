#requires -Version 5.1
<#
.SYNOPSIS
  Read-only hardware and Windows readiness inventory for Joynexa Modern.
.DESCRIPTION
  Collects local Windows facts as JSON. This is not Microsoft's compatibility
  checker and does not decide CPU-list eligibility. It makes no system changes.
#>
[CmdletBinding()]
param([ValidateSet('Json','Table')][string]$OutputFormat = 'Table')

$ErrorActionPreference = 'SilentlyContinue'

function Get-SecureBootState {
    try {
        if (-not (Get-Command Confirm-SecureBootUEFI -ErrorAction SilentlyContinue)) { return 'unknown' }
        if (Confirm-SecureBootUEFI) { return 'enabled' }
        return 'disabled'
    } catch { return 'unknown' }
}

function Get-TpmState {
    try {
        $tpm = Get-Tpm
        if ($null -eq $tpm) { return 'unknown' }
        if ($tpm.TpmPresent -and $tpm.TpmReady) {
            $spec = (Get-CimInstance -Namespace 'root\CIMV2\Security\MicrosoftTpm' -ClassName Win32_Tpm).SpecVersion
            if ($spec -match '2\.0') { return 'present_ready_2_0' }
            return 'present_ready_version_unverified'
        }
        if ($tpm.TpmPresent) { return 'present_not_ready' }
        return 'not_present'
    } catch { return 'unknown' }
}

$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$computer = Get-CimInstance Win32_ComputerSystem
$video = @(Get-CimInstance Win32_VideoController | ForEach-Object {
    [pscustomobject]@{ name = $_.Name; driver_version = $_.DriverVersion; driver_date = $_.DriverDate }
})
$systemDrive = $env:SystemDrive
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$systemDrive'"
$firmwareType = 'unknown'
try {
    $bios = Get-ComputerInfo -Property BiosFirmwareType
    if ($bios.BiosFirmwareType) { $firmwareType = [string]$bios.BiosFirmwareType }
} catch {}

$report = [ordered]@{
    schema_version = 1
    collected_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    platform = [ordered]@{ windows_caption = $os.Caption; windows_version = $os.Version; windows_build = $os.BuildNumber; architecture = $os.OSArchitecture }
    cpu = [ordered]@{ model = $cpu.Name; logical_processors = $cpu.NumberOfLogicalProcessors; physical_cores = $cpu.NumberOfCores; supported_processor_list_check = 'not_performed' }
    memory = [ordered]@{ total_bytes = [int64]$computer.TotalPhysicalMemory }
    firmware = [ordered]@{ firmware_type = $firmwareType; secure_boot = Get-SecureBootState; tpm = Get-TpmState }
    system_drive = [ordered]@{ drive = $systemDrive; size_bytes = if ($disk) { [int64]$disk.Size } else { $null }; free_bytes = if ($disk) { [int64]$disk.FreeSpace } else { $null } }
    graphics = $video
    assessment = [ordered]@{ official_compatibility = 'not_determined'; note = 'Use Microsoft PC Health Check and the official Windows requirements/processor list. This inventory is not an eligibility verdict.' }
}
if ($OutputFormat -eq 'Json') { $report | ConvertTo-Json -Depth 8 }
else {
    Write-Host 'Joynexa Modern - read-only readiness inventory' -ForegroundColor Cyan
    $report | ConvertTo-Json -Depth 8
    Write-Host 'No settings were changed. CPU supported-list eligibility was not checked.' -ForegroundColor Yellow
}
