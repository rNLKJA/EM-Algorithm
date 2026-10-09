/**
 * Parity with the ORIGINAL notebook. The expected values were produced by
 * scripts/export_parity.py, which executes the notebook's code cells verbatim
 * (and checks their printed output against the notebook) before exporting.
 */
import { describe, expect, it } from "vitest";
import fixtures from "../__fixtures__/parity.json";
import { fit, posterior } from "./em";
import { accuracyAsWritten, accuracyMatched, matchByMean } from "./labels";
import { finalResultsConsole, fitConsole } from "./notebook-console";
import { notebookRun } from "./notebook-run";
import { PARAM_KEYS, type MixtureParams } from "./types";

const TOL = 1e-6;

interface FixtureRun {
  seed: number;
  maxIterations: number;
  tolerance: number;
  ratings: number[];
  trueGroups: number[];
  init: MixtureParams;
  iterations: {
    gammaMean1: number;
    gammaMean2: number;
    params: MixtureParams;
    logLikelihood: number;
  }[];
  finalGamma1: number[];
  accuracyAsWritten: number;
  accuracyMatched: number;
  labelsSwapped: boolean;
}

function expectClose(actual: number, expected: number, tol = TOL) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(expected)));
}

function expectTraceMatches(run: FixtureRun) {
  const result = fit(run.ratings, run.init, {
    maxIterations: run.maxIterations,
    tolerance: run.tolerance,
  });
  expect(result.iterations).toHaveLength(run.iterations.length);
  result.iterations.forEach((it, i) => {
    const expected = run.iterations[i];
    expectClose(it.logLikelihood, expected.logLikelihood);
    expectClose(it.gammaMean1, expected.gammaMean1);
    expectClose(it.gammaMean2, expected.gammaMean2);
    for (const k of PARAM_KEYS) expectClose(it.params[k], expected.params[k]);
  });
  result.finalGamma1.forEach((g, i) => expectClose(g, run.finalGamma1[i]));
  return result;
}

describe("notebook run (seed 42, fit(max_iterations=15, tolerance=1e-4))", () => {
  const run = notebookRun;
  const result = fit(run.ratings, run.init, run.fit);

  it("exports the data the notebook printed", () => {
    expect(run.n).toBe(200);
    expect(run.ratings).toHaveLength(200);
    expect(run.summary.ratingMin.toFixed(1)).toBe("1.2");
    expect(run.summary.ratingMax.toFixed(1)).toBe("10.0");
    expect(run.summary.ratingMean.toFixed(2)).toBe("6.21");
    expect(run.provenance.stdoutMatchesNotebook).toBe(true);
  });

  it("matches every iteration of the exported trace to 1e-6", () => {
    expect(result.iterations).toHaveLength(15);
    expect(result.stopReason).toBe("max-iterations");
    result.iterations.forEach((it, i) => {
      const expected = run.iterations[i];
      expectClose(it.logLikelihood, expected.logLikelihood);
      for (const k of PARAM_KEYS) expectClose(it.params[k], expected.params[k]);
    });
    result.finalGamma1.forEach((g, i) => expectClose(g, run.finalGamma1[i]));
  });

  it("reproduces the headline numbers: LL -425.50 -> -416.51, improvement 8.98", () => {
    const lls = result.iterations.map((it) => it.logLikelihood);
    expect(lls[0].toFixed(2)).toBe("-425.50");
    expect(lls.at(-1)!.toFixed(2)).toBe("-416.51");
    expect((lls.at(-1)! - lls[0]).toFixed(2)).toBe("8.98");
  });

  it("prints exactly what the notebook printed (fit() log + FINAL RESULTS)", () => {
    const text =
      fitConsole(result, run.n) +
      finalResultsConsole(result.iterations.at(-1)!.params, run.trueParams);
    expect(text).toBe(run.printed.fitCell);
  });

  it("gets 90.5% accuracy as written, and the same after matching labels by mean", () => {
    expect(accuracyAsWritten(result.finalGamma1, run.trueGroups)).toBeCloseTo(0.905, 12);
    const matching = matchByMean(result.iterations.at(-1)!.params, run.trueParams);
    expect(matching.swapped).toBe(true);
    expect(accuracyMatched(result.finalGamma1, run.trueGroups, matching)).toBeCloseTo(0.905, 12);
    expect(run.summary.labelsSwapped).toBe(true);
  });

  it("reproduces the label-switched 'classify a new user' cell", () => {
    const { p1, p2 } = posterior(8.5, result.iterations.at(-1)!.params);
    expectClose(p1, run.newUser.probGroup1);
    expectClose(p2, run.newUser.probGroup2);
    expect(p1.toFixed(3)).toBe("0.001");
    expect(run.printed.newUserCell).toContain("ROMANCE LOVER");
  });
});

describe("the same notebook code under other seeds", () => {
  for (const run of fixtures.seeds as FixtureRun[]) {
    it(`seed ${run.seed}: trace, responsibilities and accuracies match`, () => {
      const result = expectTraceMatches(run);
      const final = result.iterations.at(-1)!.params;
      expect(accuracyAsWritten(result.finalGamma1, run.trueGroups)).toBeCloseTo(
        run.accuracyAsWritten,
        12,
      );
      const matching = matchByMean(final, { mu1: 7.5, mu2: 4.0 });
      expect(matching.swapped).toBe(run.labelsSwapped);
      expect(accuracyMatched(result.finalGamma1, run.trueGroups, matching)).toBeCloseTo(
        run.accuracyMatched,
        12,
      );
    });
  }
});

describe("longer runs exercise the convergence test", () => {
  it("seed 42 with max_iterations=500 converges after the same 90 iterations", () => {
    const run = fixtures.longRun as FixtureRun;
    const result = expectTraceMatches(run);
    expect(result.stopReason).toBe("converged");
    expect(result.iterations).toHaveLength(90);
    expect(result.iterations.at(-1)!.logLikelihood.toFixed(2)).toBe("-415.37");
  });

  it("seed 3 with tolerance=1e-8 runs to the 300-iteration cap", () => {
    const run = fixtures.tightRun as FixtureRun;
    expectTraceMatches(run);
  });
});
