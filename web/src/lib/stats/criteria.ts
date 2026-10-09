/**
 * Information criteria for comparing fitted models by maximised log-likelihood
 * `ll`, number of free parameters `k` and sample size `n`. Lower is better.
 */

/** Akaike: 2k - 2 ll. */
export function aic(ll: number, k: number): number {
  return 2 * k - 2 * ll;
}

/** Bayesian (Schwarz): k ln(n) - 2 ll. */
export function bic(ll: number, k: number, n: number): number {
  return k * Math.log(n) - 2 * ll;
}

/** Free parameters of a K-component univariate Gaussian mixture: K means, K SDs, K - 1 weights. */
export function mixtureParameterCount(K: number): number {
  return 3 * K - 1;
}
