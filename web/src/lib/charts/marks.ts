/** Shared mark helpers for the SVG charts (safe in server and client components). */

/** Upward triangle centred on (cx, cy) with circumradius ~ r. */
export function triangle(cx: number, cy: number, r: number): string {
  const h = r * 0.95;
  const f = (v: number) => (Math.round(v * 100) / 100).toString();
  return `M${f(cx)},${f(cy - h)}L${f(cx + r * 0.87)},${f(cy + h * 0.55)}L${f(cx - r * 0.87)},${f(cy + h * 0.55)}Z`;
}

/** teal at gamma1 = 1, coral at gamma1 = 0, blended in between (OKLab mixing). */
export function pointFill(g1: number): string {
  if (!Number.isFinite(g1)) return "var(--muted-foreground)";
  const pct = Math.round(Math.min(1, Math.max(0, g1)) * 100);
  return `color-mix(in oklab, var(--comp-1) ${pct}%, var(--comp-2))`;
}

/** deterministic pseudo-random jitter in [0, 1) per point index */
export function jitter(i: number): number {
  // integer hash (no Math.sin), so server and browser agree bit for bit
  let h = Math.imul(i + 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
