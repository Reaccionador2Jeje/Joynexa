# Joynexa Windows

Joynexa Windows is AtDev's hardware-conscious Windows customization project: a lightweight, maintainable experience intended to help compatible PCs remain useful.

> Joynexa is universal as a project and product family—not one Windows image that boots on every machine. Each edition and build must declare its architecture, Windows base, hardware requirements, and compatibility limits.

## Official editions

| Edition | Purpose |
| --- | --- |
| **Core** | Lean everyday Windows configuration with optional, reversible tuning. |
| **Play** | Gaming-oriented configuration focused on responsiveness without disabling security essentials. |
| **Productivity** | Study, development, and work tools with a practical, uncluttered setup. |
| **Modern** | Primary track for newer supported PCs and current Windows bases. |
| **Retro** | Carefully scoped support and tools for older PCs that can run a supported Windows base. |
| **Legacy** | Historical hardware documentation, preservation tools, and compatible legacy environments. Not necessarily a Windows image for every machine. |

## Distribution

Official releases will be listed in:
- The Joynexa source repository, with release notes and checksums.
- The Joynexa download page hosted on Cloudflare Workers.

No edition is considered released until a build has been tested, its requirements documented, and its download verified.

## Development principles

1. Prefer an official, properly licensed Windows installation as the base.
2. Keep Windows Update, Microsoft Defender, essential drivers, and recovery components enabled.
3. Make optimization choices transparent and reversible.
4. Never promise a universal RAM footprint or performance gain without measurements.
5. Publish architecture, minimum requirements, known issues, SHA-256 checksums, and rollback instructions for every release.
6. Separate supported Windows builds from DOS, emulator, preservation, and other historical-hardware projects.
7. Treat official OS requirements and Joynexa recommendations as separate facts; unknown hardware values never count as a pass.

## First reference device

**Lenovo ThinkPad Edge E430 — Intel Core i5-2520M**

The first local inventory is recorded in [the E430 hardware profile](reference-device-e430.md). The processor is not on Microsoft's supported Windows 11 Intel processor list, and reported RAM is below the Windows 11 minimum. Other Windows 11 requirements remain partly unknown. This device is not an official Windows 11 target.

## Requirements

The [Edition Requirements Matrix](edition-requirements-matrix.md) documents the Windows 11 baseline, the six editions' inheritance policy, and the first reference-device assessment. Its structured companion is [edition-requirements.json](edition-requirements.json).

Each edition inherits the requirements and lifecycle of its exact Windows base. Edition branding cannot make an unsupported processor, firmware configuration, or driver stack officially supported.

## Initial roadmap

- [x] Define the six official editions.
- [x] Establish the universal-but-hardware-specific compatibility policy.
- [x] Identify the ThinkPad Edge E430 as the first reference device.
- [x] Collect the first local E430 hardware inventory.
- [x] Add a read-only Debian/Linux hardware audit for maintainers.
- [x] Add structured JSON hardware inventory and privacy validation.
- [x] Record the first ThinkPad E430 hardware report and confirmed CPU/storage details.
- [x] Improve CPU identity and storage rotational-state fallbacks in the Linux collector.
- [x] Add edition-manifest validation and GitHub Actions checks.
- [x] Create the first official Windows requirements matrix and structured baseline.
- [ ] Define Joynexa minimum/recommended specifications for each edition based on a selected Windows base and measured tests.
- [ ] Create a safe, reversible optimization profile.
- [ ] Measure baseline and optimized boot time, idle memory, and responsiveness.
- [ ] Build and test the first Core/Modern prototype on officially eligible hardware.
- [ ] Add release metadata, checksums, and download listing to the Workers site.

## Status

**Development tooling — early prototype.** Debian/Linux text and JSON audit tooling, privacy validation, cross-platform repository checks, the first local ThinkPad E430 inventory, and an initial Windows 11 requirements matrix are available. The E430 is not officially eligible for Windows 11 based on its CPU. No Windows profile has been validated on a Windows installation; no bootable installer or downloadable ISO has been built.
