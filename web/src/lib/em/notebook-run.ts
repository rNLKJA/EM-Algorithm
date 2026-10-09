/**
 * The notebook's own run, exported by scripts/export_parity.py from
 * original/em_algorithm_demo.ipynb (seed 42). Everything the site states about
 * "the original run" is read from here rather than retyped.
 */
import raw from "../../../public/data/notebook-run.json";
import type { MixtureParams } from "./types";

export interface NotebookIteration {
  gammaMean1: number;
  gammaMean2: number;
  params: MixtureParams;
  logLikelihood: number;
}

export interface NotebookRun {
  provenance: {
    source: string;
    generator: string;
    seed: number;
    numpy: string;
    python: string;
    stdoutMatchesNotebook: boolean;
  };
  trueParams: MixtureParams;
  n: number;
  ratings: number[];
  trueGroups: number[];
  fit: { maxIterations: number; tolerance: number };
  init: MixtureParams;
  iterations: NotebookIteration[];
  finalGamma1: number[];
  summary: {
    ratingMin: number;
    ratingMax: number;
    ratingMean: number;
    firstLogLikelihood: number;
    finalLogLikelihood: number;
    totalImprovement: number;
    iterationsRun: number;
    accuracyAsWritten: number;
    accuracyMatched: number;
    labelsSwapped: boolean;
  };
  newUser: { rating: number; probGroup1: number; probGroup2: number };
  printed: { fitCell: string; accuracyCell: string; newUserCell: string };
  /** the same notebook code under other seeds (summaries only) */
  otherSeeds: {
    seed: number;
    accuracyAsWritten: number;
    accuracyMatched: number;
    labelsSwapped: boolean;
    final: MixtureParams;
  }[];
}

export const notebookRun = raw as NotebookRun;

export const NOTEBOOK_GROUP_NAMES = ["Sci-fi lovers", "Romance lovers"] as const;

/** Final fitted parameters of the notebook's run (after iteration 15). */
export const notebookFinal: MixtureParams = notebookRun.iterations.at(-1)!.params;
