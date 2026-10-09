# Open Graph fonts

Static TrueType copies of the site's self-hosted fonts, used only by
`src/app/opengraph-image.tsx` at build time. `next/og` cannot read WOFF2 and
draws variable fonts at their default instance, so
[`scripts/make_og_fonts.py`](../../../scripts/make_og_fonts.py) converts the
WOFF2 files in `src/app/fonts` and pins Fraunces to the hero's weights:

| file                      | from                                   | instance           |
| ------------------------- | -------------------------------------- | ------------------ |
| `fraunces-600.ttf`        | `fraunces-latin-opsz-normal.woff2`     | wght 600, opsz 144 |
| `fraunces-italic-400.ttf` | `fraunces-latin-opsz-italic.woff2`     | wght 400, opsz 144 |
| `ibm-plex-sans-400.ttf`   | `ibm-plex-sans-latin-400-normal.woff2` | (static)           |
| `ibm-plex-mono-500.ttf`   | `ibm-plex-mono-latin-500-normal.woff2` | (static)           |

All four are under the SIL Open Font License 1.1; the licence texts are in this
folder. Regenerate with `uv run scripts/make_og_fonts.py` from the repo root.
