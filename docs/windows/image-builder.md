# Joynexa Windows Image Builder

The first builder milestone is deliberately conservative: it verifies an ISO
provided by the operator, inspects its Windows image indexes with DISM, and can
stage the original files unchanged. It does **not** download Windows, activate
it, bypass hardware requirements, disable signature enforcement, modify the
Windows image, or create a bootable ISO.

## Requirements

- Windows 10/11 or Windows Server with PowerShell 7.2+.
- DISM and the Storage PowerShell module.
- A properly licensed Windows ISO obtained independently from Microsoft.
- The exact expected SHA-256 published for that ISO by Microsoft.
- A Joynexa Edition Engine manifest matching the selected edition.

## Audit a source ISO

Generate a manifest first, for example:

```powershell
python tools/windows/joynexa-edition-engine.py --edition core --base windows_11 --output build/core.json
```

Then inspect the ISO without copying its files:

```powershell
pwsh -File tools/windows/joynexa-image-builder.ps1 `
  -SourceIso C:\ISO\Windows.iso `
  -Edition core `
  -Manifest build\core.json `
  -ExpectedSha256 YOUR_OFFICIAL_64_CHARACTER_SHA256 `
  -OutputDirectory build\audit-core `
  -AuditOnly
```

The report records the verified ISO hash, install.wim/install.esd, available
image indexes, and selected image name.

## Stage a future verified edition

Omit `-AuditOnly` to copy the ISO's files unchanged into a new output directory.
This mode is intentionally blocked until every selected component in the
manifest has status `verified`. Current profiles still contain planned
components, so staging should fail closed for now.

The staging directory is not a customized installer and is not bootable media.
No ISO is generated in this milestone. Future customization must be implemented
as explicit, independently tested components and must preserve Microsoft's
licensing, supported hardware requirements, secure boot and driver signature
enforcement.
