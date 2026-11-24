#!/usr/bin/env python3
"""Validate a Joynexa hardware inventory JSON report."""
from __future__ import annotations

import json
import pathlib
import sys

FORBIDDEN_KEYS = {
    "serial", "serial_number", "serialnumber", "mac", "mac_address",
    "ip_address", "hostname", "mount", "mountpoint",
}


def fail(message: str) -> int:
    print(f"ERROR: {message}", file=sys.stderr)
    return 1


def scan_privacy(value: object, path: str = "$") -> str | None:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = str(key).lower().replace("-", "_")
            if normalized in FORBIDDEN_KEYS:
                return f"forbidden privacy-sensitive field at {path}.{key}"
            issue = scan_privacy(child, f"{path}.{key}")
            if issue:
                return issue
    elif isinstance(value, list):
        for index, child in enumerate(value):
            issue = scan_privacy(child, f"{path}[{index}]")
            if issue:
                return issue
    return None


def main() -> int:
    if len(sys.argv) != 2:
        return fail("usage: validate-hardware-report.py REPORT.json")
    path = pathlib.Path(sys.argv[1])
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return fail(f"cannot read valid JSON: {exc}")
    if not isinstance(report, dict):
        return fail("report root must be an object")
    required = {"schema_version", "collected_at_utc", "platform", "cpu", "memory",
                "storage", "graphics_and_network", "firmware", "boot", "privacy"}
    missing = required - report.keys()
    if missing:
        return fail(f"missing top-level fields: {', '.join(sorted(missing))}")
    if report["schema_version"] != 1:
        return fail("unsupported schema_version")
    for field in ("platform", "cpu", "memory", "firmware", "boot", "privacy"):
        if not isinstance(report[field], dict):
            return fail(f"{field} must be an object")
    for field in ("storage", "graphics_and_network"):
        if not isinstance(report[field], list):
            return fail(f"{field} must be an array")
    privacy = report["privacy"]
    for field in ("serial_numbers_collected", "mac_addresses_collected",
                  "ip_addresses_collected", "mount_paths_collected",
                  "hostname_collected", "automatic_upload"):
        if privacy.get(field) is not False:
            return fail(f"privacy.{field} must be false")
    issue = scan_privacy(report)
    if issue:
        return fail(issue)
    print("OK: Joynexa hardware inventory structure and privacy checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
