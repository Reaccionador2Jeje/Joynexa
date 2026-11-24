#!/usr/bin/env python3
"""Collect a privacy-conscious, read-only Linux hardware inventory as JSON."""
from __future__ import annotations

import json
import pathlib
import platform
import re
import subprocess
from datetime import datetime, timezone
from typing import Any

ROOT = pathlib.Path("/")


def command(*args: str) -> str | None:
    try:
        result = subprocess.run(
            args, check=False, capture_output=True, text=True, timeout=8
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def read_text(path: str) -> str | None:
    try:
        return pathlib.Path(path).read_text(encoding="utf-8", errors="replace").replace("\x00", "").strip() or None
    except OSError:
        return None


def os_release() -> tuple[str | None, str | None]:
    values: dict[str, str] = {}
    for line in (read_text("/etc/os-release") or "").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"')
    return values.get("PRETTY_NAME"), values.get("VERSION_ID")


def lscpu_values() -> dict[str, str]:
    output = command("lscpu") or ""
    values: dict[str, str] = {}
    for line in output.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            values[key.strip()] = value.strip()
    return values


def cpu_fallback_values() -> dict[str, str | None]:
    """Read CPU identity from /proc/cpuinfo when lscpu labels are localized."""
    text = read_text("/proc/cpuinfo") or ""
    values: dict[str, str | None] = {"model": None, "vendor": None}
    for line in text.splitlines():
        if ":" not in line:
            continue
        key, value = (part.strip() for part in line.split(":", 1))
        if key == "model name" and not values["model"]:
            values["model"] = value
        elif key == "vendor_id" and not values["vendor"]:
            values["vendor"] = value
        if values["model"] and values["vendor"]:
            break
    return values


def memory_values() -> dict[str, int | None]:
    values: dict[str, int | None] = {"total_bytes": None, "available_bytes": None}
    for line in (read_text("/proc/meminfo") or "").splitlines():
        match = re.match(r"^(MemTotal|MemAvailable):\s+(\d+)\s+kB$", line)
        if match:
            values["total_bytes" if match.group(1) == "MemTotal" else "available_bytes"] = int(match.group(2)) * 1024
    return values


def storage_devices() -> list[dict[str, Any]]:
    raw = command("lsblk", "-b", "-J", "-d", "-o", "NAME,SIZE,TYPE,ROTA,MODEL")
    if not raw:
        return []
    try:
        devices = json.loads(raw).get("blockdevices", [])
    except (json.JSONDecodeError, AttributeError):
        return []
    result = []
    for item in devices:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        rota = item.get("rota")
        rotational = bool(int(rota)) if str(rota).isdigit() else None
        if rotational is None and name:
            sys_value = read_text(f"/sys/block/{name}/queue/rotational")
            if sys_value in {"0", "1"}:
                rotational = sys_value == "1"
        result.append({
            "device": name,
            "size_bytes": int(item["size"]) if str(item.get("size", "")).isdigit() else None,
            "type": item.get("type"),
            "rotational": rotational,
            "model": item.get("model"),
        })
    return result


def pci_devices() -> list[dict[str, str]]:
    output = command("lspci", "-nn") or ""
    selected: list[dict[str, str]] = []
    for line in output.splitlines():
        lower = line.lower()
        if any(term in lower for term in ("vga", "3d controller", "display controller", "ethernet controller", "network controller")):
            selected.append({"description": line.strip()})
    return selected


def secure_boot_state() -> str:
    output = command("mokutil", "--sb-state")
    if not output:
        return "unknown"
    lower = output.lower()
    if "enabled" in lower:
        return "enabled"
    if "disabled" in lower:
        return "disabled"
    return "unknown"


def main() -> None:
    cpu = lscpu_values()
    cpu_fallback = cpu_fallback_values()
    os_name, os_version = os_release()
    report = {
        "schema_version": 1,
        "collected_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "platform": {
            "os_name": os_name,
            "os_version": os_version,
            "kernel": platform.release(),
            "architecture": platform.machine(),
        },
        "cpu": {
            "model": cpu.get("Model name") or cpu_fallback["model"],
            "vendor": cpu.get("Vendor ID") or cpu_fallback["vendor"],
            "logical_cpus": int(cpu["CPU(s)"]) if cpu.get("CPU(s)", "").isdigit() else None,
            "cores_per_socket": int(cpu["Core(s) per socket"]) if cpu.get("Core(s) per socket", "").isdigit() else None,
            "sockets": int(cpu["Socket(s)"]) if cpu.get("Socket(s)", "").isdigit() else None,
        },
        "memory": memory_values(),
        "storage": storage_devices(),
        "graphics_and_network": pci_devices(),
        "firmware": {
            "system_vendor": read_text("/sys/class/dmi/id/sys_vendor"),
            "system_model": read_text("/sys/class/dmi/id/product_name"),
            "board_vendor": read_text("/sys/class/dmi/id/board_vendor"),
            "board_name": read_text("/sys/class/dmi/id/board_name"),
            "bios_version": read_text("/sys/class/dmi/id/bios_version"),
            "bios_date": read_text("/sys/class/dmi/id/bios_date"),
        },
        "boot": {
            "mode": "uefi" if pathlib.Path("/sys/firmware/efi").is_dir() else "legacy_or_unknown",
            "secure_boot": secure_boot_state(),
        },
        "privacy": {
            "serial_numbers_collected": False,
            "mac_addresses_collected": False,
            "ip_addresses_collected": False,
            "mount_paths_collected": False,
            "hostname_collected": False,
            "automatic_upload": False,
        },
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
