/**
 * Many EM runs from different random starts, grouped into the distinct optima they
 * reach. Used by the "local maxima" gallery (inside a Web Worker) and by tests.
 */
import { fit } from "./em";
import { kmeansPlusPlusInit, notebookRandomInit } from "./init";
import { matchByMean } from "./labels";
import { createRng } from "./rng";
import type { MixtureParams, StopReason } from "./types";

export type InitStrategy = "notebook" | "kmeans++";

export interface RestartConfig {
  data: number[];
  count: number;
  seed: number;
  maxIterations: number;
  tolerance: number;
  init: InitStrategy;
  varianceFloor?: number;
  /** when given, report whether each run's component 1 is the low- or high-mean group */
  truth?: { mu1: number; mu2: number };
}

export interface RestartRun {
  index: number;
  seed: number;
  init: MixtureParams;
  final: MixtureParams;
  /** final parameters re-ordered so that mu1 <= mu2 (for grouping and display) */
  sorted: MixtureParams;
  logLikelihood: number;
  iterations: number;
  stopReason: StopReason;
  llTrace: number[];
  /** fitted component 1 matched to true group 2 (label switch); null without truth */
  swapped: boolean | null;
  optimum: number;
}

export interface Optimum {
  id: number;
  params: MixtureParams;
  logLikelihood: number;
  count: number;
  degenerate: boolean;
}

export interface RestartSummary {
  runs: RestartRun[];
  optima: Optimum[];
  switchedShare: number | null;
}

export function sortByMean(p: MixtureParams): MixtureParams {
  if (p.mu1 <= p.mu2 || Number.isNaN(p.mu1) || Number.isNaN(p.mu2)) return p;
  return { pi1: p.pi2, pi2: p.pi1, mu1: p.mu2, mu2: p.mu1, sigma1: p.sigma2, sigma2: p.sigma1 };
}

/** Restart seeds are derived from the base seed so a gallery is reproducible. */
export function restartSeed(base: number, index: number): number {
  return (Math.imul(base ^ 0x5bd1e995, 2654435761) + index * 40503) >>> 0;
}

export function runRestarts(config: RestartConfig): RestartSummary {
  const runs: RestartRun[] = [];
  for (let index = 0; index < config.count; index++) {
    const seed = restartSeed(config.seed, index);
    const rng = createRng(seed);
    const init =
      config.init === "kmeans++"
        ? kmeansPlusPlusInit(config.data, rng).params
        : notebookRandomInit(rng);
    const result = fit(config.data, init, {
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      varianceFloor: config.varianceFloor,
    });
    const last = result.iterations.at(-1);
    const final = last ? last.params : init;
    runs.push({
      index,
      seed,
      init,
      final,
      sorted: sortByMean(final),
      logLikelihood: last ? last.logLikelihood : Number.NaN,
      iterations: result.iterations.length,
      stopReason: result.stopReason,
      llTrace: result.iterations.map((it) => it.logLikelihood),
      swapped: config.truth ? matchByMean(final, config.truth).swapped : null,
      optimum: -1,
    });
  }

  const optima = groupOptima(runs);
  const judged = runs.filter((r) => r.swapped !== null);
  return {
    runs,
    optima,
    switchedShare: judged.length ? judged.filter((r) => r.swapped).length / judged.length : null,
  };
}

const MEAN_TOL = 0.05;
const LL_TOL = 0.05;

/** Group runs whose (sorted) means and log-likelihoods agree; best optimum first. */
export function groupOptima(runs: RestartRun[]): Optimum[] {
  const optima: Optimum[] = [];
  const order = [...runs].sort((a, b) => score(b) - score(a));
  for (const run of order) {
    const degenerate = run.stopReason === "degenerate" || !Number.isFinite(run.logLikelihood);
    const match = optima.find(
      (o) =>
        o.degenerate === degenerate &&
        (degenerate ||
          (Math.abs(o.params.mu1 - run.sorted.mu1) < MEAN_TOL &&
            Math.abs(o.params.mu2 - run.sorted.mu2) < MEAN_TOL &&
            Math.abs(o.logLikelihood - run.logLikelihood) < LL_TOL)),
    );
    if (match) {
      match.count++;
      run.optimum = match.id;
    } else {
      const id = optima.length;
      optima.push({
        id,
        params: run.sorted,
        logLikelihood: run.logLikelihood,
        count: 1,
        degenerate,
      });
      run.optimum = id;
    }
  }
  return optima;
}

function score(run: RestartRun): number {
  if (run.stopReason === "degenerate" || !Number.isFinite(run.logLikelihood)) return -Infinity;
  return run.logLikelihood;
}
