"use client";

import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/line-chart";
import { MixtureChart } from "@/components/charts/mixture-chart";
import { Legend } from "@/components/common/legend";
import { ParamSlider } from "@/components/common/param-slider";
import { Segmented } from "@/components/common/segmented";
import { Switch } from "@/components/ui/switch";
import { collapseInit } from "@/lib/em/collapse";
import { fit, isFiniteParams } from "@/lib/em/em";
import { notebookRun } from "@/lib/em/notebook-run";
import { minus, sci } from "@/lib/format";
import { cn } from "@/lib/utils";

const DATA = notebookRun.ratings;
const SORTED = [...DATA].sort((a, b) => a - b);

const TARGETS = {
  ten: { value: 10, label: "the 7 ratings clipped to 10" },
  lowest: { value: SORTED[0], label: `the lowest rating (${SORTED[0].toFixed(2)})` },
  crowd: { value: SORTED[100], label: `a rating in the crowd (${SORTED[100].toFixed(2)})` },
} as const;
type TargetId = keyof typeof TARGETS;

export function CollapseDemo() {
  const [target, setTarget] = useState<TargetId>("ten");
  const [sigma0, setSigma0] = useState(0.2);
  const [floorOn, setFloorOn] = useState(false);
  const [floor, setFloor] = useState(0.05);

  const init = useMemo(() => collapseInit(DATA, TARGETS[target].value, sigma0), [target, sigma0]);
  const result = useMemo(
    () =>
      fit(DATA, init, {
        maxIterations: 300,
        tolerance: 1e-10,
        varianceFloor: floorOn ? floor : 0,
      }),
    [init, floorOn, floor],
  );

  const sigmas = [init.sigma2, ...result.iterations.map((it) => it.params.sigma2)];
  const lls = result.iterations.map((it) => it.logLikelihood);
  const lastFinite = [...result.iterations].reverse().find((it) => isFiniteParams(it.params));
  const shown = lastFinite?.params ?? init;
  const n = result.iterations.length;
  const last = result.iterations[n - 1];
  const tied = DATA.filter((x) => x === 10).length;

  let verdict: { tone: "bad" | "warn" | "ok"; text: string };
  if (result.stopReason === "degenerate") {
    const peak = lls.slice(0, -1).filter(Number.isFinite).at(-1);
    verdict = {
      tone: "bad",
      text: `Collapsed at iteration ${n}: σ₂ reached exactly 0, so the next density is 0/0 and the log-likelihood is NaN. Just before, it had climbed to ${minus(peak?.toFixed(1) ?? "")}, higher than any sensible fit (−415.37). The likelihood has no maximum here: it grows without bound as σ₂ → 0.`,
    };
  } else if (floorOn && last.params.sigma2 <= floor + 1e-12) {
    verdict = {
      tone: "warn",
      text: `The floor held: σ₂ is pinned at ${floor.toFixed(2)} and the run converged after ${n} iterations (ℓ = ${minus(last.logLikelihood.toFixed(2))}). But component 2 is still a spike on ${(last.params.pi2 * DATA.length).toFixed(1)} ratings' worth of weight. A floor stops the crash; it does not rescue the fit. A different start does.`,
    };
  } else if (last.params.sigma2 < 0.1) {
    verdict = {
      tone: "warn",
      text: `No crash, but no recovery either: EM settled on a narrow spike (σ₂ = ${last.params.sigma2.toFixed(3)}) around ${last.params.mu2.toFixed(2)} with ℓ = ${minus(last.logLikelihood.toFixed(2))}, a spurious local maximum.`,
    };
  } else {
    verdict = {
      tone: "ok",
      text: `Escaped: neighbouring ratings pulled σ₂ back up to ${last.params.sigma2.toFixed(2)} and EM converged to an ordinary fit (ℓ = ${minus(last.logLikelihood.toFixed(2))}).`,
    };
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Sit component 2 on…</p>
          <Segmented
            ariaLabel="Where to start component 2"
            size="sm"
            value={target}
            onChange={setTarget}
            options={(Object.keys(TARGETS) as TargetId[]).map((id) => ({
              value: id,
              label:
                id === "ten" ? `the ${tied} tens` : id === "lowest" ? "lowest rating" : "the crowd",
              description: TARGETS[id].label,
            }))}
          />
          <p className="text-xs text-muted-foreground">
            Starting at μ₂ = {TARGETS[target].value.toFixed(2)} ({TARGETS[target].label}); component
            1 starts at the overall mean and spread.
          </p>
        </div>
        <div className="space-y-4">
          <ParamSlider
            label="starting σ₂"
            accent={2}
            value={sigma0}
            min={0.05}
            max={0.6}
            step={0.01}
            onChange={setSigma0}
          />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={floorOn} onCheckedChange={setFloorOn} />
              variance floor
            </label>
            <span className="text-xs text-muted-foreground">not in the notebook</span>
          </div>
          {floorOn && (
            <ParamSlider
              label="σ ≥"
              value={floor}
              min={0.01}
              max={0.3}
              step={0.01}
              onChange={setFloor}
            />
          )}
        </div>
      </div>

      <p
        aria-live="polite"
        className={cn(
          "rounded-xl border px-4 py-3 text-sm leading-relaxed",
          verdict.tone === "bad" && "border-destructive/35 bg-destructive/[0.06]",
          verdict.tone === "warn" && "border-correction/40 bg-correction-bg",
          verdict.tone === "ok" && "border-ok/35 bg-ok/[0.07]",
        )}
      >
        {verdict.text}
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="sheet p-4">
          <h3 className="text-sm font-semibold">σ₂ by iteration (log scale)</h3>
          <LineChart
            height={190}
            xStart={0}
            logY
            yLabel="σ₂"
            series={[{ id: "s", label: "σ₂", values: sigmas, colour: "var(--comp-2)" }]}
            ariaLabel={`Component 2 spread by iteration: ${sigmas.map((s) => sci(s, 1)).join(", ")}`}
          />
        </div>
        <div className="sheet p-4">
          <h3 className="text-sm font-semibold">log-likelihood by iteration</h3>
          <LineChart
            height={190}
            xStart={1}
            yLabel="ℓ(θ)"
            series={[
              { id: "ll", label: "log-likelihood", values: lls, colour: "var(--foreground)" },
            ]}
            ariaLabel={`Log-likelihood by iteration: ${lls.map((v) => v.toFixed(1)).join(", ")}`}
          />
        </div>
      </div>
      <div className="sheet p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            Last finite fit (iteration {lastFinite ? result.iterations.indexOf(lastFinite) + 1 : 0})
          </h3>
          <Legend />
        </div>
        <MixtureChart
          data={DATA}
          params={shown}
          height={260}
          yMax={0.45}
          annotate={false}
          ariaLabel={`Mixture at the last finite iteration: component 2 at ${shown.mu2.toFixed(2)} with spread ${shown.sigma2.toPrecision(2)}.`}
        />
      </div>
    </div>
  );
}
