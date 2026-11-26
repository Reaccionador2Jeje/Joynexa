[CmdletBinding()]
param([string]$OutputPath = ".\joynexa-hardware-inventory.json")
$ErrorActionPreference = "Stop"
function Read-Value($Object, [string]$Name) {
    if ($null -eq $Object -or $null -eq $Object.$Name) { return "" }
    return [string]$Object.$Name
}
$os = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$processors = @(Get-CimInstance Win32_Processor)
$signedDrivers = @(Get-CimInstance Win32_PnPSignedDriver)
$driverByDevice = @{}
foreach ($driver in $signedDrivers) {
    $key = Read-Value $driver "DeviceID"
    if ($key -and -not $driverByDevice.ContainsKey($key)) { $driverByDevice[$key] = $driver }
}
$devices = foreach ($device in @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue)) {
    $instanceId = Read-Value $device "InstanceId"
    $ids = @()
    if ($instanceId) {
        try {
            $property = Get-PnpDeviceProperty -InstanceId $instanceId -KeyName "DEVPKEY_Device_HardwareIds" -ErrorAction Stop
            if ($property.Data) { $ids = @($property.Data | ForEach-Object { [string]$_ }) }
        } catch { $ids = @() }
    }
    $driver = $driverByDevice[$instanceId]
    [ordered]@{
        name = Read-Value $device "FriendlyName"
        device_class = Read-Value $device "Class"
        manufacturer = Read-Value $device "Manufacturer"
        status = Read-Value $device "Status"
        instance_id = $instanceId
        hardware_ids = $ids
        driver = [ordered]@{
            provider = if ($driver) { Read-Value $driver "DriverProviderName" } else { "" }
            version = if ($driver) { Read-Value $driver "DriverVersion" } else { "" }
            date = if ($driver) { Read-Value $driver "DriverDate" } else { "" }
            inf_name = if ($driver) { Read-Value $driver "InfName" } else { "" }
            is_signed = if ($driver) { [bool]$driver.IsSigned } else { $null }
        }
    }
}
$inventory = [ordered]@{
    schema_version = 1
    inventory_id = "joynexa-windows-hardware-inventory"
    collected_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    collection_mode = "read_only_present_devices"
    operating_system = [ordered]@{
        caption = Read-Value $os "Caption"
        version = Read-Value $os "Version"
        build_number = Read-Value $os "BuildNumber"
        architecture = Read-Value $os "OSArchitecture"
    }
    system = [ordered]@{
        manufacturer = Read-Value $computer "Manufacturer"
        model = Read-Value $computer "Model"
        processor_names = @($processors | ForEach-Object { Read-Value $_ "Name" })
        logical_processors = if ($processors.Count) { [int]$processors[0].NumberOfLogicalProcessors } else { 0 }
        installed_memory_bytes = [uint64]$computer.TotalPhysicalMemory
    }
    devices = @($devices)
    privacy = @{
        serial_numbers_collected = $false
        network_addresses_collected = $false
        user_names_collected = $false
        driver_packages_modified = $false
    }
}
$destination = [System.IO.Path]::GetFullPath($OutputPath)
$parent = Split-Path -Parent $destination
if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
[System.IO.File]::WriteAllText($destination, ($inventory | ConvertTo-Json -Depth 10), [System.Text.UTF8Encoding]::new($false))
Write-Host "Joynexa inventory exported: $destination"
Write-Host ("Devices collected: {0}" -f @($devices).Count)
Write-Host "Read-only collection. No drivers were downloaded, installed, or changed."