/**
 * The script ℓ (U+2113) for "log-likelihood". None of the self-hosted text fonts
 * (Plex Sans, Plex Mono, Fraunces) has this glyph, so in mono text it fell back
 * to a tiny system glyph that read like "ι". KaTeX's main font, already loaded
 * for the maths, has a proper one; the `.ell` class in globals.css uses it.
 */
export function Ell() {
  return <span className="ell">ℓ</span>;
}
