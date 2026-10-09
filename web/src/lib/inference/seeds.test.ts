import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeedsTable } from "@/components/inference/seeds-table";
import { pairedCoverageDifferences } from "./paired-coverage";
import { inference } from "./results";
import { seedList, seedRows } from "./seeds";
import { INFERENCE_SETTINGS } from "./settings";

/** every value stored under a `seed` key, at any depth */
function seedsIn(value: unknown, out: number[] = []): number[] {
  if (Array.isArray(value)) value.forEach((v) => seedsIn(v, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      if (k === "seed" && typeof v === "number") out.push(v);
      else seedsIn(v, out);
    }
  return out;
}

const rows = seedRows(inference);
const listed = new Set(rows.flatMap((r) => r.seeds));

describe("seeds and sizes on /inference", () => {
  it("lists every seed in INFERENCE_SETTINGS", () => {
    const seeds = seedsIn(INFERENCE_SETTINGS);
    expect(seeds.length).toBeGreaterThanOrEqual(7);
    for (const s of seeds) expect(listed, `seed ${s}`).toContain(s);
  });

  it("lists every paired-bootstrap seed behind a paired interval", () => {
    const paired = [
      ...pairedCoverageDifferences(inference.bootstrapCoverage).map((d) => d?.seed),
      inference.initComparison.iterations.difference.seed,
      inference.initComparison.reachedBest.difference.seed,
    ].filter((s): s is number => s !== undefined);
    expect(paired).toEqual([100, 101, 102, 103, 104, 31, 32]);
    for (const s of paired) expect(listed, `seed ${s}`).toContain(s);
  });

  it("lists the published artefact's seeds, not just the settings", () => {
    const published = seedsIn({
      bootstrap: inference.bootstrap,
      coverage: inference.coverage,
      bootstrapCoverage: { seed: inference.bootstrapCoverage.seed },
      modelChoice: inference.modelChoice,
      selection: inference.selection,
      lrt: inference.lrt.options,
      convergence: inference.convergence.options,
      initComparison: inference.initComparison.options,
    });
    for (const s of published) expect(listed, `seed ${s}`).toContain(s);
  });

  it("renders every seed in the table", () => {
    const html = renderToStaticMarkup(createElement(SeedsTable, { rows }));
    for (const r of rows) expect(html).toContain(`>${seedList(r.seeds)}<`);
    expect(html).toContain(">100 to 104<");
    expect(html).toContain(">31 and 32<");
  });

  it("formats seed lists", () => {
    expect(seedList([42])).toBe("42");
    expect(seedList([1, 1])).toBe("1");
    expect(seedList([32, 31])).toBe("31 and 32");
    expect(seedList([104, 100, 101, 102, 103])).toBe("100 to 104");
    expect(seedList([3, 7, 12])).toBe("3, 7 and 12");
  });
});
