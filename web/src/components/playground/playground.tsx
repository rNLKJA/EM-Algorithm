"use client";

import { Dices, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ExplainIteration } from "@/components/ai/explain-iteration";
import { LineChart } from "@/components/charts/line-chart";
import { MixtureChart } from "@/components/charts/mixture-chart";
import { Callout } from "@/components/common/callout";
import { Ell } from "@/components/common/ell";
import { Legend } from "@/components/common/legend";
import { ParamSlider } from "@/components/common/param-slider";
import { PlaybackControls } from "@/components/common/playback-controls";
import { Segmented } from "@/components/common/segmented";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePlayback } from "@/hooks/use-playback";
import { useTweenedParams } from "@/hooks/use-tweened-params";
import { degenerateStatus, type IterationInput } from "@/lib/ai/explain-iteration";
import { diagnoseFit } from "@/lib/em/diagnose";
import { eStep, isNonDecreasing, logLikelihood, paramsAt } from "@/lib/em/em";
import { pyFixed, sci } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Results } from "./results";
import {
  DEFAULT_CONFIG,
  usePlaygroundModel,
  type InitStrategy,
  type PlaygroundConfig,
} from "./use-playground";

const SPEEDS = { "1": 650, "4": 170, "16": 45 } as const;
type Speed = keyof typeof SPEEDS;
const TOLERANCES = ["1e-2", "1e-4", "1e-6", "1e-8"] as const;

export function Playground() {
  const [config, setConfig] = useState<PlaygroundConfig>(DEFAULT_CONFIG);
  const [speed, setSpeed] = useState<Speed>("1");
  const [showTruth, setShowTruth] = useState(true);
  const model = usePlaygroundModel(config);
  const { dataset, init, result } = model;

  const stageCount = result ? result.iterations.length + 1 : 1;
  const playback = usePlayback(stageCount, SPEEDS[speed], stageCount - 1);
  const stage = Math.min(playback.index, stageCount - 1);

  const update = useCallback(
    (patch: Partial<PlaygroundConfig>) => {
      setConfig((c) => ({ ...c, ...patch }));
      playback.reset();
    },
    [playback],
  );
  const updateGen = (patch: Partial<PlaygroundConfig["gen"]>) =>
    update({ source: "custom", gen: { ...config.gen, ...patch } });

  const params = result ? paramsAt(result, stage) : init.params;
  const tweened = useTweenedParams(params, Math.min(420, SPEEDS[speed] * 0.85));

  const llValues = useMemo(() => {
    if (!result) return [];
    return [
      logLikelihood(dataset.ratings, result.init),
      ...result.iterations.map((it) => it.logLikelihood),
    ];
  }, [result, dataset.ratings]);
  const finitePrefix = llValues.filter(Number.isFinite);
  const monotone = isNonDecreasing(finitePrefix);

  const yMax = useMemo(() => {
    const t = dataset.truth;
    const peak = Math.max(
      t.pi1 / (t.sigma1 * Math.sqrt(2 * Math.PI)),
      t.pi2 / (t.sigma2 * Math.sqrt(2 * Math.PI)),
    );
    return Math.max(0.2, peak * 1.6);
  }, [dataset.truth]);

  const degeneracy = useMemo(
    () => (result ? diagnoseFit(dataset.ratings, result) : null),
    [result, dataset.ratings],
  );

  const status = (() => {
    if (!result) return model.pending ? "Running EM in a background worker..." : "No result yet.";
    const n = result.iterations.length;
    if (stage === 0) return "Start: the initial guess. Press play to run EM.";
    if (stage < n) return `Iteration ${stage} of ${n}`;
    const last = result.iterations[n - 1];
    if (result.stopReason === "converged")
      return `Converged after ${n} iterations: the log-likelihood moved by less than ${config.tolerance.toExponential(0)}.`;
    if (degeneracy?.kind === "underflow") {
      const [z1, z2] = degeneracy.z.map((z) => z.toFixed(0));
      const x = Number.isInteger(degeneracy.x) ? String(degeneracy.x) : degeneracy.x.toFixed(2);
      return `Numerical underflow at iteration ${n}: rating ${x} sits ${z1}σ from μ₁ and ${z2}σ from μ₂, so both densities round to 0 and its responsibilities are 0/0 = NaN. The notebook's normal_pdf does the same. Not a collapse: try wider spreads or another start.`;
    }
    if (degeneracy?.kind === "empty") {
      return `Component ${degeneracy.component} lost every rating at iteration ${n}: its responsibilities all rounded to 0, so its mean is 0/0 = NaN. Try another start.`;
    }
    if (degeneracy?.kind === "collapse") {
      const { component: k, sigma } = degeneracy;
      const size = sigma > 0 ? `shrank to ${sci(sigma, 1)}` : "hit 0";
      return `Collapsed at iteration ${n}: component ${k}'s σ ${size}, a spike whose likelihood grows without bound (σ → 0). Not a fit: EM stops here. Try another start or a variance floor.`;
    }
    return `Stopped at the cap of ${n} iterations, still improving by ${pyFixed(last.improvement ?? 0, 4)} per step (not converged).`;
  })();

  const componentLabels: [string, string] = ["component 1", "component 2"];

  const explainInput = useMemo((): IterationInput | null => {
    if (!result || stage < 1 || llValues.length <= stage) return null;
    const n = result.iterations.length;
    const before = paramsAt(result, stage - 1);
    return {
      source: "playground",
      dataset: dataset.original
        ? "The notebook's 200 synthetic ratings (np.random.seed(42), clipped to 1 to 10)"
        : `${dataset.ratings.length} ratings generated in the browser (seed ${config.gen.seed}); not the notebook's data`,
      data: dataset.ratings,
      iteration: stage,
      before,
      after: paramsAt(result, stage),
      e: eStep(dataset.ratings, before),
      logLikelihoodBefore: llValues[stage - 1],
      logLikelihoodAfter: llValues[stage],
      stopping: {
        tolerance: config.tolerance,
        maxIterations: config.maxIterations,
        status:
          stage < n
            ? "continuing"
            : result.stopReason === "converged"
              ? "converged"
              : result.stopReason === "degenerate"
                ? degenerateStatus(degeneracy)
                : "stopped-at-cap",
      },
    };
  }, [
    result,
    stage,
    llValues,
    dataset,
    degeneracy,
    config.gen.seed,
    config.tolerance,
    config.maxIterations,
  ]);

  return (
    // DOM order is the phone order: chart and playback, then the settings, then the
    // results. On lg the settings move to a left column spanning both rows, so the
    // focus order (chart, settings, results) still follows the visual flow.
    <div className="grid gap-6 lg:grid-cols-[19.5rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <section aria-label="Mixture" className="sheet p-4 sm:p-5 lg:col-start-2 lg:row-start-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PlaybackControls
            playing={playback.playing}
            atStart={playback.atStart}
            atEnd={playback.atEnd}
            onReset={playback.reset}
            onPrev={playback.prev}
            onNext={playback.next}
            onToggle={playback.toggle}
            onEnd={playback.toEnd}
            nextLabel="Next iteration"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">speed</span>
            <Segmented
              ariaLabel="Playback speed"
              size="sm"
              value={speed}
              onChange={setSpeed}
              options={[
                { value: "1", label: "1×" },
                { value: "4", label: "4×" },
                { value: "16", label: "16×" },
              ]}
            />
          </div>
        </div>
        {/* Screen readers hear the status when playback stops or on a manual step, not
            on every animation tick (up to 16 a second at 16×). */}
        <p className="sr-only" aria-live="polite" aria-atomic>
          {playback.playing ? "Playing" : `t = ${stage}. ${status}`}
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm">
          {model.pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          <span className="num shrink-0 self-start rounded bg-muted px-1.5 py-0.5 text-xs whitespace-nowrap">
            t = {stage}
          </span>
          <span
            className={cn(
              result?.stopReason === "degenerate" && stage === stageCount - 1 && "text-destructive",
            )}
          >
            {status}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Legend labels={["Component 1", "Component 2"]} showTruth={showTruth} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={showTruth}
              onCheckedChange={setShowTruth}
              aria-label="Show the true mixture"
            />
            true mixture
          </label>
        </div>
        <MixtureChart
          className="mt-2"
          data={dataset.ratings}
          params={tweened}
          truth={showTruth ? dataset.truth : null}
          height={340}
          yMax={yMax}
          draggable={config.init === "manual"}
          onMeansChange={(mu1, mu2) =>
            update({ init: "manual", manual: { ...config.manual, mu1, mu2 } })
          }
          componentLabels={componentLabels}
          ariaLabel={`Histogram of ${dataset.ratings.length} ratings with the fitted two-component mixture at iteration ${stage}: component 1 mean ${params.mu1.toFixed(2)}, component 2 mean ${params.mu2.toFixed(2)}.`}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Points under the axis are coloured by responsibility (teal = component 1, coral =
          component 2) and drawn as circles or triangles by whichever is larger.
          {config.init === "manual" &&
            " Drag the μ handles (or focus one and use the arrow keys) to restart EM from there."}
        </p>
      </section>

      <aside
        aria-label="Settings"
        className="space-y-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start"
      >
        <section className="sheet space-y-4 p-4">
          <h2 className="text-base font-semibold">Data</h2>
          <Segmented
            ariaLabel="Data source"
            className="w-full"
            value={config.source}
            onChange={(source) => update({ source })}
            options={[
              { value: "notebook", label: "Notebook's 200" },
              { value: "custom", label: "Make your own" },
            ]}
          />
          {config.source === "notebook" ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              The exact 200 ratings the notebook generated with{" "}
              <span className="num">np.random.seed(42)</span>: 60% &ldquo;sci-fi lovers&rdquo;
              around 7.5 and 40% &ldquo;romance lovers&rdquo; around 4.0, clipped to 1 to 10.
            </p>
          ) : (
            <div className="space-y-4">
              <Callout variant="note" className="text-xs">
                Generated in your browser with a seeded generator using the notebook&apos;s recipe.
                Not the notebook&apos;s data: NumPy&apos;s random stream cannot be reproduced here.
              </Callout>
              <ParamSlider
                label="ratings (n)"
                value={config.gen.n}
                min={20}
                max={2000}
                step={10}
                format={(v) => String(v)}
                onChange={(n) => updateGen({ n })}
              />
              <ParamSlider
                label="share in group 1 (π₁)"
                value={config.gen.pi1}
                min={0.05}
                max={0.95}
                step={0.01}
                onChange={(pi1) => updateGen({ pi1 })}
              />
              <ParamSlider
                label="group 1 mean"
                accent={1}
                value={config.gen.mu1}
                min={1}
                max={10}
                step={0.1}
                format={(v) => v.toFixed(1)}
                onChange={(mu1) => updateGen({ mu1 })}
              />
              <ParamSlider
                label="group 2 mean"
                accent={2}
                value={config.gen.mu2}
                min={1}
                max={10}
                step={0.1}
                format={(v) => v.toFixed(1)}
                onChange={(mu2) => updateGen({ mu2 })}
              />
              <ParamSlider
                label="group 1 spread (σ)"
                accent={1}
                value={config.gen.sigma1}
                min={0.2}
                max={3}
                step={0.05}
                onChange={(sigma1) => updateGen({ sigma1 })}
              />
              <ParamSlider
                label="group 2 spread (σ)"
                accent={2}
                value={config.gen.sigma2}
                min={0.2}
                max={3}
                step={0.05}
                onChange={(sigma2) => updateGen({ sigma2 })}
              />
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={config.gen.clip}
                    onCheckedChange={(clip) => updateGen({ clip })}
                  />
                  clip to 1 to 10
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateGen({ seed: config.gen.seed + 1 })}
                >
                  <Dices data-icon="inline-start" />
                  New sample
                </Button>
              </div>
              <p className="num text-xs text-muted-foreground">seed {config.gen.seed}</p>
            </div>
          )}
        </section>

        <section className="sheet space-y-4 p-4">
          <h2 className="text-base font-semibold">Starting guess</h2>
          <Segmented
            ariaLabel="Initialisation"
            size="sm"
            className="w-full"
            value={config.init}
            onChange={(init: InitStrategy) => update({ init })}
            options={[
              { value: "notebook", label: "Notebook" },
              { value: "kmeans++", label: "k-means++" },
              { value: "manual", label: "Drag" },
            ]}
          />
          <p className="text-sm leading-relaxed text-muted-foreground">{init.description}</p>
          {config.init === "manual" ? (
            <div className="space-y-4">
              <ParamSlider
                label="μ₁"
                accent={1}
                value={config.manual.mu1}
                min={0.75}
                max={10.25}
                step={0.05}
                onChange={(mu1) => update({ manual: { ...config.manual, mu1 } })}
              />
              <ParamSlider
                label="μ₂"
                accent={2}
                value={config.manual.mu2}
                min={0.75}
                max={10.25}
                step={0.05}
                onChange={(mu2) => update({ manual: { ...config.manual, mu2 } })}
              />
              <ParamSlider
                label="σ₁"
                accent={1}
                value={config.manual.sigma1}
                min={0.1}
                max={3}
                step={0.05}
                onChange={(sigma1) => update({ manual: { ...config.manual, sigma1 } })}
              />
              <ParamSlider
                label="σ₂"
                accent={2}
                value={config.manual.sigma2}
                min={0.1}
                max={3}
                step={0.05}
                onChange={(sigma2) => update({ manual: { ...config.manual, sigma2 } })}
              />
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => update({ initSeed: config.initSeed + 1 })}
            >
              <Dices data-icon="inline-start" />
              Draw another start
            </Button>
          )}
          {config.initSeed > 0 && config.init === "notebook" && config.source === "notebook" && (
            <button
              type="button"
              className="link block text-sm"
              onClick={() => update({ initSeed: 0 })}
            >
              Back to the notebook&apos;s own start
            </button>
          )}
        </section>

        <section className="sheet space-y-4 p-4">
          <h2 className="text-base font-semibold">Stopping rule</h2>
          <ParamSlider
            label="max iterations"
            value={config.maxIterations}
            min={5}
            max={500}
            step={5}
            format={(v) => String(v)}
            onChange={(maxIterations) => update({ maxIterations })}
            hint="The notebook used 15."
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">
              tolerance on |Δ
              <Ell />|
            </p>
            <Segmented
              ariaLabel="Tolerance"
              size="sm"
              className="w-full"
              value={config.tolerance.toExponential(0) as (typeof TOLERANCES)[number]}
              onChange={(v) => update({ tolerance: Number(v) })}
              options={TOLERANCES.map((t) => ({ value: t, label: t }))}
            />
          </div>
          <div className="space-y-3 border-t pt-4">
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              variance floor (not in the notebook)
              <Switch checked={config.floorOn} onCheckedChange={(floorOn) => update({ floorOn })} />
            </label>
            {config.floorOn && (
              <ParamSlider
                label="σ ≥"
                value={config.floor}
                min={0.01}
                max={0.5}
                step={0.01}
                onChange={(floor) => update({ floor })}
              />
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => update(DEFAULT_CONFIG)}>
            Reset everything
          </Button>
        </section>
      </aside>

      <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-2">
        <section aria-label="Log-likelihood" className="sheet p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Log-likelihood by iteration</h2>
            {finitePrefix.length > 1 &&
              (monotone ? (
                <span className="rounded-full bg-ok/10 px-2.5 py-0.5 text-xs font-medium text-ok">
                  never decreased ✓
                </span>
              ) : (
                <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                  decreased at some step ✗
                </span>
              ))}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            EM&apos;s guarantee: every iteration leaves the log-likelihood the same or higher. The
            check above runs on every trace you make.
          </p>
          <LineChart
            className="mt-2"
            height={200}
            xStart={1}
            cursor={stage >= 1 ? stage : null}
            yLabel="ℓ(θ)"
            series={[
              {
                id: "ll",
                label: "log-likelihood",
                values: llValues.slice(1),
                colour: "var(--foreground)",
              },
            ]}
            ariaLabel={`Log-likelihood over ${llValues.length - 1} iterations, from ${llValues[1]?.toFixed(2)} to ${llValues.at(-1)?.toFixed(2)}.`}
          />
          {llValues.length > 0 && (
            <p className="num mt-2 text-xs text-muted-foreground">
              start <Ell /> = {llValues[0].toFixed(2)} · after iteration 1 ={" "}
              {llValues[1]?.toFixed(2)} · last = {llValues.at(-1)?.toFixed(2)} (plotted from
              iteration 1, like the notebook&apos;s convergence plot)
            </p>
          )}
        </section>

        <ExplainIteration
          input={explainInput}
          context={`${config.source}:${config.gen.seed}:${config.init}:${config.initSeed}:${JSON.stringify(config.manual)}:${config.maxIterations}:${config.tolerance}:${config.floorOn ? config.floor : 0}:${stage}`}
        />

        {result && (
          <Results
            result={result}
            stage={stage}
            dataset={dataset}
            stopping={{ maxIterations: config.maxIterations, tolerance: config.tolerance }}
            isNotebookStart={
              config.source === "notebook" &&
              config.init === "notebook" &&
              config.initSeed === 0 &&
              !config.floorOn
            }
          />
        )}
        {model.error && (
          <Callout variant="warning" title="The worker failed">
            {model.error}
          </Callout>
        )}
      </div>
    </div>
  );
}
