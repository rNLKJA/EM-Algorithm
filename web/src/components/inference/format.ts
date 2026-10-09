/** Formatting and labels shared by the /inference components. */
import type { Interval } from "@/lib/stats/intervals";

export const THETA_ROWS = [
  { key: "pi1", symbol: "π₁", name: "share of the low group", digits: 3 },
  { key: "mu1", symbol: "μ₁", name: "mean of the low group", digits: 2 },
  { key: "mu2", symbol: "μ₂", name: "mean of the high group", digits: 2 },
  { key: "sigma1", symbol: "σ₁", name: "spread of the low group", digits: 2 },
  { key: "sigma2", symbol: "σ₂", name: "spread of the high group", digits: 2 },
] as const;

/** fixed digits with a typographic minus */
export function fmt(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "n/a";
  const s = v.toFixed(digits);
  return s.startsWith("-") ? `−${s.slice(1)}` : s;
}

export function fmtInterval(ci: Interval | null | undefined, digits = 2): string {
  if (!ci || !Number.isFinite(ci.lower)) return "n/a";
  return `${fmt(ci.lower, digits)} to ${fmt(ci.upper, digits)}`;
}

export function pct(p: number, digits = 1): string {
  return Number.isFinite(p) ? `${(100 * p).toFixed(digits)}%` : "n/a";
}

export function pctInterval(ci: Interval, digits = 1): string {
  return `${(100 * ci.lower).toFixed(digits)}% to ${(100 * ci.upper).toFixed(digits)}%`;
}

export function count(n: number): string {
  return n.toLocaleString("en-AU");
}
