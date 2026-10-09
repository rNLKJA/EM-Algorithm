import { describe, expect, it } from "vitest";
import { fit } from "./em";
import { generateMixture, threeBumpsDataset } from "./datasets";
import { kmeansPlusPlusInit, manualInit, notebookRandomInit } from "./init";
import { accuracyAsWritten, accuracyMatched, alignParams, matchByMean } from "./labels";
import { notebookRun } from "./notebook-run";
import { restartSeed, runRestarts, sortByMean } from "./restarts";
import { createRng, generateRatings } from "./rng";
import { histogram, linspace, mean, std } from "../stats";
import { pyFixed, pyPercent, sci, signed, smart } from "../format";

describe("seeded RNG", () => {
  it("is deterministic and seed-sensitive", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xs);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(xs);
    xs.forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
    xs.forEach((x) => expect(x).toBeLessThan(1));
  });

  it("draws normals with the right moments", () => {
    const rng = createRng(7);
    const draws = Array.from({ length: 40000 }, () => rng.normal(3, 2));
    expect(mean(draws)).toBeCloseTo(3, 1);
    expect(std(draws)).toBeCloseTo(2, 1);
  });

  it("generates notebook-style data: groups first, then ratings, clipped", () => {
    const { ratings, trueGroups } = generateRatings({
      n: 2000,
      pi1: 0.6,
      mu1: 7.5,
      mu2: 4,
      sigma1: 1.2,
      sigma2: 1.5,
      seed: 1,
      clip: [1, 10],
    });
    expect(ratings).toHaveLength(2000);
    expect(Math.min(...ratings)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...ratings)).toBeLessThanOrEqual(10);
    expect(trueGroups.filter((g) => g === 0).length / 2000).toBeCloseTo(0.6, 1);
  });
});

describe("initialisation", () => {
  it("notebook random init draws mu in [3, 8] and sigma in [0.5, 2] with pi = 0.5", () => {
    for (let s = 0; s < 50; s++) {
      const p = notebookRandomInit(createRng(s));
      expect(p.pi1).toBe(0.5);
      expect(p.mu1).toBeGreaterThanOrEqual(3);
      expect(p.mu2).toBeLessThan(8);
      expect(p.sigma1).toBeGreaterThanOrEqual(0.5);
      expect(p.sigma2).toBeLessThan(2);
    }
  });

  it("k-means++ finds the two obvious clusters", () => {
    const data = [1, 1.2, 0.8, 1.1, 9, 9.2, 8.8, 9.1];
    const { params } = kmeansPlusPlusInit(data, createRng(3));
    expect(params.mu1).toBeCloseTo(1.025, 10);
    expect(params.mu2).toBeCloseTo(9.025, 10);
    expect(params.pi1).toBe(0.5);
    expect(params.sigma1).toBeGreaterThan(0);
  });

  it("manual init fills in the complement of pi", () => {
    expect(manualInit(3, 7, 1, 1, 0.3).pi2).toBeCloseTo(0.7, 14);
  });
});

describe("label matching", () => {
  it("detects the notebook's switch and re-indexes parameters", () => {
    const final = notebookRun.iterations.at(-1)!.params;
    const m = matchByMean(final, notebookRun.trueParams);
    expect(m.swapped).toBe(true);
    const aligned = alignParams(final, m);
    expect(aligned.mu1).toBeCloseTo(7.361, 3);
    expect(aligned.pi1).toBeCloseTo(0.656, 3);
  });

  it("as-written accuracy inverts when the labels did not switch", () => {
    const gamma1 = [0.9, 0.8, 0.1, 0.2];
    const groups = [0, 0, 1, 1];
    expect(accuracyAsWritten(gamma1, groups)).toBe(0);
    expect(accuracyMatched(gamma1, groups, { swapped: false, cost: 0 })).toBe(1);
  });
});

describe("restarts", () => {
  it("are reproducible and every run reaches the single optimum of the notebook data", () => {
    const config = {
      data: notebookRun.ratings,
      count: 12,
      seed: 1,
      maxIterations: 1000,
      tolerance: 1e-6,
      init: "notebook" as const,
      truth: notebookRun.trueParams,
    };
    const a = runRestarts(config);
    const b = runRestarts(config);
    expect(a.runs.map((r) => r.logLikelihood)).toEqual(b.runs.map((r) => r.logLikelihood));
    expect(a.optima).toHaveLength(1);
    expect(a.optima[0].logLikelihood.toFixed(2)).toBe("-415.37");
    expect(a.switchedShare).not.toBeNull();
  });

  it("find two different optima on the three-bump data", () => {
    const ds = threeBumpsDataset();
    const s = runRestarts({
      data: ds.ratings,
      count: 24,
      seed: 1,
      maxIterations: 1000,
      tolerance: 1e-6,
      init: "notebook",
    });
    const real = s.optima.filter((o) => !o.degenerate);
    expect(real.length).toBeGreaterThanOrEqual(2);
    expect(real[0].logLikelihood).toBeGreaterThan(real[1].logLikelihood);
  });

  it("restart seeds differ and sortByMean orders components", () => {
    expect(new Set([0, 1, 2, 3].map((i) => restartSeed(9, i))).size).toBe(4);
    const p = sortByMean({ pi1: 0.2, pi2: 0.8, mu1: 8, mu2: 3, sigma1: 1, sigma2: 2 });
    expect(p).toEqual({ pi1: 0.8, pi2: 0.2, mu1: 3, mu2: 8, sigma1: 2, sigma2: 1 });
  });

  it("generateMixture respects weights", () => {
    const { groups } = generateMixture(
      [
        { weight: 1, mu: 0, sigma: 1 },
        { weight: 3, mu: 5, sigma: 1 },
      ],
      8000,
      5,
      null,
    );
    expect(groups.filter((g) => g === 1).length / 8000).toBeCloseTo(0.75, 1);
  });

  it("fit handles a manual start on generated data", () => {
    const { ratings } = generateRatings({
      n: 300,
      pi1: 0.5,
      mu1: 3,
      mu2: 8,
      sigma1: 0.8,
      sigma2: 0.8,
      seed: 4,
      clip: null,
    });
    const result = fit(ratings, manualInit(2, 9, 1, 1), { maxIterations: 200, tolerance: 1e-8 });
    const p = result.iterations.at(-1)!.params;
    expect(p.mu1).toBeCloseTo(3, 0);
    expect(p.mu2).toBeCloseTo(8, 0);
  });
});

describe("stats and formatting", () => {
  it("histogram densities integrate to one", () => {
    const bins = histogram([1, 2, 2, 3, 10], 1, 10, 9);
    const area = bins.reduce((s, b) => s + b.density * (b.x1 - b.x0), 0);
    expect(area).toBeCloseTo(1, 12);
    expect(bins.at(-1)!.count).toBe(1); // right edge inclusive
    expect(linspace(0, 1, 5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("formats like Python and reads tiny numbers", () => {
    expect(pyFixed(Number.NaN, 3)).toBe("nan");
    expect(pyFixed(-425.495, 2)).toBe("-425.50");
    expect(pyPercent(0.905)).toBe("90.5%");
    // exact binary ties round half to even, like Python (toFixed rounds them up)
    expect(pyFixed(0.125, 2)).toBe("0.12");
    expect(pyFixed(-0.125, 2)).toBe("-0.12");
    expect(pyFixed(0.375, 2)).toBe("0.38");
    expect(pyFixed(2.5, 0)).toBe("2");
    expect(pyFixed(3.5, 0)).toBe("4");
    expect(pyFixed(-0.5, 0)).toBe("-0");
    expect(pyFixed(0.0625, 3)).toBe("0.062");
    expect(pyFixed(1.005, 2)).toBe("1.00"); // 1.005 is stored as 1.00499..., not a tie
    expect(pyPercent(361 / 400)).toBe("90.2%");
    expect(pyPercent(0.00125)).toBe("0.1%");
    expect(sci(4.2376e-27)).toBe("4.24 × 10⁻²⁷");
    expect(smart(0.00001234)).toBe("1.23 × 10⁻⁵");
    expect(smart(0.4839414)).toBe("0.4839");
    expect(signed(8.9845)).toBe("+8.98");
    expect(signed(-0.5)).toBe("−0.50");
    // the UI spells non-finite values like JavaScript; only pyFixed uses Python's "nan"
    expect(smart(Number.NaN)).toBe("NaN");
    expect(sci(Number.NaN)).toBe("NaN");
    expect(signed(-Infinity)).toBe("−∞");
  });
});
