#!/usr/bin/env python3
"""Validate the Joynexa Windows requirements matrix without external dependencies."""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MATRIX = ROOT / "docs" / "windows" / "edition-requirements.json"
EXPECTED_EDITIONS = {"core", "play", "productivity", "modern", "retro", "legacy"}
VALID_STATUSES = {
    "unknown", "meets_minimum", "below_minimum", "unsupported",
    "tested_pass", "tested_fail",
}


def fail(message: str) -> int:
    print(f"ERROR: {message}", file=sys.stderr)
    return 1


def main() -> int:
    try:
        data = json.loads(MATRIX.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return fail(f"cannot read valid JSON from {MATRIX}: {exc}")

    if not isinstance(data, dict):
        return fail("matrix root must be an object")
    if data.get("schema_version") != 1:
        return fail("schema_version must be 1")
    if data.get("product") != "Joynexa Windows":
        return fail("unexpected product name")
    if not isinstance(data.get("policy"), str) or "Unknown is never a pass" not in data["policy"]:
        return fail("policy must explicitly state that unknown is never a pass")

    baselines = data.get("official_baselines")
    if not isinstance(baselines, dict) or "windows_11" not in baselines:
        return fail("official_baselines.windows_11 is required")
    win11 = baselines["windows_11"]
    if not isinstance(win11, dict):
        return fail("windows_11 baseline must be an object")
    for field in ("sources", "processor", "memory_gb_minimum", "storage_gb_minimum",
                  "graphics", "firmware", "tpm", "display"):
        if field not in win11:
            return fail(f"windows_11.{field} is missing")
    if not isinstance(win11["sources"], list) or not win11["sources"]:
        return fail("windows_11.sources must contain official references")
    if any(not isinstance(url, str) or not url.startswith("https://") for url in win11["sources"]):
        return fail("all baseline sources must be HTTPS URLs")

    editions = data.get("editions")
    if not isinstance(editions, list):
        return fail("editions must be an array")
    ids = []
    for edition in editions:
        if not isinstance(edition, dict):
            return fail("every edition must be an object")
        edition_id = edition.get("id")
        if not isinstance(edition_id, str):
            return fail("every edition must have a string id")
        ids.append(edition_id)
        if edition.get("inherits_windows_base_requirements") is not True:
            return fail(f"{edition_id} must inherit its Windows base requirements")
        if not isinstance(edition.get("additional_requirements_status"), str):
            return fail(f"{edition_id} must declare additional_requirements_status")
    if len(ids) != len(set(ids)):
        return fail("edition IDs must be unique")
    if set(ids) != EXPECTED_EDITIONS:
        return fail(f"expected editions {sorted(EXPECTED_EDITIONS)}, got {sorted(ids)}")

    device = data.get("reference_device_assessment")
    if not isinstance(device, dict) or not isinstance(device.get("windows_11"), dict):
        return fail("reference_device_assessment.windows_11 is required")
    assessment = device["windows_11"]
    for field in ("processor", "memory", "storage_capacity", "graphics",
                  "firmware", "secure_boot", "tpm", "overall"):
        if field not in assessment:
            return fail(f"reference device assessment is missing {field}")
    for field, value in assessment.items():
        if field == "overall":
            continue
        if value not in VALID_STATUSES and not (
            isinstance(value, str) and value.endswith("_unknown")
        ) and value != "capacity_appears_sufficient_free_space_unknown":
            return fail(f"unrecognized status for reference_device_assessment.windows_11.{field}: {value}")

    if assessment["processor"] != "unsupported":
        return fail("E430 Windows 11 processor status must remain unsupported")
    if assessment["overall"] != "not_officially_eligible_based_on_processor":
        return fail("E430 must not be marked officially eligible for Windows 11")
    if "unknown" not in data.get("status_values", []):
        return fail("status_values must include unknown")

    print(f"OK: requirements matrix validated ({len(ids)} editions; unknown values are not passes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
