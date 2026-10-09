/** Small descriptive-statistics helpers for charts. */

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

export function extent(values: ArrayLike<number>): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lo) lo = values[i];
    if (values[i] > hi) hi = values[i];
  }
  return [lo, hi];
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
