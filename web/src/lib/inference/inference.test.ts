import { describe, expect, it } from "vitest";
import { notebookRun } from "../em/notebook-run";
import { generateRatings } from "../em/rng";
import type { MixtureParams } from "../em/types";
import {
  compareInitialisations,
  convergenceStudy,
  iterationsToTolerance,
  largestDecrease,
} from "./convergence";
import {
  bootstrapLrt,
  compareComponentCounts,
  LRT_DEFAULTS,
  MODEL_CHOICE_DEFAULTS,
} from "./model-choice";
import {
  coverageStudy,
  fitToConvergence,
  fromTheta,
  observedInformation,
  parametricBootstrap,
  toTheta,
  waldIntervals,
} from "./uncertainty";

const data = notebookRun.ratings;
const separated: MixtureParams = { pi1: 0.5, pi2: 0.5, mu1: 2, mu2: 9, sigma1: 0.7, sigma2: 0.7 };

describe("observed information", { timeout: 60_000 }, () => {
  it("is positive definite at the converged notebook fit, with sensible SEs", () => {
    const fit = fitToConvergence(data, notebookRun.init);
    expect(fit.stopReason).toBe("converged");
    const info = observedInformation(data, fit.params);
    expect(info.positiveDefinite).toBe(true);
    expect(info.se!.every((s) => s > 0 && s < 1)).toBe(true);
    const ci = waldIntervals(info)!;
    ci.forEach((c, i) => {
      expect(c.lower).toBeLessThan(info.theta[i]);
      expect(c.upper).toBeGreaterThan(info.theta[i]);
    });
  });

  it("approaches σ/√(nπ) for the means when the components barely overlap", () => {
    const { ratings } = generateRatings({ ...separated, n: 4000, seed: 3, clip: null });
    const fit = fitToConvergence(ratings, separated);
    const info = observedInformation(ratings, fit.params);
    const [pi1, , , s1, s2] = info.theta;
    expect(info.se![1]).toBeCloseTo(s1 / Math.sqrt(4000 * pi1), 3);
    expect(info.se![2]).toBeCloseTo(s2 / Math.sqrt(4000 * (1 - pi1)), 3);
    // and π behaves like a binomial proportion
    expect(info.se![0]).toBeCloseTo(Math.sqrt((pi1 * (1 - pi1)) / 4000), 3);
  });

  it("θ round-trips and orders components by mean", () => {
    const p: MixtureParams = { pi1: 0.7, pi2: 0.3, mu1: 8, mu2: 3, sigma1: 1, sigma2: 2 };
    expect(toTheta(p)).toEqual([0.3, 3, 8, 2, 1]);
    expect(fromTheta(toTheta(p)).mu1).toBe(3);
    expect(fromTheta([0.25, 1, 2, 3, 4]).pi2).toBe(0.75);
  });
});

describe("parametric bootstrap", { timeout: 60_000 }, () => {
  const fitted = fitToConvergence(data, notebookRun.init).params;

  it("is reproducible for a seed and brackets the estimate", () => {
    const a = parametricBootstrap(fitted, { B: 60, seed: 5, n: 200 });
    const b = parametricBootstrap(fitted, { B: 60, seed: 5, n: 200 });
    expect(a).toEqual(b);
    expect(a.replicates.length + a.failed).toBe(60);
    const theta = toTheta(fitted);
    a.intervals.forEach((ci, j) => {
      expect(ci.lower).toBeLessThan(theta[j]);
      expect(ci.upper).toBeGreaterThan(theta[j]);
      expect(a.se[j]).toBeGreaterThan(0);
    });
    expect(a.labelDisagreements).toBe(0);
  });

  it("changes with the seed", () => {
    const a = parametricBootstrap(fitted, { B: 30, seed: 1, n: 200 });
    const b = parametricBootstrap(fitted, { B: 30, seed: 2, n: 200 });
    expect(a.intervals[1].lower).not.toBe(b.intervals[1].lower);
  });
});

describe("coverage study", { timeout: 60_000 }, () => {
  it("counts hits consistently, including the paired Wald/bootstrap table", () => {
    const r = coverageStudy({
      truth: notebookRun.trueParams,
      n: 200,
      S: 4,
      seed: 11,
      clip: null,
      bootstrapB: 30,
    });
    expect(r.failed + r.params[0].wald.n + r.notPositiveDefinite).toBe(4);
    for (const p of r.params) {
      expect(p.wald.hits).toBeLessThanOrEqual(p.wald.n);
      const t = p.paired!;
      expect(t.both + t.waldOnly).toBe(p.wald.hits);
      expect(t.both + t.bootOnly).toBe(p.bootstrap!.hits);
      expect(t.both + t.waldOnly + t.bootOnly + t.neither).toBe(p.wald.n);
      expect(p.wald.coverage.estimate).toBe(p.wald.hits / p.wald.n);
    }
    // θ is compared with the truth ordered by mean: (0.4, 4, 7.5, 1.5, 1.2)
    [0.4, 4, 7.5, 1.5, 1.2].forEach((v, j) => expect(r.params[j].truth).toBeCloseTo(v, 12));
  });

  it("covers almost always when the data are large and the groups far apart", () => {
    const r = coverageStudy({
      truth: separated,
      n: 2000,
      S: 40,
      seed: 2,
      clip: null,
      bootstrapB: 0,
    });
    for (const p of r.params) expect(p.wald.hits).toBeGreaterThanOrEqual(33);
  });
});

describe("choosing K", { timeout: 60_000 }, () => {
  it("BIC picks two components on two well-separated groups", () => {
    const { ratings } = generateRatings({ ...separated, n: 300, seed: 8, clip: null });
    const r = compareComponentCounts(ratings, { ...MODEL_CHOICE_DEFAULTS, restarts: 9 });
    expect(r.bestByBic).toBe(2);
    expect(r.rows.find((row) => row.K === 2)!.deltaBic).toBe(0);
    expect(r.rows.map((row) => row.p)).toEqual([2, 5, 8, 11]);
    // more components never lower the maximised likelihood (when the search finds it)
    expect(r.rows[1].ll).toBeGreaterThan(r.rows[0].ll);
  });

  it("the bootstrap LRT p-value is (1 + exceed) / (B + 1) and never zero", () => {
    const r = bootstrapLrt(data, { ...LRT_DEFAULTS, B: 15, restarts: 3 });
    expect(r.nullStatistics).toHaveLength(15);
    expect(r.pValue).toBeCloseTo((1 + r.exceed) / 16, 12);
    expect(r.pValue).toBeGreaterThan(0);
    expect(r.df).toBe(3);
    expect(r.chiSquare95).toBeCloseTo(7.814727903251178, 9);
    expect(r.statistic).toBeGreaterThan(15);
    expect(r.nullStatistics.every((t) => t >= 0)).toBe(true);
  });

  it("the LRT does not reject on data from a single normal", () => {
    const x = Array.from(
      generateRatings({ ...separated, mu2: 2, sigma2: 0.7, n: 200, seed: 4, clip: null }).ratings,
    );
    const r = bootstrapLrt(x, { ...LRT_DEFAULTS, B: 19, restarts: 3 });
    expect(r.pValue).toBeGreaterThan(0.05);
  });
});

describe("convergence diagnostics", { timeout: 60_000 }, () => {
  it("finds when a trace first meets a tolerance, and the largest drop", () => {
    expect(iterationsToTolerance([-10, -5, -4, -3.99995, -3.99994], 1e-4)).toBe(4);
    expect(iterationsToTolerance([-10, -5], 1e-4)).toBeNull();
    expect(largestDecrease([-10, -5, -6, -4])).toBe(1);
    expect(largestDecrease([-3, -2, -1])).toBe(0);
  });

  it("every run is monotone, and best-of-R chances grow with R", () => {
    const s = convergenceStudy(data, {
      starts: 30,
      seed: 3,
      maxIterations: 3000,
      tolerances: [1e-4, 1e-8],
    });
    expect(s.monotoneRuns).toBe(30);
    expect(s.iterations[0].median).toBeLessThanOrEqual(s.iterations[1].median);
    for (let i = 1; i < s.bestOfR.length; i++)
      expect(s.bestOfR[i].probability).toBeGreaterThanOrEqual(s.bestOfR[i - 1].probability);
    expect(s.bestOfR[0].probability).toBeCloseTo(s.reachBest.estimate, 12);
  });

  it("compares the two starts on the same data sets", () => {
    const r = compareInitialisations({
      truth: notebookRun.trueParams,
      n: 200,
      S: 6,
      seed: 4,
      clip: [1, 10],
      tolerance: 1e-6,
      maxIterations: 3000,
      referenceStarts: 2,
    });
    expect(r.units).toHaveLength(6);
    const diffs = r.units.map((u) => u.randomIterations - u.kmeansIterations);
    expect(r.iterations.difference.estimate).toBeCloseTo(diffs.reduce((a, b) => a + b, 0) / 6, 12);
    expect(r.reachedBest.random.n).toBe(6);
  });
});
