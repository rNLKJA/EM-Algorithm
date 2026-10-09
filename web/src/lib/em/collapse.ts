/**
 * Variance collapse: put one component's mean on a single rating with a tiny
 * spread and EM shrinks it further every iteration, because a narrower spike
 * makes that one point ever more likely. The likelihood is unbounded (it heads
 * to +infinity as sigma -> 0), so the run ends in a division by zero. A variance
 * floor (not in the notebook) stops the blow-up; it does not rescue the fit.
 */
import { mean, std } from "../stats";
import type { MixtureParams } from "./types";

export const COLLAPSE_SIGMA0 = 0.05;

export function collapseInit(
  data: ArrayLike<number>,
  target: number,
  sigma0 = COLLAPSE_SIGMA0,
): MixtureParams {
  return { pi1: 0.5, pi2: 0.5, mu1: mean(data), mu2: target, sigma1: std(data), sigma2: sigma0 };
}
