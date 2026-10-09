/** Minimal linear scales and "nice" ticks for the hand-rolled SVG charts. */

export interface LinearScale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
  invert(px: number): number;
}

export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  // Rounded to 1/100 px: server (Node) and browser engines can differ in the last
  // bit of Math.exp/Math.sin, and unrounded coordinates would break hydration.
  const scale = ((v: number) => round2(r0 + ((v - d0) / span) * (r1 - r0))) as LinearScale;
  scale.domain = domain;
  scale.range = range;
  scale.invert = (px: number) => d0 + ((px - r0) / (r1 - r0 || 1)) * span;
  return scale;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Ticks at 1, 2 or 5 x 10^k spacing covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi === lo) return [lo];
  const raw = (hi - lo) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step =
    (norm >= Math.SQRT2 * 5 ? 10 : norm >= Math.sqrt(10) ? 5 : norm >= Math.SQRT2 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** SVG path through points, skipping non-finite values (gaps). */
export function linePath(points: [number, number][]): string {
  let d = "";
  let pen = false;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    pen = true;
  }
  return d;
}

/** Interpolate two colours given as #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const lerp = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((lerp(16) << 16) | (lerp(8) << 8) | lerp(0)).toString(16).padStart(6, "0")}`;
}
