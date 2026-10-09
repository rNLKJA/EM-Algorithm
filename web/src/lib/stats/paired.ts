/**
 * Paired comparisons: two methods measured on the same units (data sets).
 * The effect is the mean of the per-unit differences, with a percentile
 * bootstrap interval from resampling whole units (so the pairing is kept).
 */
import { createRng } from "../em/rng";
import { mean } from "./descriptive";
import { percentileInterval, type Interval } from "./intervals";

export interface PairedDifference {
  /** mean of a[i] - b[i] */
  estimate: number;
  interval: Interval;
  n: number;
  B: number;
  seed: number;
  /** units where a < b, a = b, a > b */
  aLower: number;
  ties: number;
  aHigher: number;
}

export function pairedMeanDifference(
  a: readonly number[],
  b: readonly number[],
  { B = 2000, seed = 1, level = 0.95 }: { B?: number; seed?: number; level?: number } = {},
): PairedDifference {
  if (a.length !== b.length) throw new Error("paired samples must have the same length");
  const d = a.map((v, i) => v - b[i]);
  const n = d.length;
  const rng = createRng(seed);
  const reps = new Float64Array(B);
  for (let r = 0; r < B; r++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[rng.int(n)];
    reps[r] = s / n;
  }
  return {
    estimate: mean(d),
    interval: n > 0 ? percentileInterval(reps, level) : { lower: NaN, upper: NaN },
    n,
    B,
    seed,
    aLower: d.filter((v) => v < 0).length,
    ties: d.filter((v) => v === 0).length,
    aHigher: d.filter((v) => v > 0).length,
  };
}
