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

## First reference device

**Lenovo ThinkPad Edge E430 — Intel Core i5**

The E430 is the first reference device for Joynexa Windows development. Exact processor, RAM, storage, firmware mode, graphics, and Windows compatibility must be recorded before choosing a base image or publishing requirements.

## Initial roadmap

- [x] Define the six official editions.
- [x] Establish the universal-but-hardware-specific compatibility policy.
- [x] Identify the ThinkPad Edge E430 as the first reference device.
- [ ] Inventory the E430 hardware and current operating system.
- [ ] Create a safe, reversible optimization profile.
- [ ] Measure baseline and optimized boot time, idle memory, and responsiveness.
- [ ] Build and test the first Core/Modern prototype.
- [ ] Add release metadata, checksums, and download listing to the Workers site.

## Status

**Project foundation — prototype planning.** This document does not claim that bootable installers or downloadable ISO images have been built yet.
