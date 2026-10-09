/**
 * How sure can we be about the fitted π, μ and σ?
 *
 * - Standard errors from the observed information: minus the Hessian of the
 *   observed-data log-likelihood at the MLE, by central differences, inverted.
 * - Parametric-bootstrap percentile intervals: simulate new data sets of the
 *   same size from the fitted mixture, refit each, take the 2.5% and 97.5%
 *   quantiles of each parameter.
 * - A coverage study: does a "95%" interval actually contain the true value
 *   95% of the time? Simulate many data sets from known parameters and count.
 *
 * Parameters are always reported with components ordered by mean (component 1
 * = the low-mean group), the labelling rule of DR-002, and the free parameter
 * vector is θ = (π₁, μ₁, μ₂, σ₁, σ₂) with π₂ = 1 − π₁.
 */
import { exactLogLikelihood, fit } from "../em/em";
import { kmeansPlusPlusInit } from "../em/init";
import { restartSeed, sortByMean } from "../em/restarts";
import { createRng, generateRatings } from "../em/rng";
import type { FitOptions, MixtureParams } from "../em/types";
import { quantile, sampleSd } from "../stats/descriptive";
import {
  contains,
  percentileInterval,
  waldInterval,
  wilsonInterval,
  type Interval,
  type ProportionEstimate,
} from "../stats/intervals";
import {
  invertMatrix,
  isPositiveDefinite,
  negate,
  numericalHessian,
  type Matrix,
} from "../stats/numerical";

export const THETA_KEYS = ["pi1", "mu1", "mu2", "sigma1", "sigma2"] as const;
export type ThetaKey = (typeof THETA_KEYS)[number];

export const THETA_LABELS: Record<ThetaKey, string> = {
  pi1: "π₁ (π₂ = 1 − π₁)",
  mu1: "μ₁",
  mu2: "μ₂",
  sigma1: "σ₁",
  sigma2: "σ₂",
};

/**
 * Settings for the fit whose uncertainty is reported: run well past the notebook's
 * 1e-4 so the gradient is ~0 where the Hessian is taken. The floor is DR-003's.
 */
export const INFERENCE_FIT: FitOptions = {
  maxIterations: 5000,
  tolerance: 1e-10,
  varianceFloor: 0.1,
};

/** Settings for the many refits inside the bootstrap and the coverage study. */
export const REFIT: FitOptions = {
  maxIterations: 3000,
  tolerance: 1e-8,
  varianceFloor: 0.1,
};

export function toTheta(p: MixtureParams): number[] {
  const s = sortByMean(p);
  return [s.pi1, s.mu1, s.mu2, s.sigma1, s.sigma2];
}

export function fromTheta(t: readonly number[]): MixtureParams {
  return { pi1: t[0], pi2: 1 - t[0], mu1: t[1], mu2: t[2], sigma1: t[3], sigma2: t[4] };
}

export interface ObservedInformation {
  theta: number[];
  hessian: Matrix;
  /** −H: the observed information matrix */
  information: Matrix;
  positiveDefinite: boolean;
  /** inverse of the observed information; null if it is not positive definite */
  covariance: Matrix | null;
  se: number[] | null;
}

/**
 * Observed information at `params` (which should be a converged MLE: away from a
 * maximum the matrix need not be positive definite and the SEs mean nothing).
 */
export function observedInformation(
  data: ArrayLike<number>,
  params: MixtureParams,
): ObservedInformation {
  const theta = toTheta(params);
  const hessian = numericalHessian((t) => exactLogLikelihood(data, fromTheta(t)), theta);
  const information = negate(hessian);
  const positiveDefinite = isPositiveDefinite(information);
  const covariance = positiveDefinite ? invertMatrix(information) : null;
  const se = covariance ? covariance.map((row, i) => Math.sqrt(row[i])) : null;
  return { theta, hessian, information, positiveDefinite, covariance, se };
}

export function waldIntervals(info: ObservedInformation, level = 0.95): Interval[] | null {
  if (!info.se) return null;
  return info.theta.map((v, i) => waldInterval(v, info.se![i], level));
}

/** Fit EM to convergence from `init` with the inference settings. */
export function fitToConvergence(
  data: ArrayLike<number>,
  init: MixtureParams,
  options: FitOptions = INFERENCE_FIT,
) {
  const result = fit(data, init, options);
  const last = result.iterations.at(-1);
  return {
    params: last ? last.params : init,
    logLikelihood: last ? exactLogLikelihood(data, last.params) : Number.NaN,
    iterations: result.iterations.length,
    stopReason: result.stopReason,
    floorBinding:
      !!last &&
      (options.varianceFloor ?? 0) > 0 &&
      (last.params.sigma1 <= (options.varianceFloor ?? 0) ||
        last.params.sigma2 <= (options.varianceFloor ?? 0)),
  };
}

/* ---------------------------------------------------------------------------
 * Parametric bootstrap
 * ------------------------------------------------------------------------- */

export interface BootstrapOptions {
  B: number;
  seed: number;
  /** size of each simulated data set (the observed n) */
  n: number;
  level?: number;
  fitOptions?: FitOptions;
}

export interface BootstrapResult {
  B: number;
  seed: number;
  n: number;
  level: number;
  /** θ for each successful replicate, components ordered by mean */
  replicates: number[][];
  /** replicates whose refit degenerated (excluded) */
  failed: number;
  /** replicates where the variance floor was binding at the end */
  floorBinding: number;
  /**
   * replicates where ordering by mean and keeping the warm start's labels
   * disagree (the means crossed during the refit); see DR-002
   */
  labelDisagreements: number;
  intervals: Interval[];
  /** bootstrap standard error: SD of the replicates */
  se: number[];
}

/**
 * Parametric bootstrap from a fitted two-component mixture. Each replicate draws
 * n ratings from `fitted` (unclipped: the fitted model, not the notebook's clipped
 * recipe), refits EM from `fitted` itself (a warm start, so the refit tracks the
 * same maximum rather than hunting for others), and orders components by mean.
 */
export function parametricBootstrap(fitted: MixtureParams, options: BootstrapOptions) {
  const level = options.level ?? 0.95;
  const fitOptions = options.fitOptions ?? REFIT;
  const start = sortByMean(fitted);
  const replicates: number[][] = [];
  let failed = 0;
  let floorBinding = 0;
  let labelDisagreements = 0;
  for (let b = 0; b < options.B; b++) {
    const { ratings } = generateRatings({
      n: options.n,
      pi1: start.pi1,
      mu1: start.mu1,
      mu2: start.mu2,
      sigma1: start.sigma1,
      sigma2: start.sigma2,
      seed: restartSeed(options.seed, b),
      clip: null,
    });
    const refit = fitToConvergence(ratings, start, fitOptions);
    if (refit.stopReason === "degenerate") {
      failed++;
      continue;
    }
    if (refit.floorBinding) floorBinding++;
    if (refit.params.mu1 > refit.params.mu2) labelDisagreements++;
    replicates.push(toTheta(refit.params));
  }
  const column = (j: number) => replicates.map((t) => t[j]);
  const result: BootstrapResult = {
    B: options.B,
    seed: options.seed,
    n: options.n,
    level,
    replicates,
    failed,
    floorBinding,
    labelDisagreements,
    intervals: THETA_KEYS.map((_, j) => percentileInterval(column(j), level)),
    se: THETA_KEYS.map((_, j) => sampleSd(column(j))),
  };
  return result;
}

/* ---------------------------------------------------------------------------
 * Coverage study
 * ------------------------------------------------------------------------- */

export interface CoverageOptions {
  truth: MixtureParams;
  n: number;
  /** number of simulated data sets */
  S: number;
  seed: number;
  /** clip simulated ratings like the notebook (np.clip(x, 1, 10)); null = the model exactly */
  clip: [number, number] | null;
  /** bootstrap replicates per data set for percentile intervals; 0 = Wald only */
  bootstrapB: number;
  level?: number;
  fitOptions?: FitOptions;
}

export interface MethodCoverage {
  hits: number;
  /** data sets that produced an interval */
  n: number;
  coverage: ProportionEstimate;
  /** median interval width (the mean is dragged up by a few near-singular fits) */
  medianWidth: number;
}

export interface PairedCoverage {
  /** both intervals covered / only Wald / only bootstrap / neither */
  both: number;
  waldOnly: number;
  bootOnly: number;
  neither: number;
}

export interface ParamCoverage {
  key: ThetaKey;
  truth: number;
  wald: MethodCoverage;
  bootstrap: MethodCoverage | null;
  paired: PairedCoverage | null;
}

export interface CoverageResult {
  S: number;
  n: number;
  seed: number;
  clip: [number, number] | null;
  bootstrapB: number;
  level: number;
  /** data sets whose fit degenerated (no intervals) */
  failed: number;
  /** fits whose observed information was not positive definite (no Wald interval) */
  notPositiveDefinite: number;
  /** fits that ended with the variance floor binding (DR-003) */
  floorBinding: number;
  params: ParamCoverage[];
}

function summarise(hits: number, widths: number[], level: number): MethodCoverage {
  const n = widths.length;
  return { hits, n, coverage: wilsonInterval(hits, n, level), medianWidth: quantile(widths, 0.5) };
}

/**
 * Simulate S data sets of size n from `truth` (optionally clipped), fit each by EM
 * from a k-means++ start, and count how often each nominal-95% interval contains
 * the true parameter. Coverage proportions come with Wilson intervals.
 */
export function coverageStudy(options: CoverageOptions): CoverageResult {
  const level = options.level ?? 0.95;
  const fitOptions = options.fitOptions ?? REFIT;
  const truth = toTheta(options.truth);
  const K = THETA_KEYS.length;
  const wald = { hits: new Array<number>(K).fill(0), w: THETA_KEYS.map((): number[] => []) };
  const boot = { hits: new Array<number>(K).fill(0), w: THETA_KEYS.map((): number[] => []) };
  const pairs = Array.from({ length: K }, () => ({
    both: 0,
    waldOnly: 0,
    bootOnly: 0,
    neither: 0,
  }));
  let failed = 0;
  let notPositiveDefinite = 0;
  let floorBinding = 0;

  for (let s = 0; s < options.S; s++) {
    const { ratings } = generateRatings({
      n: options.n,
      pi1: options.truth.pi1,
      mu1: options.truth.mu1,
      mu2: options.truth.mu2,
      sigma1: options.truth.sigma1,
      sigma2: options.truth.sigma2,
      seed: restartSeed(options.seed, s),
      clip: options.clip,
    });
    const init = kmeansPlusPlusInit(ratings, createRng(restartSeed(options.seed ^ 0x51ed, s)));
    const fitted = fitToConvergence(ratings, init.params, fitOptions);
    if (fitted.stopReason === "degenerate") {
      failed++;
      continue;
    }
    if (fitted.floorBinding) floorBinding++;
    // in one dimension, ordering both fitted and true components by mean is the same
    // as matching them by mean (DR-002), so θ and the true θ line up component by component
    const info = observedInformation(ratings, fitted.params);
    const waldCis = waldIntervals(info, level);
    if (!waldCis) notPositiveDefinite++;
    const bootCis =
      options.bootstrapB > 0
        ? parametricBootstrap(fitted.params, {
            B: options.bootstrapB,
            seed: restartSeed(options.seed + 104729, s),
            n: options.n,
            level,
            fitOptions,
          }).intervals
        : null;

    for (let j = 0; j < K; j++) {
      let w: boolean | null = null;
      let b: boolean | null = null;
      if (waldCis) {
        w = contains(waldCis[j], truth[j]);
        wald.w[j].push(waldCis[j].upper - waldCis[j].lower);
        if (w) wald.hits[j]++;
      }
      if (bootCis && Number.isFinite(bootCis[j].lower)) {
        b = contains(bootCis[j], truth[j]);
        boot.w[j].push(bootCis[j].upper - bootCis[j].lower);
        if (b) boot.hits[j]++;
      }
      if (w !== null && b !== null) {
        if (w && b) pairs[j].both++;
        else if (w) pairs[j].waldOnly++;
        else if (b) pairs[j].bootOnly++;
        else pairs[j].neither++;
      }
    }
  }

  return {
    S: options.S,
    n: options.n,
    seed: options.seed,
    clip: options.clip,
    bootstrapB: options.bootstrapB,
    level,
    failed,
    notPositiveDefinite,
    floorBinding,
    params: THETA_KEYS.map((key, j) => ({
      key,
      truth: truth[j],
      wald: summarise(wald.hits[j], wald.w[j], level),
      bootstrap: options.bootstrapB > 0 ? summarise(boot.hits[j], boot.w[j], level) : null,
      paired: options.bootstrapB > 0 ? pairs[j] : null,
    })),
  };
}
