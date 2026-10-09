# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "fonttools>=4.50",
#   "brotli>=1.1",
# ]
# ///
"""Make the static TTF fonts the Open Graph image is drawn with.

``next/og`` (Satori) reads TTF/OTF/WOFF but not WOFF2, and draws a variable
font at its default instance. This script takes the self-hosted WOFF2 files in
``web/src/app/fonts`` (all SIL Open Font License 1.1; licences sit beside them),
pins Fraunces to the weights the hero uses, and writes plain TTFs to
``web/assets/og-fonts``. Run it from the repo root:

    uv run scripts/make_og_fonts.py
"""

from __future__ import annotations

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "web" / "src" / "app" / "fonts"
OUT = ROOT / "web" / "assets" / "og-fonts"

# (source woff2, output ttf, axis locations for variable fonts)
FONTS = [
    ("fraunces-latin-opsz-normal.woff2", "fraunces-600.ttf", {"wght": 600, "opsz": 144}),
    ("fraunces-latin-opsz-italic.woff2", "fraunces-italic-400.ttf", {"wght": 400, "opsz": 144}),
    ("ibm-plex-sans-latin-400-normal.woff2", "ibm-plex-sans-400.ttf", None),
    ("ibm-plex-mono-latin-500-normal.woff2", "ibm-plex-mono-500.ttf", None),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src, dst, axes in FONTS:
        font = TTFont(SRC / src)
        if axes is not None:
            font = instantiateVariableFont(font, axes)
        font.flavor = None  # WOFF2 -> plain TrueType
        font.save(OUT / dst)
        print(f"{src} -> {dst} ({(OUT / dst).stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
