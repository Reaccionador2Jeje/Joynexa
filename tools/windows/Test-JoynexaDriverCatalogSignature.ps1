[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$CatalogPath,
    [string]$ExpectedSha256,
    [string]$ExpectedSignerSubject
)

$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $CatalogPath).Path
$hash = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
$signature = Get-AuthenticodeSignature -FilePath $resolved

$result = [ordered]@{
    file = $resolved
    sha256 = $hash
    signature_status = [string]$signature.Status
    signer_subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
    timestamp_signer_subject = if ($signature.TimeStamperCertificate) { $signature.TimeStamperCertificate.Subject } else { $null }
    verification = 'not_approved'
}

if ($ExpectedSha256 -and $hash -ne $ExpectedSha256.ToLowerInvariant()) {
    $result.verification = 'failed_hash_mismatch'
    $result | ConvertTo-Json -Depth 4
    exit 1
}
if ($ExpectedSignerSubject -and (!$signature.SignerCertificate -or $signature.SignerCertificate.Subject -ne $ExpectedSignerSubject)) {
    $result.verification = 'failed_signer_mismatch'
    $result | ConvertTo-Json -Depth 4
    exit 1
}
if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
    $result.verification = 'failed_signature'
    $result | ConvertTo-Json -Depth 4
    exit 1
}

$result.verification = 'signature_valid_hash_recorded'
$result | ConvertTo-Json -Depth 4
