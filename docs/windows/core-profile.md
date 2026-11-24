# Joynexa Core profile (prototype v0.1)

This is an optional, per-user Windows profile—not an ISO, installer, debloater, or Windows replacement.

## Safety scope

The script changes only:
- Current-user transparency preference.
- Current-user window animation preference.

It does **not** disable Windows Update, Microsoft Defender, Windows Firewall, UAC, recovery, drivers, or services. It does not remove applications or alter boot configuration.

## Requirements

- Windows PowerShell 5.1 or later.
- A supported Windows installation.
- Run under the Windows user account whose visual preferences should change.
- No administrator elevation is intended or required.

## Run

Open PowerShell in this repository folder:

```powershell
# Read-only hardware and startup inventory
.\tools\windows\Joynexa-Core.ps1 -Mode Audit

# Back up the registry keys, then apply the two visual preferences
.\tools\windows\Joynexa-Core.ps1 -Mode Apply

# Restore the registry keys from the saved backups
.\tools\windows\Joynexa-Core.ps1 -Mode Restore
```

The backup is stored under:

```
%LOCALAPPDATA%\Joynexa\Backups\Core-v0.1
```

**Important:** Restore imports the backed-up registry keys. If you changed other values under those same keys after applying the profile, those later changes may also be overwritten. Keep the backup folder until you have verified the result.

## ThinkPad Edge E430 validation

Before selecting a Windows base or making hardware-specific changes, collect the Audit output and record:
- Exact CPU model (not just the Core i5 family).
- Installed RAM and storage type/capacity.
- BIOS/UEFI version and boot mode.
- Graphics and network adapters.
- Current Windows edition, version, and build.

Do not publish a compatibility claim or performance figure until tested on the actual device. Start with a full personal-file backup and a tested recovery path.

## Current limitations

- Prototype only; no ISO or bootable installer is produced.
- Audit output must be reviewed by the maintainer; the script does not upload device information.
- No performance improvement is guaranteed. Measure before and after under the same conditions.
