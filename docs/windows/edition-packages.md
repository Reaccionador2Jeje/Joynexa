# Joynexa Windows edition packages

The Windows Engineering workflow generates one ZIP metadata package per official
edition. These are **not Windows images, installers, or bootable media**. They
contain only the Edition Engine manifest and a short README.

## Local generation

First generate a manifest:

```bash
python3 tools/windows/joynexa-edition-engine.py \
  --edition core --base windows_11 \
  --output build/manifests/core.json
```

Then package it:

```bash
python3 tools/windows/joynexa-metadata-packager.py \
  --manifest build/manifests/core.json \
  --output build/packages/joynexa-core-metadata.zip
```

The packager fails closed unless all selected components are marked
`verified` and every safety assertion is explicitly false. Since current
edition components are still planned, the initial workflow artifacts are
expected to be blocked until real implementations and tests exist. This is
intentional: planned components must not be presented as finished software.

No Windows payload is downloaded, redistributed, activated, or modified.
Future ISO work must consume a properly licensed source supplied by the user,
retain Microsoft's requirements and signature enforcement, and use validated
build tooling.
