#!/usr/bin/env python3
"""Validate Joynexa Windows edition metadata using only the Python standard library."""
from __future__ import annotations
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "windows" / "editions.json"
EXPECTED = {"core", "play", "productivity", "modern", "retro", "legacy"}

def main() -> int:
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot read valid JSON from {MANIFEST}: {exc}", file=sys.stderr)
        return 1
    if data.get("product") != "Joynexa Windows":
        print("ERROR: unexpected product name", file=sys.stderr)
        return 1
    editions = data.get("editions")
    if not isinstance(editions, list):
        print("ERROR: 'editions' must be an array", file=sys.stderr)
        return 1
    ids = [item.get("id") for item in editions if isinstance(item, dict)]
    if len(ids) != len(editions):
        print("ERROR: every edition must be an object", file=sys.stderr)
        return 1
    if len(ids) != len(set(ids)):
        print("ERROR: edition IDs must be unique", file=sys.stderr)
        return 1
    if set(ids) != EXPECTED:
        print(f"ERROR: expected edition IDs {sorted(EXPECTED)}, got {sorted(ids)}", file=sys.stderr)
        return 1
    for edition in editions:
        for field in ("id", "name", "focus", "releaseStatus"):
            if not isinstance(edition.get(field), str) or not edition[field].strip():
                print(f"ERROR: edition {edition.get('id')} has invalid {field}", file=sys.stderr)
                return 1
    distribution = data.get("distribution")
    if not isinstance(distribution, dict):
        print("ERROR: distribution metadata is missing", file=sys.stderr)
        return 1
    for field in ("repository", "website", "requirements"):
        if field not in distribution:
            print(f"ERROR: distribution.{field} is missing", file=sys.stderr)
            return 1
    print(f"OK: {len(editions)} Joynexa Windows editions validated.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
