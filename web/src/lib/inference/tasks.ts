/**
 * The analyses a reader can re-run from /inference with their own seed, in a
 * Web Worker. Each returns the same shape as the matching slice of the
 * precomputed artefact, so the page renders either one.
 */
import { notebookRun } from "../em/notebook-run";
import type { MixtureParams } from "../em/types";
import { binValues, type Histogram } from "./histogram";
import { convergenceStudy, type ConvergenceStudy } from "./convergence";
import { INFERENCE_SETTINGS, NOTEBOOK_CLIP } from "./settings";
import {
  coverageStudy,
  fitToConvergence,
  parametricBootstrap,
  type BootstrapResult,
  type CoverageResult,
} from "./uncertainty";

export type BootstrapSummary = Omit<BootstrapResult, "replicates"> & { histograms: Histogram[] };
export type WaldCoverage = { model: CoverageResult; clipped: CoverageResult };
export type ConvergenceSummary = Omit<ConvergenceStudy, "runs"> & {
  runs: Pick<
    ConvergenceStudy["runs"][number],
    "iterationsTo" | "logLikelihood" | "optimum" | "monotone"
  >[];
};

export function notebookMle() {
  return fitToConvergence(notebookRun.ratings, notebookRun.init, INFERENCE_SETTINGS.mle.fit);
}

export function bootstrapSummary(
  fitted: MixtureParams,
  B: number = INFERENCE_SETTINGS.bootstrap.B,
  seed: number = INFERENCE_SETTINGS.bootstrap.seed,
): BootstrapSummary {
  const { replicates, ...rest } = parametricBootstrap(fitted, {
    B,
    seed,
    n: notebookRun.n,
    fitOptions: INFERENCE_SETTINGS.bootstrap.fit,
  });
  return {
    ...rest,
    histograms: [0, 1, 2, 3, 4].map((j) =>
      binValues(
        replicates.map((t) => t[j]),
        30,
      ),
    ),
  };
}

export function runCoverage(
  clip: [number, number] | null,
  S: number = INFERENCE_SETTINGS.coverage.S,
  seed: number = INFERENCE_SETTINGS.coverage.seed,
) {
  return coverageStudy({
    truth: notebookRun.trueParams,
    n: notebookRun.n,
    S,
    seed,
    clip,
    bootstrapB: 0,
    fitOptions: INFERENCE_SETTINGS.coverage.fit,
  });
}

export function waldCoverage(
  S: number = INFERENCE_SETTINGS.coverage.S,
  seed: number = INFERENCE_SETTINGS.coverage.seed,
): WaldCoverage {
  return { model: runCoverage(null, S, seed), clipped: runCoverage(NOTEBOOK_CLIP, S, seed) };
}

export function summariseConvergence(study: ConvergenceStudy): ConvergenceSummary {
  return {
    ...study,
    runs: study.runs.map((r) => ({
      iterationsTo: r.iterationsTo,
      logLikelihood: r.logLikelihood,
      optimum: r.optimum,
      monotone: r.monotone,
    })),
  };
}

export function convergenceSummary(
  starts: number = INFERENCE_SETTINGS.convergence.starts,
  seed: number = INFERENCE_SETTINGS.convergence.seed,
): ConvergenceSummary {
  return summariseConvergence(
    convergenceStudy(notebookRun.ratings, { ...INFERENCE_SETTINGS.convergence, starts, seed }),
  );
}

export type InferenceTask =
  | { task: "bootstrap"; seed: number; B: number }
  | { task: "coverage"; seed: number; S: number }
  | { task: "convergence"; seed: number; starts: number };

export type InferenceTaskResult =
  | { task: "bootstrap"; result: BootstrapSummary }
  | { task: "coverage"; result: WaldCoverage }
  | { task: "convergence"; result: ConvergenceSummary };

export function runInferenceTask(t: InferenceTask): InferenceTaskResult {
  if (t.task === "bootstrap")
    return { task: "bootstrap", result: bootstrapSummary(notebookMle().params, t.B, t.seed) };
  if (t.task === "coverage") return { task: "coverage", result: waldCoverage(t.S, t.seed) };
  return { task: "convergence", result: convergenceSummary(t.starts, t.seed) };
}
