#!/usr/bin/env python3
"""Create a safe, non-destructive Joynexa Modern build plan."""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from datetime import datetime, timezone
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROFILE_PATH = ROOT / "docs" / "windows" / "modern-profile.json"
ALLOWED_WINDOWS_EDITIONS = {"Home", "Pro"}
REQUIRED_ENABLED = (
    "windows_update",
    "microsoft_defender",
    "firewall",
    "uac",
    "driver_signature_enforcement",
    "plug_and_play",
)
REQUIRED_PRESERVED = ("recovery",)


class PlanError(ValueError):
    """Raised when the Modern profile is unsafe or incomplete."""


def load_profile() -> dict[str, Any]:
    try:
        profile = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PlanError(f"cannot load valid Modern profile: {exc}") from exc
    if not isinstance(profile, dict):
        raise PlanError("Modern profile root must be an object")
    return profile


def validate_profile(profile: dict[str, Any]) -> None:
    edition = profile.get("edition")
    base = profile.get("base")
    security = profile.get("security_and_servicing")
    drivers = profile.get("driver_policy")
    if not isinstance(edition, dict) or edition.get("id") != "modern":
        raise PlanError("profile must describe the modern edition")
    if not isinstance(base, dict):
        raise PlanError("profile base must be an object")
    if (base.get("product"), base.get("version"), base.get("architecture")) != (
        "Windows 11", "26H2", "x64"
    ):
        raise PlanError("expected the declared Windows 11 26H2 x64 base")
    if base.get("media_source") != "official_microsoft_media_supplied_by_user":
        raise PlanError("only official Microsoft media supplied by the device owner is allowed")
    if base.get("redistribution_of_windows_media") is not False:
        raise PlanError("Windows media redistribution must remain disabled")
    if not isinstance(security, dict):
        raise PlanError("security_and_servicing must be an object")
    for key in REQUIRED_ENABLED:
        if security.get(key) != "enabled":
            raise PlanError(f"required protection must remain enabled: {key}")
    for key in REQUIRED_PRESERVED:
        if security.get(key) != "preserved":
            raise PlanError(f"required component must remain preserved: {key}")
    if not isinstance(drivers, dict):
        raise PlanError("driver_policy must be an object")
    if drivers.get("allow_unsigned") is not False:
        raise PlanError("unsigned drivers must remain disallowed")
    if drivers.get("disable_security_to_install") is not False:
        raise PlanError("driver installation must not disable security")
    if drivers.get("hardware_id_matching_required") is not True:
        raise PlanError("driver matching must require exact hardware IDs")
    if drivers.get("package_hash_and_signature_record_required") is not True:
        raise PlanError("driver packages must have hash and signature records")
    if profile.get("release_status") != "not_released":
        raise PlanError("planner only supports the current unreleased development profile")


def build_plan(profile: dict[str, Any], windows_edition: str) -> dict[str, Any]:
    validate_profile(profile)
    if windows_edition not in ALLOWED_WINDOWS_EDITIONS:
        raise PlanError("Windows edition must be Home or Pro")
    base = profile["base"]
    return {
        "schema_version": 1,
        "product": "Joynexa Windows",
        "edition": "modern",
        "plan_status": "planning_only_not_a_build",
        "created_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "target": {
            "operating_system": base["product"],
            "version": base["version"],
            "architecture": base["architecture"],
            "windows_edition": windows_edition,
            "servicing_channel": base["servicing_channel"],
            "license": "provided_and_activated_by_device_owner_through_microsoft",
        },
        "media_policy": {
            "source": "official_microsoft_media_supplied_by_device_owner",
            "redistribute_media": False,
            "copy_or_modify_media": False,
            "activation_or_product_keys_included": False,
        },
        "preserved_protections": {
            key: profile["security_and_servicing"][key]
            for key in (*REQUIRED_ENABLED, *REQUIRED_PRESERVED)
        },
        "driver_policy": {
            "winpe": "inject_only_exact_signed_drivers_proven_required_for_setup",
            "installed_windows": "windows_pnp_windows_update_and_curated_signed_oem_inf_packages",
            "unsigned_drivers_allowed": False,
            "hardware_id_match_required": True,
            "record_sha256_and_signature": True,
        },
        "stages": [
            {
                "id": "preflight",
                "title": "Confirm device eligibility",
                "status": "manual_gate",
                "tasks": [
                    "Check every official Windows 11 requirement on the target device.",
                    "Confirm firmware, TPM, Secure Boot, storage, memory, CPU support, and graphics.",
                    "Stop if the device is not officially eligible; do not bypass requirements.",
                ],
            },
            {
                "id": "media",
                "title": "Obtain official installation media",
                "status": "manual_gate",
                "tasks": [
                    "Device owner obtains the matching Windows 11 26H2 x64 media directly from Microsoft.",
                    "Device owner selects the licensed Home or Pro edition.",
                    "Do not redistribute Microsoft media, keys, or activation.",
                ],
            },
            {
                "id": "drivers",
                "title": "Prepare verified drivers",
                "status": "blocked_pending_hardware_inventory",
                "tasks": [
                    "Identify exact hardware IDs for storage and USB controllers needed by WinPE.",
                    "Use only architecture- and build-compatible OEM-signed packages.",
                    "Record vendor, version, source, SHA-256, signature, and test result.",
                    "Do not disable signature enforcement or force a mismatched driver.",
                ],
            },
            {
                "id": "configuration",
                "title": "Apply the Joynexa configuration",
                "status": "blocked_pending_reversible_profile_and_tests",
                "tasks": [
                    "Define documented settings with before/after values and rollback.",
                    "Keep Windows Update, Defender, Firewall, UAC, recovery, and Plug and Play enabled.",
                    "Do not remove essential servicing or security components.",
                ],
            },
            {
                "id": "verification",
                "title": "Verify the installation",
                "status": "blocked_pending_eligible_test_environment",
                "tasks": [
                    "Test installation and device setup on eligible physical hardware or a suitable VM.",
                    "Check Device Manager, Windows Update, security, recovery, networking, graphics, audio, and sleep/resume.",
                    "Record failures and repeat tests after any driver or configuration change.",
                ],
            },
            {
                "id": "release",
                "title": "Prepare a release candidate",
                "status": "blocked_until_all_release_gates_pass",
                "tasks": [
                    "Publish Joynexa-owned artifact checksums, release notes, known limitations, and rollback instructions.",
                    "Confirm licensing and distribution boundaries.",
                    "Do not mark Modern released before all release gates pass.",
                ],
            },
        ],
        "release_gate": {
            "ready_to_release": False,
            "reason": "No eligible Windows test environment or tested Modern build is currently recorded.",
        },
        "limitations": [
            "This file is a planning document, not an installer or ISO builder.",
            "It does not download, copy, mount, modify, or redistribute Windows media.",
            "It does not install drivers, change firmware, activate Windows, or alter a device.",
            "A successful plan validation does not prove hardware compatibility.",
        ],
    }


def self_test(profile: dict[str, Any]) -> None:
    for edition in sorted(ALLOWED_WINDOWS_EDITIONS):
        plan = build_plan(profile, edition)
        assert plan["target"]["windows_edition"] == edition
        assert plan["plan_status"] == "planning_only_not_a_build"
        assert plan["release_gate"]["ready_to_release"] is False
        assert plan["media_policy"]["redistribute_media"] is False
        assert all(value == "enabled" for key, value in plan["preserved_protections"].items()
                   if key in REQUIRED_ENABLED)
    print("OK: Joynexa Modern build planner self-test passed (Home and Pro; safe planning only).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--edition", choices=sorted(ALLOWED_WINDOWS_EDITIONS),
                        help="Windows edition to describe in the plan")
    parser.add_argument("--output", type=pathlib.Path,
                        help="write the generated JSON plan to this path (default: stdout)")
    parser.add_argument("--check", action="store_true",
                        help="validate the Modern profile without generating a plan")
    parser.add_argument("--self-test", action="store_true",
                        help="validate the profile and test Home/Pro plan generation")
    args = parser.parse_args()

    try:
        profile = load_profile()
        validate_profile(profile)
        if args.check:
            print("OK: Joynexa Modern profile passed build-planner safety checks.")
        if args.self_test:
            self_test(profile)
        if not args.check and not args.self_test:
            if args.edition is None:
                parser.error("--edition Home or --edition Pro is required unless --check or --self-test is used")
            plan = build_plan(profile, args.edition)
            rendered = json.dumps(plan, indent=2, ensure_ascii=False) + "\n"
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(rendered, encoding="utf-8")
                print(f"Build plan written: {args.output}")
            else:
                sys.stdout.write(rendered)
    except (PlanError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
