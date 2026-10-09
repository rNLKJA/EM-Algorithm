import { describe, expect, it } from "vitest";
import fixtures from "../__fixtures__/parity.json";
import { CORRECTIONS } from "./corrections";
import { betaPdf, logGamma } from "./gaussian";

const byId = Object.fromEntries(CORRECTIONS.map((c) => [c.id, c]));

describe("corrections to the explainer's hand-worked numbers", () => {
  it("pins every exact value", () => {
    expect(byId["readme-f-2"].exact).toBeCloseTo(0.483941449, 9);
    expect(byId["readme-f-3"].exact).toBe(byId["readme-f-2"].exact);
    expect(byId["readme-cross-3"].exact).toBeCloseTo(fixtures.readmeExample.densities.f2[1], 30);
    expect(byId["readme-cross-2"].exact).toBeLessThan(1e-26);
    expect(byId["estep-scifi"].exact).toBeCloseTo(0.4102, 4);
    expect(byId["estep-romance"].exact).toBeCloseTo(0.0829, 4);
    expect(byId["estep-gamma"].exact).toBeCloseTo(0.881, 3);
    expect(byId["beta-0.2"].exact).toBeCloseTo(0.96, 12);
    expect(byId["beta-normal-0.2"].exact).toBeCloseTo(3.631e-11, 13);
  });

  it("only lists genuine discrepancies (more than 1% off)", () => {
    for (const c of CORRECTIONS) {
      expect(Math.abs(c.asWritten - c.exact) / Math.abs(c.exact)).toBeGreaterThan(0.01);
    }
  });

  it("log-gamma and the beta density are accurate", () => {
    expect(Math.exp(logGamma(5))).toBeCloseTo(24, 10);
    expect(Math.exp(logGamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 12);
    expect(betaPdf(0.5, 2, 2)).toBeCloseTo(1.5, 12);
    expect(betaPdf(7.5, 2, 2)).toBe(0); // bounded on [0, 1], as the explainer says
  });
});
