/** Axis helpers for the hand-rolled SVG charts: data-driven domains and tick labels. */

import { niceTicks } from "./scale";

/** Width of one histogram bar on the default 1 to 10 rating scale (20 bars). */
const BIN_WIDTH = 9 / 20;

export interface RatingAxis {
  /** x-axis domain, half a unit beyond the histogram range on each side */
  domain: [number, number];
  /** histogram range: covers every value, and never less than 1 to 10 */
  histRange: [number, number];
  bins: number;
}

/**
 * The x axis for a set of ratings. On the 1 to 10 scale this is the charts'
 * default ([0.5, 10.5], 20 bars); unclipped data that spills past either end
 * widens it to whole units around the data, keeping the same bar width, so every
 * rating is both counted in the histogram and drawn on the strip.
 */
export function ratingAxis(values: ArrayLike<number>): RatingAxis {
  let lo = 1;
  let hi = 10;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = Math.floor(v);
    if (v > hi) hi = Math.ceil(v);
  }
  return {
    domain: [lo - 0.5, hi + 0.5],
    histRange: [lo, hi],
    bins: Math.max(1, Math.round((hi - lo) / BIN_WIDTH)),
  };
}

/**
 * Decimal places that tell ticks at this spacing apart: 0.05 needs 2 (0.05, 0.10,
 * 0.15), 0.2 or 0.5 need 1, whole numbers none.
 */
export function tickDecimals(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 2;
  return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
}

/** Labels for evenly spaced linear ticks, all with the same number of decimals. */
export function formatLinearTicks(ticks: number[]): string[] {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : Math.abs(ticks[0] ?? 1) || 1;
  const decimals = tickDecimals(step);
  return ticks.map((t) => (t === 0 ? "0" : t.toFixed(decimals).replace(/^-/, "−")));
}

/**
 * Ticks for a log10 axis, returned as log10 values. Whole decades when at least two
 * fit; otherwise 1, 2, 5 × 10^k inside the range; and for a range narrower than
 * that, ordinary linear ticks on the values themselves.
 */
export function logTicks(lo: number, hi: number, target = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return [];
  const decades = niceTicks(Math.ceil(lo), Math.floor(hi), target).filter((t) =>
    Number.isInteger(t),
  );
  if (decades.length >= 2) return decades;
  const eps = 1e-9;
  const sub: number[] = [];
  for (let k = Math.floor(lo); k <= Math.ceil(hi); k++) {
    for (const m of [1, 2, 5]) {
      const t = k + Math.log10(m);
      if (t >= lo - eps && t <= hi + eps) sub.push(t);
    }
  }
  if (sub.length >= 2) return sub;
  return niceTicks(10 ** lo, 10 ** hi, 3)
    .filter((v) => v > 0)
    .map((v) => Math.log10(v))
    .filter((t) => t >= lo - eps && t <= hi + eps);
}

const SUPERSCRIPT: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

function power(exponent: number): string {
  return `10${String(exponent)
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("")}`;
}

/**
 * Label for a log-axis tick given as log10(value): plain decimals from 0.001 up
 * (0.01, 0.2, 5), powers of ten below that (10⁻⁸, 2×10⁻⁴).
 */
export function formatLogTick(t: number): string {
  const value = 10 ** t;
  if (value >= 0.001 - 1e-12 && value < 1e6) return String(Number(value.toPrecision(3)));
  const exponent = Math.floor(t + 1e-9);
  const mantissa = Number((value / 10 ** exponent).toPrecision(2));
  return mantissa === 1 ? power(exponent) : `${mantissa}×${power(exponent)}`;
}
