/**
 * Convergence diagnostics for EM on a fixed data set:
 *
 * - the ascent property: does the log-likelihood ever decrease along a run?
 * - iterations to reach a tolerance, across many random starts;
 * - which maxima the starts reach, and how likely the best of R starts is to
 *   reach the best maximum found;
 * - a paired comparison of the notebook's random start with k-means++ on the
 *   same simulated data sets.
 */
import { fit, logLikelihood } from "../em/em";
import { kmeansPlusPlusInit, notebookRandomInit } from "../em/init";
import { restartSeed, runRestarts, type Optimum } from "../em/restarts";
import { createRng, generateRatings } from "../em/rng";
import type { MixtureParams } from "../em/types";
import { quantile } from "../stats/descriptive";
import { wilsonInterval, type ProportionEstimate } from "../stats/intervals";
import { pairedMeanDifference, type PairedDifference } from "../stats/paired";

/** First iteration k >= 2 with |ℓ(k) - ℓ(k-1)| < tolerance: when `fit` would have stopped. */
export function iterationsToTolerance(trace: readonly number[], tolerance: number): number | null {
  for (let k = 1; k < trace.length; k++)
    if (Math.abs(trace[k] - trace[k - 1]) < tolerance) return k + 1;
  return null;
}

/** Largest decrease between consecutive log-likelihoods (0 if it never went down). */
export function largestDecrease(trace: readonly number[]): number {
  let worst = 0;
  for (let k = 1; k < trace.length; k++) worst = Math.max(worst, trace[k - 1] - trace[k]);
  return worst;
}

export interface Spread {
  n: number;
  /** runs that never met the tolerance within the cap */
  notReached: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

function spread(values: number[], notReached: number): Spread {
  return {
    n: values.length,
    notReached,
    min: values.length ? Math.min(...values) : NaN,
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    max: values.length ? Math.max(...values) : NaN,
  };
}

export interface ConvergenceOptions {
  starts: number;
  seed: number;
  maxIterations: number;
  tolerances: number[];
}

export const CONVERGENCE_DEFAULTS: ConvergenceOptions = {
  starts: 200,
  seed: 2025,
  maxIterations: 3000,
  tolerances: [1e-4, 1e-6, 1e-8],
};

export interface ConvergenceRun {
  index: number;
  seed: number;
  init: MixtureParams;
  final: MixtureParams;
  logLikelihood: number;
  /** iterations to each tolerance, in the order of options.tolerances */
  iterationsTo: (number | null)[];
  monotone: boolean;
  largestDecrease: number;
  optimum: number;
  degenerate: boolean;
}

export interface BestOfR {
  R: number;
  /** 1 - (1 - p)^R with p the single-start success rate */
  probability: number;
  lower: number;
  upper: number;
}

export interface ConvergenceStudy {
  options: ConvergenceOptions;
  n: number;
  runs: ConvergenceRun[];
  optima: Optimum[];
  monotoneRuns: number;
  /** the largest decrease seen in any run (floating-point noise when ~1e-13) */
  worstDecrease: number;
  iterations: Spread[];
  /** single start reaches the best optimum found */
  reachBest: ProportionEstimate;
  bestOfR: BestOfR[];
}

/**
 * Run EM from `starts` notebook-style random starts (μ ~ U(3, 8), σ ~ U(0.5, 2),
 * π = 0.5) and record the whole log-likelihood trace of each, until |Δℓ| < 1e-12.
 */
export function convergenceStudy(
  data: number[],
  options: ConvergenceOptions = CONVERGENCE_DEFAULTS,
): ConvergenceStudy {
  const summary = runRestarts({
    data,
    count: options.starts,
    seed: options.seed,
    maxIterations: options.maxIterations,
    tolerance: 1e-12,
    init: "notebook",
  });
  const runs: ConvergenceRun[] = summary.runs.map((r) => {
    const trace = [logLikelihood(data, r.init), ...r.llTrace];
    const degenerate = r.stopReason === "degenerate";
    const finite = trace.filter(Number.isFinite);
    return {
      index: r.index,
      seed: r.seed,
      init: r.init,
      final: r.final,
      logLikelihood: r.logLikelihood,
      iterationsTo: options.tolerances.map((t) =>
        degenerate ? null : iterationsToTolerance(r.llTrace, t),
      ),
      monotone: largestDecrease(finite) <= 1e-9 * Math.max(1, Math.abs(finite[0] ?? 1)),
      largestDecrease: largestDecrease(finite),
      optimum: r.optimum,
      degenerate,
    };
  });
  const best = summary.optima.find((o) => !o.degenerate);
  const hits = best ? runs.filter((r) => r.optimum === best.id).length : 0;
  const reachBest = wilsonInterval(hits, runs.length);
  const bestOfR = [1, 2, 5, 10, 20, 50].map((R) => ({
    R,
    probability: 1 - (1 - reachBest.estimate) ** R,
    lower: 1 - (1 - reachBest.lower) ** R,
    upper: 1 - (1 - reachBest.upper) ** R,
  }));
  return {
    options,
    n: data.length,
    runs,
    optima: summary.optima,
    monotoneRuns: runs.filter((r) => r.monotone).length,
    worstDecrease: Math.max(0, ...runs.map((r) => r.largestDecrease)),
    iterations: options.tolerances.map((_, j) => {
      const vals = runs.map((r) => r.iterationsTo[j]).filter((v): v is number => v !== null);
      return spread(vals, runs.length - vals.length);
    }),
    reachBest,
    bestOfR,
  };
}

/* ---------------------------------------------------------------------------
 * Paired comparison of starting strategies
 * ------------------------------------------------------------------------- */

export interface InitComparisonOptions {
  truth: MixtureParams;
  n: number;
  /** simulated data sets (the pairing unit) */
  S: number;
  seed: number;
  clip: [number, number] | null;
  tolerance: number;
  maxIterations: number;
  /** extra k-means++ starts used only to find the best-known maximum per data set */
  referenceStarts: number;
}

export const INIT_COMPARISON_DEFAULTS: InitComparisonOptions = {
  truth: { pi1: 0.6, pi2: 0.4, mu1: 7.5, mu2: 4, sigma1: 1.2, sigma2: 1.5 },
  n: 200,
  S: 200,
  seed: 31,
  clip: [1, 10],
  tolerance: 1e-6,
  maxIterations: 3000,
  referenceStarts: 4,
};

export interface InitComparison {
  options: InitComparisonOptions;
  /** per data set: iterations and whether each start reached the best-known maximum */
  units: {
    randomIterations: number;
    kmeansIterations: number;
    randomReachedBest: boolean;
    kmeansReachedBest: boolean;
  }[];
  iterations: { random: Spread; kmeans: Spread; difference: PairedDifference };
  reachedBest: {
    random: ProportionEstimate;
    kmeans: ProportionEstimate;
    /** random minus k-means++, in proportion units */
    difference: PairedDifference;
  };
}

export function compareInitialisations(
  options: InitComparisonOptions = INIT_COMPARISON_DEFAULTS,
): InitComparison {
  const fitOpts = { maxIterations: options.maxIterations, tolerance: options.tolerance };
  const units: InitComparison["units"] = [];
  for (let s = 0; s < options.S; s++) {
    const { ratings } = generateRatings({
      ...options.truth,
      n: options.n,
      seed: restartSeed(options.seed, s),
      clip: options.clip,
    });
    const rng = createRng(restartSeed(options.seed + 1, s));
    const random = fit(ratings, notebookRandomInit(rng), fitOpts);
    const kmeans = fit(ratings, kmeansPlusPlusInit(ratings, rng).params, fitOpts);
    const finalLl = (r: typeof random) =>
      r.stopReason === "degenerate" ? -Infinity : (r.iterations.at(-1)?.logLikelihood ?? -Infinity);
    let bestKnown = Math.max(finalLl(random), finalLl(kmeans));
    for (let k = 0; k < options.referenceStarts; k++) {
      const extra = fit(ratings, kmeansPlusPlusInit(ratings, rng).params, fitOpts);
      bestKnown = Math.max(bestKnown, finalLl(extra));
    }
    units.push({
      randomIterations: random.iterations.length,
      kmeansIterations: kmeans.iterations.length,
      randomReachedBest: finalLl(random) >= bestKnown - 0.01,
      kmeansReachedBest: finalLl(kmeans) >= bestKnown - 0.01,
    });
  }
  const r = units.map((u) => u.randomIterations);
  const k = units.map((u) => u.kmeansIterations);
  const rb: number[] = units.map((u) => (u.randomReachedBest ? 1 : 0));
  const kb: number[] = units.map((u) => (u.kmeansReachedBest ? 1 : 0));
  return {
    options,
    units,
    iterations: {
      random: spread(r, 0),
      kmeans: spread(k, 0),
      difference: pairedMeanDifference(r, k, { seed: options.seed }),
    },
    reachedBest: {
      random: wilsonInterval(
        rb.reduce((a, b) => a + b, 0),
        units.length,
      ),
      kmeans: wilsonInterval(
        kb.reduce((a, b) => a + b, 0),
        units.length,
      ),
      difference: pairedMeanDifference(rb, kb, { seed: options.seed + 1 }),
    },
  };
}
