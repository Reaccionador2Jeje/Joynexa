#requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateScript({Test-Path -LiteralPath $_ -PathType Leaf})][string]$SourceIso,
    [Parameter(Mandatory=$true)][ValidateSet('core','play','productivity','modern','retro','legacy')][string]$Edition,
    [Parameter(Mandatory=$true)][string]$Manifest,
    [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSha256,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [ValidateRange(1,999)][int]$ImageIndex = 1,
    [switch]$AuditOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Stop-Build([string]$Message) {
    throw "JOY NEXA IMAGE BUILDER: $Message"
}

function Read-Manifest([string]$Path) {
    try { $data = Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable }
    catch { Stop-Build "Cannot parse edition manifest: $($_.Exception.Message)" }
    if ($data.manifest_id -ne 'joynexa-windows-build-manifest' -or $data.schema_version -ne 1) {
        Stop-Build 'Unsupported Joynexa edition manifest.'
    }
    if ($data.edition.id -ne $Edition) { Stop-Build "Manifest edition '$($data.edition.id)' does not match '$Edition'." }
    if ($data.build_readiness -ne 'planning_only') { Stop-Build 'Manifest readiness must be planning_only for this builder version.' }
    $safetyKeys = @('windows_requirements_bypassed','driver_signature_enforcement_disabled','unlicensed_windows_payload_included','os_image_built','system_modified')
    foreach ($key in $safetyKeys) {
        if ($data.safety[$key] -ne $false) { Stop-Build "Safety assertion '$key' must be false." }
    }
    if ($null -eq $data.components -or $data.components -isnot [array]) { Stop-Build 'Manifest components must be an array.' }
    return $data
}

function Invoke-Dism([string[]]$Arguments) {
    $output = & dism.exe @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { Stop-Build "DISM failed ($LASTEXITCODE): $($output -join ' ')" }
    return ($output -join "`n")
}

$isoPath = (Resolve-Path -LiteralPath $SourceIso).Path
$manifestPath = (Resolve-Path -LiteralPath $Manifest).Path
$outPath = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($outPath.StartsWith($isoPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    Stop-Build 'Output directory cannot be inside the source ISO file path.'
}
if (-not (Get-Command Mount-DiskImage -ErrorAction SilentlyContinue)) { Stop-Build 'Mount-DiskImage is unavailable; run on Windows with the Storage module.' }
if (-not (Get-Command dism.exe -ErrorAction SilentlyContinue)) { Stop-Build 'DISM is unavailable.' }

$manifestData = Read-Manifest -Path $manifestPath
$actualHash = (Get-FileHash -LiteralPath $isoPath -Algorithm SHA256).Hash
if ($actualHash -ne $ExpectedSha256.ToUpperInvariant()) {
    Stop-Build "ISO SHA-256 mismatch. Actual: $actualHash. No files were staged."
}

$unverified = @($manifestData.components | Where-Object { $_.definition_status -ne 'verified' })
if (-not $AuditOnly -and $unverified.Count -gt 0) {
    $ids = ($unverified | ForEach-Object { "$($_.id)=$($_.definition_status)" }) -join ', '
    Stop-Build "Edition '$Edition' is not build-ready. Every selected component must be verified. Current: $ids"
}

$diskImage = $null
$mounted = $false
try {
    $diskImage = Mount-DiskImage -ImagePath $isoPath -Access ReadOnly -PassThru
    $mounted = $true
    $volumes = @($diskImage | Get-Volume | Where-Object DriveLetter)
    if ($volumes.Count -ne 1) { Stop-Build 'Expected exactly one mounted ISO volume.' }
    $root = "$($volumes[0].DriveLetter):\"
    $wim = Join-Path $root 'sources\install.wim'
    $esd = Join-Path $root 'sources\install.esd'
    $imageFile = if (Test-Path -LiteralPath $wim) { $wim } elseif (Test-Path -LiteralPath $esd) { $esd } else { Stop-Build 'ISO does not contain sources\install.wim or sources\install.esd.' }

    $dismText = Invoke-Dism -Arguments @('/English','/Get-WimInfo',"/WimFile:$imageFile")
    $indexes = @([regex]::Matches($dismText, '(?m)^Index\s*:\s*(\d+)') | ForEach-Object { [int]$_.Groups[1].Value })
    if ($indexes -notcontains $ImageIndex) { Stop-Build "Image index $ImageIndex not found. Available indexes: $($indexes -join ', ')." }

    $indexText = Invoke-Dism -Arguments @('/English','/Get-WimInfo',"/WimFile:$imageFile","/Index:$ImageIndex")
    $nameMatch = [regex]::Match($indexText, '(?m)^Name\s*:\s*(.+)$')
    $editionName = if ($nameMatch.Success) { $nameMatch.Groups[1].Value.Trim() } else { 'Unknown' }

    $report = [ordered]@{
        schema_version = 1
        product = 'Joynexa Windows Image Builder'
        operation = if ($AuditOnly) { 'source_audit_only' } else { 'verified_source_staging' }
        edition = $Edition
        source_iso_name = [System.IO.Path]::GetFileName($isoPath)
        source_sha256 = $actualHash
        source_image_file = [System.IO.Path]::GetFileName($imageFile)
        selected_image_index = $ImageIndex
        selected_image_name = $editionName
        available_image_indexes = $indexes
        selected_components = @($manifestData.components | ForEach-Object { @{ id=$_.id; status=$_.definition_status } })
        verified_components_only = ($unverified.Count -eq 0)
        requirements_bypassed = $false
        signature_enforcement_disabled = $false
        windows_payload_downloaded = $false
        activation_modified = $false
        source_modified = $false
        iso_created = $false
        staged = $false
        created_at_utc = [DateTime]::UtcNow.ToString('o')
    }

    if (-not $AuditOnly) {
        if (Test-Path -LiteralPath $outPath) { Stop-Build 'Output directory already exists; choose a new empty destination.' }
        New-Item -ItemType Directory -Path $outPath -Force | Out-Null
        Copy-Item -Path (Join-Path $root '*') -Destination $outPath -Recurse -Force
        $report.staged = $true
    }

    New-Item -ItemType Directory -Path $outPath -Force | Out-Null
    $reportPath = Join-Path $outPath "joynexa-$Edition-image-audit.json"
    $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $reportPath -Encoding utf8
    Write-Host "Joynexa source inspection complete: $reportPath"
    if ($AuditOnly) { Write-Host 'Audit-only: source files were not copied or modified.' }
    else { Write-Host 'Verified source files staged unchanged. No ISO was created.' }
}
finally {
    if ($mounted -and $null -ne $diskImage) {
        Dismount-DiskImage -ImagePath $isoPath -ErrorAction SilentlyContinue | Out-Null
    }
}
