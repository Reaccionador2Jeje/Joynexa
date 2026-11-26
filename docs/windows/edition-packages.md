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

The packager accepts planning declarations but fails closed unless every safety
assertion is explicitly false. Packages can therefore be generated while
components remain planned, but they are metadata only and cannot be mistaken
for finished software. A future installer/build pipeline must require verified
components and its own tests.

No Windows payload is downloaded, redistributed, activated, or modified.
Future ISO work must consume a properly licensed source supplied by the user,
retain Microsoft's requirements and signature enforcement, and use validated
build tooling.
