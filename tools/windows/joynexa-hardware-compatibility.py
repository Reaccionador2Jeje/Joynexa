#!/usr/bin/env python3
"""Exact Hardware ID matching for Joynexa's read-only inventory and driver catalog."""
from __future__ import annotations
import argparse, json, pathlib, sys
from collections import Counter
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_CATALOG = ROOT / "docs" / "windows" / "modern-driver-catalog.json"

class CompatibilityError(ValueError):
    pass

def read_json(path: pathlib.Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CompatibilityError(f"cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise CompatibilityError(f"{path}: root must be an object")
    return value

def normalize_architecture(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in {"x64", "amd64", "64-bit", "x86_64"}:
        return "x64"
    if text in {"arm64", "aarch64"}:
        return "arm64"
    if text in {"x86", "32-bit", "i386"}:
        return "x86"
    return "unknown"

def entry_is_approved_for_inventory(entry: dict[str, Any], inventory: dict[str, Any], catalog: dict[str, Any]) -> bool:
    signature = entry.get("signature") or {}
    compatibility = entry.get("compatibility") or {}
    os_info = inventory.get("operating_system") or {}
    architecture = normalize_architecture(os_info.get("architecture"))
    catalog_arch = normalize_architecture((catalog.get("target") or {}).get("architecture"))
    try:
        build = int(os_info.get("build_number"))
        minimum = int(compatibility.get("minimum_build"))
        maximum = int(compatibility.get("maximum_build"))
    except (TypeError, ValueError):
        return False
    caption = str(os_info.get("caption", "")).lower()
    return (
        entry.get("approval") == "approved"
        and signature.get("status") == "verified"
        and entry.get("test_status") == "passed"
        and architecture == "x64"
        and catalog_arch == architecture
        and "windows 11" in caption
        and compatibility.get("architecture") == architecture
        and minimum <= build <= maximum
    )

def analyze(inventory: dict[str, Any], catalog: dict[str, Any]) -> dict[str, Any]:
    if inventory.get("schema_version") != 1 or inventory.get("inventory_id") != "joynexa-windows-hardware-inventory":
        raise CompatibilityError("unsupported hardware inventory schema")
    if catalog.get("schema_version") != 1 or catalog.get("catalog_id") != "joynexa-modern-drivers":
        raise CompatibilityError("unsupported driver catalog")
    devices, entries = inventory.get("devices"), catalog.get("entries")
    if not isinstance(devices, list) or not isinstance(entries, list):
        raise CompatibilityError("inventory.devices and catalog.entries must be arrays")
    index: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        if isinstance(entry, dict):
            for raw in entry.get("hardware_ids", []):
                if isinstance(raw, str) and raw.strip():
                    index.setdefault(raw.strip().upper(), []).append(entry)
    output = []
    for device in devices:
        if not isinstance(device, dict):
            continue
        raw_ids = device.get("hardware_ids", [])
        if not isinstance(raw_ids, list):
            raw_ids = []
        ids = [x.strip().upper() for x in raw_ids if isinstance(x, str) and x.strip()]
        matches = {}
        for hwid in ids:
            for entry in index.get(hwid, []):
                matches.setdefault(str(entry.get("id", "unknown")), (entry, hwid))
        details = []
        for entry, hwid in matches.values():
            signature = entry.get("signature") or {}
            test = entry.get("test_status", "untested")
            if entry_is_approved_for_inventory(entry, inventory, catalog):
                state = "approved_for_reported_os"
            elif entry.get("approval") == "blocked" or test == "failed":
                state = "blocked"
            else:
                state = "candidate_not_installable"
            details.append({
                "catalog_entry_id": entry.get("id), "matched_hardware_id": hwid,
                "vendor": entry.get("vendor"), "device": entry.get("device"),
                "approval_state": state, "signature_status": signature.get("status", "pending"),
                "hardware_test_status": test
            })
        assessment = ("catalog_approved_match" if any(x["approval_state"] == "approved_for_reported_os" for x in details)
                      else "catalog_match_requires_validation" if details
                      else "no_catalog_match" if ids else "hardware_ids_unavailable")
        output.append({
            "device_name": device.get("name", ""), "device_class": device.get("device_class", ""),
            "status": device.get("status", ""), "hardware_ids": ids,
            "catalog_matches": details, "assessment": assessment
        })
    counts = Counter(x["assessment"] for x in output)
    return {
        "schema_version": 1, "report_id": "joynexa-hardware-compatibility",
        "inventory_collected_at_utc": inventory.get("collected_at_utc"),
        "catalog_id": catalog.get("catalog_id"), "target": catalog.get("target"),
        "reported_os": inventory.get("operating_system", {}),
        "summary": {
            "devices_analyzed": len(output),
            "catalog_approved_match": counts["catalog_approved_match"],
            "catalog_match_requires_validation": counts["catalog_match_requires_validation"],
            "no_catalog_match": counts["no_catalog_match"],
            "hardware_ids_unavailable": counts["hardware_ids_unavailable"],
            "install_actions_performed": 0
        },
        "devices": output,
        "limitations": [
            "A catalog match does not prove suitability for the complete system.",
            "An approved match is limited to the reported Windows 11 x64 build range and recorded hardware evidence.",
            "No match means only that this curated catalog has no exact Hardware ID entry.",
            "This report never downloads or installs drivers."
        ]
    }

def self_test() -> None:
    inventory = {"schema_version": 1, "inventory_id": "joynexa-windows-hardware-inventory",
        "operating_system": {"caption": "Microsoft Windows 11 Pro", "build_number": "26100", "architecture": "64-bit"},
        "devices": [
            {"name": "NIC", "hardware_ids": [r"PCI\\VEN_1234&DEV_ABCD"]},
            {"name": "Unknown", "hardware_ids": [r"PCI\\VEN_9999&DEV_0001"]},
            {"name": "No IDs", "hardware_ids": []}
        ]}
    catalog = {"schema_version": 1, "catalog_id": "joynexa-modern-drivers",
        "target": {"architecture": "x64"},
        "entries": [{"id": "sample", "vendor": "Example", "device": "NIC",
        "hardware_ids": [r"PCI\\VEN_1234&DEV_ABCD"], "signature": {"status": "pending"},
        "test_status": "untested", "approval": "candidate",
        "compatibility": {"architecture": "x64", "minimum_build": 22000, "maximum_build": 30000}}]}
    report = analyze(inventory, catalog)
    assert [x["assessment"] for x in report["devices"]] == [
        "catalog_match_requires_validation", "no_catalog_match", "hardware_ids_unavailable"]
    assert report["summary"]["install_actions_performed"] == 0
    approved = dict(catalog["entries"][0], approval="approved", test_status="passed",
        signature={"status": "verified"})
    catalog["entries"] = [approved]
    assert analyze(inventory, catalog)["summary"]["catalog_approved_match"] == 1
    inventory["operating_system"]["architecture"] = "32-bit"
    assert analyze(inventory, catalog)["summary"]["catalog_approved_match"] == 0
    print("OK: compatibility analyzer self-test passed (matching, unknown, and OS eligibility gates).")

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", type=pathlib.Path)
    parser.add_argument("--catalog", type=pathlib.Path, default=DEFAULT_CATALOG)
    parser.add_argument("--output", type=pathlib.Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test: self_test()
        if args.inventory:
            report = analyze(read_json(args.inventory), read_json(args.catalog))
            rendered = json.dumps(report, indent=2, ensure_ascii=False) + "\\n"
            if args.output:
                args.output.write_text(rendered, encoding="utf-8")
                print(f"Compatibility report written: {args.output}")
            else: sys.stdout.write(rendered)
        elif not args.self_test: parser.error("provide --inventory or --self-test")
    except (CompatibilityError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
