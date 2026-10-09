/** Descriptive statistics: means, spreads, quantiles and histograms. */

export function mean(values: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i];
  return values.length ? s / values.length : Number.NaN;
}

/** Population standard deviation (ddof = 0, NumPy's default). */
export function std(values: ArrayLike<number>): number {
  const m = mean(values);
  let s = 0;
  for (let i = 0; i < values.length; i++) s += (values[i] - m) ** 2;
  return values.length ? Math.sqrt(s / values.length) : Number.NaN;
}

/** Sample standard deviation (ddof = 1, R's `sd`). */
export function sampleSd(values: ArrayLike<number>): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  let s = 0;
  for (let i = 0; i < values.length; i++) s += (values[i] - m) ** 2;
  return Math.sqrt(s / (values.length - 1));
}

/**
 * Quantile by linear interpolation between order statistics: R's `quantile(type = 7)`
 * and NumPy's default `np.quantile(method="linear")`. Non-finite values are an error
 * for the caller to filter out first.
 */
export function quantile(values: ArrayLike<number>, p: number): number {
  if (values.length === 0 || !(p >= 0 && p <= 1)) return Number.NaN;
  const sorted = Float64Array.from(values).sort();
  return quantileSorted(sorted, p);
}

/** `quantile` on values already sorted ascending (no copy). */
export function quantileSorted(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0 || !(p >= 0 && p <= 1)) return Number.NaN;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export function median(values: ArrayLike<number>): number {
  return quantile(values, 0.5);
}

export function linspace(start: number, stop: number, count: number): number[] {
  if (count < 2) return [start];
  const step = (stop - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

export interface Bin {
  x0: number;
  x1: number;
  count: number;
  /** count / (n * width): comparable with a probability density */
  density: number;
}

/** Equal-width histogram over [lo, hi]; the right edge is inclusive like NumPy. */
export function histogram(values: ArrayLike<number>, lo: number, hi: number, bins: number): Bin[] {
  const width = (hi - lo) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < lo || v > hi) continue;
    const k = v === hi ? bins - 1 : Math.floor((v - lo) / width);
    counts[k]++;
  }
  const n = values.length || 1;
  return counts.map((count, k) => ({
    x0: lo + k * width,
    x1: lo + (k + 1) * width,
    count,
    density: count / (n * width),
  }));
}
