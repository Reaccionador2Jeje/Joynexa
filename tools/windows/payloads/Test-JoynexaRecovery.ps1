# Joynexa Recovery Check — read-only diagnostics; no repair actions are performed.
[CmdletBinding()]
param([string]$OutputPath = (Join-Path $PWD 'joynexa-recovery-report.json'))
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$os=Get-CimInstance Win32_OperatingSystem
$disk=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'"
$services=@('WinDefend','wuauserv','BITS','CryptSvc') | ForEach-Object {
  $svc=Get-Service -Name $_ -ErrorAction SilentlyContinue
  [pscustomobject]@{Name=$_;Present=($null -ne $svc);Status=if($svc){[string]$svc.Status}else{'NotPresent'}}
}
$checks=@(
  [pscustomobject]@{Name='Windows system drive';Status=if($disk.FreeSpace -gt 5GB){'OK'}else{'Review'};Detail=('{0:N1} GiB free' -f ($disk.FreeSpace/1GB))},
  [pscustomobject]@{Name='Windows installation';Status='Detected';Detail="$($os.Caption) $($os.Version) build $($os.BuildNumber)"},
  [pscustomobject]@{Name='System architecture';Status='Detected';Detail=$os.OSArchitecture}
)
$report=[pscustomobject]@{
  SchemaVersion=1;Product='Joynexa Recovery Check';GeneratedAtUtc=[DateTime]::UtcNow.ToString('o')
  ReadOnly=$true;Checks=$checks;ProtectedServices=$services
  Notes=@('This report does not repair Windows.','Do not disable Defender, Windows Update, BITS, or Cryptographic Services.','Use Windows Settings or official Microsoft recovery media for repairs.')
}
$parent=Split-Path -Parent $OutputPath
if($parent -and -not(Test-Path -LiteralPath $parent)){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
$report|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host "Joynexa recovery report saved: $OutputPath"
Write-Host 'Read-only check complete. No repairs or system changes were made.'
