"""Subset the profile's two typefaces and record their advance widths.

Run once (or after changing the glyph set):
    python tools/subset_fonts.py <plex-regular> <plex-semibold> <martian-mono>

Writes scripts/fonts/*.woff2 and scripts/fonts/metrics.json. The SVG generators
embed the woff2 files as data URIs and use the widths to lay out text.
"""

import io
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts" / "fonts"

TEXT = "".join(chr(c) for c in range(0x20, 0x7F)) + "·—–’“”…•×→↗"


def subset_font(src: Path, dest: Path, pin: dict | None = None) -> TTFont:
    font = TTFont(src, lazy=False)
    if pin:
        font = instancer.instantiateVariableFont(font, pin)
        buf = io.BytesIO()
        font.save(buf)
        buf.seek(0)
        font = TTFont(buf, lazy=False)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["kern", "liga", "calt", "tnum"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(text=TEXT)
    sub.subset(font)
    font.flavor = "woff2"
    font.save(dest)
    return TTFont(dest)


def widths(font: TTFont) -> dict:
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    return {
        ch: round(hmtx[cmap[ord(ch)]][0] / upm, 4)
        for ch in TEXT
        if ord(ch) in cmap
    }


def main() -> None:
    plex_regular, plex_semibold, mono = (Path(p) for p in sys.argv[1:4])
    OUT.mkdir(parents=True, exist_ok=True)
    metrics = {}
    jobs = [
        ("plex-regular", plex_regular, None),
        ("plex-semibold", plex_semibold, None),
        # Martian Mono is variable; pin width so every glyph shares one advance,
        # keep the weight axis so one file covers 400-800.
        ("martian-mono", mono, {"wdth": 100}),
    ]
    for name, src, pin in jobs:
        dest = OUT / f"{name}.woff2"
        font = subset_font(src, dest, pin)
        metrics[name] = widths(font)
        print(f"{name}: {dest.stat().st_size / 1024:.1f} KB, {len(metrics[name])} glyphs")
    (OUT / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=0), encoding="utf-8")


if __name__ == "__main__":
    main()
