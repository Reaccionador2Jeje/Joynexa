# Joynexa Setup and First Boot

The Setup Engine creates edition-specific setup kits. Each kit contains:
- A minimal Windows answer file that only sets the computer name to `JOYNEXA-PC` during the specialize pass.
- An interactive Windows OOBE is deliberately preserved. The user handles account, privacy, EULA, and licensing prompts.
- A manually launched PowerShell first-boot script that generates a native 1920×1080 PNG wallpaper and applies dark appearance and wallpaper to the current user's profile.
- A JSON manifest with explicit safety assertions.
- `Optimize-Joynexa.ps1`, an optional Balanced/Performance profile for current-user visual settings, with a Restore mode and a backup under `%LOCALAPPDATA%\\Joynexa`.

## Build and test

```bash
python tools/windows/joynexa-setup-engine.py --check
python tools/windows/joynexa-setup-engine.py --self-test
python tools/windows/joynexa-setup-engine.py --edition core --output build/joynexa-core-setup.zip
```

## Use

1. Obtain Windows installation media independently from Microsoft and verify its published checksum.
2. Do not use this kit to bypass Windows hardware requirements.
3. If using the answer file, copy `unattend.xml` to the installation media as documented by Microsoft; Windows OOBE remains interactive.
4. Complete Windows installation and OOBE normally.
5. Extract the edition kit after signing in and run `Install-Joynexa.ps1`; review it first and type `YES` when prompted.
6. Optionally run `Optimize-Joynexa.ps1 -Mode Balanced` or `-Mode Performance`. Run `Optimize-Joynexa.ps1 -Mode Restore` to restore the captured values.

The first-boot script only changes current-user personalization values and creates a wallpaper under the extracted kit's assets directory. The optimization script only adjusts current-user animation, transparency, and menu-delay preferences; it saves their previous values before applying a profile. It does not modify system files, services, accounts, activation, Windows Update, driver-signature enforcement, or security settings. Review scripts before running them.

This is a setup customization kit, not a bootable installer, Windows image, or independent operating system. Windows remains the underlying OS and its license and support requirements still apply.


## Read-only hardware advisor

Every generated edition kit also includes `Get-JoynexaHardwareReport.ps1`.
Run it from PowerShell after extracting the kit:

```powershell
.\Get-JoynexaHardwareReport.ps1 -OutputPath .\joynexa-hardware-report.json
```

It inventories the Windows version, processor, memory, graphics adapters, and
storage devices, then writes a JSON report. It does not benchmark, update
drivers, change settings, or certify Windows compatibility. Use official
Microsoft and application requirements for compatibility decisions.


## Joynexa Runtime and Recovery

The edition kit includes `Start-JoynexaRuntime.ps1`, a small entry point that
validates the edition manifest and dispatches an explicit action:

- `-Action Diagnose`: creates hardware and read-only recovery reports.
- `-Action Personalize`: starts the interactive Joynexa first-boot installer.
- `-Action Balanced` / `-Action Performance`: applies reversible current-user UI preferences.
- `-Action Restore`: restores the previously captured UI preference values.

`Test-JoynexaRecovery.ps1` records OS identity, system-drive free space, and
the presence/status of selected protected services. It does not repair Windows,
change service startup types, or stop/start services. Reports are diagnostic
hints, not a guarantee that Windows is healthy.
