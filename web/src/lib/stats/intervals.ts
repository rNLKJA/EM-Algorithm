/**
 * Confidence intervals: Wilson score intervals for proportions, percentile
 * intervals for bootstrap replicates, and Wald intervals from a standard error.
 */
import { quantileSorted } from "./descriptive";
import { zCritical } from "./distributions";

export interface Interval {
  lower: number;
  upper: number;
}

export interface ProportionEstimate extends Interval {
  /** successes / n */
  estimate: number;
  successes: number;
  n: number;
  level: number;
}

/**
 * Wilson score interval for a binomial proportion (no continuity correction):
 * the same interval as R's `prop.test(x, n, correct = FALSE)` and statsmodels'
 * `proportion_confint(method = "wilson")`. Unlike the Wald interval it stays
 * inside [0, 1] and behaves well at 0 and n successes.
 */
export function wilsonInterval(successes: number, n: number, level = 0.95): ProportionEstimate {
  if (n <= 0) return { estimate: Number.NaN, lower: 0, upper: 1, successes, n, level };
  const z = zCritical(level);
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  // clamp the last-bit rounding at the edges (k = 0 or k = n gives exactly 0 or 1)
  return {
    estimate: p,
    lower: successes === 0 ? 0 : Math.max(0, centre - half),
    upper: successes === n ? 1 : Math.min(1, centre + half),
    successes,
    n,
    level,
  };
}

/**
 * Percentile interval from bootstrap replicates: the (1 - level) / 2 and
 * (1 + level) / 2 quantiles, interpolated like R's `quantile(type = 7)`.
 * Non-finite replicates are dropped (the caller reports how many).
 */
export function percentileInterval(replicates: ArrayLike<number>, level = 0.95): Interval {
  const finite: number[] = [];
  for (let i = 0; i < replicates.length; i++)
    if (Number.isFinite(replicates[i])) finite.push(replicates[i]);
  if (finite.length === 0) return { lower: Number.NaN, upper: Number.NaN };
  const sorted = Float64Array.from(finite).sort();
  const alpha = 1 - level;
  return {
    lower: quantileSorted(sorted, alpha / 2),
    upper: quantileSorted(sorted, 1 - alpha / 2),
  };
}

/** Normal-approximation (Wald) interval: estimate ± z × se. */
export function waldInterval(estimate: number, se: number, level = 0.95): Interval {
  const z = zCritical(level);
  return { lower: estimate - z * se, upper: estimate + z * se };
}

export function contains(interval: Interval, value: number): boolean {
  return interval.lower <= value && value <= interval.upper;
}
