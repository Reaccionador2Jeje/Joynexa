# Joynexa Runtime entry point for an extracted edition kit.
[CmdletBinding()]
param(
  [ValidateSet('Diagnose','Personalize','Balanced','Performance','Restore')]
  [string]$Action='Diagnose'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath=Join-Path $root 'joynexa-setup.json'
if(-not(Test-Path -LiteralPath $manifestPath)){throw 'joynexa-setup.json is missing. Extract the complete edition kit first.'}
$m=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
if($m.product -ne 'Joynexa Windows' -or $m.edition -notin @('core','play','productivity','modern','retro','legacy')){throw 'Invalid Joynexa edition manifest.'}
switch($Action){
  'Diagnose' {
    $script=Join-Path $root 'Get-JoynexaHardwareReport.ps1'
    if(-not(Test-Path -LiteralPath $script)){throw 'Hardware advisor is missing.'}
    & $script -OutputPath (Join-Path $root 'joynexa-hardware-report.json')
    $recovery=Join-Path $root 'Test-JoynexaRecovery.ps1'
    if(Test-Path -LiteralPath $recovery){& $recovery -OutputPath (Join-Path $root 'joynexa-recovery-report.json')}
  }
  'Personalize' {
    $script=Join-Path $root 'Install-Joynexa.ps1'
    if(-not(Test-Path -LiteralPath $script)){throw 'Joynexa installer is missing.'}
    & $script
  }
  default {
    $script=Join-Path $root 'Optimize-Joynexa.ps1'
    if(-not(Test-Path -LiteralPath $script)){throw 'Optimization engine is missing.'}
    $mode=if($Action -eq 'Balanced'){'Balanced'}elseif($Action -eq 'Performance'){'Performance'}else{'Restore'}
    & $script -Mode $mode
  }
}
