/**
 * Label switching helpers.
 *
 * EM's component indices are arbitrary: nothing ties "component 1" to the group
 * the notebook calls "Sci-fi lovers". In the notebook's own run, component 1 ends
 * up as the LOW-mean group, so its "classify a new user" cell reports a rating of
 * 8.5 as a romance lover. The app keeps that as-run output visible, and for every
 * comparison against the true groups it first matches components to groups by mean.
 */
import type { MixtureParams } from "./types";

export interface GroupMeans {
  mu1: number;
  mu2: number;
}

export interface Matching {
  /** true when fitted component 1 corresponds to true group 2 (and vice versa) */
  swapped: boolean;
  /** total |mu_fit - mu_true| under the chosen matching */
  cost: number;
}

/**
 * Match fitted components to true groups by the order of their means: the lower
 * fitted mean goes with the lower true mean. In one dimension this order-preserving
 * matching always minimises the total |mu_fit - mu_true|, and unlike comparing the
 * two totals it stays decisive when both fitted means sit on the same side of both
 * true means (the totals then tie, e.g. fitted 3.37 and 3.51 against true 7.5 and 4.0).
 */
export function matchByMean(fitted: GroupMeans, truth: GroupMeans): Matching {
  const swapped = fitted.mu1 < fitted.mu2 !== truth.mu1 < truth.mu2;
  const cost = swapped
    ? Math.abs(fitted.mu1 - truth.mu2) + Math.abs(fitted.mu2 - truth.mu1)
    : Math.abs(fitted.mu1 - truth.mu1) + Math.abs(fitted.mu2 - truth.mu2);
  return { swapped, cost };
}

/** Re-index fitted parameters so component k lines up with true group k. */
export function alignParams(params: MixtureParams, matching: Matching): MixtureParams {
  if (!matching.swapped) return params;
  return {
    pi1: params.pi2,
    pi2: params.pi1,
    mu1: params.mu2,
    mu2: params.mu1,
    sigma1: params.sigma2,
    sigma2: params.sigma1,
  };
}

/**
 * Accuracy exactly as the notebook computes it:
 * `predicted_groups = (em.gamma1 > 0.5).astype(int); np.mean(predicted_groups == true_groups)`.
 * Note the encoding: gamma1 > 0.5 predicts label 1, and the notebook's true label 1 is
 * "Romance lover". It is only the right comparison when the labels have switched.
 */
export function accuracyAsWritten(
  gamma1: ArrayLike<number>,
  trueGroups: ArrayLike<number>,
): number {
  let hits = 0;
  for (let i = 0; i < gamma1.length; i++) {
    const predicted = gamma1[i] > 0.5 ? 1 : 0;
    if (predicted === trueGroups[i]) hits++;
  }
  return hits / gamma1.length;
}

/**
 * Accuracy after matching components to groups by mean. True groups are 0-based
 * like the notebook (0 = group with `mu1`, 1 = group with `mu2`).
 */
export function accuracyMatched(
  gamma1: ArrayLike<number>,
  trueGroups: ArrayLike<number>,
  matching: Matching,
): number {
  const correct = correctMatched(gamma1, trueGroups, matching);
  return correct.reduce((a, b) => a + b, 0) / gamma1.length;
}

/** Per user: 1 if classified into their true group after matching labels by mean, else 0. */
export function correctMatched(
  gamma1: ArrayLike<number>,
  trueGroups: ArrayLike<number>,
  matching: Matching,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < gamma1.length; i++) {
    const component = gamma1[i] > 0.5 ? 0 : 1; // 0 = fitted component 1
    const group = matching.swapped ? 1 - component : component;
    out.push(group === trueGroups[i] ? 1 : 0);
  }
  return out;
}
