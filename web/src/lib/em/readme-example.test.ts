import { describe, expect, it } from "vitest";
import fixtures from "../__fixtures__/parity.json";
import { normalPdf } from "./gaussian";
import { README_AS_WRITTEN, README_INIT, README_RATINGS, buildStages } from "./readme-example";

const example = fixtures.readmeExample;

describe("the explainer's 4-rating example", () => {
  it("uses the explainer's data and starting guess", () => {
    expect([...README_RATINGS]).toEqual(example.ratings);
    expect(README_INIT).toEqual(example.init);
  });

  it("computes the densities exactly (scipy reference)", () => {
    README_RATINGS.forEach((x, i) => {
      expect(normalPdf(x, 2.5, 0.5)).toBeCloseTo(example.densities.f1[i], 15);
      const rel = Math.abs(normalPdf(x, 7.5, 0.5) - example.densities.f2[i]);
      expect(rel).toBeLessThanOrEqual(1e-12 * example.densities.f2[i]);
    });
  });

  it("documents the correction: 0.8 and 0.6 are both really 0.4839", () => {
    const exact2 = normalPdf(2, 2.5, 0.5);
    const exact3 = normalPdf(3, 2.5, 0.5);
    expect(exact2).toBeCloseTo(0.48394, 5);
    expect(exact3).toBe(exact2); // both one sigma from the mean
    expect(README_AS_WRITTEN.eStep[0].f1).toBe(0.8);
    expect(README_AS_WRITTEN.eStep[1].f1).toBe(0.6);
    // Cross-group densities are ~1e-18 and ~1e-27, not 0.0001.
    expect(normalPdf(3, 7.5, 0.5)).toBeLessThan(1e-17);
    expect(normalPdf(2, 7.5, 0.5)).toBeLessThan(1e-26);
  });

  it("matches the exact E-step and M-step for three iterations", () => {
    const stages = buildStages([...README_RATINGS], README_INIT, 3, 0);
    const mStages = stages.filter((s) => s.kind === "m");
    expect(mStages).toHaveLength(3);
    mStages.forEach((stage, t) => {
      const expected = example.iterations[t];
      stage.e.gamma1.forEach((g, i) => {
        expect(Math.abs(g - expected.gamma1[i])).toBeLessThanOrEqual(1e-12);
      });
      expect(stage.params.mu1).toBeCloseTo(expected.params.mu1, 12);
      expect(stage.params.mu2).toBeCloseTo(expected.params.mu2, 12);
      expect(stage.params.sigma1).toBeCloseTo(expected.params.sigma1, 12);
      expect(stage.params.sigma2).toBeCloseTo(expected.params.sigma2, 12);
      expect(stage.params.pi1).toBeCloseTo(expected.params.pi1, 12);
      expect(stage.logLikelihood).toBeCloseTo(expected.logLikelihood, 10);
    });
  });

  it("agrees with the explainer's conclusion despite the wrong densities", () => {
    const stages = buildStages([...README_RATINGS], README_INIT);
    const firstM = stages.find((s) => s.kind === "m")!;
    expect(firstM.params.mu1).toBeCloseTo(README_AS_WRITTEN.mStep.mu1, 12);
    expect(firstM.params.mu2).toBeCloseTo(README_AS_WRITTEN.mStep.mu2, 12);
    expect(firstM.params.sigma1).toBeCloseTo(README_AS_WRITTEN.mStep.sigma1, 12);
    expect(firstM.params.pi1).toBeCloseTo(README_AS_WRITTEN.mStep.pi1, 12);
    // Already a fixed point: EM stops after the first iteration (+ the check).
    expect(stages.filter((s) => s.kind === "m").length).toBeLessThanOrEqual(2);
  });

  it("the explainer's as-written gammas are internally consistent", () => {
    for (const row of README_AS_WRITTEN.eStep) {
      expect(row.w1 + row.w2).toBeCloseTo(row.total, 10);
      expect(row.gamma1 + row.gamma2).toBeCloseTo(1, 10);
    }
  });

  it("other E-step / Normal+Beta numbers in the explainer, recomputed", () => {
    expect(normalPdf(5, 4.5, 0.8)).toBeCloseTo(example.extraPdf["f_5_4.5_0.8"], 14);
    expect(normalPdf(5, 3.0, 1.2)).toBeCloseTo(example.extraPdf["f_5_3.0_1.2"], 14);
    expect(normalPdf(7.5, 7.0, 1.0)).toBeCloseTo(example.extraPdf["f_7.5_7.0_1.0"], 14);
    const tiny = normalPdf(0.2, 7.0, 1.0);
    expect(Math.abs(tiny - example.extraPdf["f_0.2_7.0_1.0"])).toBeLessThan(1e-20);
  });
});
