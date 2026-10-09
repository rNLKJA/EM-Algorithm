"use client";

import { Dices, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StaticMixture } from "@/components/charts/static-mixture";
import { Ell } from "@/components/common/ell";
import { Segmented } from "@/components/common/segmented";
import { Button } from "@/components/ui/button";
import { useEmWorker } from "@/hooks/use-em-worker";
import { notebookDataset, threeBumpsDataset } from "@/lib/em/datasets";
import type { InitStrategy, RestartSummary } from "@/lib/em/restarts";
import { minus } from "@/lib/format";
import { cn } from "@/lib/utils";

type DatasetId = "notebook" | "three-bumps";

const OPTIMUM_STYLE = [
  "bg-ok/12 text-ok",
  "bg-correction-bg text-correction",
  "bg-comp-2/12 text-comp-2-ink",
  "bg-muted text-muted-foreground",
];

export function RestartGallery() {
  const { runRestarts } = useEmWorker();
  const [datasetId, setDatasetId] = useState<DatasetId>("three-bumps");
  const [init, setInit] = useState<InitStrategy>("notebook");
  const [count, setCount] = useState<"12" | "24" | "48">("24");
  const [seed, setSeed] = useState(1);
  const [state, setState] = useState<{ key: string; summary: RestartSummary } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);

  const dataset = useMemo(
    () => (datasetId === "notebook" ? notebookDataset() : threeBumpsDataset()),
    [datasetId],
  );
  const key = `${datasetId}|${init}|${count}|${seed}`;

  useEffect(() => {
    let cancelled = false;
    runRestarts({
      data: dataset.ratings,
      count: Number(count),
      seed,
      maxIterations: 1000,
      tolerance: 1e-6,
      init,
    })
      .then((summary) => {
        if (!cancelled) setState({ key, summary });
      })
      .catch((e: Error) => {
        if (!cancelled) setFailure({ key, message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [runRestarts, dataset, count, seed, init, key]);

  const summary = state?.key === key ? state.summary : null;
  // errors belong to the request that raised them; a new request starts clean
  const error = !summary && failure?.key === key ? failure.message : null;
  const runs = summary ? [...summary.runs].sort((a, b) => scoreOf(b) - scoreOf(a)) : [];
  const yMax = dataset.id === "notebook" ? 0.32 : 0.36;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">data</p>
          <Segmented
            ariaLabel="Data for the restarts"
            size="sm"
            value={datasetId}
            onChange={setDatasetId}
            options={[
              { value: "three-bumps", label: "Three bumps (made up)" },
              { value: "notebook", label: "Notebook's 200" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">start</p>
          <Segmented
            ariaLabel="Starting guess for each restart"
            size="sm"
            value={init}
            onChange={setInit}
            options={[
              { value: "notebook", label: "Notebook random" },
              { value: "kmeans++", label: "k-means++" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">restarts</p>
          <Segmented
            ariaLabel="Number of restarts"
            size="sm"
            value={count}
            onChange={setCount}
            options={[
              { value: "12", label: "12" },
              { value: "24", label: "24" },
              { value: "48", label: "48" },
            ]}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setSeed((s) => s + 1)}>
          <Dices data-icon="inline-start" />
          New random starts
        </Button>
      </div>

      <div aria-live="polite" className="min-h-6 text-sm">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : !summary ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Running {count} fits in a
            background worker...
          </span>
        ) : (
          <p>
            <strong className="font-medium">
              {summary.optima.length === 1
                ? "Every start reached the same answer"
                : `${summary.optima.length} different answers`}
            </strong>{" "}
            from {count} starts:{" "}
            {summary.optima.map((o, i) => (
              <span key={o.id} className="num">
                {i > 0 && ", "}
                {o.degenerate ? (
                  "collapsed"
                ) : (
                  <>
                    <Ell /> = {minus(o.logLikelihood.toFixed(2))}
                  </>
                )}{" "}
                ({o.count}×)
              </span>
            ))}
            .
          </p>
        )}
      </div>

      <ul
        className={cn(
          "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
          !summary && "opacity-50",
        )}
        aria-label="Restarts, best log-likelihood first"
      >
        {runs.map((run) => {
          const rank = summary!.optima.findIndex((o) => o.id === run.optimum);
          const optimum = summary!.optima[rank];
          return (
            <li key={run.index} className="sheet overflow-hidden p-2.5">
              <StaticMixture
                data={dataset.ratings}
                params={run.final}
                width={260}
                height={110}
                yMax={yMax}
                className="h-auto w-full text-foreground"
                ariaLabel={`Restart ${run.index + 1}: means ${run.sorted.mu1.toFixed(2)} and ${run.sorted.mu2.toFixed(2)}, log-likelihood ${run.logLikelihood.toFixed(2)}`}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="num text-[0.7rem] text-muted-foreground">
                  #{run.index + 1} · {run.iterations} it
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.68rem] font-medium",
                    optimum?.degenerate
                      ? "bg-destructive/10 text-destructive"
                      : OPTIMUM_STYLE[Math.min(rank, OPTIMUM_STYLE.length - 1)],
                  )}
                >
                  {optimum?.degenerate ? "collapsed" : rank === 0 ? "best" : `local #${rank + 1}`}
                </span>
              </div>
              <p className="num mt-1 text-xs">
                <Ell /> ={" "}
                {Number.isFinite(run.logLikelihood) ? minus(run.logLikelihood.toFixed(2)) : "NaN"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function scoreOf(run: { logLikelihood: number; stopReason: string }) {
  return run.stopReason === "degenerate" || !Number.isFinite(run.logLikelihood)
    ? -Infinity
    : run.logLikelihood;
}
