# Joynexa Modern Build Planner

The Modern Build Planner converts the current Modern profile into a machine-readable **planning document** for a selected Windows edition. It is deliberately not an installer or ISO builder.

## Run on Linux (NEXORA OS) or Windows

From the repository root:

```bash
python3 tools/windows/joynexa-modern-build-planner.py --check
python3 tools/windows/joynexa-modern-build-planner.py --self-test
python3 tools/windows/joynexa-modern-build-planner.py --edition Home --output build/joynexa-modern-home-plan.json
python3 tools/windows/joynexa-modern-build-planner.py --edition Pro --output build/joynexa-modern-pro-plan.json
```

The script uses only the Python standard library. The generated plan records the Windows base, selected Home/Pro edition, media boundaries, security protections, driver policy, implementation stages, and release gates.

## Safety boundaries

- Uses only the repository's declared Windows 11 26H2 x64 Modern profile.
- Requires official Microsoft media supplied by the device owner.
- Does not download, copy, mount, modify, activate, or redistribute Windows media.
- Does not install drivers or change a computer.
- Keeps Windows Update, Defender, Firewall, UAC, recovery, driver signature enforcement, and Plug and Play intact.
- Rejects profile changes that weaken these requirements or permit unsigned drivers.
- Marks hardware validation, driver preparation, configuration, and release as blocked until their evidence and tests exist.

A generated plan is not proof of compatibility, a bootable image, or a release candidate. Joynexa Modern remains unreleased until its release gates pass on eligible test hardware.
