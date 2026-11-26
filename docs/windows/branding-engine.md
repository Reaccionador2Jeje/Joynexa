# Joynexa Branding Engine

The Branding Engine generates six original, standalone identity packs. Each ZIP contains an edition palette, a vector wordmark, a 1920×1080 SVG desktop background, and a short README.

## Generate one edition

```bash
python tools/windows/joynexa-branding-engine.py --check
python tools/windows/joynexa-branding-engine.py --self-test
python tools/windows/joynexa-branding-engine.py --edition play --output build/joynexa-play-branding.zip
```

## Design contract

- All six editions have distinct palettes and original vector motifs.
- Assets are SVG source, so they remain scalable and editable.
- No external images, remote fonts, scripts, or linked resources are embedded.
- The pack is independent of Windows installation media.
- It does not replace protected Windows resources, modify activation, or change system settings.
- The edition component is marked implemented, not verified as a Windows integration. Manual import and visual review remain separate work.

The generated pack is an asset bundle, not an installer or Windows image.
