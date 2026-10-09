"use client";

import { useMemo } from "react";
import { ScrollX } from "@/components/common/scroll-x";
import type { WaldCoverage } from "@/lib/inference/tasks";
import { pairedCoverageDifferences } from "@/lib/inference/paired-coverage";
import { seedList } from "@/lib/inference/seeds";
import type { CoverageResult } from "@/lib/inference/uncertainty";
import { CoveragePlot, SeriesKey, type CoverageSeries } from "./coverage-plot";
import { count, fmt, pct, THETA_ROWS } from "./format";
import { RerunBar } from "./rerun-bar";
import { useRerun } from "./use-rerun";

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
  const paired = useMemo(() => pairedCoverageDifferences(bc), [bc]);
  const pairedSeeds = paired.flatMap((d) => (d ? [d.seed] : []));
  const pairedB = paired.find((d) => d !== null)?.B ?? 0;
  // a browser re-run replaces only the Wald study; the bootstrap study stays the published one
  const ownRun = !rerun.published;
  const waldTag = `seed ${model.seed}${ownRun ? ", your run" : ""}`;
  const bootTag = `seed ${bc.seed}${ownRun ? ", published" : ""}`;

  const series: CoverageSeries[] = [
    {
      id: "wald",
      label: `Wald, model exactly (S = ${count(model.S)}, ${waldTag})`,
      colour: "var(--comp-2)",
      shape: "circle",
      values: model.params.map((p) => p.wald.coverage),
    },
    {
      id: "wald-clipped",
      label: `Wald, clipped like the notebook (S = ${count(clipped.S)}, ${waldTag})`,
      colour: "var(--chart-3)",
      shape: "diamond",
      values: clipped.params.map((p) => p.wald.coverage),
    },
    {
      id: "boot",
      label: `Percentile bootstrap, model exactly (S = ${count(bc.S)}, B = ${bc.bootstrapB}, ${bootTag})`,
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
                <span className="block text-[0.7rem]">{waldTag}</span>
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                Wald, clipped
                <span className="block text-[0.7rem]">{waldTag}</span>
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                Wald, same {bc.S}
                <span className="block text-[0.7rem]">{bootTag}</span>
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                bootstrap, same {bc.S}
                <span className="block text-[0.7rem]">{bootTag}</span>
              </th>
              <th scope="col" className="px-3 py-2.5 font-normal">
                bootstrap − Wald (paired)
                <span className="block text-[0.7rem]">{bootTag}</span>
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
        95% bootstrap interval from resampling data sets (B = {count(pairedB)}, seeds{" "}
        {seedList(pairedSeeds)}, one per parameter), and the discordant pairs (only the bootstrap
        interval covered, against only the Wald interval). Failed fits: {model.failed} (model),{" "}
        {clipped.failed} (clipped), {bc.failed} (bootstrap study); fits without a positive-definite
        information matrix:{" "}
        {model.notPositiveDefinite + clipped.notPositiveDefinite + bc.notPositiveDefinite}; variance
        floor binding: {model.floorBinding + clipped.floorBinding + bc.floorBinding}.
        {ownRun ? (
          <strong className="font-medium text-foreground">
            {" "}
            Only the Wald study was re-run in your browser (seed {model.seed}); the bootstrap study,
            the &ldquo;same {bc.S}&rdquo; columns and the paired column still show the published run
            (seed {bc.seed}), so compare those with each other, not with your run.
          </strong>
        ) : null}
      </p>

      <RerunBar
        label="the coverage study"
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
