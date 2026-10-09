import { describe, expect, it } from "vitest";
import { generateRatings } from "@/lib/em/rng";
import { histogram } from "@/lib/stats";
import { formatLinearTicks, formatLogTick, logTicks, ratingAxis, tickDecimals } from "./axes";
import { niceTicks } from "./scale";

describe("ratingAxis", () => {
  it("keeps the 1 to 10 default for ratings on the scale", () => {
    expect(ratingAxis([1, 4.5, 10])).toEqual({ domain: [0.5, 10.5], histRange: [1, 10], bins: 20 });
    expect(ratingAxis([])).toEqual({ domain: [0.5, 10.5], histRange: [1, 10], bins: 20 });
  });

  it("widens to whole units around unclipped ratings, with the same bar width", () => {
    const axis = ratingAxis([-3.2, 5, 12.4]);
    expect(axis.histRange).toEqual([-4, 13]);
    expect(axis.domain).toEqual([-4.5, 13.5]);
    const width = (axis.histRange[1] - axis.histRange[0]) / axis.bins;
    expect(width).toBeCloseTo(0.45, 1);
  });

  it("counts every rating in the histogram once clipping is off", () => {
    // group 1 mean 1 and spread 3: about a quarter of the ratings fall below 1
    const { ratings } = generateRatings({
      n: 200,
      pi1: 0.6,
      mu1: 1,
      mu2: 4,
      sigma1: 3,
      sigma2: 1.5,
      seed: 2025,
      clip: null,
    });
    expect(ratings.some((r) => r < 1)).toBe(true);
    const fixed = histogram(ratings, 1, 10, 20).reduce((s, b) => s + b.count, 0);
    expect(fixed).toBeLessThan(ratings.length);

    const axis = ratingAxis(ratings);
    const bins = histogram(ratings, axis.histRange[0], axis.histRange[1], axis.bins);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(ratings.length);
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(axis.domain[0]);
      expect(r).toBeLessThanOrEqual(axis.domain[1]);
    }
  });
});

describe("tick labels", () => {
  it("takes the decimals from the tick step", () => {
    expect(tickDecimals(0.05)).toBe(2);
    expect(tickDecimals(0.1)).toBe(1);
    expect(tickDecimals(0.2)).toBe(1);
    expect(tickDecimals(0.5)).toBe(1);
    expect(tickDecimals(1)).toBe(0);
    expect(tickDecimals(20)).toBe(0);
  });

  it("labels a 0.05 step without duplicates or rounding errors", () => {
    const ticks = niceTicks(0, 0.2, 4);
    expect(ticks).toEqual([0, 0.05, 0.1, 0.15, 0.2]);
    const labels = formatLinearTicks(ticks);
    expect(labels).toEqual(["0", "0.05", "0.10", "0.15", "0.20"]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("labels log-likelihood ticks as whole numbers with a true minus sign", () => {
    expect(formatLinearTicks([-426, -424, -422])).toEqual(["−426", "−424", "−422"]);
  });
});

describe("log ticks", () => {
  it("uses whole decades when the range spans several", () => {
    const ticks = logTicks(-8.3, 0.1);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.every(Number.isInteger)).toBe(true);
  });

  it("falls back to 1-2-5 ticks inside a single decade (sigma from 0.2 to 0.86)", () => {
    const ticks = logTicks(Math.log10(0.2), Math.log10(0.86));
    expect(ticks.map(formatLogTick)).toEqual(["0.2", "0.5"]);
  });

  it("still labels a very narrow range", () => {
    const ticks = logTicks(Math.log10(0.84), Math.log10(0.88));
    expect(ticks.length).toBeGreaterThanOrEqual(1);
    for (const t of ticks) {
      expect(10 ** t).toBeGreaterThanOrEqual(0.84 - 1e-9);
      expect(10 ** t).toBeLessThanOrEqual(0.88 + 1e-9);
    }
  });

  it("formats plain decimals from 0.001 and powers of ten below", () => {
    expect(formatLogTick(0)).toBe("1");
    expect(formatLogTick(-1)).toBe("0.1");
    expect(formatLogTick(-2)).toBe("0.01");
    expect(formatLogTick(-3)).toBe("0.001");
    expect(formatLogTick(Math.log10(0.5))).toBe("0.5");
    expect(formatLogTick(-8)).toBe("10⁻⁸");
    expect(formatLogTick(Math.log10(2e-4))).toBe("2×10⁻⁴");
  });
});
