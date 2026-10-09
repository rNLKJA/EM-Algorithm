import { describe, expect, it } from "vitest";
import { collapseInit } from "./collapse";
import { diagnoseFit, diagnoseStep } from "./diagnose";
import {
  eStep,
  exactLogLikelihood,
  fit,
  isNonDecreasing,
  isNonDegenerate,
  SIGMA_EPS,
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

  it("a component sitting on the seven ratings clipped to 10 collapses (sigma -> 0)", () => {
    expect(data.filter((x) => x === 10)).toHaveLength(7);
    const result = fit(data, init, { maxIterations: 200, tolerance: 1e-10 });
    expect(result.stopReason).toBe("degenerate");
    const last = result.iterations.at(-1)!;
    expect(last.params.sigma2).toBeLessThan(SIGMA_EPS);
    expect(last.params.mu2).toBeCloseTo(10, 12);
    expect(isNonDegenerate(last.params)).toBe(false);
    // the likelihood climbs while the spike narrows: EM is doing its job on an unbounded objective
    const lls = result.iterations.map((it) => it.logLikelihood).filter(Number.isFinite);
    expect(isNonDecreasing(lls)).toBe(true);
    // already above the best ordinary fit (ℓ = -415.37) before it breaks down
    expect(lls.at(-1)!).toBeGreaterThan(-415);
  });

  it("treats sigma frozen at floating-point residue as collapsed, not converged", () => {
    // From sigma = 0.06 the spike freezes at sigma ~ 1.8e-15, mu = 9.999999999999998:
    // |Δℓ| is then exactly 0, so without the SIGMA_EPS guard fit() reported "converged"
    // at ℓ = -203.35, the unbounded-likelihood spike.
    const result = fit(data, collapseInit(data, 10, 0.06), {
      maxIterations: 300,
      tolerance: 1e-10,
    });
    expect(result.stopReason).toBe("degenerate");
    const last = result.iterations.at(-1)!.params;
    expect(last.sigma2).toBeGreaterThan(0);
    expect(last.sigma2).toBeLessThan(SIGMA_EPS);
  });

  it("every small starting spread on the tens collapses; wider ones escape to a real optimum", () => {
    for (let s = 5; s <= 60; s++) {
      const result = fit(data, collapseInit(data, 10, s / 100), {
        maxIterations: 300,
        tolerance: 1e-10,
      });
      const last = result.iterations.at(-1)!;
      if (result.stopReason === "degenerate") {
        expect(last.params.sigma2 < SIGMA_EPS || !Number.isFinite(last.logLikelihood)).toBe(true);
      } else {
        expect(result.stopReason).toBe("converged");
        expect(last.params.sigma2).toBeGreaterThan(0.1);
      }
      expect(result.stopReason).toBe(s <= 53 ? "degenerate" : "converged");
    }
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

describe("diagnosing a degenerate run", () => {
  it("names a real collapse as a collapse of the spiked component", () => {
    for (let s = 5; s <= 53; s += 8) {
      const result = fit(notebookRun.ratings, collapseInit(notebookRun.ratings, 10, s / 100), {
        maxIterations: 300,
        tolerance: 1e-10,
      });
      const d = diagnoseFit(notebookRun.ratings, result);
      expect(d?.kind).toBe("collapse");
      expect(d?.kind === "collapse" && d.component).toBe(2);
    }
  });

  it("tells density underflow (γ = 0/0) apart from collapse", () => {
    // Playground, Drag start: both means near 1 with σ = 0.1, so rating 10 is ~90σ from both
    const init: MixtureParams = {
      pi1: 0.5,
      pi2: 0.5,
      mu1: 0.75,
      mu2: 1.25,
      sigma1: 0.1,
      sigma2: 0.1,
    };
    const result = fit(notebookRun.ratings, init, { maxIterations: 15, tolerance: 1e-4 });
    expect(result.stopReason).toBe("degenerate");
    expect(result.iterations).toHaveLength(1);
    const d = diagnoseFit(notebookRun.ratings, result);
    expect(d?.kind).toBe("underflow");
    if (d?.kind !== "underflow") return;
    expect(Math.min(...d.z)).toBeGreaterThan(38);
    expect(Number.isNaN(result.finalGamma1[notebookRun.ratings.indexOf(d.x)])).toBe(true);

    // Stepper, "Your own": both means at 10.5, σ = 0.2; rating 2 is 42.5σ from each
    const before: MixtureParams = {
      pi1: 0.5,
      pi2: 0.5,
      mu1: 10.5,
      mu2: 10.5,
      sigma1: 0.2,
      sigma2: 0.2,
    };
    const after = mStep([2, 3, 7, 8], ...gammas([2, 3, 7, 8], before));
    expect(diagnoseStep([2, 3, 7, 8], before, after)).toEqual({
      kind: "underflow",
      x: 2,
      z: [42.5, 42.5],
    });
  });

  it("reports a component that lost every rating as empty", () => {
    const before: MixtureParams = { pi1: 0.5, pi2: 0.5, mu1: 2, mu2: 60, sigma1: 1, sigma2: 0.5 };
    const after = mStep([1, 2, 3], ...gammas([1, 2, 3], before));
    expect(after.pi2).toBe(0);
    expect(diagnoseStep([1, 2, 3], before, after)).toEqual({ kind: "empty", component: 2 });
  });

  it("returns null for healthy fits", () => {
    const result = fit(notebookRun.ratings, notebookRun.init, notebookRun.fit);
    expect(diagnoseFit(notebookRun.ratings, result)).toBeNull();
    expect(diagnoseStep([1, 2, 3], params, params)).toBeNull();
  });
});

function gammas(data: number[], p: MixtureParams): [Float64Array, Float64Array] {
  const e = eStep(data, p);
  return [e.gamma1, e.gamma2];
}

describe("posterior for a new observation", () => {
  it("sums to one", () => {
    const { p1, p2 } = posterior(4.2, params);
    expect(p1 + p2).toBeCloseTo(1, 14);
  });
});
