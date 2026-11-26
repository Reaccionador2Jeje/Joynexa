# Joynexa Setup and First Boot

The Setup Engine creates edition-specific setup kits. Each kit contains:
- A minimal Windows answer file that only sets the computer name to `JOYNEXA-PC` during the specialize pass.
- An interactive Windows OOBE is deliberately preserved. The user handles account, privacy, EULA, and licensing prompts.
- A manually launched PowerShell first-boot script that generates a native 1920×1080 PNG wallpaper and applies dark appearance and wallpaper to the current user's profile.
- A JSON manifest with explicit safety assertions.

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
5. Extract the edition kit after signing in and manually run `Start-JoynexaFirstBoot.ps1`.

The first-boot script only changes current-user personalization values and creates a wallpaper under the extracted kit's assets directory. It does not modify system files, services, accounts, activation, Windows Update, driver-signature enforcement, or security settings. Review scripts before running them.

This is a setup customization kit, not a bootable installer, Windows image, or independent operating system. Windows remains the underlying OS and its license and support requirements still apply.
