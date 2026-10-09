/**
 * EM for a univariate Gaussian mixture with any number of components K.
 *
 * The notebook only ever fits K = 2, and the parity-tested port in
 * lib/em/em.ts keeps its exact arithmetic. Choosing K needs K = 1 to 4, so this
 * module generalises the same algorithm (same updates, same stopping rule on
 * |Δℓ|) and adds two things a K-component fit needs: the E-step works in log
 * space (log-sum-exp), so narrow components never underflow to 0/0, and an
 * optional variance floor (see docs/decisions/DR-003-variance-floor.md).
 * For K = 2 it reproduces lib/em/em.ts (tested in gmm.test.ts).
 */
import { SIGMA_EPS } from "../em/em";
import { createRng, type Rng } from "../em/rng";
import { restartSeed } from "../em/restarts";
import type { MixtureParams, StopReason } from "../em/types";
import { mean, std } from "../stats/descriptive";

export interface Gmm {
  weights: number[];
  means: number[];
  sds: number[];
}

export interface GmmFitOptions {
  maxIterations: number;
  tolerance: number;
  /** lower bound on every standard deviation after each M-step; 0 = none */
  varianceFloor?: number;
}

export interface GmmFit {
  params: Gmm;
  /** exact log-likelihood of `params` (NaN when the run degenerated) */
  logLikelihood: number;
  /** M-steps performed */
  iterations: number;
  stopReason: StopReason;
  /** true when the floor was binding for at least one component at the end */
  floorBinding: boolean;
}

const LOG_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);

export function logNormalPdf(x: number, mu: number, sd: number): number {
  const z = (x - mu) / sd;
  return -0.5 * z * z - Math.log(sd) - LOG_SQRT_2PI;
}

/** Exact mixture log-likelihood, computed stably with log-sum-exp. */
export function gmmLogLikelihood(data: ArrayLike<number>, g: Gmm): number {
  const K = g.means.length;
  const logW = g.weights.map(Math.log);
  const logSd = g.sds.map(Math.log);
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    let max = -Infinity;
    const terms = new Array<number>(K);
    for (let k = 0; k < K; k++) {
      const z = (data[i] - g.means[k]) / g.sds[k];
      const t = logW[k] - 0.5 * z * z - logSd[k] - LOG_SQRT_2PI;
      terms[k] = t;
      if (t > max) max = t;
    }
    let s = 0;
    for (let k = 0; k < K; k++) s += Math.exp(terms[k] - max);
    total += max + Math.log(s);
  }
  return total;
}

function valid(g: Gmm): boolean {
  for (let k = 0; k < g.means.length; k++) {
    if (!Number.isFinite(g.means[k]) || !Number.isFinite(g.sds[k]) || !(g.sds[k] > SIGMA_EPS))
      return false;
    if (!(g.weights[k] > 0) || !Number.isFinite(g.weights[k])) return false;
  }
  return true;
}

/**
 * Run EM from `init`. Iteration t: E-step with θ(t-1) (which also gives ℓ(θ(t-1))),
 * then the M-step gives θ(t). From the second iteration on it stops when
 * |ℓ(θ(t)) - ℓ(θ(t-1))| < tolerance, the notebook's rule.
 */
export function fitGmm(data: ArrayLike<number>, init: Gmm, options: GmmFitOptions): GmmFit {
  const n = data.length;
  const K = init.means.length;
  const floor = options.varianceFloor ?? 0;
  let g: Gmm = { weights: [...init.weights], means: [...init.means], sds: [...init.sds] };
  const resp = new Float64Array(n * K);
  const terms = new Float64Array(K);
  let previousLl = Number.NaN;
  let iterations = 0;
  let floorBinding = false;

  // ℓ(θ) and responsibilities for the current θ
  const eStep = (): number => {
    const logW = g.weights.map(Math.log);
    const logSd = g.sds.map(Math.log);
    let total = 0;
    for (let i = 0; i < n; i++) {
      let max = -Infinity;
      for (let k = 0; k < K; k++) {
        const z = (data[i] - g.means[k]) / g.sds[k];
        const t = logW[k] - 0.5 * z * z - logSd[k] - LOG_SQRT_2PI;
        terms[k] = t;
        if (t > max) max = t;
      }
      let s = 0;
      for (let k = 0; k < K; k++) {
        const e = Math.exp(terms[k] - max);
        resp[i * K + k] = e;
        s += e;
      }
      for (let k = 0; k < K; k++) resp[i * K + k] /= s;
      total += max + Math.log(s);
    }
    return total;
  };

  for (;;) {
    const ll = eStep(); // ℓ(θ(iterations))
    if (iterations >= 2 && Math.abs(ll - previousLl) < options.tolerance) {
      return { params: g, logLikelihood: ll, iterations, stopReason: "converged", floorBinding };
    }
    if (iterations >= options.maxIterations) {
      return {
        params: g,
        logLikelihood: ll,
        iterations,
        stopReason: "max-iterations",
        floorBinding,
      };
    }
    previousLl = ll;

    // M-step
    const weights = new Array<number>(K);
    const means = new Array<number>(K);
    const sds = new Array<number>(K);
    floorBinding = false;
    for (let k = 0; k < K; k++) {
      let nk = 0;
      let sx = 0;
      for (let i = 0; i < n; i++) {
        const r = resp[i * K + k];
        nk += r;
        sx += r * data[i];
      }
      const mu = sx / nk;
      let ss = 0;
      for (let i = 0; i < n; i++) ss += resp[i * K + k] * (data[i] - mu) ** 2;
      let sd = Math.sqrt(ss / nk);
      if (floor > 0 && !(sd >= floor)) {
        sd = floor;
        floorBinding = true;
      }
      weights[k] = nk / n;
      means[k] = mu;
      sds[k] = sd;
    }
    g = { weights, means, sds };
    iterations++;
    if (!valid(g)) {
      return {
        params: g,
        logLikelihood: Number.NaN,
        iterations,
        stopReason: "degenerate",
        floorBinding,
      };
    }
  }
}

/** The K = 1 fit has a closed form: the sample mean and the ddof = 0 SD (floored). */
export function fitSingleNormal(data: ArrayLike<number>, varianceFloor = 0): GmmFit {
  const sd = Math.max(std(data), varianceFloor);
  const params: Gmm = { weights: [1], means: [mean(data)], sds: [sd] };
  return {
    params,
    logLikelihood: gmmLogLikelihood(data, params),
    iterations: 0,
    stopReason: "converged",
    floorBinding: varianceFloor > 0 && std(data) < varianceFloor,
  };
}

/** Components ordered by mean (low to high): the labelling rule of DR-002. */
export function sortGmm(g: Gmm): Gmm {
  const order = g.means.map((_, k) => k).sort((a, b) => g.means[a] - g.means[b]);
  return {
    weights: order.map((k) => g.weights[k]),
    means: order.map((k) => g.means[k]),
    sds: order.map((k) => g.sds[k]),
  };
}

export function toGmm(p: MixtureParams): Gmm {
  return { weights: [p.pi1, p.pi2], means: [p.mu1, p.mu2], sds: [p.sigma1, p.sigma2] };
}

export function toMixtureParams(g: Gmm): MixtureParams {
  if (g.means.length !== 2) throw new Error("toMixtureParams needs exactly two components");
  return {
    pi1: g.weights[0],
    pi2: g.weights[1],
    mu1: g.means[0],
    mu2: g.means[1],
    sigma1: g.sds[0],
    sigma2: g.sds[1],
  };
}

/** k-means++ seeding, Lloyd's k-means in 1-D, then weights, means and SDs of the hard clusters. */
export function kmeansPlusPlusGmm(data: ArrayLike<number>, K: number, rng: Rng): Gmm {
  const n = data.length;
  const centres = [data[rng.int(n)]];
  const d2 = new Float64Array(n);
  while (centres.length < K) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      let best = Infinity;
      for (const c of centres) best = Math.min(best, (data[i] - c) ** 2);
      d2[i] = best;
      total += best;
    }
    if (total === 0) {
      centres.push(centres[0]);
      continue;
    }
    let target = rng.next() * total;
    let pick = n - 1;
    for (let i = 0; i < n; i++) {
      target -= d2[i];
      if (target <= 0) {
        pick = i;
        break;
      }
    }
    centres.push(data[pick]);
  }
  centres.sort((a, b) => a - b);
  const assign = new Int32Array(n);
  for (let it = 0; it < 100; it++) {
    let changed = it === 0;
    for (let i = 0; i < n; i++) {
      let best = 0;
      for (let k = 1; k < K; k++)
        if (Math.abs(data[i] - centres[k]) < Math.abs(data[i] - centres[best])) best = k;
      if (best !== assign[i]) changed = true;
      assign[i] = best;
    }
    for (let k = 0; k < K; k++) {
      let s = 0;
      let c = 0;
      for (let i = 0; i < n; i++)
        if (assign[i] === k) {
          s += data[i];
          c++;
        }
      if (c > 0) centres[k] = s / c;
    }
    if (!changed) break;
  }
  const overall = std(data) || 1;
  const weights: number[] = [];
  const sds: number[] = [];
  for (let k = 0; k < K; k++) {
    let c = 0;
    let ss = 0;
    for (let i = 0; i < n; i++)
      if (assign[i] === k) {
        c++;
        ss += (data[i] - centres[k]) ** 2;
      }
    weights.push(Math.max(c, 1) / n);
    // a cluster of one point (or several identical ones) would start EM on a spike
    sds.push(c > 1 && ss > 0 ? Math.sqrt(ss / c + 1e-6) : overall / K);
  }
  const total = weights.reduce((a, b) => a + b, 0);
  return { weights: weights.map((w) => w / total), means: [...centres], sds };
}

/** Forgy start: K distinct data points as means, equal weights, every SD the data's SD. */
export function forgyGmm(data: ArrayLike<number>, K: number, rng: Rng): Gmm {
  const n = data.length;
  const picked = new Set<number>();
  while (picked.size < Math.min(K, n)) picked.add(rng.int(n));
  const means = [...picked].map((i) => data[i]).sort((a, b) => a - b);
  while (means.length < K) means.push(means[means.length - 1]);
  const sd = std(data) || 1;
  return { weights: means.map(() => 1 / K), means, sds: means.map(() => sd) };
}

/**
 * The notebook's random start generalised to K components: means uniform between
 * the 10th and 90th percentiles of the data (the notebook's U(3, 8) on ratings in
 * 1 to 10), SDs uniform on [0.25, 1] times the data's SD, equal weights.
 */
export function randomGmm(data: ArrayLike<number>, K: number, rng: Rng): Gmm {
  const sorted = Float64Array.from(data).sort();
  const lo = sorted[Math.floor(0.1 * (sorted.length - 1))];
  const hi = sorted[Math.ceil(0.9 * (sorted.length - 1))];
  const sd = std(data) || 1;
  const means = Array.from({ length: K }, () => rng.uniform(lo, hi));
  const sds = Array.from({ length: K }, () => rng.uniform(0.25, 1) * sd);
  return { weights: means.map(() => 1 / K), means, sds };
}

export type StartKind = "kmeans++" | "forgy" | "random";
const START_KINDS: StartKind[] = ["kmeans++", "forgy", "random"];

export interface BestFitOptions extends GmmFitOptions {
  /** number of starts, cycling k-means++, Forgy and random (K = 1 needs none) */
  restarts: number;
  seed: number;
}

export interface BestFit {
  K: number;
  best: GmmFit | null;
  /** final log-likelihood of every start (NaN when it degenerated) */
  runs: { ll: number; iterations: number; stopReason: StopReason; init: StartKind }[];
  degenerate: number;
  /** starts that ended within 0.01 of the best log-likelihood */
  reachedBest: number;
}

/** Best of several EM runs for K components (K = 1 is closed form). */
export function fitGmmBest(data: ArrayLike<number>, K: number, options: BestFitOptions): BestFit {
  if (K === 1) {
    const best = fitSingleNormal(data, options.varianceFloor);
    return {
      K,
      best,
      runs: [{ ll: best.logLikelihood, iterations: 0, stopReason: "converged", init: "kmeans++" }],
      degenerate: 0,
      reachedBest: 1,
    };
  }
  let best: GmmFit | null = null;
  const runs: BestFit["runs"] = [];
  for (let r = 0; r < options.restarts; r++) {
    const rng = createRng(restartSeed(options.seed + 7919 * K, r));
    const kind = START_KINDS[r % START_KINDS.length];
    const init =
      kind === "kmeans++"
        ? kmeansPlusPlusGmm(data, K, rng)
        : kind === "forgy"
          ? forgyGmm(data, K, rng)
          : randomGmm(data, K, rng);
    const fit = fitGmm(data, init, options);
    runs.push({
      ll: fit.logLikelihood,
      iterations: fit.iterations,
      stopReason: fit.stopReason,
      init: kind,
    });
    if (fit.stopReason !== "degenerate" && (!best || fit.logLikelihood > best.logLikelihood))
      best = fit;
  }
  const bestLl = best?.logLikelihood ?? Number.NaN;
  return {
    K,
    best: best ? { ...best, params: sortGmm(best.params) } : null,
    runs,
    degenerate: runs.filter((r) => r.stopReason === "degenerate").length,
    reachedBest: runs.filter((r) => Math.abs(r.ll - bestLl) < 0.01).length,
  };
}
