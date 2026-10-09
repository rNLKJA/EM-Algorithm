/**
 * The precomputed inference results shown on /inference.
 *
 * The slow studies (bootstrap coverage, the bootstrap LRT, criterion selection
 * rates) take minutes, so they are run once by `pnpm inference`
 * (scripts/generate-inference.ts) with the seeds in settings.ts and stored in
 * __generated__/inference.json, like the notebook parity data (DR-001). The
 * artefact test re-runs the fast analyses in full and small versions of the
 * slow ones, so a code change that would alter the numbers fails CI until the
 * artefact is regenerated.
 */
import { exactLogLikelihood } from "../em/em";
import { notebookRun } from "../em/notebook-run";
import type { MixtureParams, StopReason } from "../em/types";
import type { Interval } from "../stats/intervals";
import { compareInitialisations, convergenceStudy, type InitComparison } from "./convergence";
import { binValues, type Histogram } from "./histogram";
import {
  bootstrapLrt,
  compareComponentCounts,
  selectionFrequency,
  type LrtResult,
  type ModelChoice,
  type SelectionFrequency,
} from "./model-choice";
import { CHECK_SETTINGS, INFERENCE_SETTINGS, NOTEBOOK_CLIP } from "./settings";
import {
  bootstrapSummary,
  notebookMle,
  runCoverage,
  summariseConvergence,
  type BootstrapSummary,
  type ConvergenceSummary,
} from "./tasks";
import {
  coverageStudy,
  fitToConvergence,
  fromTheta,
  observedInformation,
  waldIntervals,
  type CoverageResult,
} from "./uncertainty";

export interface FitSummary {
  /** components ordered by mean */
  params: MixtureParams;
  logLikelihood: number;
  theta: number[];
  se: number[] | null;
  wald: Interval[] | null;
  positiveDefinite: boolean;
}

export interface InferenceArtefact {
  version: 1;
  n: number;
  mle: FitSummary & { iterations: number; stopReason: StopReason };
  /** a higher maximum some random starts reach (null if none was found) */
  otherMaximum: (FitSummary & { startsReaching: number; starts: number }) | null;
  bootstrap: BootstrapSummary;
  coverage: { model: CoverageResult; clipped: CoverageResult };
  bootstrapCoverage: CoverageResult;
  modelChoice: {
    full: ModelChoice;
    withoutClipped: ModelChoice;
    dropped: number;
    /** the full-data comparison under other variance floors */
    floorSensitivity: ModelChoice[];
  };
  selection: { model: SelectionFrequency; clipped: SelectionFrequency };
  lrt: LrtResult & { nullHistogram: Histogram };
  convergence: ConvergenceSummary;
  initComparison: InitComparison;
  checks: {
    lrt: Pick<LrtResult, "statistic" | "nullStatistics" | "exceed">;
    bootstrapCoverage: CoverageResult;
    selection: SelectionFrequency;
  };
}

export function summariseFit(data: ArrayLike<number>, params: MixtureParams): FitSummary {
  const info = observedInformation(data, params);
  return {
    params: fromTheta(info.theta),
    logLikelihood: exactLogLikelihood(data, params),
    theta: info.theta,
    se: info.se,
    wald: waldIntervals(info),
    positiveDefinite: info.positiveDefinite,
  };
}

export function runBootstrapCoverage(S: number, B: number) {
  return coverageStudy({
    truth: notebookRun.trueParams,
    n: notebookRun.n,
    S,
    seed: INFERENCE_SETTINGS.bootstrapCoverage.seed,
    clip: null,
    bootstrapB: B,
    fitOptions: INFERENCE_SETTINGS.bootstrapCoverage.fit,
  });
}

export function runSelection(clip: [number, number] | null, S: number) {
  return selectionFrequency({ ...INFERENCE_SETTINGS.selection, clip, S });
}

/** Ratings strictly below the clip ceiling (the notebook's clipping piled seven onto 10.0). */
export function withoutClipped(data: readonly number[]): number[] {
  return data.filter((v) => v < NOTEBOOK_CLIP[1]);
}

export function buildInferenceArtefact(log: (message: string) => void = () => {}) {
  const data = notebookRun.ratings;
  const timed = <T>(label: string, f: () => T): T => {
    const t0 = performance.now();
    const out = f();
    log(`${label}: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    return out;
  };

  const fit = notebookMle();
  const mle = summariseFit(data, fit.params);

  const convergence = timed("convergence", () =>
    convergenceStudy(data, INFERENCE_SETTINGS.convergence),
  );
  const best = convergence.optima.find((o) => !o.degenerate);
  let otherMaximum: InferenceArtefact["otherMaximum"] = null;
  if (best && best.logLikelihood > fit.logLikelihood + 0.01) {
    const refined = fitToConvergence(data, best.params, INFERENCE_SETTINGS.mle.fit);
    otherMaximum = {
      ...summariseFit(data, refined.params),
      startsReaching: best.count,
      starts: convergence.runs.length,
    };
  }

  const bootstrap = timed("bootstrap", () => bootstrapSummary(fit.params));

  const coverage = {
    model: timed("coverage (model)", () => runCoverage(null)),
    clipped: timed("coverage (clipped)", () => runCoverage(NOTEBOOK_CLIP)),
  };
  const bc = INFERENCE_SETTINGS.bootstrapCoverage;
  const bootstrapCoverage = timed("bootstrap coverage", () => runBootstrapCoverage(bc.S, bc.B));

  const trimmed = withoutClipped(data);
  const modelChoice = {
    full: timed("model choice", () => compareComponentCounts(data, INFERENCE_SETTINGS.modelChoice)),
    withoutClipped: compareComponentCounts(trimmed, INFERENCE_SETTINGS.modelChoice),
    dropped: data.length - trimmed.length,
    floorSensitivity: timed("model choice, other floors", () =>
      INFERENCE_SETTINGS.modelChoiceFloors.map((varianceFloor) =>
        compareComponentCounts(data, { ...INFERENCE_SETTINGS.modelChoice, varianceFloor }),
      ),
    ),
  };
  const S = INFERENCE_SETTINGS.selection.S;
  const selection = {
    model: timed("selection (model)", () => runSelection(null, S)),
    clipped: timed("selection (clipped)", () => runSelection(NOTEBOOK_CLIP, S)),
  };
  const lrt = timed("bootstrap LRT", () => bootstrapLrt(data, INFERENCE_SETTINGS.lrt));
  const initComparison = timed("init comparison", () =>
    compareInitialisations(INFERENCE_SETTINGS.initComparison),
  );

  const lrtCheck = bootstrapLrt(data, { ...INFERENCE_SETTINGS.lrt, B: CHECK_SETTINGS.lrtB });
  const artefact: InferenceArtefact = {
    version: 1,
    n: data.length,
    mle: { ...mle, iterations: fit.iterations, stopReason: fit.stopReason },
    otherMaximum,
    bootstrap,
    coverage,
    bootstrapCoverage,
    modelChoice,
    selection,
    lrt: { ...lrt, nullHistogram: binValues(lrt.nullStatistics, 30) },
    convergence: summariseConvergence(convergence),
    initComparison,
    checks: {
      lrt: {
        statistic: lrtCheck.statistic,
        nullStatistics: lrtCheck.nullStatistics,
        exceed: lrtCheck.exceed,
      },
      bootstrapCoverage: runBootstrapCoverage(
        CHECK_SETTINGS.bootstrapCoverage.S,
        CHECK_SETTINGS.bootstrapCoverage.B,
      ),
      selection: runSelection(NOTEBOOK_CLIP, CHECK_SETTINGS.selectionS),
    },
  };
  return artefact;
}
