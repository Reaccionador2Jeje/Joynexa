# Joynexa Hardware Intelligence

Hardware Intelligence records evidence from real machines before edition compatibility is declared. An inventory is not a compatibility verdict.

## Reference machine: Lenovo ThinkPad Edge E430

Collected locally on 2026-11-24 from Debian GNU/Linux 13 (trixie), running kernel 6.12.118+deb13-amd64.

| Component | Observed value | Confidence / notes |
| --- | --- | --- |
| System vendor | LENOVO | Reported by firmware |
| System product identifier | 32543QS | Firmware product name; commercial configuration still to be confirmed |
| CPU | Intel Core i5-2520M @ 2.50 GHz | 2nd-generation Intel Core; 2 physical cores and 4 logical processors |
| RAM | 3,686,035,456 bytes (~3.43 GiB) | Reported by Linux; likely marketed as 4 GB |
| Main storage | ST500LT012-1DG142, 500,107,862,016 bytes (~500 GB) | Device sda; rotational=true, therefore a mechanical drive |
| Graphics | Intel 2nd Generation Core Processor Family Integrated Graphics Controller [8086:0126] | PCI description; exact Windows driver capabilities not verified |
| Wi-Fi | Broadcom BCM4313 [14e4:4727] | PCI description; Windows driver availability not verified |
| Ethernet | Realtek RTL8111/8168/8211/8411 [10ec:8168] | PCI description; Windows driver availability not verified |
| BIOS | H0ET30WW (1.12), 2012-05-08 | Reported by firmware |
| Boot mode | legacy_or_unknown | UEFI directory was not detected; confirm firmware settings directly |
| Secure Boot | unknown | Not established by this report |
| TPM | unknown | Not collected by this Linux report |
| OS used for inventory | Debian GNU/Linux 13 (trixie), x86_64 | Not a Windows compatibility test |

## Preliminary Windows 11 assessment

The Intel Core i5-2520M is a 2nd-generation Core processor and is not in Microsoft's supported Windows 11 Intel processor list. The reported available RAM is also below Windows 11's 4 GB minimum (the total reported memory is approximately 3.43 GiB). Firmware mode, Secure Boot capability, TPM 2.0, and DirectX/WDDM graphics support have not been established by this inventory.

**Result: not officially eligible for Windows 11 based on the processor; other requirements are partly unknown or below minimum.** Joynexa must not bypass Windows setup checks or advertise this machine as Windows 11 supported.

This is not a verdict about every Windows release. Any other proposed Windows base needs its own lifecycle, licensing, hardware, and driver assessment. Windows 10 reached end of regular support on 2025-10-14; consumer Extended Security Updates are a separate, opt-in program with eligibility and regional conditions. Do not treat Windows 10 as currently supported by default.

## Recollect after updating the repository

```bash
git pull
python3 tools/linux/joynexa-audit.py > joynexa-hardware-report.json
python3 tools/validate-hardware-report.py joynexa-hardware-report.json
```

Inspect the JSON before sharing it. The collector does not upload reports automatically.

## Compatibility status

No Joynexa edition is yet declared compatible with this machine. Before any verdict for a particular Windows base, check the exact OS version's official CPU, firmware, security, memory, storage, and driver requirements. Then perform installation, update, recovery, graphics, network, audio, sleep/resume, and sustained-use tests.

Unknown values remain unknown. The Legacy edition may document preservation options separately, but it must not be presented as a supported modern Windows installation.

## Privacy

The collector excludes serial numbers, MAC addresses, IP addresses, hostnames, and mount paths. It performs read-only local collection and emits JSON to standard output.
