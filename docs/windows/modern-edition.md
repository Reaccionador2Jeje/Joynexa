# Joynexa Modern

**Status:** first edition in active development; not released.

## Product definition

Joynexa Modern is the primary edition for newer PCs that meet the official requirements of its Windows base. It aims for a clean, current, supportable Windows experience—not an unsupported hardware bypass or a stripped-down operating system.

## Initial Windows base

- Windows 11, version 26H2, x64, General Availability Channel.
- The device owner selects Home or Pro and supplies their own valid license.
- Installation media must come from Microsoft. Joynexa will not redistribute Microsoft's Windows image, keys, or activation.
- Windows Update, Defender, Firewall, UAC, recovery, servicing components, and Plug and Play remain enabled.

Official references (re-check before each release):
- [Windows 11 release information](https://learn.microsoft.com/en-us/windows/release-health/windows11-release-information)
- [Windows 11 Home and Pro lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-11-home-and-pro)
- [Windows 11 requirements](https://learn.microsoft.com/en-us/windows/whats-new/windows-11-requirements)
- [Supported Intel processors](https://learn.microsoft.com/en-us/windows-hardware/design/minimum/supported/windows-11-supported-intel-processors)

Microsoft lists 26H2 as generally available from 2026-09-29. Home and Pro 26H2 support is listed through 2028-10-10. This base must be reviewed when Microsoft publishes newer releases or changes lifecycle information.

## Edition boundaries

Modern inherits all official requirements and support rules of its exact Windows base. Joynexa's own recommendations must be published separately and backed by tests. A local inventory script is not an official compatibility checker.

The Lenovo ThinkPad Edge E430 in this repository is not an official Windows 11 target: its Intel Core i5-2520M is not on Microsoft's supported processor list and its reported RAM is below the 4 GB minimum.

## First implementation scope

1. Define the Modern profile and exact base.
2. Provide a read-only readiness report for an already installed Windows environment.
3. Keep driver installation separate from Windows Setup: WinPE boot/storage drivers must be prepared in the installation image; post-install drivers are staged from curated, signed packages.
4. Establish an auditable, reversible configuration before implementing settings changes.
5. Test on officially eligible physical hardware and a virtual machine before release.

## Driver strategy

- WinPE: inject only exact, signed, architecture-compatible drivers demonstrated to be required for setup, especially storage or USB paths.
- Installed Windows: use Windows Plug and Play, Windows Update, and curated OEM-signed INF packages.
- Never disable signature enforcement, Defender, Firewall, UAC, or Windows Update to make a driver install.
- Never force a driver based only on a similar model name or filename.
- Record hardware IDs, supported Windows builds, architecture, vendor, version, package source, SHA-256, signature status, and test outcome.
- Preserve rollback options and logs.

See [Driver Intelligence](../driver-intelligence.md).

## Release gate

Modern cannot be marked released until:
- The official base media and edition are documented.
- The device meets Microsoft's published requirements.
- No unexplained critical devices remain in Device Manager.
- Windows Update, Defender, Firewall, UAC, recovery, audio, networking, graphics, sleep/resume, and common peripherals are tested.
- The configuration can be restored or reinstalled safely.
- Release notes, checksums for Joynexa-owned artifacts, and known limitations are published.

## Current limitations

- No Modern ISO or bootable USB image has been built.
- No Windows image has been modified.
- The readiness script is an inventory aid, not Microsoft's compatibility checker.
- The driver catalog and WinPE injection pipeline are not implemented yet.
- No Modern build has passed physical-device testing.
