#!/usr/bin/env python3
"""Package a Joynexa edition's verified planning metadata (never a Windows image)."""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import zipfile


class PackageError(ValueError):
    pass


def load_manifest(path: pathlib.Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PackageError(f"cannot read manifest: {exc}") from exc
    if not isinstance(value, dict):
        raise PackageError("manifest root must be an object")
    if value.get("manifest_id") != "joynexa-windows-build-manifest" or value.get("schema_version") != 1:
        raise PackageError("unsupported Joynexa manifest")
    if value.get("build_readiness") != "planning_only":
        raise PackageError("only planning manifests are accepted by this metadata packager")
    safety = value.get("safety")
    if not isinstance(safety, dict):
        raise PackageError("manifest safety section is required")
    required_false = (
        "windows_requirements_bypassed",
        "driver_signature_enforcement_disabled",
        "unlicensed_windows_payload_included",
        "os_image_built",
        "system_modified",
    )
    if any(safety.get(key) is not False for key in required_false):
        raise PackageError("manifest safety assertions are missing or unsafe")
    edition = value.get("edition")
    if not isinstance(edition, dict) or edition.get("id") not in {
        "core", "play", "productivity", "modern", "retro", "legacy"
    }:
        raise PackageError("manifest has an unknown edition")
    components = value.get("components")
    if not isinstance(components, list):
        raise PackageError("manifest components must be an array")
    for item in components:
        if not isinstance(item, dict) or item.get("definition_status") not in {
            "planned", "implemented", "verified", "blocked"
        }:
            raise PackageError("invalid component record")
    return value


def create_package(manifest_path: pathlib.Path, output: pathlib.Path) -> None:
    manifest = load_manifest(manifest_path)
    edition_id = manifest["edition"]["id"]
    readme = f"""# Joynexa {manifest['edition']['name']} — metadata package

This archive contains edition metadata only.

- Windows image included: no
- Windows installer included: no
- System changes performed: no
- Requirements bypassed: no
- Selected components: {len(manifest['components'])}

The component list is empty until implementation and verification are complete.
This package is not bootable and cannot install or activate Windows.
Use a separately obtained, properly licensed Windows installation source and
follow its official requirements and lifecycle.
"""
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(manifest_path, "Joynexa/edition-manifest.json")
        archive.writestr("README.txt", readme)


def self_test() -> None:
    import tempfile
    with tempfile.TemporaryDirectory() as directory:
        root = pathlib.Path(directory)
        manifest = {
            "schema_version": 1,
            "manifest_id": "joynexa-windows-build-manifest",
            "build_readiness": "planning_only",
            "edition": {"id": "core", "name": "Joynexa Core"},
            "components": [],
            "safety": {
                "windows_requirements_bypassed": False,
                "driver_signature_enforcement_disabled": False,
                "unlicensed_windows_payload_included": False,
                "os_image_built": False,
                "system_modified": False,
            },
        }
        source = root / "manifest.json"
        source.write_text(json.dumps(manifest), encoding="utf-8")
        destination = root / "package.zip"
        create_package(source, destination)
        with zipfile.ZipFile(destination) as archive:
            assert set(archive.namelist()) == {
                "Joynexa/edition-manifest.json", "README.txt"
            }
            assert json.loads(archive.read("Joynexa/edition-manifest.json"))["edition"]["id"] == "core"
        manifest["safety"]["windows_requirements_bypassed"] = True
        source.write_text(json.dumps(manifest), encoding="utf-8")
        try:
            load_manifest(source)
        except PackageError:
            pass
        else:
            raise AssertionError("unsafe manifests must be rejected")
    print("OK: metadata packager self-test passed.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    try:
        if args.self_test:
            self_test()
        if args.manifest or args.output:
            if not args.manifest or not args.output:
                parser.error("--manifest and --output must be used together")
            create_package(args.manifest, args.output)
            print(f"Metadata package written: {args.output}")
        elif not args.self_test:
            parser.error("provide --manifest/--output or --self-test")
    except (PackageError, OSError, zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
