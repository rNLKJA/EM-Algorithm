/**
 * The committed inference artefact must be what the code produces. The fast
 * analyses are re-run in full; the slow ones (minutes) are checked through
 * small versions stored beside them with the same seeds. If this fails after a
 * deliberate change, regenerate with `pnpm inference`.
 */
import { describe, expect, it } from "vitest";
import { notebookRun } from "../em/notebook-run";
import { runBootstrapCoverage, runSelection, summariseFit, withoutClipped } from "./artefact";
import { compareInitialisations, convergenceStudy } from "./convergence";
import { bootstrapLrt, compareComponentCounts } from "./model-choice";
import { inference } from "./results";
import { bootstrapSummary, notebookMle, runCoverage } from "./tasks";
import { CHECK_SETTINGS, INFERENCE_SETTINGS, NOTEBOOK_CLIP } from "./settings";

/** stored numbers are rounded to 10 significant digits */
function close(actual: number, stored: number) {
  if (Number.isNaN(stored)) return expect(actual).toBeNaN();
  expect(Math.abs(actual - stored)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(stored)));
}

const data = notebookRun.ratings;

// generous per-test timeouts: CI runners are slower than a laptop
describe("inference artefact", { timeout: 120_000 }, () => {
  it("MLE and observed-information SEs", () => {
    const fit = notebookMle();
    const s = summariseFit(data, fit.params);
    s.theta.forEach((v, i) => close(v, inference.mle.theta[i]));
    s.se!.forEach((v, i) => close(v, inference.mle.se![i]));
    close(s.logLikelihood, inference.mle.logLikelihood);
    expect(fit.iterations).toBe(inference.mle.iterations);
  });

  it("parametric bootstrap", () => {
    const b = bootstrapSummary(notebookMle().params);
    b.intervals.forEach((ci, j) => {
      close(ci.lower, inference.bootstrap.intervals[j].lower);
      close(ci.upper, inference.bootstrap.intervals[j].upper);
    });
    expect(b.failed).toBe(inference.bootstrap.failed);
  });

  it("Wald coverage in both scenarios", () => {
    for (const [clip, stored] of [
      [null, inference.coverage.model],
      [NOTEBOOK_CLIP, inference.coverage.clipped],
    ] as const) {
      const r = runCoverage(clip);
      expect(r.params.map((p) => p.wald.hits)).toEqual(stored.params.map((p) => p.wald.hits));
    }
  });

  it("bootstrap coverage (small check)", () => {
    const { S, B } = CHECK_SETTINGS.bootstrapCoverage;
    const r = runBootstrapCoverage(S, B);
    expect(r.params.map((p) => p.paired)).toEqual(
      inference.checks.bootstrapCoverage.params.map((p) => p.paired),
    );
    // the full study used the same seeds and settings
    expect(inference.bootstrapCoverage.S).toBe(INFERENCE_SETTINGS.bootstrapCoverage.S);
    expect(inference.bootstrapCoverage.bootstrapB).toBe(INFERENCE_SETTINGS.bootstrapCoverage.B);
  });

  it("choosing K, with and without the clipped ratings", () => {
    const full = compareComponentCounts(data, INFERENCE_SETTINGS.modelChoice);
    full.rows.forEach((r, i) => close(r.ll, inference.modelChoice.full.rows[i].ll));
    expect(full.bestByBic).toBe(inference.modelChoice.full.bestByBic);
    const trimmed = compareComponentCounts(withoutClipped(data), INFERENCE_SETTINGS.modelChoice);
    trimmed.rows.forEach((r, i) => close(r.ll, inference.modelChoice.withoutClipped.rows[i].ll));
    expect(inference.modelChoice.dropped).toBe(7);
  });

  it("selection rates and the bootstrap LRT (small checks)", () => {
    const sel = runSelection(NOTEBOOK_CLIP, CHECK_SETTINGS.selectionS);
    expect(sel.bic.map((r) => r.picked.successes)).toEqual(
      inference.checks.selection.bic.map((r) => r.picked.successes),
    );
    const lrt = bootstrapLrt(data, { ...INFERENCE_SETTINGS.lrt, B: CHECK_SETTINGS.lrtB });
    close(lrt.statistic, inference.checks.lrt.statistic);
    lrt.nullStatistics.forEach((t, i) => close(t, inference.checks.lrt.nullStatistics[i]));
    close(lrt.statistic, inference.lrt.statistic);
    expect(inference.lrt.nullStatistics).toHaveLength(INFERENCE_SETTINGS.lrt.B);
  });

  it("convergence study and the paired comparison of starts", () => {
    const c = convergenceStudy(data, INFERENCE_SETTINGS.convergence);
    expect(c.iterations).toEqual(inference.convergence.iterations);
    expect(c.optima.map((o) => o.count)).toEqual(inference.convergence.optima.map((o) => o.count));
    expect(c.monotoneRuns).toBe(inference.convergence.monotoneRuns);
    const ic = compareInitialisations(INFERENCE_SETTINGS.initComparison);
    close(
      ic.iterations.difference.estimate,
      inference.initComparison.iterations.difference.estimate,
    );
    close(
      ic.iterations.difference.interval.lower,
      inference.initComparison.iterations.difference.interval.lower,
    );
  });
});
