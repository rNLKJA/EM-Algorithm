/**
 * Every seed and size behind the numbers on /inference, in one place. The
 * generator (scripts/generate-inference.ts) reads these, the artefact test
 * re-runs the cheap analyses with them, and the page prints them.
 */
import { notebookRun } from "../em/notebook-run";
import { CONVERGENCE_DEFAULTS, INIT_COMPARISON_DEFAULTS } from "./convergence";
import { LRT_DEFAULTS, MODEL_CHOICE_DEFAULTS, type SelectionOptions } from "./model-choice";
import { INFERENCE_FIT, REFIT } from "./uncertainty";

export const NOTEBOOK_CLIP: [number, number] = [1, 10];

export const INFERENCE_SETTINGS = {
  /** the notebook's own random start, run to |Δℓ| < 1e-10 */
  mle: { fit: INFERENCE_FIT },
  bootstrap: { B: 1000, seed: 42, fit: REFIT },
  /** Wald-interval coverage, two scenarios on the same seeds */
  coverage: { S: 500, seed: 1, fit: REFIT },
  /** Wald and bootstrap intervals on the same data sets (paired) */
  bootstrapCoverage: { S: 200, B: 200, seed: 7, fit: REFIT },
  modelChoice: MODEL_CHOICE_DEFAULTS,
  /** the same comparison under other variance floors (sensitivity, DR-003) */
  modelChoiceFloors: [0.05, 0.25],
  selection: {
    truth: notebookRun.trueParams,
    n: notebookRun.n,
    S: 100,
    seed: 3,
    clip: null,
    Ks: [1, 2, 3, 4],
    restarts: 12,
    pileStarts: 6,
    maxIterations: 2000,
    tolerance: 1e-7,
    varianceFloor: 0.1,
  } satisfies SelectionOptions,
  lrt: LRT_DEFAULTS,
  convergence: CONVERGENCE_DEFAULTS,
  initComparison: INIT_COMPARISON_DEFAULTS,
} as const;

/** Small versions of the slow studies, stored beside the results and re-run by the tests. */
export const CHECK_SETTINGS = {
  lrtB: 12,
  bootstrapCoverage: { S: 3, B: 40 },
  selectionS: 3,
} as const;
