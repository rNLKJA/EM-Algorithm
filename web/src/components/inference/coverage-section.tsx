"use client";

import { useMemo } from "react";
import { ScrollX } from "@/components/common/scroll-x";
import type { WaldCoverage } from "@/lib/inference/tasks";
import type { CoverageResult, PairedCoverage } from "@/lib/inference/uncertainty";
import { pairedMeanDifference } from "@/lib/stats/paired";
import { CoveragePlot, SeriesKey, type CoverageSeries } from "./coverage-plot";
import { count, fmt, pct, THETA_ROWS } from "./format";
import { RerunBar } from "./rerun-bar";
import { useRerun } from "./use-rerun";

/** Bootstrap minus Wald coverage on the same data sets, with a paired bootstrap interval. */
function pairedDifference(t: PairedCoverage, seed: number) {
  const wald: number[] = [];
  const boot: number[] = [];
  const push = (w: number, b: number, k: number) => {
    for (let i = 0; i < k; i++) {
      wald.push(w);
      boot.push(b);
    }
  };
  push(1, 1, t.both);
  push(1, 0, t.waldOnly);
  push(0, 1, t.bootOnly);
  push(0, 0, t.neither);
  return pairedMeanDifference(boot, wald, { seed, B: 4000 });
}

export function CoverageSection({
  published,
  bootstrapCoverage,
}: {
  published: WaldCoverage;
  bootstrapCoverage: CoverageResult;
}) {
  const rerun = useRerun("coverage", published.model.S, published, published.model.seed);
  const { model, clipped } = rerun.result;
  const bc = bootstrapCoverage;
  const paired = useMemo(
    () => bc.params.map((p, j) => (p.paired ? pairedDifference(p.paired, 100 + j) : null)),
    [bc],
  );

  const series: CoverageSeries[] = [
    {
      id: "wald",
      label: `Wald, model exactly (S = ${count(model.S)})`,
      colour: "var(--comp-2)",
      shape: "circle",
      values: model.params.map((p) => p.wald.coverage),
    },
    {
      id: "wald-clipped",
      label: `Wald, clipped like the notebook (S = ${count(clipped.S)})`,
      colour: "var(--chart-3)",
      shape: "diamond",
      values: clipped.params.map((p) => p.wald.coverage),
    },
    {
      id: "boot",
      label: `Percentile bootstrap, model exactly (S = ${count(bc.S)}, B = ${bc.bootstrapB})`,
      colour: "var(--comp-1)",
      shape: "square",
      values: bc.params.map((p) => p.bootstrap!.coverage),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="sheet space-y-3 p-4 sm:p-5">
        <SeriesKey series={series} />
        <CoveragePlot
          rows={THETA_ROWS.map((r) => r.symbol)}
          series={series}
          ariaLabel={`Coverage of nominal 95% intervals for each parameter. ${series
            .map(
              (s) =>
                `${s.label}: ${s.values.map((v, j) => `${THETA_ROWS[j].symbol} ${pct(v.estimate)}`).join(", ")}`,
            )
            .join(". ")}.`}
        />
        <p className="text-xs text-muted-foreground">
          Each mark is the share of intervals that contained the true value; the whiskers are Wilson
          95% intervals for that share.
        </p>
      </div>

      <ScrollX label="Coverage table" className="sheet p-1">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">
            Coverage counts, rates with Wilson intervals and median interval widths
          </caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2.5 font-normal">
                parameter
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                Wald, model
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                Wald, clipped
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                Wald, same {bc.S}
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                bootstrap, same {bc.S}
              </th>
              <th scope="col" className="px-3 py-2.5 font-normal">
                bootstrap − Wald (paired)
              </th>
            </tr>
          </thead>
          <tbody className="num">
            {THETA_ROWS.map((row, j) => {
              const cells = [
                model.params[j].wald,
                clipped.params[j].wald,
                bc.params[j].wald,
                bc.params[j].bootstrap!,
              ];
              const d = paired[j];
              return (
                <tr key={row.key} className="border-t align-top">
                  <th scope="row" className="px-3 py-2.5 text-left font-sans font-medium">
                    {row.symbol}
                  </th>
                  {cells.map((c, i) => (
                    <td key={i} className="px-2 py-2.5">
                      {c.hits}/{c.n} = {pct(c.coverage.estimate)}
                      <span className="block text-[0.72rem] text-muted-foreground">
                        {pct(c.coverage.lower)} to {pct(c.coverage.upper)} · width{" "}
                        {fmt(c.medianWidth, row.digits)}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    {d ? (
                      <>
                        {d.estimate >= 0 ? "+" : "−"}
                        {(100 * Math.abs(d.estimate)).toFixed(1)} pts
                        <span className="block text-[0.72rem] text-muted-foreground">
                          {(100 * d.interval.lower).toFixed(1)} to{" "}
                          {(100 * d.interval.upper).toFixed(1)} · {bc.params[j].paired!.bootOnly} vs{" "}
                          {bc.params[j].paired!.waldOnly} discordant
                        </span>
                      </>
                    ) : (
                      "n/a"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollX>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Widths are medians in the parameter&apos;s units. The paired column compares the two kinds
        of interval on the same {bc.S} data sets: the difference in coverage in percentage points, a
        95% bootstrap interval from resampling data sets, and the discordant pairs (only the
        bootstrap interval covered, against only the Wald interval). Failed fits: {model.failed}{" "}
        (model), {clipped.failed} (clipped), {bc.failed} (bootstrap study); fits without a
        positive-definite information matrix:{" "}
        {model.notPositiveDefinite + clipped.notPositiveDefinite + bc.notPositiveDefinite}; variance
        floor binding: {model.floorBinding + clipped.floorBinding + bc.floorBinding}.
      </p>

      <RerunBar
        what={`S = ${count(model.S)} data sets in each scenario (Wald intervals; the bootstrap study is too slow for a browser)`}
        seed={rerun.seed}
        publishedSeed={published.model.seed}
        published={rerun.published}
        running={rerun.running}
        seconds={rerun.seconds}
        reproduced={rerun.reproduced}
        error={rerun.error}
        onRun={rerun.run}
        onReset={rerun.reset}
      />
    </div>
  );
}
