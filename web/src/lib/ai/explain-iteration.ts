/**
 * "Explain this iteration" (optional, bring-your-own-key).
 *
 * The model receives only the numbers of the EM iteration the reader is looking
 * at: the parameters before and after, the E-step responsibilities (every
 * rating's, for the four-rating stepper; a summary for the 200-rating
 * playground), the log-likelihood before and after, and the stopping rule. It
 * must explain that iteration using those numbers alone. A grounding check then
 * lists any number in the reply that does not appear in what was sent.
 */
import { z } from "zod";
import type { EStepResult, MixtureParams } from "../em/types";
import { quantile } from "../stats/descriptive";

export const EXPLAIN_FEATURE = "explain-iteration";

export const ExplanationSchema = z.object({
  headline: z.string().min(1).max(400),
  e_step: z.string().min(1).max(1200),
  m_step: z.string().min(1).max(1200),
  log_likelihood: z.string().min(1).max(700),
  caveats: z.array(z.string().max(400)).max(4),
});

export type Explanation = z.infer<typeof ExplanationSchema>;

/** The same contract as JSON Schema, for the providers' structured-output modes. */
export const EXPLANATION_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "e_step", "m_step", "log_likelihood", "caveats"],
  properties: {
    headline: { type: "string", description: "One-sentence takeaway for this iteration." },
    e_step: {
      type: "string",
      description: "What the E-step's responsibilities say, citing them.",
    },
    m_step: {
      type: "string",
      description: "How each share, mean and spread moved in the M-step, and why.",
    },
    log_likelihood: {
      type: "string",
      description: "What the log-likelihood change shows, including the stopping rule.",
    },
    caveats: { type: "array", items: { type: "string" } },
  },
};

export const EXPLAIN_SYSTEM_PROMPT = [
  "You are a careful statistics tutor on a teaching site about the EM algorithm.",
  "You explain one iteration of EM for a two-component Gaussian mixture fitted to movie ratings.",
  "You receive a JSON snapshot with the numbers of this iteration: the parameters before and after it, the E-step responsibilities, the log-likelihood before and after, and the stopping rule.",
  "Rules:",
  "- Use only numbers that appear in the snapshot (rounding is fine). Do not compute new statistics, do not invent values and do not predict later iterations.",
  "- e_step: say which component each rating (or the ratings overall) most likely belongs to, citing the responsibilities.",
  "- m_step: explain how each share (pi), mean (mu) and spread (sigma) moved, as responsibility-weighted shares, averages and spreads.",
  "- log_likelihood: say what the change shows. EM never decreases it. Compare the change with the stopping tolerance in the snapshot and say whether the stopping rule is met.",
  "- Component numbers are arbitrary labels: never claim that component 1 or 2 is a particular kind of viewer.",
  "- If the snapshot does not support a claim, say that it is not available.",
  "- Plain Australian English, no markdown, about 150 words in total.",
].join("\n");

const sig = (v: number, digits = 4) => (Number.isFinite(v) ? Number(v.toPrecision(digits)) : v);

function rounded(p: MixtureParams) {
  return {
    pi1: sig(p.pi1),
    pi2: sig(p.pi2),
    mu1: sig(p.mu1),
    mu2: sig(p.mu2),
    sigma1: sig(p.sigma1),
    sigma2: sig(p.sigma2),
  };
}

export interface IterationInput {
  /** where the reader is: the four-rating stepper or the playground */
  source: "stepper" | "playground";
  /** short description of the data set */
  dataset: string;
  data: readonly number[];
  /** t >= 1: the E-step uses θ(t-1), the M-step produces θ(t) */
  iteration: number;
  /** the half of the iteration on screen (stepper only) */
  stage?: "e" | "m";
  before: MixtureParams;
  after: MixtureParams;
  e: Pick<EStepResult, "gamma1" | "gamma2">;
  logLikelihoodBefore: number;
  logLikelihoodAfter: number;
  stopping: {
    tolerance: number;
    maxIterations: number;
    /** what happened at this iteration under the rule */
    status: "continuing" | "converged" | "stopped-at-cap" | "collapsed";
  };
}

export interface IterationSnapshot {
  page: string;
  dataset: string;
  n: number;
  iteration: number;
  stage_on_screen?: string;
  parameters_before: ReturnType<typeof rounded>;
  parameters_after: ReturnType<typeof rounded>;
  responsibilities?: { rating: number; gamma1: number; gamma2: number }[];
  responsibility_summary?: {
    share_component1: number;
    share_component2: number;
    ratings_more_likely_component1: number;
    ratings_more_likely_component2: number;
    gamma1_at_rating: { rating: number; gamma1: number }[];
  };
  log_likelihood_before: number;
  log_likelihood_after: number;
  log_likelihood_change: number;
  stopping_rule: { tolerance: number; max_iterations: number; status: string };
  notes: string[];
}

/** Every rating's responsibilities when there are few; a summary otherwise. */
export const LIST_ALL_BELOW = 13;

export function buildIterationSnapshot(input: IterationInput): IterationSnapshot {
  const n = input.data.length;
  const change = input.logLikelihoodAfter - input.logLikelihoodBefore;
  const snapshot: IterationSnapshot = {
    page:
      input.source === "stepper"
        ? "Stepper: the explainer's four-rating example, one stage at a time"
        : "Playground: EM on a data set of ratings",
    dataset: input.dataset,
    n,
    iteration: input.iteration,
    ...(input.stage
      ? { stage_on_screen: input.stage === "e" ? "E-step (expectation)" : "M-step (maximisation)" }
      : {}),
    parameters_before: rounded(input.before),
    parameters_after: rounded(input.after),
    log_likelihood_before: sig(input.logLikelihoodBefore, 7),
    log_likelihood_after: sig(input.logLikelihoodAfter, 7),
    log_likelihood_change: sig(change, 4),
    stopping_rule: {
      tolerance: input.stopping.tolerance,
      max_iterations: input.stopping.maxIterations,
      status: input.stopping.status,
    },
    notes: [
      "The E-step uses parameters_before; the M-step turns the responsibilities into parameters_after.",
      "gamma1 is the probability that a rating came from component 1; gamma1 + gamma2 = 1.",
      "The run stops when |log_likelihood_change| is below the tolerance (from the second iteration on) or at max_iterations.",
    ],
  };
  if (n < LIST_ALL_BELOW) {
    snapshot.responsibilities = input.data.map((x, i) => ({
      rating: sig(x),
      gamma1: sig(input.e.gamma1[i]),
      gamma2: sig(input.e.gamma2[i]),
    }));
  } else {
    let g1 = 0;
    let more1 = 0;
    for (let i = 0; i < n; i++) {
      g1 += input.e.gamma1[i];
      if (input.e.gamma1[i] > 0.5) more1++;
    }
    const sorted = [...input.data].sort((a, b) => a - b);
    const at = [0, 0.25, 0.5, 0.75, 1].map((p) => quantile(sorted, p));
    snapshot.responsibility_summary = {
      share_component1: sig(g1 / n),
      share_component2: sig(1 - g1 / n),
      ratings_more_likely_component1: more1,
      ratings_more_likely_component2: n - more1,
      gamma1_at_rating: at.map((x) => {
        // the responsibility of the data point nearest each quantile
        let best = 0;
        for (let i = 1; i < n; i++)
          if (Math.abs(input.data[i] - x) < Math.abs(input.data[best] - x)) best = i;
        return { rating: sig(input.data[best]), gamma1: sig(input.e.gamma1[best]) };
      }),
    };
  }
  return snapshot;
}

export function buildExplainUserPrompt(snapshot: IterationSnapshot): string {
  return `Explain this EM iteration to the reader. Snapshot (JSON):\n${JSON.stringify(snapshot, null, 2)}`;
}

/** Plain-text rendering of an explanation (used for display, editing and export). */
export function explanationToText(e: Explanation): string {
  const lines = [
    e.headline,
    "",
    `E-step: ${e.e_step}`,
    `M-step: ${e.m_step}`,
    `Log-likelihood: ${e.log_likelihood}`,
  ];
  if (e.caveats.length) lines.push("", ...e.caveats.map((c) => `Caveat: ${c}`));
  return lines.join("\n");
}

/* ---------------------------------------------------------------------------
 * Grounding check
 * ------------------------------------------------------------------------- */

function collectNumbers(value: unknown, out: number[]) {
  if (typeof value === "number") out.push(value);
  else if (typeof value === "string") extractNumbers(value).forEach((n) => out.push(n.value));
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => collectNumbers(v, out));
}

/** Numbers written in free text, skipping identifiers such as γ1 or mu2. */
export function extractNumbers(text: string): { raw: string; value: number; decimals: number }[] {
  const out: { raw: string; value: number; decimals: number }[] = [];
  // the leading group stands in for a lookbehind: a number must not follow a letter, digit or dot
  const re = /(^|[^A-Za-z0-9_.Ͱ-Ͽ₀-₉])([-−]?\d+(?:\.\d+)?(?:e[-−]?\d+)?)/g;
  for (const m of text.matchAll(re)) {
    const raw = m[2].replace(/−/g, "-");
    const mantissa = raw.split("e")[0];
    const decimals = mantissa.includes(".") ? mantissa.split(".")[1].length : 0;
    out.push({ raw: m[2], value: Number(raw), decimals });
  }
  return out;
}

/**
 * Numbers in `text` that cannot be matched (after rounding to the precision they
 * are written with) to any number in `snapshot`. Small integers (0 to 10) are
 * allowed: they are usually counts, ratings or ordinals ("two components").
 * Percentages are also matched as proportions (62% against 0.62).
 */
export function findUngroundedNumbers(text: string, snapshot: unknown): string[] {
  const known: number[] = [];
  collectNumbers(snapshot, known);
  const bad = new Set<string>();
  const proportions = known.map((k) => k * 100);
  for (const n of extractNumbers(text)) {
    if (n.decimals === 0 && Math.abs(n.value) <= 10) continue;
    const tol = 0.5 * 10 ** -n.decimals + 1e-9;
    const match = (k: number) => Math.abs(Math.abs(n.value) - Math.abs(k)) <= tol;
    if (!known.some(match) && !proportions.some(match)) bad.add(n.raw);
  }
  return [...bad];
}
