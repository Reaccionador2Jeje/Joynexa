# Joynexa Windows Edition Requirements Matrix

## Purpose

This matrix separates official Windows minimum requirements from Joynexa's edition-specific recommendations and from actual device test results. A product edition does not change the requirements of its Windows base.

## Windows 11 baseline

The following baseline is taken from Microsoft's published Windows 11 hardware requirements. Confirm the exact Windows release and processor list again before each release.

| Requirement | Official Windows 11 baseline | E430 inventory | Assessment |
| --- | --- | --- | --- |
| Processor | 1 GHz+, 2+ cores, compatible 64-bit processor on Microsoft's supported list | Intel Core i5-2520M, 2nd generation, 2 cores / 4 threads | **Not supported**: processor is not on the supported Intel list |
| RAM | 4 GB or greater | 3,686,035,456 bytes (~3.43 GiB reported) | **Below minimum** |
| Storage | 64 GB or greater available capacity | 500 GB HDD capacity; free space not measured | Capacity appears sufficient; free space and health unverified |
| Graphics | DirectX 12 or later, WDDM 2.0 driver | Intel 2nd-generation integrated graphics PCI device | Unknown; exact driver capability not verified |
| Firmware | UEFI, Secure Boot capable | legacy_or_unknown | Unknown; verify in firmware setup |
| TPM | TPM 2.0 | Not collected | Unknown |
| Display | 720p display, at least 9 inches diagonally | Not collected | Unknown |

Official references:
- [Windows 11 requirements](https://learn.microsoft.com/en-gb/windows/whats-new/windows-11-requirements)
- [Windows 11 supported Intel processors](https://learn.microsoft.com/en-us/windows-hardware/design/minimum/supported/windows-11-supported-intel-processors)
- [Windows 10 end of support](https://support.microsoft.com/en-us/windows/deployment/updates-lifecycle/windows-10-support-has-ended-on-october-14-2025)

## Six-edition policy

All six editions inherit the official requirements and support lifecycle of the exact Windows base they ship with. The edition labels below describe product intent, not permission to lower OS requirements.

| Edition | Intended audience | Additional Joynexa requirements |
| --- | --- | --- |
| Core | Everyday use | Publish a tested baseline and disclose optional features |
| Play | Gaming | List each tested game's requirements separately; no generic FPS promises |
| Productivity | Study and development | List supported toolchains and their requirements |
| Modern | Newer supported PCs | Require a currently supported Windows base and modern driver validation |
| Retro | Older PCs | Only target older hardware when a supported, properly licensed Windows base and drivers exist |
| Legacy | Historical preservation | May document historical systems and preservation workflows; do not imply current security support |

## Joynexa recommendation fields

Do not invent edition minimums. Before assigning a Joynexa minimum or recommended specification, record:
- Exact Windows base, edition, release, architecture, and lifecycle status.
- Official minimum requirements and source URLs.
- Joynexa minimum and recommended CPU, RAM, storage, graphics, firmware, and display targets.
- Driver availability and known limitations.
- Validation device, test date, test procedure, and pass/fail result.
- Whether the value is a measured result, an official requirement, or a project recommendation.

## Status vocabulary

- `unknown`: evidence has not been collected.
- `meets_minimum`: evidence supports the published requirement.
- `below_minimum`: evidence shows the requirement is not met.
- `unsupported`: the component or configuration is outside the official supported list.
- `tested_pass` / `tested_fail`: the exact build was tested on the exact device.

Never turn `unknown` into a pass. Never call a device supported based only on an inventory report.

## First reference device

The Lenovo ThinkPad Edge E430 is **not officially eligible for Windows 11 because its Intel Core i5-2520M is not on Microsoft's supported processor list**. Its reported RAM is also below the Windows 11 minimum. Other Windows 11 requirements remain unknown or untested. See [the E430 hardware profile](reference-device-e430.md).

This matrix does not select a Windows base for the E430. Any future base selection must consider official support lifecycle, licensing, security updates, drivers, and real-device testing.
