#!/usr/bin/env python3
"""Generate and validate Joynexa edition build manifests (planning only)."""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from datetime import datetime, timezone
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_PROFILES = ROOT / "config" / "windows" / "edition-profiles.json"
DEFAULT_REQUIREMENTS = ROOT / "docs" / "windows" / "edition-requirements.json"
VALID_EDITIONS = {"core", "play", "productivity", "modern", "retro", "legacy"}


class EditionError(ValueError):
    pass


def load_object(path: pathlib.Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EditionError(f"cannot read {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise EditionError(f"{path}: root must be an object")
    return value


def validate_definitions(profiles: dict[str, Any], requirements: dict[str, Any]) -> dict[str, dict[str, Any]]:
    if profiles.get("schema_version") != 1 or profiles.get("engine_id") != "joynexa-edition-engine":
        raise EditionError("unsupported edition profile schema")
    if profiles.get("status") != "planning_only":
        raise EditionError("edition engine must remain planning_only until build pipeline is verified")
    if requirements.get("schema_version") != 1 or requirements.get("product") != "Joynexa Windows":
        raise EditionError("unsupported edition requirements matrix")
    matrix = requirements.get("editions")
    if not isinstance(matrix, list):
        raise EditionError("requirements.editions must be an array")
    matrix_ids = {item.get("id") for item in matrix if isinstance(item, dict)}
    if matrix_ids != VALID_EDITIONS:
        raise EditionError("requirements matrix must define exactly the six official editions")
    if any(item.get("inherits_windows_base_requirements") is not True for item in matrix if isinstance(item, dict)):
        raise EditionError("every edition must inherit the selected Windows base requirements")
    definitions = profiles.get("editions")
    if not isinstance(definitions, list):
        raise EditionError("profiles.editions must be an array")
    result: dict[str, dict[str, Any]] = {}
    for item in definitions:
        if not isinstance(item, dict):
            raise EditionError("each edition profile must be an object")
        edition_id = item.get("id")
        if edition_id not in VALID_EDITIONS or edition_id in result:
            raise EditionError(f"invalid or duplicate edition id: {edition_id}")
        if not isinstance(item.get("name"), str) or not item["name"].strip():
            raise EditionError(f"{edition_id}: name is required")
        components = item.get("components")
        if not isinstance(components, list) or not components:
            raise EditionError(f"{edition_id}: components must be a non-empty array")
        seen: set[str] = set()
        for component in components:
            if not isinstance(component, dict):
                raise EditionError(f"{edition_id}: each component must be an object")
            component_id = component.get("id")
            if not isinstance(component_id, str) or not component_id.strip() or component_id in seen:
                raise EditionError(f"{edition_id}: invalid or duplicate component id")
            seen.add(component_id)
            if not isinstance(component.get("required"), bool):
                raise EditionError(f"{edition_id}/{component_id}: required must be boolean")
            if component.get("status") not in {"planned", "implemented", "verified", "blocked"}:
                raise EditionError(f"{edition_id}/{component_id}: invalid status")
        result[edition_id] = item
    if set(result) != VALID_EDITIONS:
        raise EditionError("profiles must define exactly the six official editions")
    return result


def hardware_summary(report: dict[str, Any] | None) -> dict[str, Any]:
    if report is None:
        return {"provided": False, "assessment": "not_assessed"}
    if report.get("schema_version") != 1:
        raise EditionError("hardware report schema_version must be 1")
    cpu = report.get("cpu") or {}
    memory = report.get("memory") or {}
    platform = report.get("platform") or {}
    if not all(isinstance(x, dict) for x in (cpu, memory, platform)):
        raise EditionError("hardware report platform, cpu, and memory must be objects")
    return {
        "provided": True,
        "assessment": "inventory_evidence_only",
        "os_name": platform.get("os_name"),
        "architecture": platform.get("architecture"),
        "cpu_model": cpu.get("model"),
        "logical_cpus": cpu.get("logical_cpus"),
        "memory_total_bytes": memory.get("total_bytes"),
        "warning": "An inventory is not a Windows compatibility verdict."
    }


def build_manifest(edition: dict[str, Any], base: str, include: list[str],
                   requirements: dict[str, Any], report: dict[str, Any] | None) -> dict[str, Any]:
    components = edition["components"]
    known = {item["id"]: item for item in components}
    unknown = sorted(set(include) - set(known))
    if unknown:
        raise EditionError(f"unknown optional component(s) for {edition['id']}: {', '.join(unknown)}")
    selected = []
    for component in components:
        enabled = component["required"] or component["id"] in include
        if enabled:
            selected.append({
                "id": component["id"],
                "required": component["required"],
                "definition_status": component["status"],
                "build_action": "not_implemented" if component["status"] == "planned" else "not_executed"
            })
    base_data = requirements.get("official_baselines", {}).get(base)
    if not isinstance(base_data, dict):
        raise EditionError(f"unknown Windows base '{base}' in official requirements matrix")
    if edition.get("windows_base") and edition["windows_base"] != base:
        raise EditionError(f"{edition['id']} requires base {edition['windows_base']}")
    return {
        "schema_version": 1,
        "manifest_id": "joynexa-windows-build-manifest",
        "product": "Joynexa Windows",
        "edition": {"id": edition["id"], "name": edition["name"], "purpose": edition.get("purpose")},
        "windows_base": {"id": base, "official_baseline_inherited": True},
        "build_readiness": "planning_only",
        "created_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "components": selected,
        "component_summary": {
            "selected": len(selected),
            "implemented": sum(x["definition_status"] == "implemented" for x in selected),
            "verified": sum(x["definition_status"] == "verified" for x in selected),
            "planned": sum(x["definition_status"] == "planned" for x in selected),
            "blocked": sum(x["definition_status"] == "blocked" for x in selected)
        },
        "requirements_policy": requirements.get("policy"),
        "hardware_evidence": hardware_summary(report),
        "safety": {
            "windows_requirements_bypassed": False,
            "driver_signature_enforcement_disabled": False,
            "unlicensed_windows_payload_included": False,
            "os_image_built": False,
            "system_modified": False
        },
        "notes": [
            "This is a declarative planning manifest, not a Windows image or installer.",
            "Edition labels do not reduce the requirements or lifecycle of the selected Windows base.",
            "Legacy is a preservation profile and is not represented as currently security-supported.",
            "Only implemented and verified components may enter a future reproducible build pipeline."
        ]
    }


def self_test() -> None:
    profiles = {
        "schema_version": 1, "engine_id": "joynexa-edition-engine", "status": "planning_only",
        "editions": [{"id": name, "name": name.title(), "components": [
            {"id": "base", "required": True, "status": "planned"},
            {"id": "optional", "required": False, "status": "planned"}]} for name in sorted(VALID_EDITIONS)]
    }
    requirements = {
        "schema_version": 1, "product": "Joynexa Windows",
        "policy": "Unknown is never a pass",
        "editions": [{"id": name, "inherits_windows_base_requirements": True} for name in sorted(VALID_EDITIONS)],
        "official_baselines": {"windows_11": {"sources": ["https://example.invalid/requirements"]}}
    }
    definitions = validate_definitions(profiles, requirements)
    manifest = build_manifest(definitions["play"], "windows_11", ["optional"], requirements, None)
    assert [x["id"] for x in manifest["components"]] == ["base", "optional"]
    assert manifest["build_readiness"] == "planning_only"
    assert manifest["safety"]["os_image_built"] is False
    try:
        build_manifest(definitions["core"], "windows_11", ["not-a-component"], requirements, None)
    except EditionError:
        pass
    else:
        raise AssertionError("unknown optional components must be rejected")
    print("OK: edition engine self-test passed (six editions, selection, fail-closed components).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--edition", choices=sorted(VALID_EDITIONS))
    parser.add_argument("--base", default="windows_11", help="base key from the official requirements matrix")
    parser.add_argument("--include", action="append", default=[], help="enable an optional component; repeatable")
    parser.add_argument("--hardware-report", type=pathlib.Path)
    parser.add_argument("--profiles", type=pathlib.Path, default=DEFAULT_PROFILES)
    parser.add_argument("--requirements", type=pathlib.Path, default=DEFAULT_REQUIREMENTS)
    parser.add_argument("--output", type=pathlib.Path)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        profiles = load_object(args.profiles)
        requirements = load_object(args.requirements)
        definitions = validate_definitions(profiles, requirements)
        if args.check:
            print("OK: all six edition profiles and inherited Windows requirements are valid.")
        if args.self_test:
            self_test()
        if args.edition:
            report = load_object(args.hardware_report) if args.hardware_report else None
            manifest = build_manifest(definitions[args.edition], args.base, args.include, requirements, report)
            rendered = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(rendered, encoding="utf-8")
                print(f"Build manifest written: {args.output}")
            else:
                sys.stdout.write(rendered)
        elif not (args.check or args.self_test):
            parser.error("provide --edition, --check, or --self-test")
    except (EditionError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
