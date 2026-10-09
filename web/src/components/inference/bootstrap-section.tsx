"use client";

import { ScrollX } from "@/components/common/scroll-x";
import type { FitSummary } from "@/lib/inference/artefact";
import type { BootstrapSummary } from "@/lib/inference/tasks";
import { count, fmt, fmtInterval, THETA_ROWS } from "./format";
import { IntervalHistogram } from "./interval-histogram";
import { RerunBar } from "./rerun-bar";
import { useRerun } from "./use-rerun";

/** The estimates table (SEs, Wald and bootstrap intervals) and the bootstrap histograms. */
export function BootstrapSection({
  mle,
  notebook15,
  truth,
  published,
}: {
  mle: FitSummary;
  /** the notebook's printed estimates after 15 iterations, ordered by mean */
  notebook15: number[];
  /** the true parameters, ordered by mean */
  truth: number[];
  published: BootstrapSummary;
}) {
  const rerun = useRerun("bootstrap", published.B, published, published.seed);
  const boot = rerun.result;
  const what = `B = ${count(boot.B)} data sets of n = ${boot.n}`;

  return (
    <div className="space-y-5">
      <ScrollX label="Estimates with standard errors and intervals" className="sheet p-1">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">
            Fitted parameters with observed-information standard errors, Wald intervals and
            parametric-bootstrap intervals, components ordered by mean
          </caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2.5 font-normal">
                parameter
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                notebook, t = 15
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                converged MLE
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                SE (Hessian)
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                95% Wald
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                SE (bootstrap)
              </th>
              <th scope="col" className="px-2 py-2.5 font-normal">
                95% bootstrap
              </th>
              <th scope="col" className="px-3 py-2.5 font-normal">
                true
              </th>
            </tr>
          </thead>
          <tbody className="num">
            {THETA_ROWS.map((row, j) => {
              const d = row.digits;
              const wald = mle.wald?.[j];
              const ci = boot.intervals[j];
              const missWald = wald && (truth[j] < wald.lower || truth[j] > wald.upper);
              const missBoot = truth[j] < ci.lower || truth[j] > ci.upper;
              return (
                <tr key={row.key} className="border-t align-top">
                  <th scope="row" className="px-3 py-2.5 text-left font-sans font-normal">
                    <span className="font-medium">{row.symbol}</span>
                    <span className="block text-xs text-muted-foreground">{row.name}</span>
                  </th>
                  <td className="px-2 py-2.5 text-muted-foreground">{fmt(notebook15[j], d)}</td>
                  <td className="px-2 py-2.5 font-medium">{fmt(mle.theta[j], d)}</td>
                  <td className="px-2 py-2.5">{mle.se ? fmt(mle.se[j], d + 1) : "n/a"}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {fmtInterval(wald, d)}
                    {missWald ? <Miss /> : null}
                  </td>
                  <td className="px-2 py-2.5">{fmt(boot.se[j], d + 1)}</td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    {fmtInterval(ci, d)}
                    {missBoot ? <Miss /> : null}
                  </td>
                  <td className="px-3 py-2.5">{fmt(truth[j], 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollX>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-correction">misses</span> marks an interval that does not
        contain the true value. π₂ = 1 − π₁ has the same standard error and intervals as π₁.
      </p>

      <div>
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded-sm bg-foreground/25" aria-hidden />
            bootstrap estimates
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-4 rounded-sm bg-comp-1/15" aria-hidden />
            95% bootstrap interval
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-comp-1" aria-hidden />
            converged MLE
          </li>
          <li className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 8" className="h-2 w-4" aria-hidden>
              <path d="M1,0V8M1,4H15M15,0V8" stroke="var(--comp-2)" strokeWidth="1.6" fill="none" />
            </svg>
            95% Wald interval
          </li>
          <li className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 8" className="h-2 w-4" aria-hidden>
              <path d="M8,0V8" stroke="currentColor" strokeWidth="1.6" strokeDasharray="1.5 2" />
            </svg>
            true value
          </li>
        </ul>
        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-5">
          {THETA_ROWS.map((row, j) => (
            <li key={row.key} className="sheet p-2.5">
              <p className="px-1 text-sm">
                <span className="font-medium">{row.symbol}</span>{" "}
                <span className="text-xs text-muted-foreground">{row.name}</span>
              </p>
              <IntervalHistogram
                histogram={boot.histograms[j]}
                estimate={mle.theta[j]}
                percentile={boot.intervals[j]}
                wald={mle.wald?.[j] ?? null}
                truth={truth[j]}
                digits={row.digits}
                title={`${row.symbol}, ${row.name}`}
              />
            </li>
          ))}
        </ul>
      </div>

      <RerunBar
        what={what}
        seed={rerun.seed}
        publishedSeed={published.seed}
        published={rerun.published}
        running={rerun.running}
        seconds={rerun.seconds}
        reproduced={rerun.reproduced}
        error={rerun.error}
        onRun={rerun.run}
        onReset={rerun.reset}
      />
      <p className="text-xs text-muted-foreground">
        {count(boot.B - boot.failed)} of {count(boot.B)} refits succeeded; the variance floor bound
        in {boot.floorBinding}; the two means crossed (needing relabelling, DR-002) in{" "}
        {boot.labelDisagreements}.
      </p>
    </div>
  );
}

function Miss() {
  return (
    <span className="ml-1.5 rounded-full bg-correction-bg px-1.5 py-0.5 font-sans text-[0.68rem] font-medium text-correction">
      misses
    </span>
  );
}
