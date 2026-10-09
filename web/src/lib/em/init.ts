/**
 * Initial guesses for EM.
 *
 * - `notebookRandomInit` is `EMAnalyzer.initialize_parameters`: pi = 0.5/0.5,
 *   mu ~ U(3, 8), sigma ~ U(0.5, 2), drawn in the dict's order (mu1, mu2,
 *   sigma1, sigma2). With the TS RNG it cannot reproduce NumPy's draws; the
 *   notebook's actual draws are in public/data/notebook-run.json.
 * - `kmeansPlusPlusInit` is the usual non-random-guess start: k-means++ seeding,
 *   Lloyd's k-means, then pi/mu/sigma from the hard clusters.
 * - `manualInit` is the "drag the means" option.
 */
import type { Rng } from "./rng";
import type { MixtureParams } from "./types";

export function notebookRandomInit(rng: Rng): MixtureParams {
  const mu1 = rng.uniform(3, 8);
  const mu2 = rng.uniform(3, 8);
  const sigma1 = rng.uniform(0.5, 2);
  const sigma2 = rng.uniform(0.5, 2);
  return { pi1: 0.5, pi2: 0.5, mu1, mu2, sigma1, sigma2 };
}

export const SKLEARN_REG_COVAR = 1e-6;

export interface KMeansPPResult {
  params: MixtureParams;
  /** the two k-means++ seeds, sorted */
  seeds: [number, number];
  /** Lloyd iterations until the hard assignment stopped changing */
  lloydIterations: number;
}

/**
 * k-means++ seeding, then Lloyd's k-means on the 1-D data, then one M-step on the
 * hard clusters. This mirrors scikit-learn's default GaussianMixture start
 * (init_params="kmeans", which seeds k-means with k-means++) including its
 * reg_covar of 1e-6 on each variance.
 */
export function kmeansPlusPlusInit(
  data: ArrayLike<number>,
  rng: Rng,
  maxLloyd = 100,
): KMeansPPResult {
  const n = data.length;
  if (n === 0) throw new Error("k-means++ needs at least one point");
  const first = data[rng.int(n)];
  // D(x)^2 to the first seed, then sample the second seed proportionally.
  let total = 0;
  for (let i = 0; i < n; i++) total += (data[i] - first) ** 2;
  let second = first;
  if (total > 0) {
    let target = rng.next() * total;
    for (let i = 0; i < n; i++) {
      target -= (data[i] - first) ** 2;
      if (target <= 0) {
        second = data[i];
        break;
      }
    }
  }
  const seeds: [number, number] = first <= second ? [first, second] : [second, first];

  let [c1, c2] = seeds;
  const assign = new Uint8Array(n);
  let lloydIterations = 0;
  for (let it = 0; it < maxLloyd; it++) {
    let changed = it === 0;
    let n1 = 0;
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(data[i] - c1) <= Math.abs(data[i] - c2) ? 0 : 1;
      if (a !== assign[i]) changed = true;
      assign[i] = a;
      if (a === 0) {
        n1++;
        s1 += data[i];
      } else s2 += data[i];
    }
    lloydIterations = it + 1;
    if (n1 > 0) c1 = s1 / n1;
    if (n - n1 > 0) c2 = s2 / (n - n1);
    if (!changed) break;
  }

  let n1 = 0;
  let v1 = 0;
  let v2 = 0;
  for (let i = 0; i < n; i++) {
    if (assign[i] === 0) {
      n1++;
      v1 += (data[i] - c1) ** 2;
    } else v2 += (data[i] - c2) ** 2;
  }
  const n2 = n - n1;
  const sigma1 = Math.sqrt((n1 > 0 ? v1 / n1 : 0) + SKLEARN_REG_COVAR);
  const sigma2 = Math.sqrt((n2 > 0 ? v2 / n2 : 0) + SKLEARN_REG_COVAR);
  // An empty cluster (all points identical) would give pi = 0; keep it at 1/n.
  const pi1 = Math.min(Math.max(n1 / n, 1 / n), 1 - 1 / n) || 0.5;
  return {
    params: { pi1, pi2: 1 - pi1, mu1: c1, mu2: c2, sigma1, sigma2 },
    seeds,
    lloydIterations,
  };
}

export function manualInit(
  mu1: number,
  mu2: number,
  sigma1: number,
  sigma2: number,
  pi1 = 0.5,
): MixtureParams {
  return { pi1, pi2: 1 - pi1, mu1, mu2, sigma1, sigma2 };
}
