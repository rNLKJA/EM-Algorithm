"use client";

import { Ell } from "@/components/common/ell";
import { ScrollX } from "@/components/common/scroll-x";
import type { ConvergenceSummary } from "@/lib/inference/tasks";
import { count, fmt, pct, pctInterval } from "./format";
import { IterationBoxes } from "./iteration-boxes";
import { RerunBar } from "./rerun-bar";
import { useRerun } from "./use-rerun";

const SUP: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};
/** 1e-4 -> "10⁻⁴" */
const TOL_LABEL = (t: number) =>
  `10${String(Math.round(Math.log10(t)))
    .split("")
    .map((c) => SUP[c] ?? c)
    .join("")}`;
const round = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function ConvergenceSection({
  published,
  notebookIterations,
}: {
  published: ConvergenceSummary;
  /** iterations the notebook's own start needs to meet its 1e-4 tolerance */
  notebookIterations: number;
}) {
  const rerun = useRerun(
    "convergence",
    published.options.starts,
    published,
    published.options.seed,
  );
  const c = rerun.result;
  const optima = c.optima.filter((o) => !o.degenerate);
  const best = optima[0];

  return (
    <div className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="sheet p-4">
          <dt className="text-sm text-muted-foreground">log-likelihood never decreased</dt>
          <dd className="num mt-1 text-2xl font-medium">
            {c.monotoneRuns}/{c.runs.length}
          </dd>
          <dd className="mt-1 text-xs text-muted-foreground">
            runs; largest single drop{" "}
            {c.worstDecrease === 0 ? "0" : c.worstDecrease.toExponential(1)}
          </dd>
        </div>
        <div className="sheet p-4">
          <dt className="text-sm text-muted-foreground">maxima reached</dt>
          <dd className="num mt-1 text-2xl font-medium">{optima.length}</dd>
          <dd className="mt-1 text-xs text-muted-foreground">
            {optima.map((o, i) => (
              <span key={o.id} className="num">
                {i > 0 ? "; " : ""}
                <Ell /> = {fmt(o.logLikelihood)} ({o.count} start
                {o.count === 1 ? "" : "s"})
              </span>
            ))}
          </dd>
        </div>
        <div className="sheet p-4">
          <dt className="text-sm text-muted-foreground">one start reaches the best maximum</dt>
          <dd className="num mt-1 text-2xl font-medium">{pct(c.reachBest.estimate)}</dd>
          <dd className="mt-1 text-xs text-muted-foreground">
            {c.reachBest.successes} of {c.reachBest.n}, Wilson 95% CI {pctInterval(c.reachBest)}
          </dd>
        </div>
      </dl>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="sheet p-4 sm:p-5">
          <h3 className="text-base font-semibold">Iterations to reach each tolerance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Box: quartiles and median; whiskers: fastest and slowest of {c.runs.length} random
            starts. The dashed line is the notebook&apos;s own start, which needs{" "}
            {notebookIterations} iterations to meet its 10⁻⁴ (it was given 15).
          </p>
          <IterationBoxes
            className="mt-3"
            rows={c.options.tolerances.map((t, i) => ({
              label: TOL_LABEL(t),
              spread: c.iterations[i],
            }))}
            marker={{ value: notebookIterations, label: "notebook" }}
            ariaLabel={`Iterations to tolerance over ${c.runs.length} random starts: ${c.options.tolerances
              .map(
                (t, i) =>
                  `${TOL_LABEL(t)}: median ${c.iterations[i].median}, quartiles ${c.iterations[i].q1} to ${c.iterations[i].q3}, range ${c.iterations[i].min} to ${c.iterations[i].max}`,
              )
              .join("; ")}.`}
          />
          <p className="num mt-2 text-xs text-muted-foreground">
            {c.options.tolerances.map((t, i) => (
              <span key={t}>
                {i > 0 ? " · " : ""}|Δ
                <Ell />| &lt; {TOL_LABEL(t)}: median {round(c.iterations[i].median)} (IQR{" "}
                {Math.round(c.iterations[i].q1)} to {Math.round(c.iterations[i].q3)})
              </span>
            ))}
          </p>
        </div>
        <div className="sheet p-4 sm:p-5">
          <h3 className="text-base font-semibold">Best of R random starts</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Chance that at least one of R starts reaches the higher maximum
            {best ? (
              <>
                {" "}
                (<Ell /> = {fmt(best.logLikelihood)})
              </>
            ) : null}
            , from the single-start rate and its Wilson interval.
          </p>
          <ScrollX label="Best of R" className="mt-3">
            <table className="num w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 font-normal">
                    R
                  </th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">
                    P(best reached)
                  </th>
                  <th scope="col" className="py-1.5 font-normal">
                    95% interval
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.bestOfR.map((b) => (
                  <tr key={b.R} className="border-t">
                    <td className="py-1.5 pr-3">{b.R}</td>
                    <td className="py-1.5 pr-3">{pct(b.probability)}</td>
                    <td className="py-1.5">{pctInterval(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </div>
      </div>

      <RerunBar
        what={`${count(c.runs.length)} notebook-style random starts on the notebook's 200 ratings`}
        seed={rerun.seed}
        publishedSeed={published.options.seed}
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
