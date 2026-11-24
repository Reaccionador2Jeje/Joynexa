#!/usr/bin/env python3
"""Validate Joynexa Modern's driver catalog and optionally verify local file hashes.

This tool never downloads, installs, enables, or modifies drivers. Signature trust
must be checked separately on Windows with Test-JoynexaDriverCatalogSignature.ps1.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import sys
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_CATALOG = ROOT / "docs" / "windows" / "modern-driver-catalog.json"
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
PCI_RE = re.compile(r"^PCI\\VEN_[0-9A-F]{4}&DEV_[0-9A-F]{4}(?:&SUBSYS_[0-9A-F]{8})?(?:&REV_[0-9A-F]{2})?$")
USB_RE = re.compile(r"^USB\\VID_[0-9A-F]{4}&PID_[0-9A-F]{4}(?:&REV_[0-9A-F]{4})?$")


class CatalogError(ValueError):
    pass


def load_catalog(path: pathlib.Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CatalogError(f"cannot read catalog: {exc}") from exc
    if not isinstance(data, dict):
        raise CatalogError("catalog root must be an object")
    return data


def validate_catalog(data: dict[str, Any]) -> None:
    if data.get("schema_version") != 1:
        raise CatalogError("schema_version must be 1")
    if data.get("catalog_id") != "joynexa-modern-drivers":
        raise CatalogError("unexpected catalog_id")
    target = data.get("target")
    expected = {"windows_product": "Windows 11", "windows_version": "26H2", "architecture": "x64"}
    if target != expected:
        raise CatalogError("catalog target must be Windows 11 26H2 x64")
    entries = data.get("entries")
    if not isinstance(entries, list):
        raise CatalogError("entries must be an array")
    seen_ids: set[str] = set()
    seen_hwids: dict[str, str] = {}
    for index, entry in enumerate(entries):
        prefix = f"entries[{index}]"
        if not isinstance(entry, dict):
            raise CatalogError(f"{prefix} must be an object")
        required_text = ("id", "vendor", "device", "package_source", "catalog_file")
        for key in required_text:
            if not isinstance(entry.get(key), str) or not entry[key].strip():
                raise CatalogError(f"{prefix}.{key} must be a non-empty string")
        entry_id = entry["id"]
        if entry_id in seen_ids:
            raise CatalogError(f"duplicate entry id: {entry_id}")
        seen_ids.add(entry_id)
        if not entry["package_source"].startswith("https://"):
            raise CatalogError(f"{prefix}.package_source must use HTTPS")
        hwids = entry.get("hardware_ids")
        if not isinstance(hwids, list) or not hwids:
            raise CatalogError(f"{prefix}.hardware_ids must be a non-empty array")
        for raw in hwids:
            if not isinstance(raw, str):
                raise CatalogError(f"{prefix} contains a non-string hardware ID")
            hwid = raw.upper()
            if not (PCI_RE.fullmatch(hwid) or USB_RE.fullmatch(hwid)):
                raise CatalogError(f"{prefix} has unsupported or malformed hardware ID: {raw}")
            previous = seen_hwids.get(hwid)
            if previous and previous != entry_id:
                raise CatalogError(f"hardware ID {hwid} appears in both {previous} and {entry_id}")
            seen_hwids[hwid] = entry_id
        compatibility = entry.get("compatibility")
        if not isinstance(compatibility, dict) or compatibility.get("architecture") != "x64":
            raise CatalogError(f"{prefix}.compatibility must declare x64")
        minimum = compatibility.get("minimum_build")
        maximum = compatibility.get("maximum_build")
        if not isinstance(minimum, int) or not isinstance(maximum, int) or minimum <= 0 or maximum < minimum:
            raise CatalogError(f"{prefix}.compatibility has an invalid Windows build range")
        package_files = entry.get("package_files")
        if not isinstance(package_files, list) or not package_files:
            raise CatalogError(f"{prefix}.package_files must list files and SHA-256 hashes")
        file_paths: set[str] = set()
        for item in package_files:
            if not isinstance(item, dict):
                raise CatalogError(f"{prefix}.package_files entries must be objects")
            relative = item.get("path")
            digest = item.get("sha256")
            if not isinstance(relative, str) or not relative or pathlib.PurePosixPath(relative).is_absolute() or ".." in pathlib.PurePosixPath(relative).parts:
                raise CatalogError(f"{prefix} has an unsafe package file path")
            if relative in file_paths:
                raise CatalogError(f"{prefix} has duplicate package file path: {relative}")
            file_paths.add(relative)
            if not isinstance(digest, str) or not SHA256_RE.fullmatch(digest):
                raise CatalogError(f"{prefix} has an invalid SHA-256 for {relative}")
        if entry["catalog_file"] not in file_paths:
            raise CatalogError(f"{prefix}.catalog_file must also appear in package_files")
        signature = entry.get("signature")
        if not isinstance(signature, dict) or signature.get("status") not in {"pending", "verified"}:
            raise CatalogError(f"{prefix}.signature.status must be pending or verified")
        if signature.get("status") == "verified":
            if not isinstance(signature.get("signer_subject"), str) or not signature["signer_subject"].strip():
                raise CatalogError(f"{prefix} verified signature requires signer_subject")
            if not isinstance(signature.get("verified_on"), str) or not signature["verified_on"].strip():
                raise CatalogError(f"{prefix} verified signature requires verified_on")
        if entry.get("test_status") not in {"untested", "passed", "failed"}:
            raise CatalogError(f"{prefix}.test_status must be untested, passed, or failed")
        if entry.get("test_status") == "passed" and not isinstance(entry.get("test_evidence"), str):
            raise CatalogError(f"{prefix} passed test requires test_evidence")
        if entry.get("approval") not in {"candidate", "blocked", "approved"}:
            raise CatalogError(f"{prefix}.approval must be candidate, blocked, or approved")
        if entry.get("approval") == "approved":
            if signature.get("status") != "verified" or entry.get("test_status") != "passed":
                raise CatalogError(f"{prefix} cannot be approved without verified signature and passed hardware test")
    print(f"OK: driver catalog structure validated ({len(entries)} entries).")


def verify_files(data: dict[str, Any], package_root: pathlib.Path) -> None:
    checked = 0
    for entry in data["entries"]:
        for item in entry["package_files"]:
            path = (package_root / item["path"]).resolve()
            try:
                path.relative_to(package_root.resolve())
            except ValueError as exc:
                raise CatalogError(f"path escapes package root: {item['path']}") from exc
            if not path.is_file():
                raise CatalogError(f"package file is missing: {item['path']}")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != item["sha256"]:
                raise CatalogError(f"SHA-256 mismatch: {item['path']}")
            checked += 1
    print(f"OK: SHA-256 verified for {checked} package files.")


def self_test() -> None:
    sample = {
        "schema_version": 1,
        "catalog_id": "joynexa-modern-drivers",
        "target": {"windows_product": "Windows 11", "windows_version": "26H2", "architecture": "x64"},
        "entries": [{
            "id": "sample-oem-storage",
            "vendor": "Example OEM",
            "device": "Example Storage Controller",
            "hardware_ids": [r"PCI\VEN_1234&DEV_ABCD"],
            "compatibility": {"architecture": "x64", "minimum_build": 1, "maximum_build": 99999},
            "package_source": "https://vendor.example/driver-package",
            "catalog_file": "example.cat",
            "package_files": [{"path": "example.cat", "sha256": "a" * 64}],
            "signature": {"status": "pending", "signer_subject": None, "verified_on": None},
            "test_status": "untested",
            "test_evidence": None,
            "approval": "candidate"
        }]
    }
    validate_catalog(sample)
    invalid = json.loads(json.dumps(sample))
    invalid["entries"][0]["approval"] = "approved"
    try:
        validate_catalog(invalid)
    except CatalogError:
        pass
    else:
        raise AssertionError("unverified and untested package must never be approved")
    print("OK: driver catalog self-test passed (valid candidate and unsafe approval rejection).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=pathlib.Path, default=DEFAULT_CATALOG)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--verify-files", action="store_true")
    parser.add_argument("--package-root", type=pathlib.Path)
    args = parser.parse_args()
    try:
        data = load_catalog(args.catalog)
        validate_catalog(data)
        if args.self_test:
            self_test()
        if args.verify_files:
            if args.package_root is None:
                parser.error("--verify-files requires --package-root")
            verify_files(data, args.package_root)
        if not (args.check or args.self_test or args.verify_files):
            parser.print_help()
    except (CatalogError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
