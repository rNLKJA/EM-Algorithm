/**
 * How many components? K = 1 to 4 compared by AIC and BIC, and a parametric
 * bootstrap likelihood-ratio test of K = 1 against K = 2.
 *
 * Why not the textbook χ² reference for the LRT? Under H0 (one normal) the
 * two-component model can reproduce it on a whole curve of parameter values
 * (π₂ = 0 with μ₂ anything, or μ₁ = μ₂ and σ₁ = σ₂ with π anything). The
 * null sits on the boundary of the parameter space and some parameters are
 * not identified there, so the regularity conditions behind Wilks' theorem
 * fail and 2Δℓ does not follow χ² with 3 degrees of freedom. The bootstrap
 * simulates the null distribution directly instead.
 */
import { createRng, generateRatings } from "../em/rng";
import type { MixtureParams } from "../em/types";
import { restartSeed } from "../em/restarts";
import { aic, bic, mixtureParameterCount } from "../stats/criteria";
import { quantile } from "../stats/descriptive";
import { wilsonInterval, type ProportionEstimate } from "../stats/intervals";
import { chiSquareQuantile, chiSquareSf } from "../stats/distributions";
import { fitGmmBest, fitSingleNormal, type BestFitOptions, type Gmm } from "./gmm";

export interface ModelChoiceOptions {
  Ks: number[];
  restarts: number;
  seed: number;
  maxIterations: number;
  tolerance: number;
  varianceFloor: number;
}

export const MODEL_CHOICE_DEFAULTS: ModelChoiceOptions = {
  Ks: [1, 2, 3, 4],
  restarts: 60,
  seed: 4,
  maxIterations: 3000,
  tolerance: 1e-8,
  varianceFloor: 0.1,
};

export interface KRow {
  K: number;
  /** free parameters, 3K - 1 */
  p: number;
  ll: number;
  aic: number;
  bic: number;
  /** AIC / BIC minus the smallest in the table */
  deltaAic: number;
  deltaBic: number;
  params: Gmm | null;
  restarts: number;
  degenerate: number;
  reachedBest: number;
  floorBinding: boolean;
}

export interface ModelChoice {
  n: number;
  options: ModelChoiceOptions;
  rows: KRow[];
  bestByAic: number;
  bestByBic: number;
}

export function compareComponentCounts(
  data: ArrayLike<number>,
  options: ModelChoiceOptions = MODEL_CHOICE_DEFAULTS,
): ModelChoice {
  const n = data.length;
  const raw = options.Ks.map((K) => {
    const r = fitGmmBest(data, K, options);
    const p = mixtureParameterCount(K);
    const ll = r.best?.logLikelihood ?? Number.NaN;
    return {
      K,
      p,
      ll,
      aic: aic(ll, p),
      bic: bic(ll, p, n),
      params: r.best?.params ?? null,
      restarts: K === 1 ? 1 : options.restarts,
      degenerate: r.degenerate,
      reachedBest: r.reachedBest,
      floorBinding: r.best?.floorBinding ?? false,
    };
  });
  const finite = raw.filter((r) => Number.isFinite(r.ll));
  const minAic = Math.min(...finite.map((r) => r.aic));
  const minBic = Math.min(...finite.map((r) => r.bic));
  const rows: KRow[] = raw.map((r) => ({
    ...r,
    deltaAic: r.aic - minAic,
    deltaBic: r.bic - minBic,
  }));
  return {
    n,
    options,
    rows,
    bestByAic: finite.find((r) => r.aic === minAic)?.K ?? Number.NaN,
    bestByBic: finite.find((r) => r.bic === minBic)?.K ?? Number.NaN,
  };
}

/* ---------------------------------------------------------------------------
 * Parametric bootstrap LRT, K = 1 vs K = 2
 * ------------------------------------------------------------------------- */

export interface LrtOptions {
  /** bootstrap data sets simulated under H0 */
  B: number;
  seed: number;
  /** EM starts for each K = 2 fit (observed and every replicate) */
  restarts: number;
  maxIterations: number;
  tolerance: number;
  varianceFloor: number;
}

export const LRT_DEFAULTS: LrtOptions = {
  B: 500,
  seed: 12,
  restarts: 9,
  maxIterations: 2000,
  tolerance: 1e-7,
  varianceFloor: 0.1,
};

export interface LrtResult {
  n: number;
  options: LrtOptions;
  ll1: number;
  ll2: number;
  /** 2 (ℓ₂ − ℓ₁) on the observed data */
  statistic: number;
  /** the same statistic on each data set simulated from the fitted single normal */
  nullStatistics: number[];
  /** replicates at least as large as the observed statistic */
  exceed: number;
  /** (1 + exceed) / (B + 1): never 0, so "p < 1/(B+1)" is the honest floor */
  pValue: number;
  /** the naive reference: P(χ²₃ ≥ statistic) */
  chiSquarePValue: number;
  df: number;
  null95: number;
  chiSquare95: number;
  /** bootstrap statistics above the χ²₃ 95% point: how often the naive test would reject a true H0 */
  naiveRejections: number;
  /** replicates where the K = 2 refit hit the variance floor */
  floorBinding: number;
  /** the null 95% point using only replicates where the floor was not binding (sensitivity) */
  null95Unfloored: number;
}

export function bootstrapLrt(
  data: ArrayLike<number>,
  options: LrtOptions = LRT_DEFAULTS,
): LrtResult {
  const n = data.length;
  const fitOptions: BestFitOptions = {
    restarts: options.restarts,
    seed: options.seed,
    maxIterations: options.maxIterations,
    tolerance: options.tolerance,
    varianceFloor: options.varianceFloor,
  };
  const h0 = fitSingleNormal(data, options.varianceFloor);
  const h1 = fitGmmBest(data, 2, fitOptions);
  const ll1 = h0.logLikelihood;
  const ll2 = h1.best?.logLikelihood ?? Number.NaN;
  const statistic = Math.max(0, 2 * (ll2 - ll1));
  const mu = h0.params.means[0];
  const sd = h0.params.sds[0];

  const nullStatistics: number[] = [];
  const unfloored: number[] = [];
  let floorBinding = 0;
  for (let b = 0; b < options.B; b++) {
    const rng = createRng(restartSeed(options.seed + 31337, b));
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = rng.normal(mu, sd);
    const f1 = fitSingleNormal(x, options.varianceFloor);
    const f2 = fitGmmBest(x, 2, { ...fitOptions, seed: restartSeed(options.seed + 271, b) });
    if (f2.best?.floorBinding) floorBinding++;
    // K = 2 nests K = 1, so a fit below ℓ₁ is an EM local optimum: the LRT is then 0
    const ll2b = f2.best?.logLikelihood ?? f1.logLikelihood;
    const t = Math.max(0, 2 * (ll2b - f1.logLikelihood));
    nullStatistics.push(t);
    if (!f2.best?.floorBinding) unfloored.push(t);
  }
  const df = mixtureParameterCount(2) - mixtureParameterCount(1);
  const exceed = nullStatistics.filter((t) => t >= statistic).length;
  const chiSquare95 = chiSquareQuantile(0.95, df);
  return {
    n,
    options,
    ll1,
    ll2,
    statistic,
    nullStatistics,
    exceed,
    pValue: (1 + exceed) / (options.B + 1),
    chiSquarePValue: chiSquareSf(statistic, df),
    df,
    null95: quantile(nullStatistics, 0.95),
    chiSquare95,
    naiveRejections: nullStatistics.filter((t) => t > chiSquare95).length,
    floorBinding,
    null95Unfloored: quantile(unfloored, 0.95),
  };
}

/* ---------------------------------------------------------------------------
 * How often does each criterion pick each K on data from a known recipe?
 * ------------------------------------------------------------------------- */

export interface SelectionOptions {
  truth: MixtureParams;
  n: number;
  S: number;
  seed: number;
  clip: [number, number] | null;
  Ks: number[];
  restarts: number;
  maxIterations: number;
  tolerance: number;
  varianceFloor: number;
}

export interface SelectionFrequency {
  options: SelectionOptions;
  /** chosen[K] = data sets on which the criterion picked K, with a Wilson interval */
  bic: { K: number; picked: ProportionEstimate }[];
  aic: { K: number; picked: ProportionEstimate }[];
}

/** Simulate S data sets from a two-component truth and record the K each criterion picks. */
export function selectionFrequency(options: SelectionOptions): SelectionFrequency {
  const bicCounts = new Map(options.Ks.map((K) => [K, 0]));
  const aicCounts = new Map(options.Ks.map((K) => [K, 0]));
  for (let s = 0; s < options.S; s++) {
    const { ratings } = generateRatings({
      ...options.truth,
      n: options.n,
      seed: restartSeed(options.seed, s),
      clip: options.clip,
    });
    const choice = compareComponentCounts(ratings, {
      Ks: options.Ks,
      restarts: options.restarts,
      seed: restartSeed(options.seed + 17, s),
      maxIterations: options.maxIterations,
      tolerance: options.tolerance,
      varianceFloor: options.varianceFloor,
    });
    bicCounts.set(choice.bestByBic, (bicCounts.get(choice.bestByBic) ?? 0) + 1);
    aicCounts.set(choice.bestByAic, (aicCounts.get(choice.bestByAic) ?? 0) + 1);
  }
  const table = (m: Map<number, number>) =>
    options.Ks.map((K) => ({ K, picked: wilsonInterval(m.get(K) ?? 0, options.S) }));
  return { options, bic: table(bicCounts), aic: table(aicCounts) };
}
