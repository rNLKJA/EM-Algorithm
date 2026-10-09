import { describe, expect, it } from "vitest";
import { collapseInit } from "./collapse";
import {
  eStep,
  exactLogLikelihood,
  fit,
  isNonDecreasing,
  logLikelihood,
  mStep,
  paramsAt,
  posterior,
} from "./em";
import { normalPdf } from "./gaussian";
import { notebookRandomInit } from "./init";
import { notebookRun } from "./notebook-run";
import { createRng, generateRatings } from "./rng";
import type { MixtureParams } from "./types";

const params: MixtureParams = { pi1: 0.3, pi2: 0.7, mu1: 2, mu2: 6, sigma1: 1, sigma2: 1.5 };

describe("E-step", () => {
  it("responsibilities are Bayes' rule and sum to one", () => {
    const data = [1, 2.5, 4, 6, 9];
    const e = eStep(data, params);
    data.forEach((x, i) => {
      const a = params.pi1 * normalPdf(x, params.mu1, params.sigma1);
      const b = params.pi2 * normalPdf(x, params.mu2, params.sigma2);
      expect(e.gamma1[i]).toBeCloseTo(a / (a + b), 14);
      expect(e.gamma1[i] + e.gamma2[i]).toBeCloseTo(1, 14);
      expect(e.weighted1[i]).toBeCloseTo(a, 14);
    });
  });
});

describe("M-step", () => {
  it("is a responsibility-weighted mean / std, with sigma using the new mean", () => {
    const data = [1, 2, 3, 10];
    const g1 = [1, 1, 1, 0];
    const g2 = [0, 0, 0, 1];
    const next = mStep(data, g1, g2);
    expect(next.pi1).toBe(0.75);
    expect(next.mu1).toBe(2);
    expect(next.sigma1).toBeCloseTo(Math.sqrt(2 / 3), 14);
    expect(next.mu2).toBe(10);
    expect(next.sigma2).toBe(0);
  });

  it("applies the optional variance floor", () => {
    const next = mStep([1, 2, 3, 10], [1, 1, 1, 0], [0, 0, 0, 1], 0.25);
    expect(next.sigma2).toBe(0.25);
    expect(next.sigma1).toBeCloseTo(Math.sqrt(2 / 3), 14);
  });
});

describe("log-likelihood", () => {
  it("adds the notebook's 1e-10 inside the log", () => {
    const data = [2, 3, 7, 8];
    const diff = logLikelihood(data, params) - exactLogLikelihood(data, params);
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(1e-7);
  });
});

describe("fit", () => {
  it("never decreases the log-likelihood (random data, random starts)", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      const { ratings } = generateRatings({
        n: 50 + rng.int(300),
        pi1: rng.uniform(0.15, 0.85),
        mu1: rng.uniform(2, 9),
        mu2: rng.uniform(2, 9),
        sigma1: rng.uniform(0.4, 2.5),
        sigma2: rng.uniform(0.4, 2.5),
        seed,
        clip: seed % 2 ? [1, 10] : null,
      });
      const result = fit(ratings, notebookRandomInit(rng), {
        maxIterations: 300,
        tolerance: 1e-9,
        varianceFloor: 0.05,
      });
      const lls = result.iterations.map((it) => it.logLikelihood);
      expect(isNonDecreasing(lls)).toBe(true);
    }
  });

  it("stops on the notebook's rule: |improvement| < tolerance, from iteration 2", () => {
    const result = fit(notebookRun.ratings, notebookRun.init, {
      maxIterations: 1000,
      tolerance: 1e-4,
    });
    expect(result.stopReason).toBe("converged");
    const last = result.iterations.at(-1)!;
    expect(Math.abs(last.improvement!)).toBeLessThan(1e-4);
    result.iterations.slice(1, -1).forEach((it) => {
      expect(Math.abs(it.improvement!)).toBeGreaterThanOrEqual(1e-4);
    });
  });

  it("paramsAt maps stages to the init and each iteration", () => {
    const result = fit(notebookRun.ratings, notebookRun.init, notebookRun.fit);
    expect(paramsAt(result, 0)).toEqual(notebookRun.init);
    expect(paramsAt(result, 1)).toEqual(result.iterations[0].params);
    expect(paramsAt(result, 99)).toEqual(result.iterations.at(-1)!.params);
  });
});

describe("variance collapse", () => {
  const data = notebookRun.ratings;
  const init = collapseInit(data, 10, 0.2);

  it("a component sitting on the seven ratings clipped to 10 collapses to sigma = 0", () => {
    expect(data.filter((x) => x === 10)).toHaveLength(7);
    const result = fit(data, init, { maxIterations: 200, tolerance: 1e-10 });
    expect(result.stopReason).toBe("degenerate");
    const sigmas = result.iterations.map((it) => it.params.sigma2);
    expect(sigmas.at(-1)).toBe(0);
    // the likelihood climbs while the spike narrows: EM is doing its job on an unbounded objective
    const lls = result.iterations.slice(0, -1).map((it) => it.logLikelihood);
    expect(isNonDecreasing(lls)).toBe(true);
    expect(Number.isNaN(result.iterations.at(-1)!.logLikelihood)).toBe(true);
  });

  it("a variance floor keeps the run finite but the spike remains", () => {
    const result = fit(data, init, { maxIterations: 500, tolerance: 1e-10, varianceFloor: 0.05 });
    expect(result.stopReason).toBe("converged");
    const final = result.iterations.at(-1)!.params;
    expect(final.sigma2).toBe(0.05);
    expect(final.mu2).toBeCloseTo(10, 3);
    expect(isNonDecreasing(result.iterations.map((it) => it.logLikelihood))).toBe(true);
  });
});

describe("posterior for a new observation", () => {
  it("sums to one", () => {
    const { p1, p2 } = posterior(4.2, params);
    expect(p1 + p2).toBeCloseTo(1, 14);
  });
});
