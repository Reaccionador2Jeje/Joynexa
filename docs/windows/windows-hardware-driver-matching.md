# Windows Hardware Inventory and Driver Matching

## Collect an inventory on Windows

Run from the Joynexa repository root in PowerShell:

```powershell
.\tools\windows\Export-JoynexaHardwareInventory.ps1 -OutputPath .\joynexa-hardware-inventory.json
```

The collector records present Plug and Play devices, exact Hardware IDs, system model, CPU and memory, and available driver metadata. It intentionally excludes serial numbers, network addresses, and user names. It does not change drivers.

## Compare against the Modern catalog

The analysis tool runs on Linux, macOS, or Windows:

```bash
python3 tools/windows/joynexa-hardware-compatibility.py \
  --inventory joynexa-hardware-inventory.json \
  --output joynexa-hardware-compatibility.json

python3 tools/windows/joynexa-hardware-compatibility.py --self-test
```

Matching is exact and case-insensitive. A match is considered approved only when the catalog entry is approved, its signature is verified, and its hardware test passed. Candidate entries remain non-installable.

## Assessment values

- catalog_approved_match: exact match to an entry that passed catalog approval gates.
- catalog_match_requires_validation: a match exists but is not approved.
- no_catalog_match: this catalog has no exact entry; it does not prove the device is unsupported.
- hardware_ids_unavailable: no IDs were reported by Windows.

## Safety and privacy

The inventory may reveal hardware configuration. Inspect it before sharing or publishing. Do not commit a personal machine inventory to the public repository by default.

Never invent OEM sources, package hashes, signer identities, or test evidence. Never disable signature enforcement or force an unrelated INF. The compatibility analyzer is informational and never downloads or installs drivers.
