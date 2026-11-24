# Joynexa Modern Driver Intelligence

This is a metadata and verification layer, not a driver downloader or installer.

## Catalog format

The source of truth is [modern-driver-catalog.json](modern-driver-catalog.json). Each entry must include:
- Exact PCI or USB hardware IDs.
- Windows 11 26H2 x64 build range.
- OEM HTTPS source, package file paths, and SHA-256 values.
- Catalog signature state and signer evidence.
- Hardware test status and evidence.
- Explicit approval state.

The catalog currently has **zero approved drivers**. Empty is intentional: no package should be invented or marked trusted without OEM provenance and verification.

## Validate the catalog on Linux or Windows

From the repository root:

```bash
python3 tools/windows/joynexa-driver-catalog.py --check
python3 tools/windows/joynexa-driver-catalog.py --self-test
```

To verify package file hashes after obtaining a package from its OEM, place the extracted files under a local directory and run:

```bash
python3 tools/windows/joynexa-driver-catalog.py --verify-files --package-root /path/to/extracted/package
```

The tool checks every catalogued file hash and rejects paths that escape the package root. It does not authenticate the publisher's signature.

## Verify a catalog signature on Windows

Use the read-only PowerShell verifier against the OEM-supplied `.cat` file:

```powershell
.\tools\windows\Test-JoynexaDriverCatalogSignature.ps1 -CatalogPath C:\Drivers\vendor\driver.cat
```

Optionally supply the expected SHA-256 and exact signer subject from a separately trusted OEM record. The script uses Windows Authenticode verification and records the catalog hash. A valid standalone catalog signature does not, by itself, prove that the package supports a device or Windows build; Windows Plug and Play / PnPUtil package validation and hardware testing remain required.

## Approval policy

A catalog entry cannot be marked `approved` unless its signature state is `verified` and its hardware test state is `passed`. The metadata validator enforces this consistency but cannot independently prove that a human-entered evidence record is genuine. Keep original OEM source records and test logs with release evidence.

Never disable driver signature enforcement, use unofficial mirrors, force mismatched INF files, or inject drivers merely because they are available. WinPE storage/USB drivers and post-install device drivers remain separate workflows.
