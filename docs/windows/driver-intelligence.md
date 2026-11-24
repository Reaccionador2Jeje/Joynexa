# Joynexa Driver Intelligence and Installation

## Goal

Make installation more reliable by preparing the small set of drivers needed by Windows Setup, then installing a curated set of matching drivers after Windows starts. No third-party tool can guarantee zero driver errors on every PC.

## Two separate driver phases

### 1. Windows Setup / WinPE phase

The message **"No device drivers were found"** can occur before Windows is installed. A post-install script cannot fix this stage.

Joynexa's future media builder must:
1. Identify the target machine and the exact storage controller / USB controller hardware IDs.
2. Determine whether the Windows Setup environment (WinPE) lacks a required driver.
3. Add only the required, architecture-compatible, signed OEM INF package to the correct `boot.wim` index using Microsoft's DISM workflow.
4. Keep a copy of the same required storage package available for the installed Windows image when appropriate.
5. Validate the modified WIM and test the media on the target device.

Microsoft documents injecting drivers into WinPE boot images with DISM. It also recommends not adding a full driver collection to WinPE: include only drivers proven necessary for setup. See [Customize Windows PE boot images](https://learn.microsoft.com/en-us/windows/deployment/customize-boot-image) and [WinPE: Mount and Customize](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/winpe-mount-and-customize?view=windows-11).

### 2. Installed Windows phase

After Windows starts, Joynexa can stage curated driver packages and let Plug and Play match them to devices. The initial implementation is:

```powershell
.\tools\windows\Install-JoynexaDrivers.ps1 -DriverPath "D:\JoynexaDrivers"
```

The script:
- Requires an elevated PowerShell session.
- Accepts a local driver directory containing INF packages.
- Uses PnPUtil to add packages and install matching devices.
- Requests a device rescan.
- Writes a transcript log.
- Does not download drivers or bypass driver-signature enforcement.
- Does not force unsigned drivers or disable Windows security features.

See [Microsoft's PnPUtil documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/pnputil).

## Driver source and trust policy

- Prefer the computer manufacturer's support page and the component manufacturer's official driver distribution.
- Keep the original package, INF, catalog (CAT), and supporting files together.
- Require a valid signature accepted by Windows; never use `/ForceUnsigned`.
- Record vendor, device IDs, supported Windows versions, architecture, package version, source URL, SHA-256, and test status in the future driver catalog.
- Do not silently install a driver merely because its filename looks relevant.
- Do not bundle random driver collections, repackaged executables, or packages from unofficial download sites.
- Do not overwrite a newer working driver without a documented reason and rollback plan.
- Keep Windows Update and normal Plug and Play driver selection available.

## E430: evidence still needed

The E430 inventory currently identifies:
- Intel HD Graphics device [8086:0126].
- Broadcom BCM4313 Wi-Fi [14e4:4727].
- Realtek RTL8111/8168/8211/8411 Ethernet [10ec:8168].
- A 500 GB ST500LT012-1DG142 SATA HDD.

The report does **not** identify the SATA/AHCI controller PCI hardware ID or USB controller IDs. Therefore Joynexa must not guess which storage or USB driver to inject into WinPE. Collect the controller IDs and inspect the firmware storage mode before preparing E430-specific setup media.

## Troubleshooting the setup message

Before changing an installer:
- Confirm the installation media was created from an official, intact Windows source.
- Try another USB port and recreate the media if corruption is suspected.
- Determine whether the installer can see the target disk.
- If the disk is missing, identify the storage controller and obtain its exact signed OEM driver.
- If the disk is visible but setup still reports missing drivers, investigate the USB media/controller path and setup logs.

Do not change firmware storage modes casually: changing AHCI/RAID settings can make an existing operating system unbootable. Record the original setting and consult the device documentation first.

## Current status

- [x] Define a safe post-install INF driver staging script.
- [x] Document the separate WinPE and installed-Windows driver phases.
- [ ] Build a signed, hardware-ID-based driver catalog.
- [ ] Add WinPE driver injection to the Windows media builder.
- [ ] Add package signature, hash, architecture, and OS-version validation.
- [ ] Test on physical hardware and virtual machines.
