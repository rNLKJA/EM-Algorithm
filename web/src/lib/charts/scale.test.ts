import { describe, expect, it } from "vitest";
import { areaPath, linePath, linearScale, mixHex, niceTicks } from "./scale";

describe("chart scales", () => {
  it("maps and inverts", () => {
    const s = linearScale([0, 10], [0, 200]);
    expect(s(5)).toBe(100);
    expect(s.invert(50)).toBe(2.5);
  });
  it("makes nice ticks", () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(-426, -416, 5)).toEqual([-426, -424, -422, -420, -418, -416]);
  });
  it("closes areas to the baseline, and skips an empty line (sigma = 0 gives all NaN)", () => {
    const line = linePath([
      [0, 5],
      [10, 2],
    ]);
    expect(areaPath(line, 0, 10, 20)).toBe("M0.00,5.00L10.00,2.00L10.00,20.00L0.00,20.00Z");
    const empty = linePath([
      [0, Number.NaN],
      [10, Number.NaN],
    ]);
    expect(empty).toBe("");
    expect(areaPath(empty, 0, 10, 20)).toBe("");
  });
  it("breaks lines at non-finite points", () => {
    expect(
      linePath([
        [0, 0],
        [1, Number.NaN],
        [2, 2],
      ]),
    ).toBe("M0.00,0.00M2.00,2.00");
  });
  it("mixes colours", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
