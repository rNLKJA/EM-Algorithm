/**
 * Claims made in the prose of the pitfalls page, pinned so the copy cannot drift
 * from what the code actually does.
 */
import { describe, expect, it } from "vitest";
import { threeBumpsDataset } from "./datasets";
import { fit } from "./em";
import { accuracyMatched, matchByMean } from "./labels";
import { notebookRun } from "./notebook-run";
import { runRestarts } from "./restarts";

describe("pitfalls page claims", () => {
  it("notebook data: nearly every random start reaches ℓ = -415.37, a few find a higher peak", () => {
    let total = 0;
    let common = 0;
    let higher = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = runRestarts({
        data: notebookRun.ratings,
        count: 48,
        seed,
        maxIterations: 1000,
        tolerance: 1e-6,
        init: "notebook",
      });
      for (const r of s.runs) {
        total++;
        if (Math.abs(r.logLikelihood - -415.366) < 0.01) common++;
        else if (r.logLikelihood > -414.5) higher++;
      }
    }
    expect(common / total).toBeGreaterThan(0.9);
    expect(higher).toBeGreaterThan(0);
  });

  it("three bumps: random starts find two optima, k-means++ always the better one", () => {
    const ds = threeBumpsDataset();
    for (const seed of [1, 2, 3, 4, 5]) {
      const random = runRestarts({
        data: ds.ratings,
        count: 48,
        seed,
        maxIterations: 1000,
        tolerance: 1e-6,
        init: "notebook",
      });
      const real = random.optima.filter((o) => !o.degenerate);
      expect(real.length).toBeGreaterThanOrEqual(2);
      expect(real[0].logLikelihood - real[1].logLikelihood).toBeGreaterThan(13);
      expect(real[0].logLikelihood - real[1].logLikelihood).toBeLessThan(15.5);
      const kpp = runRestarts({
        data: ds.ratings,
        count: 48,
        seed,
        maxIterations: 1000,
        tolerance: 1e-6,
        init: "kmeans++",
      });
      expect(kpp.optima).toHaveLength(1);
      expect(kpp.optima[0].logLikelihood).toBeCloseTo(random.optima[0].logLikelihood, 4);
    }
  });

  it("stopping early: 90 iterations to converge, higher likelihood, lower accuracy", () => {
    const long = fit(notebookRun.ratings, notebookRun.init, {
      maxIterations: 1000,
      tolerance: 1e-4,
    });
    expect(long.iterations).toHaveLength(90);
    const last = long.iterations.at(-1)!;
    expect(last.logLikelihood).toBeGreaterThan(notebookRun.summary.finalLogLikelihood);
    const acc = accuracyMatched(
      long.finalGamma1,
      notebookRun.trueGroups,
      matchByMean(last.params, notebookRun.trueParams),
    );
    expect(acc).toBeCloseTo(0.835, 10);
    const lastImprovement =
      notebookRun.iterations[14].logLikelihood - notebookRun.iterations[13].logLikelihood;
    expect(lastImprovement / notebookRun.fit.tolerance).toBeGreaterThan(250);
  });

  it("seed 0: the notebook's accuracy line reports 10% for a 90% fit", () => {
    const s0 = notebookRun.otherSeeds.find((s) => s.seed === 0)!;
    expect(s0.labelsSwapped).toBe(false);
    expect(s0.accuracyAsWritten).toBeCloseTo(0.1, 10);
    expect(s0.accuracyMatched).toBeCloseTo(0.9, 10);
  });
});
