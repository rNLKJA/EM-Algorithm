"use client";

import { useMemo, useState } from "react";
import { ConsoleBlock } from "@/components/common/console";
import { ScrollX } from "@/components/common/scroll-x";
import { ComponentSwatch } from "@/components/common/legend";
import { ParamSlider } from "@/components/common/param-slider";
import { eStep, paramsAt, posterior } from "@/lib/em/em";
import { accuracyAsWritten, accuracyMatched, matchByMean } from "@/lib/em/labels";
import { finalResultsConsole, fitConsole } from "@/lib/em/notebook-console";
import { notebookRun } from "@/lib/em/notebook-run";
import { PARAM_KEYS, type FitResult, type MixtureParams } from "@/lib/em/types";
import { pyPercent, sci, smart } from "@/lib/format";
import { wilsonInterval } from "@/lib/stats/intervals";
import { cn } from "@/lib/utils";

/** Wilson 95% interval for an accuracy measured on n ratings. */
function wilsonText(accuracy: number, n: number) {
  const w = wilsonInterval(Math.round(accuracy * n), n);
  return `${pyPercent(w.lower)} to ${pyPercent(w.upper)}`;
}
import type { Dataset } from "./use-playground";

export function Results({
  result,
  stage,
  dataset,
  stopping,
  isNotebookStart,
}: {
  result: FitResult;
  stage: number;
  dataset: Dataset;
  stopping: { maxIterations: number; tolerance: number };
  isNotebookStart: boolean;
}) {
  const params = paramsAt(result, stage);
  const matching = matchByMean(params, dataset.truth);
  // responsibilities used in iteration `stage` (the notebook's em.gamma1 after the last one)
  const gamma1 = useMemo(() => {
    if (stage >= 1 && stage === result.iterations.length) return result.finalGamma1;
    return Array.from(eStep(dataset.ratings, paramsAt(result, Math.max(0, stage - 1))).gamma1);
  }, [result, stage, dataset.ratings]);
  const accWritten = accuracyAsWritten(gamma1, dataset.groups);
  const accMatched = accuracyMatched(gamma1, dataset.groups, matching);
  const names = dataset.groupNames;
  const matchedName = (k: 1 | 2) => names[(matching.swapped ? 3 - k : k) - 1];

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="Parameters" className="sheet min-w-0 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Parameters at t = {stage}</h2>
          <ScrollX label="Parameters" className="mt-3">
            <table className="w-full min-w-[18rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-2 font-normal">
                    component
                  </th>
                  <th scope="col" className="py-1.5 pr-2 font-normal">
                    π
                  </th>
                  <th scope="col" className="py-1.5 pr-2 font-normal">
                    μ
                  </th>
                  <th scope="col" className="py-1.5 pr-2 font-normal">
                    σ
                  </th>
                  <th scope="col" className="py-1.5 font-normal">
                    matches true group
                  </th>
                </tr>
              </thead>
              <tbody className="num">
                {([1, 2] as const).map((k) => {
                  const truthIdx = matching.swapped ? 3 - k : k;
                  const t = dataset.truth;
                  const tv = truthIdx === 1 ? [t.pi1, t.mu1, t.sigma1] : [t.pi2, t.mu2, t.sigma2];
                  const v =
                    k === 1
                      ? [params.pi1, params.mu1, params.sigma1]
                      : [params.pi2, params.mu2, params.sigma2];
                  return (
                    <tr key={k} className="border-t align-top">
                      <th scope="row" className="py-2 pr-2 text-left font-normal">
                        <span className="flex items-center gap-1.5">
                          <ComponentSwatch k={k} />
                          {k}
                        </span>
                      </th>
                      {v.map((x, i) => (
                        <td key={i} className="py-2 pr-2">
                          {smart(x, 3)}
                          <span className="block text-[0.72rem] text-muted-foreground">
                            true {tv[i].toFixed(1)}
                          </span>
                        </td>
                      ))}
                      <td className="py-2 font-sans">{matchedName(k)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollX>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {matching.swapped ? (
              <>
                <strong className="font-medium text-foreground">Labels switched.</strong> Component
                1 ended up describing <em>{names[1].toLowerCase()}</em>, the group the data calls
                group 2. EM&apos;s numbering is arbitrary, so every comparison here first matches
                components to groups by their means.
              </>
            ) : (
              <>Component 1 lines up with {names[0].toLowerCase()}, so no relabelling is needed.</>
            )}
          </p>
        </section>

        <section aria-label="Accuracy" className="sheet min-w-0 p-4 sm:p-5">
          <h2 className="text-base font-semibold">Classification accuracy</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <dt className="text-xs text-muted-foreground">matched by mean</dt>
              <dd className="num mt-1 text-2xl font-medium">{pyPercent(accMatched)}</dd>
              <dd className="num mt-1 text-[0.72rem] text-muted-foreground">
                95% CI {wilsonText(accMatched, gamma1.length)}
              </dd>
            </div>
            <div className="rounded-xl border p-3">
              <dt className="text-xs text-muted-foreground">as the notebook computes it</dt>
              <dd
                className={cn(
                  "num mt-1 text-2xl font-medium",
                  accWritten !== accMatched && "text-correction",
                )}
              >
                {pyPercent(accWritten)}
              </dd>
              <dd className="num mt-1 text-[0.72rem] text-muted-foreground">
                95% CI {wilsonText(accWritten, gamma1.length)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The notebook scores <span className="num">(γ₁ &gt; 0.5)</span> against true labels where
            1 means group 2, so its number is only right when the labels have switched.
            {accWritten !== accMatched
              ? " Here they have not, which is why the two disagree."
              : " Here they agree."}{" "}
            Responsibilities are taken from the E-step of iteration {Math.max(1, stage)}, like the
            notebook&apos;s <span className="num">em.gamma1</span>. The intervals are Wilson 95%
            intervals over the {gamma1.length} ratings.
          </p>
        </section>
      </div>

      <ClassifyNewRating params={params} names={names} swapped={matching.swapped} />

      {isNotebookStart && (
        <ParityPanel result={result} n={dataset.ratings.length} stopping={stopping} />
      )}

      <details className="sheet group p-4 sm:p-5">
        <summary className="cursor-pointer text-base font-semibold select-none">
          Full trace ({result.iterations.length} iterations)
        </summary>
        <div
          className="mt-3 max-h-96 overflow-auto"
          tabIndex={0}
          role="region"
          aria-label="Full trace table (scrolls)"
        >
          <table className="num w-full min-w-[36rem] text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-muted-foreground">
                {["t", "log-lik", "Δ", "π₁", "μ₁", "μ₂", "σ₁", "σ₂"].map((h) => (
                  <th key={h} scope="col" className="py-1.5 pr-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.iterations.map((it) => (
                <tr
                  key={it.iteration}
                  className={cn("border-t", it.iteration === stage && "bg-muted")}
                >
                  <td className="py-1 pr-3">{it.iteration}</td>
                  <td className="py-1 pr-3">{it.logLikelihood.toFixed(4)}</td>
                  <td className="py-1 pr-3">
                    {it.improvement === null ? "" : it.improvement.toFixed(5)}
                  </td>
                  {(["pi1", "mu1", "mu2", "sigma1", "sigma2"] as const).map((k) => (
                    <td key={k} className="py-1 pr-3">
                      {smart(it.params[k], 4)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function ClassifyNewRating({
  params,
  names,
  swapped,
}: {
  params: MixtureParams;
  names: [string, string];
  swapped: boolean;
}) {
  const [x, setX] = useState(notebookRun.newUser.rating);
  const { p1, p2 } = posterior(x, params);
  const asRun = p1 > p2 ? names[0] : names[1];
  const matchedComp: 1 | 2 = p1 > p2 ? 1 : 2;
  const matched = names[(swapped ? 3 - matchedComp : matchedComp) - 1];
  const single = (s: string) => s.replace(/s$/, "");
  return (
    <section aria-label="Classify a new rating" className="sheet p-4 sm:p-5">
      <h2 className="text-base font-semibold">Classify a new rating</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The notebook&apos;s last cell asks which group a user who rates a film 8.5 belongs to,
        reading component 1 as &ldquo;{single(names[0])}&rdquo;.
      </p>
      <div className="mt-4 grid gap-5 md:grid-cols-[1fr_1.3fr] md:items-center">
        <ParamSlider
          label="new rating x"
          value={x}
          min={1}
          max={10}
          step={0.1}
          format={(v) => v.toFixed(1)}
          onChange={setX}
        />
        <div className="num grid gap-1.5 text-sm">
          <p className="flex items-center gap-2">
            <ComponentSwatch k={1} /> P(component 1 | x) = {p1 < 0.001 ? sci(p1) : p1.toFixed(3)}
          </p>
          <p className="flex items-center gap-2">
            <ComponentSwatch k={2} /> P(component 2 | x) = {p2 < 0.001 ? sci(p2) : p2.toFixed(3)}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-xl border p-3",
            swapped && "border-correction/40 bg-correction-bg",
          )}
        >
          <dt className="text-xs text-muted-foreground">as the notebook would print it</dt>
          <dd className="mt-1 font-medium">&ldquo;likely a {single(asRun).toUpperCase()}&rdquo;</dd>
        </div>
        <div className="rounded-xl border p-3">
          <dt className="text-xs text-muted-foreground">after matching labels by mean</dt>
          <dd className="mt-1 font-medium">{single(matched)}</dd>
        </div>
      </dl>
    </section>
  );
}

function ParityPanel({
  result,
  n,
  stopping,
}: {
  result: FitResult;
  n: number;
  stopping: { maxIterations: number; tolerance: number };
}) {
  const notebookRule =
    stopping.maxIterations === notebookRun.fit.maxIterations &&
    stopping.tolerance === notebookRun.fit.tolerance;
  const call = `em.fit(max_iterations=${stopping.maxIterations}, tolerance=${stopping.tolerance.toExponential(0)})`;
  const overlap = Math.min(result.iterations.length, notebookRun.iterations.length);
  let maxDiff = 0;
  for (let i = 0; i < overlap; i++) {
    const a = result.iterations[i];
    const b = notebookRun.iterations[i];
    maxDiff = Math.max(maxDiff, Math.abs(a.logLikelihood - b.logLikelihood));
    for (const k of PARAM_KEYS) maxDiff = Math.max(maxDiff, Math.abs(a.params[k] - b.params[k]));
  }
  const ok = maxDiff < 1e-6;
  const sameRun = overlap === notebookRun.iterations.length && result.iterations.length === overlap;
  const text =
    fitConsole(result, n) +
    (sameRun ? finalResultsConsole(result.iterations.at(-1)!.params, notebookRun.trueParams) : "");
  const matchesPrinted = sameRun && text === notebookRun.printed.fitCell;

  return (
    <section aria-label="Parity with the notebook" className="sheet space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Parity with the original notebook</h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            ok ? "bg-ok/10 text-ok" : "bg-destructive/10 text-destructive",
          )}
        >
          {ok ? "matches ✓" : "differs ✗"}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This run starts from the notebook&apos;s own random draw. Comparing this browser&apos;s
        TypeScript trace with the trace exported from the notebook, iterations 1 to {overlap} agree
        to within{" "}
        <span className="num text-foreground">{maxDiff === 0 ? "0" : sci(maxDiff, 1)}</span>{" "}
        (largest absolute difference in any π, μ, σ or log-likelihood).
        {matchesPrinted &&
          " The console below is regenerated from this run and is identical, character for character, to what the notebook printed."}
        {!notebookRule && (
          <>
            {" "}
            Your stopping rule differs from the notebook&apos;s (
            <span className="num">
              max_iterations={notebookRun.fit.maxIterations}, tolerance=
              {notebookRun.fit.tolerance.toExponential(0)}
            </span>
            ), so the console below is what the notebook&apos;s code would print with yours.
          </>
        )}
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-medium select-none">
          Replay the notebook&apos;s console output
        </summary>
        <ConsoleBlock className="mt-3" label={`${call}, regenerated`} maxHeight={420}>
          {text}
        </ConsoleBlock>
      </details>
    </section>
  );
}
