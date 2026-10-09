import { describe, expect, it } from "vitest";
import { linePath, linearScale, mixHex, niceTicks } from "./scale";

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
