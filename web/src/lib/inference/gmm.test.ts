import { describe, expect, it } from "vitest";
import { exactLogLikelihood, fit } from "../em/em";
import { notebookRun } from "../em/notebook-run";
import { createRng } from "../em/rng";
import { mean, std } from "../stats/descriptive";
import {
  fitGmm,
  fitGmmBest,
  fitSingleNormal,
  forgyGmm,
  gmmLogLikelihood,
  kmeansPlusPlusGmm,
  randomGmm,
  sortGmm,
  toGmm,
  toMixtureParams,
} from "./gmm";

const data = notebookRun.ratings;

describe("general-K Gaussian mixture", () => {
  it("log-likelihood equals the two-component formula and survives tiny SDs", () => {
    const p = notebookRun.iterations.at(-1)!.params;
    expect(gmmLogLikelihood(data, toGmm(p))).toBeCloseTo(exactLogLikelihood(data, p), 9);
    // a component far narrower than float exp() can represent at distant points
    const spiky = { weights: [0.5, 0.5], means: [5, 9.99], sds: [2, 1e-6] };
    expect(Number.isFinite(gmmLogLikelihood(data, spiky))).toBe(true);
  });

  it("reproduces the parity-tested two-component port from the same start", () => {
    const options = { maxIterations: 500, tolerance: 1e-10 };
    const a = fit(data, notebookRun.init, options);
    const b = fitGmm(data, toGmm(notebookRun.init), options);
    const pa = a.iterations.at(-1)!.params;
    const pb = toMixtureParams(b.params);
    for (const k of ["pi1", "mu1", "mu2", "sigma1", "sigma2"] as const)
      expect(pb[k]).toBeCloseTo(pa[k], 7);
    expect(Math.abs(b.iterations - a.iterations.length)).toBeLessThanOrEqual(1);
    expect(b.stopReason).toBe("converged");
  });

  it("matches the notebook's 15-iteration trace when capped at 15", () => {
    const b = fitGmm(data, toGmm(notebookRun.init), { maxIterations: 15, tolerance: 1e-4 });
    const nb = notebookRun.iterations.at(-1)!.params;
    expect(b.iterations).toBe(15);
    expect(b.stopReason).toBe("max-iterations");
    expect(b.params.means[0]).toBeCloseTo(nb.mu1, 8);
    expect(b.params.sds[1]).toBeCloseTo(nb.sigma2, 8);
  });

  it("K = 1 is the sample mean and ddof-0 SD", () => {
    const f = fitSingleNormal(data);
    expect(f.params.means[0]).toBeCloseTo(mean(data), 12);
    expect(f.params.sds[0]).toBeCloseTo(std(data), 12);
    expect(fitSingleNormal([1, 1, 1], 0.1).params.sds[0]).toBe(0.1);
  });

  it("applies the variance floor and flags it", () => {
    // seven identical ratings invite a spike; the floor holds it at 0.1
    const x = [...data.filter((v) => v < 10), 10, 10, 10, 10, 10, 10, 10];
    const start = { weights: [0.5, 0.45, 0.05], means: [3.5, 7, 10], sds: [1, 1, 0.05] };
    const floored = fitGmm(x, start, { maxIterations: 2000, tolerance: 1e-9, varianceFloor: 0.1 });
    expect(floored.stopReason).not.toBe("degenerate");
    expect(Math.min(...floored.params.sds)).toBeGreaterThanOrEqual(0.1);
    expect(floored.floorBinding).toBe(true);
    const free = fitGmm(x, start, { maxIterations: 2000, tolerance: 1e-9 });
    expect(free.stopReason).toBe("degenerate");
    expect(free.logLikelihood).toBeNaN();
  });

  it("orders components by mean", () => {
    const g = sortGmm({ weights: [0.2, 0.5, 0.3], means: [8, 2, 5], sds: [1, 2, 3] });
    expect(g.means).toEqual([2, 5, 8]);
    expect(g.weights).toEqual([0.5, 0.3, 0.2]);
    expect(g.sds).toEqual([2, 3, 1]);
    expect(() => toMixtureParams(g)).toThrow();
  });

  it("starts are valid and reproducible for a seed", () => {
    for (const make of [kmeansPlusPlusGmm, forgyGmm, randomGmm]) {
      const a = make(data, 3, createRng(9));
      const b = make(data, 3, createRng(9));
      expect(a).toEqual(b);
      expect(a.weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 12);
      expect(a.sds.every((s) => s > 0)).toBe(true);
    }
  });

  it("best of several starts keeps the highest maximum and counts who reached it", () => {
    const r = fitGmmBest(data, 2, { restarts: 30, seed: 4, maxIterations: 3000, tolerance: 1e-8 });
    expect(r.best).not.toBeNull();
    expect(r.runs).toHaveLength(30);
    expect(Math.max(...r.runs.map((x) => (Number.isFinite(x.ll) ? x.ll : -Infinity)))).toBe(
      r.best!.logLikelihood,
    );
    expect(r.reachedBest).toBeGreaterThanOrEqual(1);
    expect(r.best!.params.means[0]).toBeLessThan(r.best!.params.means[1]);
  });
});
