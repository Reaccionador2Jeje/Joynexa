# Joynexa Hardware Intelligence

Hardware Intelligence is the inventory foundation for edition compatibility decisions. It records what a machine reports; it does not claim that Windows is compatible or recommend bypassing operating-system requirements.

## Linux inventory

On the reference ThinkPad Edge E430 running Debian/NEXORA OS:

```bash
python3 tools/linux/joynexa-audit.py > joynexa-hardware-report.json
python3 tools/validate-hardware-report.py joynexa-hardware-report.json
```

The collector uses Python's standard library and optional system utilities such as `lscpu`, `lsblk`, `lspci`, and `mokutil`. Missing utilities or unavailable firmware fields are reported as unknown or omitted rather than guessed.

The existing human-readable audit remains available:

```bash
bash tools/linux/joynexa-audit.sh
```

## Report contents

- Operating system, kernel, and CPU architecture.
- CPU model, vendor, logical processor count, cores per socket, and sockets when available.
- Total and available memory.
- Storage device model, capacity, type, and rotational indicator.
- Graphics and network PCI device descriptions.
- System and motherboard vendor/model plus BIOS version/date when exposed by firmware.
- UEFI/legacy boot indication and Secure Boot state when `mokutil` is available.

## Privacy

The report deliberately excludes serial numbers, MAC addresses, IP addresses, hostnames, and mount paths. It does not upload anything. The maintainer must inspect the generated JSON before sharing it; hardware model and PCI descriptions can still reveal device details.

## Compatibility decision policy

Inventory is evidence, not a compatibility verdict. Joynexa must not mark an edition as supported until the following are checked against the exact proposed Windows base:

1. CPU model and official OS support requirements.
2. Firmware mode and required security capabilities.
3. RAM and storage capacity.
4. Graphics, network, audio, chipset, and input-device driver availability.
5. Installation, update, recovery, sleep/resume, and sustained-use tests on the target hardware.

Unknown values stay unknown. No unsupported CPU, TPM, Secure Boot, or installer checks are bypassed. The Legacy edition may document preservation options separately, but it must not be presented as a supported modern Windows installation.

See the [Edition Requirements Matrix](edition-requirements-matrix.md) for the current Windows 11 baseline and the [E430 reference profile](reference-device-e430.md) for collected evidence.

## CI behavior

GitHub Actions runs the collector on a temporary hosted Ubuntu runner and validates the JSON structure and privacy exclusions. That verifies the tool itself; it does **not** inventory the maintainer's ThinkPad. The reference-device report must be collected locally on the E430.

## Current reference-device status

- Device: Lenovo ThinkPad Edge E430 (firmware product identifier 32543QS).
- CPU: Intel Core i5-2520M @ 2.50 GHz, 2 cores / 4 logical processors.
- RAM: 3,686,035,456 bytes (~3.43 GiB reported).
- Main disk: 500 GB mechanical HDD.
- Windows 11 CPU eligibility: unsupported by Microsoft's supported Intel processor list.
- Windows 11 RAM: below the 4 GB minimum based on reported total memory.
- Firmware, Secure Boot, TPM 2.0, and graphics driver capabilities: unknown or not verified.
- Windows edition compatibility: not established; the device is not an official Windows 11 target.

The local inventory was collected on 2026-11-24. See [the full reference-device profile](reference-device-e430.md).
