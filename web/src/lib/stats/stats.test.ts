import { describe, expect, it } from "vitest";
import {
  aic,
  bic,
  chiSquareCdf,
  chiSquareQuantile,
  contains,
  invertMatrix,
  isPositiveDefinite,
  median,
  mixtureParameterCount,
  normalCdf,
  normalQuantile,
  numericalHessian,
  pairedMeanDifference,
  percentileInterval,
  quantile,
  sampleSd,
  waldInterval,
  wilsonInterval,
  zCritical,
} from ".";

describe("descriptive", () => {
  it("quantile interpolates between order statistics (type 7)", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
    expect(quantile([10, 0], 0.25)).toBe(2.5);
    expect(median([5, 1, 3])).toBe(3);
    expect(quantile([], 0.5)).toBeNaN();
    expect(quantile([1, 2], 1.5)).toBeNaN();
  });

  it("sampleSd uses n - 1", () => {
    expect(sampleSd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.13809, 5);
    expect(sampleSd([1])).toBeNaN();
  });
});

describe("Wilson interval", () => {
  it("brackets the estimate and stays in [0, 1]", () => {
    const w = wilsonInterval(181, 200);
    expect(w.estimate).toBe(0.905);
    expect(w.lower).toBeLessThan(0.905);
    expect(w.upper).toBeGreaterThan(0.905);
    expect(wilsonInterval(0, 10).lower).toBe(0);
    expect(wilsonInterval(10, 10).upper).toBe(1);
  });

  it("is narrower with more data and wider at higher confidence", () => {
    const small = wilsonInterval(5, 10);
    const big = wilsonInterval(500, 1000);
    expect(big.upper - big.lower).toBeLessThan(small.upper - small.lower);
    const w90 = wilsonInterval(30, 100, 0.9);
    const w99 = wilsonInterval(30, 100, 0.99);
    expect(w99.upper - w99.lower).toBeGreaterThan(w90.upper - w90.lower);
  });

  it("returns the uninformative [0, 1] for n = 0", () => {
    const w = wilsonInterval(0, 0);
    expect(w.lower).toBe(0);
    expect(w.upper).toBe(1);
    expect(w.estimate).toBeNaN();
  });
});

describe("percentile and Wald intervals", () => {
  it("percentile interval uses the 2.5% and 97.5% quantiles and ignores NaN", () => {
    const values = Array.from({ length: 101 }, (_, i) => i);
    const ci = percentileInterval([...values, Number.NaN]);
    expect(ci.lower).toBeCloseTo(2.5, 10);
    expect(ci.upper).toBeCloseTo(97.5, 10);
    expect(contains(ci, 50)).toBe(true);
    expect(contains(ci, 1)).toBe(false);
  });

  it("Wald interval is estimate ± 1.96 se", () => {
    const ci = waldInterval(10, 2);
    expect(ci.lower).toBeCloseTo(10 - 1.959963984540054 * 2, 12);
    expect(ci.upper).toBeCloseTo(10 + 1.959963984540054 * 2, 12);
    expect(zCritical(0.9)).toBeCloseTo(1.6448536269514722, 12);
  });
});

describe("distributions", () => {
  it("normal quantile inverts the CDF", () => {
    for (const p of [1e-12, 0.001, 0.2, 0.5, 0.77, 0.999999]) {
      expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 13);
    }
    expect(normalQuantile(0)).toBe(-Infinity);
    expect(normalQuantile(1)).toBe(Infinity);
    expect(normalQuantile(2)).toBeNaN();
  });

  it("chi-square quantile inverts the CDF", () => {
    for (const df of [1, 3, 7]) {
      const q = chiSquareQuantile(0.95, df);
      expect(chiSquareCdf(q, df)).toBeCloseTo(0.95, 10);
    }
  });
});

describe("numerical Hessian and matrices", () => {
  it("recovers the Hessian of a quadratic", () => {
    // f = -(2x² + 3xy + 5y²) has Hessian [[-4, -3], [-3, -10]]
    const H = numericalHessian(([x, y]) => -(2 * x * x + 3 * x * y + 5 * y * y), [0.7, -1.3]);
    expect(H[0][0]).toBeCloseTo(-4, 6);
    expect(H[0][1]).toBeCloseTo(-3, 6);
    expect(H[1][0]).toBeCloseTo(-3, 6);
    expect(H[1][1]).toBeCloseTo(-10, 6);
  });

  it("gives the textbook information for a normal sample", () => {
    // ℓ(μ, σ) for n points at the MLE: I = diag(n / σ², 2n / σ²)
    const x = [4.1, 5.3, 6.2, 3.8, 5.9, 4.7, 6.6, 5.0];
    const n = x.length;
    const mu = x.reduce((a, b) => a + b, 0) / n;
    const sigma = Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / n);
    const ll = ([m, s]: number[]) =>
      x.reduce(
        (acc, v) => acc - Math.log(s) - 0.5 * Math.log(2 * Math.PI) - (v - m) ** 2 / (2 * s * s),
        0,
      );
    const H = numericalHessian(ll, [mu, sigma]);
    expect(-H[0][0]).toBeCloseTo(n / sigma ** 2, 5);
    expect(-H[1][1]).toBeCloseTo((2 * n) / sigma ** 2, 5);
    expect(Math.abs(H[0][1])).toBeLessThan(1e-5);
  });

  it("inverts a matrix and detects singular and indefinite ones", () => {
    const A = [
      [4, 1, 0],
      [1, 3, 1],
      [0, 1, 2],
    ];
    const inv = invertMatrix(A)!;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const v = A[i].reduce((s, a, k) => s + a * inv[k][j], 0);
        expect(v).toBeCloseTo(i === j ? 1 : 0, 12);
      }
    expect(isPositiveDefinite(A)).toBe(true);
    expect(
      invertMatrix([
        [1, 2],
        [2, 4],
      ]),
    ).toBeNull();
    expect(
      isPositiveDefinite([
        [1, 2],
        [2, 1],
      ]),
    ).toBe(false);
  });
});

describe("information criteria", () => {
  it("AIC and BIC", () => {
    expect(mixtureParameterCount(1)).toBe(2);
    expect(mixtureParameterCount(2)).toBe(5);
    expect(aic(-100, 5)).toBe(210);
    expect(bic(-100, 5, 200)).toBeCloseTo(200 + 5 * Math.log(200), 12);
  });
});

describe("paired mean difference", () => {
  it("is deterministic for a seed and counts the direction of each pair", () => {
    const a = [10, 12, 9, 14, 11, 13];
    const b = [8, 12, 7, 10, 12, 9];
    const d1 = pairedMeanDifference(a, b, { seed: 5, B: 500 });
    const d2 = pairedMeanDifference(a, b, { seed: 5, B: 500 });
    expect(d1).toEqual(d2);
    expect(d1.estimate).toBeCloseTo(11 / 6, 12);
    expect(d1.aHigher).toBe(4);
    expect(d1.ties).toBe(1);
    expect(d1.aLower).toBe(1);
    expect(d1.interval.lower).toBeLessThanOrEqual(d1.estimate);
    expect(d1.interval.upper).toBeGreaterThanOrEqual(d1.estimate);
  });

  it("collapses to a point when every difference is the same", () => {
    const d = pairedMeanDifference([3, 4, 5], [1, 2, 3]);
    expect(d.interval.lower).toBe(2);
    expect(d.interval.upper).toBe(2);
  });

  it("rejects unequal lengths", () => {
    expect(() => pairedMeanDifference([1], [1, 2])).toThrow();
  });
});
