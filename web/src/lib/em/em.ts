/**
 * TypeScript port of `EMAnalyzer` from original/em_algorithm_demo.ipynb.
 *
 * The maths, the order of operations and the stopping rule follow the notebook
 * line for line; the parity suite (em.parity.test.ts) replays the notebook's
 * exported trace and checks every iteration to 1e-6. Two additions are opt-in
 * and off by default: a variance floor (for the collapse demo) and an early stop
 * when the parameters stop being finite (the notebook would keep printing nan).
 */
import { normalPdf } from "./gaussian";
import type {
  EStepResult,
  FitOptions,
  FitResult,
  IterationRecord,
  MixtureParams,
  StopReason,
} from "./types";

export type Data = ArrayLike<number>;

/** The `+ 1e-10` the notebook adds inside the log "to avoid log(0)". */
export const LOG_EPSILON = 1e-10;

function sum(values: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i];
  return s;
}

function mean(values: ArrayLike<number>): number {
  return sum(values) / values.length;
}

/** E-step: posterior responsibilities via Bayes' theorem (`EMAnalyzer.e_step`). */
export function eStep(data: Data, params: MixtureParams): EStepResult {
  const n = data.length;
  const weighted1 = new Float64Array(n);
  const weighted2 = new Float64Array(n);
  const gamma1 = new Float64Array(n);
  const gamma2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const likelihood1 = normalPdf(data[i], params.mu1, params.sigma1);
    const likelihood2 = normalPdf(data[i], params.mu2, params.sigma2);
    const numerator1 = params.pi1 * likelihood1;
    const numerator2 = params.pi2 * likelihood2;
    const denominator = numerator1 + numerator2;
    weighted1[i] = numerator1;
    weighted2[i] = numerator2;
    gamma1[i] = numerator1 / denominator;
    gamma2[i] = numerator2 / denominator;
  }
  return { weighted1, weighted2, gamma1, gamma2 };
}

/** M-step: weighted updates of pi, mu, then sigma using the new mu (`EMAnalyzer.m_step`). */
export function mStep(
  data: Data,
  gamma1: ArrayLike<number>,
  gamma2: ArrayLike<number>,
  varianceFloor = 0,
): MixtureParams {
  const n = data.length;
  let g1 = 0;
  let g2 = 0;
  let g1x = 0;
  let g2x = 0;
  for (let i = 0; i < n; i++) {
    g1 += gamma1[i];
    g2 += gamma2[i];
    g1x += gamma1[i] * data[i];
    g2x += gamma2[i] * data[i];
  }
  const mu1 = g1x / g1;
  const mu2 = g2x / g2;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    s1 += gamma1[i] * (data[i] - mu1) ** 2;
    s2 += gamma2[i] * (data[i] - mu2) ** 2;
  }
  let sigma1 = Math.sqrt(s1 / g1);
  let sigma2 = Math.sqrt(s2 / g2);
  if (varianceFloor > 0) {
    // max() keeps NaN out: a component with no weight at all falls back to the floor.
    sigma1 = Number.isNaN(sigma1) ? varianceFloor : Math.max(sigma1, varianceFloor);
    sigma2 = Number.isNaN(sigma2) ? varianceFloor : Math.max(sigma2, varianceFloor);
  }
  return { pi1: mean(gamma1), pi2: mean(gamma2), mu1, mu2, sigma1, sigma2 };
}

/** Mixture log-likelihood with the notebook's `+ 1e-10` (`compute_log_likelihood`). */
export function logLikelihood(data: Data, params: MixtureParams): number {
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    const marginal =
      params.pi1 * normalPdf(data[i], params.mu1, params.sigma1) +
      params.pi2 * normalPdf(data[i], params.mu2, params.sigma2);
    total += Math.log(marginal + LOG_EPSILON);
  }
  return total;
}

/** Exact log-likelihood without the epsilon (for the maths pages and tests). */
export function exactLogLikelihood(data: Data, params: MixtureParams): number {
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    total += Math.log(
      params.pi1 * normalPdf(data[i], params.mu1, params.sigma1) +
        params.pi2 * normalPdf(data[i], params.mu2, params.sigma2),
    );
  }
  return total;
}

export function isFiniteParams(p: MixtureParams): boolean {
  return (
    Number.isFinite(p.pi1) &&
    Number.isFinite(p.pi2) &&
    Number.isFinite(p.mu1) &&
    Number.isFinite(p.mu2) &&
    Number.isFinite(p.sigma1) &&
    Number.isFinite(p.sigma2) &&
    p.sigma1 > 0 &&
    p.sigma2 > 0
  );
}

export interface StepOutcome {
  e: EStepResult;
  params: MixtureParams;
  logLikelihood: number;
}

/** One full EM iteration: E-step with `params`, M-step, then the new log-likelihood. */
export function emIteration(data: Data, params: MixtureParams, varianceFloor = 0): StepOutcome {
  const e = eStep(data, params);
  const next = mStep(data, e.gamma1, e.gamma2, varianceFloor);
  return { e, params: next, logLikelihood: logLikelihood(data, next) };
}

/**
 * Run EM from `init` exactly like `EMAnalyzer.fit(max_iterations, tolerance)`:
 * for each iteration, E-step, M-step, log-likelihood; from the second iteration
 * on, stop when |improvement| < tolerance.
 */
export function fit(data: Data, init: MixtureParams, options: FitOptions): FitResult {
  const { maxIterations, tolerance, varianceFloor = 0 } = options;
  let params = { ...init };
  const iterations: IterationRecord[] = [];
  let stopReason: StopReason = "max-iterations";
  let lastGamma1: Float64Array = new Float64Array(0);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const { e, params: next, logLikelihood: ll } = emIteration(data, params, varianceFloor);
    lastGamma1 = e.gamma1;
    const previous = iterations.length > 0 ? iterations[iterations.length - 1] : null;
    const improvement = previous ? ll - previous.logLikelihood : null;
    iterations.push({
      iteration: iteration + 1,
      gammaMean1: mean(e.gamma1),
      gammaMean2: mean(e.gamma2),
      params: next,
      logLikelihood: ll,
      improvement,
    });
    params = next;

    if (!isFiniteParams(next) || !Number.isFinite(ll)) {
      stopReason = "degenerate";
      break;
    }
    if (iteration > 0 && improvement !== null && Math.abs(improvement) < tolerance) {
      stopReason = "converged";
      break;
    }
  }

  return { init: { ...init }, iterations, stopReason, finalGamma1: Array.from(lastGamma1) };
}

/** Parameters at stage `t` of a fit: 0 is the initial guess, t >= 1 is after iteration t. */
export function paramsAt(result: FitResult, stage: number): MixtureParams {
  if (stage <= 0 || result.iterations.length === 0) return result.init;
  const idx = Math.min(stage, result.iterations.length) - 1;
  return result.iterations[idx].params;
}

/**
 * True when the log-likelihood never decreases (EM's ascent property). A tiny
 * relative slack absorbs floating-point noise once the run has converged.
 */
export function isNonDecreasing(values: readonly number[], relTol = 1e-9): boolean {
  for (let i = 1; i < values.length; i++) {
    const slack = relTol * Math.max(1, Math.abs(values[i - 1]));
    if (values[i] < values[i - 1] - slack) return false;
  }
  return true;
}

/** Posterior P(component k | x) for a single new observation (notebook cell 14). */
export function posterior(x: number, params: MixtureParams): { p1: number; p2: number } {
  const numerator1 = params.pi1 * normalPdf(x, params.mu1, params.sigma1);
  const numerator2 = params.pi2 * normalPdf(x, params.mu2, params.sigma2);
  const denominator = numerator1 + numerator2;
  return { p1: numerator1 / denominator, p2: numerator2 / denominator };
}

/** pi1 f1(x) + pi2 f2(x), the mixture density drawn on the charts. */
export function mixtureDensity(x: number, params: MixtureParams): number {
  return (
    params.pi1 * normalPdf(x, params.mu1, params.sigma1) +
    params.pi2 * normalPdf(x, params.mu2, params.sigma2)
  );
}
