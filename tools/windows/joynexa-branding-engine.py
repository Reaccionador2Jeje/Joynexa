#!/usr/bin/env python3
"""Generate original, standalone Joynexa SVG identity packs (no Windows modification)."""
from __future__ import annotations
import argparse, json, pathlib, re, sys, zipfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[2]
CONFIG = ROOT / "config" / "windows" / "branding-profiles.json"
IDS = {"core", "play", "productivity", "modern", "retro", "legacy"}
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")

class BrandingError(ValueError): pass

def load_config(path: pathlib.Path) -> dict:
    try: data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc: raise BrandingError(str(exc)) from exc
    if not isinstance(data, dict) or data.get("schema_version") != 1 or data.get("engine_id") != "joynexa-branding-engine":
        raise BrandingError("unsupported branding config schema")
    editions = data.get("editions")
    if not isinstance(editions, dict) or set(editions) != IDS: raise BrandingError("branding config must define exactly six editions")
    for key, item in editions.items():
        if not isinstance(item, dict) or not isinstance(item.get("name"), str): raise BrandingError(f"{key}: invalid edition branding")
        for color in ("accent", "background", "surface", "foreground", "muted"):
            if not isinstance(item.get(color), str) or not HEX.fullmatch(item[color]): raise BrandingError(f"{key}: invalid {color}")
    canvas = data.get("shared", {}).get("canvas", {})
    if canvas != {"width": 1920, "height": 1080}: raise BrandingError("canvas must be 1920x1080")
    return data

def make_logo(name: str, accent: str, foreground: str) -> str:
    safe = name.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320" role="img" aria-labelledby="title desc">
<title id="title">{safe}</title><desc id="desc">Original Joynexa wordmark and geometric emblem.</desc>
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{accent}"/><stop offset="1" stop-color="{foreground}"/></linearGradient></defs>
<rect x="28" y="28" width="264" height="264" rx="68" fill="#101820"/>
<path d="M160 72 238 116 238 204 160 248 82 204 82 116Z" fill="none" stroke="url(#g)" stroke-width="17" stroke-linejoin="round"/>
<path d="M119 160h82m-41-42v84" stroke="{foreground}" stroke-width="15" stroke-linecap="round"/>
<text x="340" y="178" fill="{foreground}" font-family="Segoe UI,Arial,sans-serif" font-size="104" font-weight="700" letter-spacing="5">JOYNEXA</text>
<rect x="344" y="211" width="470" height="7" rx="3" fill="{accent}"/>
</svg>'''

def make_wallpaper(name: str, c: dict, motif: str) -> str:
    # All artwork is authored here; no external images, scripts, fonts, or references.
    safe = name.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    shapes = {
      "calm": '<circle cx="1510" cy="340" r="280" fill="none" stroke="{a}" stroke-width="3" opacity=".55"/><circle cx="1510" cy="340" r="205" fill="none" stroke="{a}" stroke-width="2" opacity=".35"/>',
      "energy": '<path d="M1180 1080 1920 340M1350 1080 1920 510M1520 1080 1920 680" stroke="{a}" stroke-width="34" opacity=".25"/><circle cx="1510" cy="390" r="230" fill="none" stroke="{a}" stroke-width="8" opacity=".6"/>',
      "focus": '<rect x="1230" y="150" width="470" height="470" rx="235" fill="none" stroke="{a}" stroke-width="4" opacity=".5"/><rect x="1320" y="240" width="290" height="290" rx="145" fill="none" stroke="{a}" stroke-width="3" opacity=".35"/>',
      "orbit": '<ellipse cx="1510" cy="430" rx="480" ry="180" transform="rotate(-28 1510 430)" fill="none" stroke="{a}" stroke-width="5" opacity=".55"/><circle cx="1510" cy="430" r="170" fill="none" stroke="{a}" stroke-width="3" opacity=".3"/>',
      "heritage": '<path d="M1180 180h520v520h-520zM1260 260h360v360h-360z" fill="none" stroke="{a}" stroke-width="5" opacity=".5"/>',
      "archive": '<path d="M1180 200h540M1180 280h420M1180 360h500M1180 440h360" stroke="{a}" stroke-width="8" opacity=".35"/>'
    }.get(motif)
    if not shapes: raise BrandingError("unknown artwork motif")
    art = shapes.format(a=c["accent"])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-labelledby="title">
<title id="title">{safe} desktop background</title><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{c['background']}"/><stop offset="1" stop-color="{c['surface']}"/></linearGradient><radialGradient id="glow"><stop stop-color="{c['accent']}" stop-opacity=".16"/><stop offset="1" stop-color="{c['accent']}" stop-opacity="0"/></radialGradient></defs>
<rect width="1920" height="1080" fill="url(#bg)"/><circle cx="1510" cy="430" r="620" fill="url(#glow)"/>{art}
<path d="M110 820h170" stroke="{c['accent']}" stroke-width="8" stroke-linecap="round"/>
<text x="110" y="900" fill="{c['foreground']}" font-family="Segoe UI,Arial,sans-serif" font-size="68" font-weight="650">{safe}</text>
<text x="114" y="954" fill="{c['muted']}" font-family="Segoe UI,Arial,sans-serif" font-size="26">Windows, shaped around you.</text>
</svg>'''

def build(edition: str, config: dict, output: pathlib.Path) -> None:
    item = config["editions"][edition]; shared = config["shared"]
    manifest = {"schema_version":1,"product":"Joynexa","edition":edition,"edition_name":item["name"],
      "engine":"joynexa-branding-engine","assets":[{"path":"assets/joynexa-wordmark.svg","format":"svg","role":"wordmark"},
      {"path":"assets/desktop-background.svg","format":"svg","role":"desktop-background","width":1920,"height":1080}],
      "palette":{k:item[k] for k in ("accent","background","surface","foreground","muted")},
      "font_family":shared["font_family"],"windows_resources_modified":False,"external_assets":False}
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        z.writestr("joynexa-branding.json",json.dumps(manifest,indent=2,ensure_ascii=False)+"\n")
        z.writestr("assets/joynexa-wordmark.svg",make_logo(item["name"],item["accent"],item["foreground"]))
        z.writestr("assets/desktop-background.svg",make_wallpaper(item["name"],item,item["motif"]))
        z.writestr("README.txt",f"{item['name']} original identity pack.\nStandalone SVG assets; import manually where supported.\nNo Windows system resources are modified.\n")
    with zipfile.ZipFile(output) as z:
        bad=z.testzip()
        if bad: raise BrandingError(f"ZIP integrity failure: {bad}")
    print(f"Branding pack created: {output}")

def self_test(config: dict) -> None:
    import tempfile
    for edition in sorted(IDS):
        item=config["editions"][edition]
        logo=make_logo(item["name"],item["accent"],item["foreground"])
        wallpaper=make_wallpaper(item["name"],item,item["motif"])
        assert logo.startswith("<svg ") and "</svg>" in logo
        assert 'width="1920" height="1080"' in wallpaper and "</svg>" in wallpaper
        assert "<script" not in logo.lower()+wallpaper.lower()
    with tempfile.TemporaryDirectory() as td:
        p=pathlib.Path(td)/"test.zip"; build("core",config,p)
        with zipfile.ZipFile(p) as z:
            assert set(z.namelist()) == {"joynexa-branding.json","assets/joynexa-wordmark.svg","assets/desktop-background.svg","README.txt"}
            data=json.loads(z.read("joynexa-branding.json"))
            assert data["windows_resources_modified"] is False
    print("OK: six edition palettes, SVG generation, archive contents, and safety contract.")

def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--edition",choices=sorted(IDS)); ap.add_argument("--output",type=pathlib.Path)
    ap.add_argument("--config",type=pathlib.Path,default=CONFIG); ap.add_argument("--check",action="store_true"); ap.add_argument("--self-test",action="store_true")
    args=ap.parse_args()
    try:
        config=load_config(args.config)
        if args.check: print("OK: six branding profiles and color palettes are valid.")
        if args.self_test: self_test(config)
        if args.edition:
            if not args.output: ap.error("--output is required with --edition")
            build(args.edition,config,args.output)
        elif not (args.check or args.self_test): ap.error("provide --check, --self-test, or --edition")
    except (BrandingError,OSError,zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}",file=sys.stderr); return 1
    return 0
if __name__=="__main__": raise SystemExit(main())
