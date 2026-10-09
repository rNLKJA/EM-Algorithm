/**
 * The statistics helpers against values computed independently with SciPy,
 * statsmodels and numdifftools (scripts/stats_reference.py) and with R's
 * prop.test, qchisq, qnorm and numDeriv (scripts/stats_reference.R).
 */
import { describe, expect, it } from "vitest";
import { notebookRun } from "../em/notebook-run";
import { observedInformation, fitToConvergence, toTheta } from "../inference/uncertainty";
import ref from "./__fixtures__/reference.json";
import refR from "./__fixtures__/reference-r.json";
import {
  chiSquareCdf,
  chiSquarePdf,
  chiSquareQuantile,
  chiSquareSf,
  normalCdf,
  normalQuantile,
  quantile,
  regularizedGammaP,
  wilsonInterval,
} from ".";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);

describe("against SciPy", () => {
  it("normal CDF and quantile", () => {
    for (const [z, p] of ref.normal.cdf) expect(rel(normalCdf(z), p)).toBeLessThan(1e-12);
    for (const [p, z] of ref.normal.ppf)
      expect(Math.abs(normalQuantile(p) - z)).toBeLessThan(1e-11);
  });

  it("chi-square CDF, survival, density and 95% points", () => {
    for (const [x, k, v] of ref.chi2.cdf)
      expect(Math.abs(chiSquareCdf(x, k) - v)).toBeLessThan(1e-13);
    for (const [x, k, v] of ref.chi2.sf) expect(rel(chiSquareSf(x, k), v)).toBeLessThan(1e-11);
    for (const [x, k, v] of ref.chi2.pdf) expect(rel(chiSquarePdf(x, k), v)).toBeLessThan(1e-12);
    for (const [k, q] of ref.chi2.ppf95)
      expect(Math.abs(chiSquareQuantile(0.95, k) - q)).toBeLessThan(1e-9);
  });

  it("regularised incomplete gamma", () => {
    for (const [a, x, v] of ref.gammainc)
      expect(rel(regularizedGammaP(a, x), v)).toBeLessThan(1e-12);
  });

  it("Wilson intervals (statsmodels)", () => {
    for (const [k, n, level, lo, hi] of ref.wilson) {
      const w = wilsonInterval(k, n, level);
      expect(Math.abs(w.lower - lo)).toBeLessThan(1e-12);
      expect(Math.abs(w.upper - hi)).toBeLessThan(1e-12);
    }
  });

  it("type-7 quantiles (numpy.quantile)", () => {
    for (const [p, q] of ref.quantile7.points)
      expect(quantile(ref.quantile7.data, p)).toBeCloseTo(q, 12);
  });

  it("mixture MLE and observed-information standard errors (numdifftools)", () => {
    const fit = fitToConvergence(notebookRun.ratings, notebookRun.init);
    const theta = toTheta(fit.params);
    theta.forEach((v, i) => expect(Math.abs(v - ref.mixture.theta[i])).toBeLessThan(1e-5));
    expect(fit.logLikelihood).toBeCloseTo(ref.mixture.logLikelihood, 7);
    // evaluate at the reference MLE so only the Hessian code is being compared
    const info = observedInformation(notebookRun.ratings, {
      pi1: ref.mixture.theta[0],
      pi2: 1 - ref.mixture.theta[0],
      mu1: ref.mixture.theta[1],
      mu2: ref.mixture.theta[2],
      sigma1: ref.mixture.theta[3],
      sigma2: ref.mixture.theta[4],
    });
    expect(info.positiveDefinite).toBe(true);
    info.se!.forEach((s, i) => expect(rel(s, ref.mixture.se[i])).toBeLessThan(1e-5));
    info.hessian.forEach((row, i) =>
      row.forEach((h, j) =>
        expect(Math.abs(h - ref.mixture.hessian[i][j])).toBeLessThan(
          1e-4 * Math.max(1, Math.abs(h)),
        ),
      ),
    );
  });
});

describe("against R", () => {
  it("prop.test Wilson intervals, qchisq and qnorm", () => {
    for (const [k, n, level, lo, hi] of refR.wilson) {
      const w = wilsonInterval(k, n, level);
      expect(Math.abs(w.lower - lo)).toBeLessThan(1e-12);
      expect(Math.abs(w.upper - hi)).toBeLessThan(1e-12);
    }
    for (const [k, q] of refR.qchisq95)
      expect(Math.abs(chiSquareQuantile(0.95, k) - q)).toBeLessThan(1e-9);
    for (const [p, z] of refR.qnorm) expect(Math.abs(normalQuantile(p) - z)).toBeLessThan(1e-12);
  });

  it("numDeriv observed-information standard errors", () => {
    const t = refR.mixture.theta;
    const info = observedInformation(notebookRun.ratings, {
      pi1: t[0],
      pi2: 1 - t[0],
      mu1: t[1],
      mu2: t[2],
      sigma1: t[3],
      sigma2: t[4],
    });
    info.se!.forEach((s, i) => expect(rel(s, refR.mixture.se[i])).toBeLessThan(1e-5));
  });
});
