import { describe, expect, it } from "vitest";
import { RERUN_RELATIVE_TOLERANCE, sameNumbers } from "./compare";

describe("re-run comparison", () => {
  it("accepts the last-digit differences between JavaScript engines", () => {
    // measured in Chrome 155 against Node 26: a Wald interval's median width
    const published = { wald: { hits: 431, medianWidth: 0.3517861641 } };
    const chrome = { wald: { hits: 431, medianWidth: 0.35178615331 } };
    expect(Math.abs(0.35178615331 / 0.3517861641 - 1)).toBeGreaterThan(1e-8);
    expect(sameNumbers(chrome, published)).toBe(true);
    expect(sameNumbers(1 + 3e-7, 1)).toBe(true);
  });

  it("still catches real differences", () => {
    expect(sameNumbers(0.3518, 0.3517)).toBe(false);
    expect(sameNumbers(1 + 10 * RERUN_RELATIVE_TOLERANCE, 1)).toBe(false);
    // counts must match exactly, however large
    expect(sameNumbers({ hits: 432 }, { hits: 431 })).toBe(false);
    expect(sameNumbers([1, 2, 3], [1, 2])).toBe(false);
    expect(sameNumbers({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameNumbers("x", "x")).toBe(true);
    expect(sameNumbers(Number.NaN, Number.NaN)).toBe(true);
  });
});
