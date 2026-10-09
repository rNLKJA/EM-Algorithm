"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ExplainIteration } from "@/components/ai/explain-iteration";
import { LineChart } from "@/components/charts/line-chart";
import { MixtureChart } from "@/components/charts/mixture-chart";
import { CorrectionTag } from "@/components/common/callout";
import { ComponentSwatch, Legend } from "@/components/common/legend";
import { ParamSlider } from "@/components/common/param-slider";
import { PlaybackControls } from "@/components/common/playback-controls";
import { ScrollX } from "@/components/common/scroll-x";
import { Segmented } from "@/components/common/segmented";
import { Switch } from "@/components/ui/switch";
import { usePlayback } from "@/hooks/use-playback";
import { useTweenedParams } from "@/hooks/use-tweened-params";
import { degenerateStatus, type IterationInput } from "@/lib/ai/explain-iteration";
import { diagnoseStep } from "@/lib/em/diagnose";
import { normalPdf } from "@/lib/em/gaussian";
import {
  README_AS_WRITTEN,
  README_RATINGS,
  STEPPER_PRESETS,
  buildStages,
  type StepperStage,
} from "@/lib/em/readme-example";
import type { MixtureParams } from "@/lib/em/types";
import { signed, smart } from "@/lib/format";
import { cn } from "@/lib/utils";

const DATA = [...README_RATINGS];
const MAX_ITERATIONS = 15;
const TOLERANCE = 1e-6;
type PresetId = (typeof STEPPER_PRESETS)[number]["id"] | "custom";

export interface StepperFormulas {
  eStep: ReactNode;
  mStep: ReactNode;
  logLik: ReactNode;
}

function stageLabel(stage: StepperStage): string {
  if (stage.kind === "init") return "Start";
  return `${stage.kind === "e" ? "E" : "M"}${stage.iteration}`;
}

function stageTitle(stage: StepperStage): string {
  if (stage.kind === "init") return "Initial guess (iteration 0)";
  if (stage.kind === "e")
    return `Iteration ${stage.iteration} · E-step: which group does each rating probably belong to?`;
  return `Iteration ${stage.iteration} · M-step: update what each group looks like`;
}

function stageAnnouncement(stage: StepperStage, last: boolean): string {
  if (stage.kind === "init") return "Start: the initial guess.";
  if (stage.kind === "e") return `Iteration ${stage.iteration}, E-step.`;
  const end = last
    ? Number.isFinite(stage.logLikelihood)
      ? " Last step: the log-likelihood stopped changing."
      : " Last step: the run broke down."
    : "";
  return `Iteration ${stage.iteration}, M-step. Log-likelihood ${smart(stage.logLikelihood, 4)}.${end}`;
}

export function Stepper({ formulas }: { formulas: StepperFormulas }) {
  const [preset, setPreset] = useState<PresetId>("readme");
  const [custom, setCustom] = useState<MixtureParams>({
    pi1: 0.5,
    pi2: 0.5,
    mu1: 3.5,
    mu2: 6,
    sigma1: 1.5,
    sigma2: 1.5,
  });
  const [showWritten, setShowWritten] = useState(true);

  const init = preset === "custom" ? custom : STEPPER_PRESETS.find((p) => p.id === preset)!.init;
  const stages = useMemo(
    () => buildStages(DATA, init, MAX_ITERATIONS, TOLERANCE, preset === "readme" ? 2 : 1),
    [init, preset],
  );
  const playback = usePlayback(stages.length, 1500);
  const stage = stages[playback.index];
  const tweened = useTweenedParams(stage.params);
  const isReadme = preset === "readme";

  const llSeries = useMemo(() => {
    const values = [stages[0].logLikelihood];
    for (const s of stages) if (s.kind === "m") values.push(s.logLikelihood);
    return values;
  }, [stages]);
  const yMax = useMemo(() => {
    let peak = 0;
    for (const st of stages) {
      const q = st.params;
      peak = Math.max(
        peak,
        q.pi1 / (q.sigma1 * Math.sqrt(2 * Math.PI)),
        q.pi2 / (q.sigma2 * Math.sqrt(2 * Math.PI)),
      );
    }
    return Math.min(1.6, Math.max(0.3, peak * 1.18));
  }, [stages]);
  const currentIteration =
    stage.kind === "init" ? 0 : stage.kind === "e" ? stage.iteration - 1 : stage.iteration;

  const choosePreset = (id: PresetId) => {
    setPreset(id);
    playback.reset();
  };
  const updateCustom = (patch: Partial<MixtureParams>) => {
    setPreset("custom");
    setCustom((c) => {
      const next = { ...c, ...patch };
      if (patch.pi1 !== undefined) next.pi2 = 1 - patch.pi1;
      return next;
    });
    playback.reset();
  };

  // ← / → step through the stages from anywhere on the page, except while a control
  // that uses the arrow keys itself (slider, radio group, text field, scroll box) has focus.
  const { next, prev } = playback;
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "[role=slider],[role=radio],[role=tab],[role=region],input,select,textarea,[contenteditable=true]",
        )
      )
        return;
      if (event.key === "ArrowRight") next();
      else prev();
      event.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [next, prev]);

  const gammaForChart = stage.kind === "init" ? undefined : stage.e.gamma1;
  const explainInput = useMemo(
    () => iterationInput(stages, playback.index),
    [stages, playback.index],
  );
  const explainContext = `${preset}:${preset === "custom" ? JSON.stringify(custom) : ""}:${stage.kind === "init" ? 0 : stage.iteration}`;
  const chartParams = stage.kind === "e" ? stage.params : tweened;

  return (
    // DOM order is the phone order: starting guess, chart and controls, the narration
    // for the current stage, then the log-likelihood. On lg the narration becomes the
    // right-hand column beside the other three.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_auto_1fr]">
      <section
        aria-label="Starting guess"
        className="sheet space-y-4 p-4 sm:p-5 lg:col-start-1 lg:row-start-1"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Starting guess</h2>
          <Segmented
            ariaLabel="Choose a starting guess"
            size="sm"
            className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto"
            value={preset}
            onChange={choosePreset}
            options={[
              ...STEPPER_PRESETS.map((p) => ({
                value: p.id as PresetId,
                label:
                  p.id === "readme" ? "Explainer's" : p.id === "overlap" ? "Muddled" : "Lopsided",
                description: p.description,
              })),
              { value: "custom" as PresetId, label: "Your own" },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {preset === "custom"
            ? "Drag the means on the chart or use the sliders. EM restarts from your guess."
            : STEPPER_PRESETS.find((p) => p.id === preset)!.description}
        </p>
        {preset === "custom" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ParamSlider
              label="μ₁"
              accent={1}
              value={custom.mu1}
              min={0.5}
              max={10.5}
              step={0.05}
              onChange={(v) => updateCustom({ mu1: v })}
            />
            <ParamSlider
              label="μ₂"
              accent={2}
              value={custom.mu2}
              min={0.5}
              max={10.5}
              step={0.05}
              onChange={(v) => updateCustom({ mu2: v })}
            />
            <ParamSlider
              label="σ₁"
              accent={1}
              value={custom.sigma1}
              min={0.2}
              max={4}
              step={0.05}
              onChange={(v) => updateCustom({ sigma1: v })}
            />
            <ParamSlider
              label="σ₂"
              accent={2}
              value={custom.sigma2}
              min={0.2}
              max={4}
              step={0.05}
              onChange={(v) => updateCustom({ sigma2: v })}
            />
            <ParamSlider
              label="π₁ (π₂ = 1 − π₁)"
              value={custom.pi1}
              min={0.05}
              max={0.95}
              step={0.01}
              onChange={(v) => updateCustom({ pi1: v })}
            />
          </div>
        )}
      </section>

      <section
        aria-label="Mixture chart"
        className="sheet p-4 sm:p-5 lg:col-start-1 lg:row-start-2"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Legend labels={["Group 1", "Group 2"]} />
          <span className="text-xs text-muted-foreground">
            bars under each rating: γ₁ (teal) vs γ₂ (coral)
          </span>
        </div>
        <MixtureChart
          data={DATA}
          params={chartParams}
          gamma1={gammaForChart}
          pointsMode="markers"
          showHistogram={false}
          height={300}
          yMax={yMax}
          componentLabels={["group 1", "group 2"]}
          draggable={preset === "custom" && stage.kind === "init"}
          onMeansChange={(mu1, mu2) => updateCustom({ mu1, mu2 })}
          ariaLabel={`Four ratings 2, 3, 7 and 8 with the two group densities at ${stageTitle(stage)}. Group 1 mean ${chartParams.mu1.toFixed(2)}, group 2 mean ${chartParams.mu2.toFixed(2)}.`}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <PlaybackControls
            playing={playback.playing}
            atStart={playback.atStart}
            atEnd={playback.atEnd}
            onReset={playback.reset}
            onPrev={playback.prev}
            onNext={playback.next}
            onToggle={playback.toggle}
            onEnd={playback.toEnd}
          />
          <p className="num text-sm text-muted-foreground" aria-hidden>
            step {playback.index + 1} / {stages.length}
          </p>
          {/* A short summary for screen readers, announced on manual steps and when
              playback stops; the full stage panel is not a live region. */}
          <p className="sr-only" aria-live="polite" aria-atomic>
            {playback.playing
              ? "Playing"
              : stageAnnouncement(stage, playback.index === stages.length - 1)}
          </p>
        </div>
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Stages">
          {stages.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  playback.setPlaying(false);
                  playback.setIndex(i);
                }}
                aria-current={i === playback.index ? "step" : undefined}
                aria-label={`${stageLabel(s)}: ${stageTitle(s)}`}
                className={cn(
                  "num h-7 min-w-10 rounded-md border px-2 text-xs transition-colors",
                  i === playback.index
                    ? "border-foreground bg-foreground text-background"
                    : i < playback.index
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                )}
              >
                {stageLabel(s)}
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Tip: ← and → step through the stages (except while a slider has focus).
        </p>
      </section>

      <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
        <section aria-label="Current stage" className="sheet min-w-0 p-4 sm:p-6">
          <p className="eyebrow">
            {stage.kind === "init" ? "start" : stage.kind === "e" ? "expectation" : "maximisation"}
          </p>
          <h2 className="mt-2 text-xl leading-snug font-semibold sm:text-2xl">
            {stageTitle(stage)}
          </h2>
          {isReadme && (
            <div className="mt-4 flex items-center gap-2.5">
              <Switch id="show-written" checked={showWritten} onCheckedChange={setShowWritten} />
              <label htmlFor="show-written" className="text-sm">
                Show the explainer&apos;s hand-worked numbers beside the exact ones
              </label>
            </div>
          )}
          <div className="mt-5">
            {stage.kind === "init" && <InitPanel params={stage.params} />}
            {stage.kind === "e" && (
              <EPanel
                stage={stage}
                formula={formulas.eStep}
                written={isReadme && showWritten && stage.iteration === 1}
                repeat={isReadme && showWritten && stage.iteration === 2}
              />
            )}
            {stage.kind === "m" && (
              <MPanel
                stage={stage}
                formula={formulas.mStep}
                written={isReadme && showWritten && stage.iteration === 1}
              />
            )}
          </div>
        </section>
        <ExplainIteration input={explainInput} context={explainContext} />
      </div>
      <section
        aria-label="Log-likelihood"
        className="sheet p-4 sm:p-5 lg:col-start-1 lg:row-start-3 lg:self-start"
      >
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Log-likelihood</h2>
          <span className="num text-sm">{smart(stage.logLikelihood, 4)}</span>
        </div>
        <div className="text-sm text-muted-foreground">{formulas.logLik}</div>
        <LineChart
          height={150}
          xStart={0}
          cursor={currentIteration}
          yLabel="ℓ(θ)"
          series={[
            { id: "ll", label: "log-likelihood", values: llSeries, colour: "var(--foreground)" },
          ]}
          ariaLabel={`Log-likelihood by iteration: ${llSeries.map((v) => v.toFixed(3)).join(", ")}`}
        />
      </section>
    </div>
  );
}

/** The numbers of the iteration on screen, for "Explain this iteration" (null at the start). */
function iterationInput(stages: StepperStage[], index: number): IterationInput | null {
  const stage = stages[index];
  if (stage.kind === "init") return null;
  const m = stage.kind === "m" ? stage : stages[index + 1];
  if (!m || m.kind !== "m") return null;
  const last = m.index === stages.length - 1;
  const status = !Number.isFinite(m.logLikelihood)
    ? degenerateStatus(diagnoseStep(DATA, m.before, m.params))
    : !last
      ? "continuing"
      : Math.abs(m.improvement) < TOLERANCE
        ? "converged"
        : "stopped-at-cap";
  return {
    source: "stepper",
    dataset: "The explainer's four hand-worked ratings, [2, 3, 7, 8]",
    data: DATA,
    iteration: m.iteration,
    stage: stage.kind,
    before: m.before,
    after: m.params,
    e: m.e,
    logLikelihoodBefore: m.logLikelihood - m.improvement,
    logLikelihoodAfter: m.logLikelihood,
    stopping: { tolerance: TOLERANCE, maxIterations: MAX_ITERATIONS, status },
  };
}

function InitPanel({ params }: { params: MixtureParams }) {
  return (
    <div className="space-y-4 text-[0.95rem] leading-relaxed">
      <p>
        We have four ratings, <span className="num">[2, 3, 7, 8]</span>, and suspect two kinds of
        user behind them. EM needs a starting guess for each group&apos;s average (μ), spread (σ)
        and share of users (π). It does not have to be good; the steps fix it.
      </p>
      <ParamTable rows={[{ label: "guess", params }]} />
      <p className="text-sm text-muted-foreground">Press play, or step with the arrow buttons.</p>
    </div>
  );
}

function ParamTable({ rows }: { rows: { label: string; params: MixtureParams }[] }) {
  return (
    <ScrollX label="Parameters">
      <table className="num w-full min-w-[18rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1.5 pr-3 font-normal" scope="col">
              group
            </th>
            {rows.map((r) => (
              <th key={r.label} className="py-1.5 pr-3 font-normal" colSpan={3} scope="colgroup">
                {r.label}: π · μ · σ
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {([1, 2] as const).map((k) => (
            <tr key={k} className="border-t">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                <span className="flex items-center gap-1.5">
                  <ComponentSwatch k={k} />
                  {k}
                </span>
              </th>
              {rows.map((r) => (
                <ParamCells key={r.label} p={r.params} k={k} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

function ParamCells({ p, k }: { p: MixtureParams; k: 1 | 2 }) {
  const v = k === 1 ? [p.pi1, p.mu1, p.sigma1] : [p.pi2, p.mu2, p.sigma2];
  return (
    <>
      {v.map((x, i) => (
        <td key={i} className="py-2 pr-3">
          {x.toFixed(4)}
        </td>
      ))}
    </>
  );
}

function Written({ children, wrong }: { children: ReactNode; wrong?: boolean }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex items-center gap-1.5 text-[0.75rem]",
        wrong ? "text-correction" : "text-muted-foreground",
      )}
    >
      <span className="font-sans">explainer:</span> {children}
      {wrong && <CorrectionTag>off</CorrectionTag>}
    </span>
  );
}

function EPanel({
  stage,
  formula,
  written,
  repeat,
}: {
  stage: Extract<StepperStage, { kind: "e" }>;
  formula: ReactNode;
  written: boolean;
  repeat: boolean;
}) {
  const p = stage.params;
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 px-3 py-1 text-sm">{formula}</div>
      <ul className="space-y-2.5" aria-label="Responsibilities for each rating">
        {DATA.map((x, i) => {
          const f1 = normalPdf(x, p.mu1, p.sigma1);
          const f2 = normalPdf(x, p.mu2, p.sigma2);
          const w = README_AS_WRITTEN.eStep[i];
          const off = (a: number, b: number) =>
            Math.abs(a - b) / Math.max(Math.abs(b), 1e-300) > 0.01;
          return (
            <li key={x} className="rounded-lg border px-3 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="num flex size-8 items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background">
                  {x}
                </span>
                <GammaBar g={stage.e.gamma1[i]} />
                <span className="num text-xs text-muted-foreground">
                  γ₂ = {smart(stage.e.gamma2[i])}
                </span>
                {written && (
                  <span className="num text-xs text-muted-foreground">
                    <span className="font-sans">explainer:</span> {w.gamma1} / {w.gamma2}
                  </span>
                )}
              </div>
              <dl className="num mt-2.5 grid gap-1.5 text-[0.8rem]">
                {([1, 2] as const).map((k) => {
                  const pi = k === 1 ? p.pi1 : p.pi2;
                  const f = k === 1 ? f1 : f2;
                  const weighted = k === 1 ? stage.e.weighted1[i] : stage.e.weighted2[i];
                  const wf = k === 1 ? w.f1 : w.f2;
                  const ww = k === 1 ? w.w1 : w.w2;
                  return (
                    <div key={k} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <dt className="flex items-center gap-1.5 font-sans text-muted-foreground">
                        <ComponentSwatch k={k} className="h-3 w-6" />π{k === 1 ? "₁" : "₂"}·f
                        {k === 1 ? "₁" : "₂"}({x})
                      </dt>
                      <dd>
                        {pi.toFixed(2)} × {smart(f)} ={" "}
                        <strong className="font-medium">{smart(weighted)}</strong>
                      </dd>
                      {written && (
                        <dd
                          className={cn(
                            "flex items-center gap-1.5",
                            off(wf, f) ? "text-correction" : "text-muted-foreground",
                          )}
                        >
                          <span className="font-sans text-[0.72rem]">explainer:</span>0.5 × {wf} ={" "}
                          {ww}
                          {off(wf, f) && <CorrectionTag>off</CorrectionTag>}
                        </dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            </li>
          );
        })}
      </ul>
      {written && (
        <p className="rounded-lg border border-correction/30 bg-correction-bg px-3 py-2.5 text-sm leading-relaxed">
          The explainer plugs in densities of 0.8 and 0.6 for ratings 2 and 3, but both sit exactly
          one σ from 2.5, so both densities are <span className="num">0.4839</span>. The cross-group
          densities are far smaller than 0.0001 (about 10⁻¹⁸ and 10⁻²⁷). The responsibilities still
          round to the same story: 2 and 3 belong to group 1, 7 and 8 to group 2.
        </p>
      )}
      {repeat && (
        <p className="text-sm text-muted-foreground">
          The explainer notes that iteration 2 repeats iteration 1&apos;s numbers. Exactly so: the
          first M-step landed on the same parameters it started from.
        </p>
      )}
    </div>
  );
}

function GammaBar({ g }: { g: number }) {
  const pct = Number.isFinite(g) ? Math.max(0, Math.min(1, g)) : 0;
  return (
    <span className="num flex items-center gap-2">
      <span
        aria-hidden
        className="relative inline-block h-2 w-12 overflow-hidden rounded-full bg-comp-2"
      >
        <span
          className="absolute inset-y-0 left-0 bg-comp-1"
          style={{ width: `${Math.round(pct * 1000) / 10}%` }}
        />
      </span>
      {smart(g)}
    </span>
  );
}

function MPanel({
  stage,
  formula,
  written,
}: {
  stage: Extract<StepperStage, { kind: "m" }>;
  formula: ReactNode;
  written: boolean;
}) {
  const { sums, params: p, before } = stage;
  const n = DATA.length;
  const degeneracy = Number.isFinite(stage.logLikelihood) ? null : diagnoseStep(DATA, before, p);
  const w = README_AS_WRITTEN.mStep;
  const lines: {
    k: 1 | 2;
    label: string;
    expr: string;
    value: number;
    was: number;
    writtenExpr?: string;
  }[] = [
    {
      k: 1,
      label: "π₁",
      expr: `Σγ₁ / n = ${sums.g1.toFixed(4)} / ${n}`,
      value: p.pi1,
      was: before.pi1,
      writtenExpr: `2.0000 / 4 = ${w.pi1}`,
    },
    {
      k: 2,
      label: "π₂",
      expr: `Σγ₂ / n = ${sums.g2.toFixed(4)} / ${n}`,
      value: p.pi2,
      was: before.pi2,
      writtenExpr: `2.0000 / 4 = ${w.pi2}`,
    },
    {
      k: 1,
      label: "μ₁",
      expr: `Σγ₁x / Σγ₁ = ${sums.g1x.toFixed(4)} / ${sums.g1.toFixed(4)}`,
      value: p.mu1,
      was: before.mu1,
      writtenExpr: `${w.mu1Numerator} / ${w.denominator.toFixed(4)} = ${w.mu1}`,
    },
    {
      k: 2,
      label: "μ₂",
      expr: `Σγ₂x / Σγ₂ = ${sums.g2x.toFixed(4)} / ${sums.g2.toFixed(4)}`,
      value: p.mu2,
      was: before.mu2,
      writtenExpr: `${w.mu2Numerator} / ${w.denominator.toFixed(4)} = ${w.mu2}`,
    },
    {
      k: 1,
      label: "σ₁",
      expr: `√(Σγ₁(x − μ₁)² / Σγ₁) = √(${sums.g1sq.toFixed(4)} / ${sums.g1.toFixed(4)})`,
      value: p.sigma1,
      was: before.sigma1,
      writtenExpr: `√(0.5 / 2.0000) = ${w.sigma1}`,
    },
    {
      k: 2,
      label: "σ₂",
      expr: `√(Σγ₂(x − μ₂)² / Σγ₂) = √(${sums.g2sq.toFixed(4)} / ${sums.g2.toFixed(4)})`,
      value: p.sigma2,
      was: before.sigma2,
      writtenExpr: `√(0.5 / 2.0000) = ${w.sigma2}`,
    },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 px-3 py-1 text-sm">{formula}</div>
      <ul className="space-y-2.5">
        {lines.map((l) => (
          <li key={l.label} className="rounded-lg border px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="flex items-center gap-2 font-medium">
                <ComponentSwatch k={l.k} />
                {l.label}
              </span>
              <span className="num text-sm">
                {l.value.toFixed(4)}{" "}
                <span className="text-muted-foreground">(was {l.was.toFixed(4)})</span>
              </span>
            </div>
            <p className="num mt-1 text-[0.78rem] break-words text-muted-foreground">{l.expr}</p>
            {written && l.writtenExpr && <Written>{l.writtenExpr}</Written>}
          </li>
        ))}
      </ul>
      <p className="num text-sm">
        log-likelihood {smart(stage.logLikelihood, 4)}{" "}
        <span className="text-muted-foreground">(change {signed(stage.improvement, 6)})</span>
      </p>
      {degeneracy && (
        <p className="rounded-lg border border-destructive/35 bg-destructive/[0.06] px-3 py-2.5 text-sm leading-relaxed">
          {degeneracy.kind === "underflow" ? (
            <>
              This start broke down numerically, not by collapse. Rating{" "}
              <span className="num">{degeneracy.x}</span> sits{" "}
              <span className="num">{degeneracy.z[0].toFixed(1)}σ</span> from μ₁ and{" "}
              <span className="num">{degeneracy.z[1].toFixed(1)}σ</span> from μ₂, so both of its
              densities round to 0 in floating point and its responsibilities are 0/0 = NaN; every
              update after that is NaN too. The notebook&apos;s{" "}
              <span className="num">normal_pdf</span> does exactly the same. Wider spreads or closer
              means avoid it.
            </>
          ) : degeneracy.kind === "empty" ? (
            <>
              This start broke down: group {degeneracy.component} got a responsibility of 0 for
              every rating, so its new mean is 0/0 = NaN. Try a start whose groups overlap the data.
            </>
          ) : (
            <>
              This start collapsed: group {degeneracy.component} ended up owning a single rating,
              its spread shrank to zero and the next density is 0/0. The{" "}
              <a className="link" href="/pitfalls#variance-collapse">
                pitfalls page
              </a>{" "}
              explains why.
            </>
          )}
        </p>
      )}
      {written && (
        <p className="text-sm text-muted-foreground">
          With the rounded responsibilities the explainer gets 5.0015 / 2.0000 for μ₁; the exact
          responsibilities give 5.0000 / 2.0000. Both round to the same update.
        </p>
      )}
    </div>
  );
}
