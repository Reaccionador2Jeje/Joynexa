# Joynexa Edition Engine

The Edition Engine turns one of the six official edition profiles into a deterministic JSON planning manifest. It does not build or modify a Windows image.

## Validate definitions

```bash
python3 tools/windows/joynexa-edition-engine.py --check
python3 tools/windows/joynexa-edition-engine.py --self-test
```

## Generate an edition manifest

```bash
python3 tools/windows/joynexa-edition-engine.py \
  --edition core \
  --base windows_11 \
  --output build/manifests/core.json
```

Enable optional components by their exact profile IDs. Repeat `--include` for multiple components:

```bash
python3 tools/windows/joynexa-edition-engine.py \
  --edition play --base windows_11 \
  --include gaming-tools --include game-launcher \
  --output build/manifests/play.json
```

Attach a local Linux hardware report as evidence only:

```bash
python3 tools/windows/joynexa-edition-engine.py \
  --edition retro --base windows_11 \
  --hardware-report joynexa-hardware-report.json \
  --output build/manifests/retro-e430-review.json
```

The report is not a compatibility verdict. Unknown CPU support, TPM, firmware, graphics, free disk space, or driver status remain unknown. The Lenovo ThinkPad Edge E430 is already documented as not officially eligible for Windows 11 because its i5-2520M is outside Microsoft's supported CPU list and reported memory is below the Windows 11 minimum. The engine will not bypass those requirements.

## Profile design

- **Core:** essential base, Joynexa identity, diagnostics.
- **Play:** Core foundation plus optional gaming tools and launcher.
- **Productivity:** Core foundation plus optional development and productivity tools.
- **Modern:** Windows 11 26H2 x64 profile with mandatory driver-validation component.
- **Retro:** older-hardware assessment and optional classic interface; only with a supported and licensed Windows base.
- **Legacy:** historical preservation documentation and offline recovery guidance, not a claim of current security support.

Every edition inherits the selected Windows base requirements. Edition-specific hardware minimums are not invented; they must be supported by official requirements and measured tests.

## Manifest guarantees

- Stable edition and component IDs.
- Unknown optional component IDs fail closed.
- Required components are always selected.
- Planned components are explicitly marked and cannot be mistaken for implemented features.
- No Windows payload, driver package, activation mechanism, or installer is downloaded or included.
- The output explicitly records that no OS image was built and no system was modified.

The build pipeline remains planning-only until each component has implementation, reproducible build steps, licensing review, and validation on supported hardware.
