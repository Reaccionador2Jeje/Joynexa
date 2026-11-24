# Joynexa Hardware Intelligence

Hardware Intelligence is the inventory foundation for edition compatibility decisions. It records what a machine reports; it does not claim that Windows is compatible or recommend bypassing operating-system requirements.

## Linux inventory

On the reference ThinkPad Edge E430 running Debian/NEXORA OS:

\`\`\`bash
python3 tools/linux/joynexa-audit.py > joynexa-hardware-report.json
python3 tools/validate-hardware-report.py joynexa-hardware-report.json
\`\`\`

The collector uses Python's standard library and optional system utilities such as \`lscpu\`, \`lsblk\`, \`lspci\`, and \`mokutil\`. Missing utilities or unavailable firmware fields are reported as unknown or omitted rather than guessed.

The existing human-readable audit remains available:

\`\`\`bash
bash tools/linux/joynexa-audit.sh
\`\`\`

## Report contents

- Operating system, kernel, and CPU architecture.
- CPU model, vendor, logical processor count, cores per socket, and sockets when available.
- Total and available memory.
- Storage device model, capacity, type, and rotational indicator.
- Graphics and network PCI device descriptions.
- System and motherboard vendor/model plus BIOS version/date when exposed by firmware.
- UEFI/legacy boot indication and Secure Boot state when \`mokutil\` is available.

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

## CI behavior

GitHub Actions runs the collector on a temporary hosted Ubuntu runner and validates the JSON structure and privacy exclusions. That verifies the tool itself; it does **not** inventory the maintainer's ThinkPad. The reference-device report must be collected locally on the E430.

## Current reference-device status

- Device: Lenovo ThinkPad Edge E430.
- CPU family: Intel Core i5; exact model not yet recorded.
- Hardware inventory: pending local collection.
- Windows edition compatibility: not yet established.


## First reference-device inventory

The first local report from the Lenovo ThinkPad Edge E430 was collected on 2026-11-24. It identifies a Lenovo 32543QS system, 4 logical CPUs, approximately 3.43 GiB reported RAM, a 500 GB ST500LT012-1DG142 drive, Intel 2nd Generation integrated graphics, Broadcom BCM4313 Wi-Fi, Realtek gigabit Ethernet, and BIOS H0ET30WW (1.12). The exact CPU model, rotational storage flag, boot mode certainty, and Secure Boot state remain unresolved. See [the reference-device profile](reference-device-e430.md).

The inventory collector now falls back to `/proc/cpuinfo` when localized `lscpu` output does not expose the expected English CPU labels, and checks sysfs for a missing rotational flag. Run `git pull` and recollect locally to verify whether those fields can be resolved on the reference machine.
