# Joynexa Hardware Intelligence

Hardware Intelligence records evidence from real machines before edition compatibility is declared. An inventory is not a compatibility verdict.

## Reference machine: Lenovo ThinkPad Edge E430

Collected locally on 2026-11-24 from Debian GNU/Linux 13 (trixie), running kernel 6.12.118+deb13-amd64.

| Component | Observed value | Confidence / notes |
| --- | --- | --- |
| System vendor | LENOVO | Reported by firmware |
| System product identifier | 32543QS | Firmware product name; commercial configuration still to be confirmed |
| CPU | Intel 2nd Generation Core Processor family; exact model unknown | Four logical CPUs; original report returned a null model and vendor |
| RAM | 3,686,035,456 bytes (~3.43 GiB) | Reported by Linux; marketed capacity is approximately 4 GB |
| Main storage | ST500LT012-1DG142, 500,107,862,016 bytes | Device sda; rotational flag unavailable in this report |
| Graphics | Intel 2nd Generation Core Processor Family Integrated Graphics Controller [8086:0126] | PCI description |
| Wi-Fi | Broadcom BCM4313 [14e4:4727] | PCI description |
| Ethernet | Realtek RTL8111/8168/8211/8411 [10ec:8168] | PCI description |
| BIOS | H0ET30WW (1.12), 2012-05-08 | Reported by firmware |
| Boot mode | legacy_or_unknown | UEFI directory was not detected |
| Secure Boot | unknown | Not established by this report |
| OS used for inventory | Debian GNU/Linux 13 (trixie), x86_64 | Not a Windows compatibility test |

The inventory contains 4 logical CPUs but does not establish the exact Core i5 SKU. The collector has now been improved with a `/proc/cpuinfo` fallback; rerun it to obtain the missing identity where available.

## Recollect after updating the repository

```bash
git pull
python3 tools/linux/joynexa-audit.py > joynexa-hardware-report.json
python3 tools/validate-hardware-report.py joynexa-hardware-report.json
```

Inspect the JSON before sharing it. The collector does not upload reports automatically.

## Compatibility status

No Joynexa edition is yet declared compatible with this machine. Before any verdict, check the exact Windows base's official CPU, firmware, security, memory, storage, and driver requirements. Then perform installation, update, recovery, graphics, network, audio, sleep/resume, and sustained-use tests.

Unknown values remain unknown. Joynexa does not bypass Windows setup checks or disable security features to force installation.

## Privacy

The collector excludes serial numbers, MAC addresses, IP addresses, hostnames, and mount paths. It performs read-only local collection and emits JSON to standard output.
