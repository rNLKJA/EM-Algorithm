/**
 * The seeds and sizes behind every simulated number on /inference, as rows for
 * the page's "Seeds and sizes" table. The rows are read from the settings and
 * the published artefact rather than retyped, and seeds.test.ts checks that
 * every seed in INFERENCE_SETTINGS and every paired-bootstrap seed appears.
 */
import { notebookRun } from "../em/notebook-run";
import type { InferenceArtefact } from "./artefact";
import { pairedCoverageDifferences } from "./paired-coverage";
import { INFERENCE_SETTINGS } from "./settings";

export type InferenceSection = "uncertainty" | "coverage" | "choosing-k" | "convergence";

export interface SeedRow {
  /** what the seed drives */
  study: string;
  /** the /inference section that shows its numbers */
  section: InferenceSection;
  seeds: number[];
  /** sizes and settings, e.g. "B = 1,000 data sets of n = 200" */
  sizes: string;
}

const n = (v: number) => v.toLocaleString("en-AU");

/** "42", "31 and 32", "100 to 104" */
export function seedList(seeds: readonly number[]): string {
  const s = [...new Set(seeds)].sort((a, b) => a - b);
  if (s.length === 0) return "";
  if (s.length === 1) return String(s[0]);
  const consecutive = s.every((v, i) => i === 0 || v === s[i - 1] + 1);
  if (consecutive && s.length > 2) return `${s[0]} to ${s.at(-1)}`;
  return `${s.slice(0, -1).join(", ")} and ${s.at(-1)}`;
}

export function seedRows(a: InferenceArtefact): SeedRow[] {
  const s = INFERENCE_SETTINGS;
  const pairedCoverage = pairedCoverageDifferences(a.bootstrapCoverage).filter((d) => d !== null);
  const ic = a.initComparison;
  const icDiffs = [ic.iterations.difference, ic.reachedBest.difference];
  return [
    {
      study: "The notebook's 200 ratings and its random start (NumPy, in the original notebook)",
      section: "uncertainty",
      seeds: [notebookRun.provenance.seed],
      sizes: `n = ${notebookRun.n}`,
    },
    {
      study: "Parametric bootstrap of the notebook's fit",
      section: "uncertainty",
      seeds: [a.bootstrap.seed],
      sizes: `B = ${n(a.bootstrap.B)} data sets of n = ${a.bootstrap.n}`,
    },
    {
      study: "Wald coverage, model exactly and clipped (same seeds for both)",
      section: "coverage",
      seeds: [a.coverage.model.seed, a.coverage.clipped.seed],
      sizes: `S = ${n(a.coverage.model.S)} data sets per scenario, n = ${a.coverage.model.n}`,
    },
    {
      study: "Wald and bootstrap coverage on the same data sets",
      section: "coverage",
      seeds: [a.bootstrapCoverage.seed],
      sizes: `S = ${n(a.bootstrapCoverage.S)} data sets, B = ${n(a.bootstrapCoverage.bootstrapB)} per data set`,
    },
    {
      study: "Paired bootstrap − Wald coverage intervals (one seed per parameter)",
      section: "coverage",
      seeds: pairedCoverage.map((d) => d.seed),
      sizes: `B = ${n(pairedCoverage[0]?.B ?? 0)} resamples of the ${n(a.bootstrapCoverage.S)} data sets`,
    },
    {
      study:
        "AIC and BIC for K = 1 to 4 on the notebook's ratings (also without the clipped ones, and at other variance floors)",
      section: "choosing-k",
      seeds: [
        a.modelChoice.full.options.seed,
        a.modelChoice.withoutClipped.options.seed,
        ...a.modelChoice.floorSensitivity.map((m) => m.options.seed),
      ],
      sizes: `${s.modelChoice.restarts} ordinary starts + ${s.modelChoice.pileStarts} pile starts per K`,
    },
    {
      study: "How often each criterion picks each K (model exactly and clipped)",
      section: "choosing-k",
      seeds: [a.selection.model.options.seed, a.selection.clipped.options.seed],
      sizes: `S = ${n(a.selection.model.options.S)} samples per scenario, ${a.selection.model.options.restarts} starts + ${a.selection.model.options.pileStarts} pile starts per K`,
    },
    {
      study: "Bootstrap likelihood-ratio test, one group against two",
      section: "choosing-k",
      seeds: [a.lrt.options.seed],
      sizes: `B = ${n(a.lrt.options.B)} null data sets, ${a.lrt.options.restarts} starts + ${a.lrt.options.pileStarts} pile starts per fit`,
    },
    {
      study: "Notebook-style random starts (ascent, iterations, maxima, best of R)",
      section: "convergence",
      seeds: [a.convergence.options.seed],
      sizes: `${n(a.convergence.options.starts)} starts`,
    },
    {
      study: "Random start against k-means++ on the same data sets",
      section: "convergence",
      seeds: [ic.options.seed],
      sizes: `S = ${n(ic.options.S)} data sets, n = ${ic.options.n}`,
    },
    {
      study: "Paired intervals for that comparison (iterations, then reaching the best maximum)",
      section: "convergence",
      seeds: icDiffs.map((d) => d.seed),
      sizes: `B = ${n(ic.iterations.difference.B)} resamples of the ${n(ic.options.S)} data sets`,
    },
  ];
}
