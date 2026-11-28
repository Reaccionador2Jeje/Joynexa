#!/usr/bin/env python3
"""Build a safe Joynexa Windows setup kit (interactive Windows OOBE is preserved)."""
from __future__ import annotations
import argparse, json, pathlib, sys, tempfile, zipfile, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROFILES = ROOT / "config/windows/branding-profiles.json"
INSTALLER = ROOT / "tools/windows/payloads/Install-Joynexa.ps1"
OPTIMIZER = ROOT / "tools/windows/payloads/Optimize-Joynexa.ps1"
HARDWARE_REPORT = ROOT / "tools/windows/payloads/Get-JoynexaHardwareReport.ps1"
EDITIONS = ("core", "play", "productivity", "modern", "retro", "legacy")
NS = "urn:schemas-microsoft-com:unattend"
ET.register_namespace("", NS)

FIRST_BOOT = r'''# Joynexa First Boot — run manually from an extracted setup kit.
# Applies only current-user personalization. It does not alter Windows security,
# activation, updates, services, accounts, or protected system files.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $root 'joynexa-setup.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$edition = [string]$manifest.edition
$palette = $manifest.palette
$assets = Join-Path $root 'assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null

Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new(1920,1080)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $bg = [System.Drawing.ColorTranslator]::FromHtml($palette.background)
  $surface = [System.Drawing.ColorTranslator]::FromHtml($palette.surface)
  $accent = [System.Drawing.ColorTranslator]::FromHtml($palette.accent)
  $fg = [System.Drawing.ColorTranslator]::FromHtml($palette.foreground)
  $muted = [System.Drawing.ColorTranslator]::FromHtml($palette.muted)
  $rect = [System.Drawing.Rectangle]::new(0,0,1920,1080)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect,$bg,$surface,35)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.FillRectangle($brush,$rect)
  $brush.Dispose()
  $pen = [System.Drawing.Pen]::new($accent,5)
  $graphics.DrawEllipse($pen,1230,150,470,470)
  $graphics.DrawEllipse($pen,1320,240,290,290)
  $pen.Dispose()
  $font = [System.Drawing.Font]::new('Segoe UI',64,[System.Drawing.FontStyle]::Bold)
  $small = [System.Drawing.Font]::new('Segoe UI',24,[System.Drawing.FontStyle]::Regular)
  $fgBrush = [System.Drawing.SolidBrush]::new($fg)
  $mutedBrush = [System.Drawing.SolidBrush]::new($muted)
  $graphics.DrawString([string]$manifest.edition_name,$font,$fgBrush,110,850)
  $graphics.DrawString('Windows, shaped around you.',$small,$mutedBrush,114,940)
  $font.Dispose(); $small.Dispose(); $fgBrush.Dispose(); $mutedBrush.Dispose()
  $pen2 = [System.Drawing.Pen]::new($accent,8)
  $graphics.DrawLine($pen2,110,820,280,820); $pen2.Dispose()
  $wallpaper = Join-Path $assets 'joynexa-wallpaper.png'
  $bitmap.Save($wallpaper,[System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $bitmap.Dispose() }

$personalization = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
New-Item -Path $personalization -Force | Out-Null
New-ItemProperty -Path $personalization -Name SystemUsesLightTheme -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -Path $personalization -Name AppsUseLightTheme -PropertyType DWord -Value 0 -Force | Out-Null
$desktop = 'HKCU:\Control Panel\Desktop'
Set-ItemProperty -Path $desktop -Name Wallpaper -Value $wallpaper
Set-ItemProperty -Path $desktop -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path $desktop -Name TileWallpaper -Value '0'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class JoynexaDesktop {
  [DllImport("user32.dll", CharSet=CharSet.Auto)]
  public static extern int SystemParametersInfo(int action, int param, string value, int update);
}
'@
[void][JoynexaDesktop]::SystemParametersInfo(20,0,$wallpaper,3)
Write-Host "Joynexa $edition personalization applied to the current user."
Write-Host "No Windows system files, services, activation, or security settings were changed."
'''

def tag(name: str) -> str:
    return f"{{{NS}}}{name}"

def make_unattend() -> bytes:
    root = ET.Element(tag("unattend"), {"{http://www.w3.org/2001/XMLSchema-instance}schemaLocation": f"{NS} unattend.xsd"})
    settings = ET.SubElement(root, tag("settings"), {"pass":"specialize"})
    comp = ET.SubElement(settings, tag("component"), {
        "name":"Microsoft-Windows-Shell-Setup", "processorArchitecture":"amd64",
        "publicKeyToken":"31bf3856ad364e35", "language":"neutral", "versionScope":"nonSxS"
    })
    ET.SubElement(comp, tag("ComputerName")).text = "JOYNEXA-PC"
    # No OOBE pass, account creation, EULA acceptance, activation, or requirement bypass.
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)

def load_profiles(path: pathlib.Path) -> dict:
    data=json.loads(path.read_text(encoding="utf-8"))
    if set(data.get("editions",{})) != set(EDITIONS): raise ValueError("branding profile must contain exactly six editions")
    return data

def build(edition: str, output: pathlib.Path, profiles: dict) -> None:
    item=profiles["editions"][edition]
    manifest={"schema_version":1,"product":"Joynexa Windows","component":"joynexa-setup-first-boot",
      "edition":edition,"edition_name":item["name"],"palette":{k:item[k] for k in ("accent","background","surface","foreground","muted")},
      "setup":{"answer_file":"unattend.xml","computer_name":"JOYNEXA-PC","oobe":"interactive"},
      "first_boot":{"script":"Start-JoynexaFirstBoot.ps1","scope":"current_user","requires_manual_launch":True},
      "safety":{"windows_requirements_bypassed":False,"eula_auto_accepted":False,"account_auto_created":False,
      "activation_modified":False,"security_settings_weakened":False,"protected_windows_files_modified":False}}
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,"w",zipfile.ZIP_DEFLATED,compresslevel=9) as z:
      z.writestr("joynexa-setup.json",json.dumps(manifest,indent=2)+"\n")
      z.writestr("unattend.xml",make_unattend())
      z.writestr("Start-JoynexaFirstBoot.ps1",FIRST_BOOT)
      z.write(INSTALLER, "Install-Joynexa.ps1")
      z.write(OPTIMIZER, "Optimize-Joynexa.ps1")
      z.write(HARDWARE_REPORT, "Get-JoynexaHardwareReport.ps1")
      z.writestr("README.txt",f"""{item['name']} setup kit

1. Extract this archive.
2. Use unattend.xml only as an optional Windows Setup answer file. It sets a computer name; Windows OOBE remains interactive.
3. Complete Windows setup and all account, privacy, and licensing prompts yourself.
4. After signing in, run Install-Joynexa.ps1 and type YES when prompted. It launches the first-boot personalization for the current user.\n5. Run Get-JoynexaHardwareReport.ps1 to create a read-only hardware inventory JSON.\n6. Optionally run Optimize-Joynexa.ps1 -Mode Balanced or -Mode Performance. Use -Mode Restore to restore the captured user-interface values.

This is not Windows installation media and contains no Windows payload or license.
It does not bypass hardware requirements, activate Windows, create accounts, disable security, or alter protected system files.
""")
    with zipfile.ZipFile(output) as z:
      assert z.testzip() is None
      assert set(z.namelist())=={"joynexa-setup.json","unattend.xml","Start-JoynexaFirstBoot.ps1","Install-Joynexa.ps1","Optimize-Joynexa.ps1","Get-JoynexaHardwareReport.ps1","README.txt"}

def self_test(profiles: dict) -> None:
  xml=make_unattend()
  parsed=ET.fromstring(xml)
  assert parsed.find(f".//{tag('ComputerName')}").text=="JOYNEXA-PC"
  assert parsed.find(tag("settings")) is not None
  assert parsed.find(f".//{tag('OOBE')}") is None
  assert "SystemParametersInfo" in FIRST_BOOT and "HKCU:" in FIRST_BOOT
  installer=INSTALLER.read_text(encoding="utf-8")
  assert "Type YES to continue" in installer and "interactive" in installer
  hardware=HARDWARE_REPORT.read_text(encoding="utf-8")
  assert "Get-CimInstance" in hardware and "ReadOnly = $true" in hardware
  assert "Remove-Item" not in hardware and "Set-Service" not in hardware
  optimizer=OPTIMIZER.read_text(encoding="utf-8")
  assert "ValidateSet" in optimizer and "optimization-backup.json" in optimizer
  assert "HKCU:" in optimizer and "HKLM:" not in optimizer and "Windows Update" in optimizer
  assert "windows_requirements_bypassed" in installer and "current_user" in installer
  assert "New-ItemProperty" in FIRST_BOOT and "Set-ItemProperty -Path $personalization -Name SystemUsesLightTheme -Type" not in FIRST_BOOT
  forbidden=("BypassTPMCheck","BypassSecureBootCheck","SkipMachineOOBE","SkipUserOOBE","AutoLogon","ProductKey")
  assert not any(x.lower() in xml.decode().lower()+FIRST_BOOT.lower() for x in forbidden)
  with tempfile.TemporaryDirectory() as td:
    for ed in EDITIONS:
      out=pathlib.Path(td)/f"{ed}.zip"; build(ed,out,profiles)
      with zipfile.ZipFile(out) as z:
        m=json.loads(z.read("joynexa-setup.json"))
        assert m["edition"]==ed and m["setup"]["oobe"]=="interactive"
        assert all(v is False for v in m["safety"].values())
  print("OK: six setup kits, valid XML, interactive OOBE, first-boot payload, and safety assertions.")

def main() -> int:
  ap=argparse.ArgumentParser(description=__doc__)
  ap.add_argument("--edition",choices=EDITIONS); ap.add_argument("--output",type=pathlib.Path)
  ap.add_argument("--config",type=pathlib.Path,default=PROFILES); ap.add_argument("--check",action="store_true"); ap.add_argument("--self-test",action="store_true")
  a=ap.parse_args()
  try:
    profiles=load_profiles(a.config)
    if a.check: print("OK: six editions and palettes available.")
    if a.self_test: self_test(profiles)
    if a.edition:
      if not a.output: ap.error("--output is required with --edition")
      build(a.edition,a.output,profiles); print(f"Setup kit created: {a.output}")
    elif not (a.check or a.self_test): ap.error("provide --check, --self-test, or --edition")
  except (OSError,ValueError,KeyError,zipfile.BadZipFile) as e:
    print(f"ERROR: {e}",file=sys.stderr); return 1
  return 0
if __name__=="__main__": raise SystemExit(main())
