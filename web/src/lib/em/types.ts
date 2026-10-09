/**
 * Parameters of the notebook's two-component, one-dimensional Gaussian mixture.
 * Keys mirror the `params` dict in `EMAnalyzer` (original/em_algorithm_demo.ipynb)
 * so traces exported from Python can be compared field by field.
 */
export interface MixtureParams {
  pi1: number;
  pi2: number;
  mu1: number;
  mu2: number;
  sigma1: number;
  sigma2: number;
}

export const PARAM_KEYS = ["pi1", "pi2", "mu1", "mu2", "sigma1", "sigma2"] as const;

export interface EStepResult {
  /** pi_1 * f(x_i | mu_1, sigma_1), the notebook's `numerator1` */
  weighted1: Float64Array;
  /** pi_2 * f(x_i | mu_2, sigma_2), the notebook's `numerator2` */
  weighted2: Float64Array;
  /** responsibilities gamma_i1 = P(component 1 | x_i) */
  gamma1: Float64Array;
  /** responsibilities gamma_i2 = P(component 2 | x_i) */
  gamma2: Float64Array;
}

export interface IterationRecord {
  /** 1-based, like the notebook's "--- ITERATION k ---" */
  iteration: number;
  /** mean responsibility printed by the E-step ("Average P(group 1)") */
  gammaMean1: number;
  gammaMean2: number;
  /** parameters after this iteration's M-step */
  params: MixtureParams;
  /** log-likelihood of the updated parameters (computed after the M-step) */
  logLikelihood: number;
  /** logLikelihood minus the previous one; null on the first iteration */
  improvement: number | null;
}

export interface FitOptions {
  maxIterations: number;
  tolerance: number;
  /**
   * Lower bound on each standard deviation after the M-step. NOT in the notebook:
   * the default 0 reproduces it exactly. Used by the variance-collapse demo.
   */
  varianceFloor?: number;
}

export type StopReason = "converged" | "max-iterations" | "degenerate";

export interface FitResult {
  init: MixtureParams;
  iterations: IterationRecord[];
  stopReason: StopReason;
  /** responsibilities from the last E-step (what the notebook's `em.gamma1` holds) */
  finalGamma1: number[];
}
