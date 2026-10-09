"use client";

import { Dices, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEmWorker } from "@/hooks/use-em-worker";
import { notebookRun } from "@/lib/em/notebook-run";
import type { RestartSummary } from "@/lib/em/restarts";
import { wilsonInterval } from "@/lib/stats/intervals";

const COUNT = 100;

function ci(k: number) {
  const w = wilsonInterval(k, COUNT);
  return `${Math.round(100 * w.lower)}% to ${Math.round(100 * w.upper)}%`;
}

/** How often does the notebook's own recipe end with component 1 as the low-mean group? */
export function SwitchCensus() {
  const { runRestarts } = useEmWorker();
  const [seed, setSeed] = useState(7);
  const [state, setState] = useState<{ seed: number; summary: RestartSummary } | null>(null);
  const [failure, setFailure] = useState<{ seed: number; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    runRestarts({
      data: notebookRun.ratings,
      count: COUNT,
      seed,
      maxIterations: notebookRun.fit.maxIterations,
      tolerance: notebookRun.fit.tolerance,
      init: "notebook",
      truth: notebookRun.trueParams,
    })
      .then((summary) => {
        if (!cancelled) setState({ seed, summary });
      })
      .catch((error: Error) => {
        if (!cancelled) setFailure({ seed, message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [runRestarts, seed]);

  const summary = state?.seed === seed ? state.summary : null;
  const error = !summary && failure?.seed === seed ? failure.message : null;
  const switched = summary ? summary.runs.filter((r) => r.swapped).length : 0;
  const predicted = summary
    ? summary.runs.filter((r) => r.init.mu1 < r.init.mu2 === r.swapped).length
    : 0;

  return (
    <div className="sheet space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">Is it bad luck? Rerun the notebook 100 times</h3>
        <Button variant="outline" size="sm" onClick={() => setSeed((s) => s + 1)}>
          <Dices data-icon="inline-start" />
          Another 100
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Same data, same recipe (μ ~ U(3, 8), σ ~ U(0.5, 2), 15 iterations), 100 fresh random starts.
      </p>
      {/* a short live summary; the strip and paragraph below are not re-read on every rerun */}
      <p className="sr-only" aria-live="polite" aria-atomic>
        {error
          ? "The census could not run."
          : summary
            ? `${switched} of ${COUNT} runs switched labels.`
            : ""}
      </p>
      <div>
        {error ? (
          <p className="text-sm text-destructive">
            The census could not run: {error}. Try &ldquo;Another 100&rdquo;.
          </p>
        ) : !summary ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> fitting in a background
            worker...
          </p>
        ) : (
          <>
            <div
              className="flex h-9 overflow-hidden rounded-lg border"
              role="img"
              aria-label={`${switched} of ${COUNT} runs ended with labels switched`}
            >
              {/* switched runs: strong ink with diagonal hatching; lined-up runs: plain and muted.
                  Teal and coral stay reserved for the two components. */}
              {summary.runs.map((r) => (
                <span
                  key={r.index}
                  className={r.swapped ? "census-switched flex-1" : "flex-1 bg-muted"}
                  style={{ marginRight: 1 }}
                />
              ))}
            </div>
            <p className="mt-3 text-sm">
              <span className="num text-lg font-medium">{switched}</span> of {COUNT} runs ended with
              component 1 as the <em>low</em>-mean group (hatched), so their &ldquo;sci-fi&rdquo;
              label would point at romance lovers (Wilson 95% CI{" "}
              <span className="num">{ci(switched)}</span>). The other{" "}
              <span className="num">{COUNT - switched}</span> (plain) happen to line up. It is close
              to a coin toss, and mostly decided by which mean the random start happens to put
              lower: that alone predicts the outcome in <span className="num">{predicted}</span> of{" "}
              {COUNT} runs.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
