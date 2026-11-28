# Joynexa Hardware Advisor — read-only inventory and edition guidance.
[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $PWD 'joynexa-hardware-report.json')
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$computer = Get-CimInstance Win32_ComputerSystem
$video = @(Get-CimInstance Win32_VideoController | ForEach-Object {
    [pscustomobject]@{
        Name = $_.Name
        DriverVersion = $_.DriverVersion
        AdapterRAMBytes = if ($_.AdapterRAM) { [uint64]$_.AdapterRAM } else { $null }
    }
})
$disks = @(Get-CimInstance Win32_DiskDrive | ForEach-Object {
    [pscustomobject]@{
        Model = $_.Model
        SizeBytes = if ($_.Size) { [uint64]$_.Size } else { $null }
        MediaType = $_.MediaType
        InterfaceType = $_.InterfaceType
    }
})
$memoryBytes = [uint64]$computer.TotalPhysicalMemory
$freeBytes = [uint64]$os.FreePhysicalMemory * 1KB
$logicalCpus = [int]$cpu.NumberOfLogicalProcessors
$physicalCores = [int]$cpu.NumberOfCores
$editionHints = @()
if ($memoryBytes -lt 4GB) {
    $editionHints += 'Core: prefer lightweight apps and avoid unnecessary background workloads.'
} elseif ($memoryBytes -lt 8GB) {
    $editionHints += 'Core or Productivity: moderate multitasking; evaluate game requirements individually.'
} else {
    $editionHints += 'Play or Productivity may be considered after checking each app and game requirement.'
}
if ($disks | Where-Object { $_.MediaType -match 'Fixed hard disk' }) {
    $editionHints += 'At least one fixed disk is reported; verify whether it is HDD or SSD before estimating load times.'
}
$report = [pscustomobject]@{
    SchemaVersion = 1
    Product = 'Joynexa Windows Hardware Advisor'
    GeneratedAtUtc = [DateTime]::UtcNow.ToString('o')
    ReadOnly = $true
    OperatingSystem = [pscustomobject]@{
        Caption = $os.Caption
        Version = $os.Version
        BuildNumber = $os.BuildNumber
        Architecture = $os.OSArchitecture
    }
    Processor = [pscustomobject]@{
        Name = $cpu.Name
        LogicalProcessors = $logicalCpus
        PhysicalCores = $physicalCores
        MaxClockMHz = $cpu.MaxClockSpeed
    }
    Memory = [pscustomobject]@{
        TotalBytes = $memoryBytes
        AvailableBytes = $freeBytes
    }
    Graphics = $video
    Storage = $disks
    EditionGuidance = $editionHints
    Limitations = @(
        'Inventory is not a Windows compatibility verdict.',
        'No benchmark, driver update, system change, or hardware requirement bypass is performed.',
        'Check official Windows and application requirements before installation.'
    )
}
$parent = Split-Path -Parent $OutputPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
$report | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host "Joynexa hardware report saved: $OutputPath"
Write-Host "CPU: $($cpu.Name)"
Write-Host ("RAM: {0:N2} GiB" -f ($memoryBytes / 1GB))
Write-Host "This is read-only inventory, not a compatibility certification."
