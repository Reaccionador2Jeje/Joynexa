#!/usr/bin/env python3
"""Static safety-contract checks for the PowerShell ISO inspection tool."""
from __future__ import annotations

import argparse
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools" / "windows" / "joynexa-image-builder.ps1"

REQUIRED = (
    "[ValidatePattern('^[A-Fa-f0-9]{64}$')]",
    "Get-FileHash -LiteralPath $isoPath -Algorithm SHA256",
    "Mount-DiskImage -ImagePath $isoPath -Access ReadOnly",
    "dism.exe",
    "sources\\install.wim",
    "sources\\install.esd",
    "definition_status -ne 'verified'",
    "windows_requirements_bypassed",
    "driver_signature_enforcement_disabled",
    "unlicensed_windows_payload_included",
    "Dismount-DiskImage",
    "requirements_bypassed = $false",
    "signature_enforcement_disabled = $false",
    "iso_created = $false",
)
FORBIDDEN = (
    "Set-ExecutionPolicy Unrestricted",
    "bcdedit /set",
    "DISM /Set-Edition",
    "DISM /Set-ProductKey",
    "Disable-WindowsOptionalFeature",
    "AllowUpgradesWithUnsupportedTPMOrCPU",
)


def validate(text: str) -> list[str]:
    errors = [f"missing safety contract: {token}" for token in REQUIRED if token not in text]
    errors.extend(f"forbidden bypass or modification token: {token}" for token in FORBIDDEN if token.lower() in text.lower())
    if "-AuditOnly" not in text or "source_audit_only" not in text:
        errors.append("audit-only mode is required")
    if "Copy-Item" not in text:
        errors.append("verified source staging operation is missing")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--script", type=pathlib.Path, default=SCRIPT)
    args = parser.parse_args()
    if args.self_test:
        assert not validate(SCRIPT_TEXT := "\n".join(REQUIRED) + "\n-AuditOnly\nsource_audit_only\nCopy-Item")
        assert validate(SCRIPT_TEXT.replace("Mount-DiskImage -ImagePath $isoPath -Access ReadOnly", "Mount-DiskImage")) 
        assert validate(SCRIPT_TEXT + "\nAllowUpgradesWithUnsupportedTPMOrCPU")
        print("OK: image builder safety-contract self-test passed.")
        return 0
    try:
        content = args.script.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    errors = validate(content)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("OK: image builder safety contract is present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
