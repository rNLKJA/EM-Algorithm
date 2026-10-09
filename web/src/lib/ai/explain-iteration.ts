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

/**
 * Validates exactly the contract in EXPLANATION_JSON_SCHEMA and nothing more.
 * Neither provider's structured-output mode enforces length or item limits, so
 * a reply that obeys the schema must never be discarded for being long: the
 * display limits are applied afterwards by `forDisplay`.
 */
export const ExplanationSchema = z.object({
  headline: z.string(),
  e_step: z.string(),
  m_step: z.string(),
  log_likelihood: z.string(),
  caveats: z.array(z.string()),
});

export type Explanation = z.infer<typeof ExplanationSchema>;

/** Display limits, in characters (caveats: items). */
export const DISPLAY_LIMITS = {
  headline: 400,
  e_step: 1200,
  m_step: 1200,
  log_likelihood: 700,
  caveat: 400,
  caveats: 4,
} as const;

function clip(text: string, max: number): [string, boolean] {
  return text.length > max ? [`${text.slice(0, max - 1).trimEnd()}…`, true] : [text, false];
}

/**
 * The explanation as shown on screen: long fields cut at DISPLAY_LIMITS and at
 * most four caveats. `shortened` says whether anything was cut; the full reply
 * stays in the audit log and is what the grounding check reads.
 */
export function forDisplay(e: Explanation): { explanation: Explanation; shortened: boolean } {
  let shortened = false;
  const cut = (text: string, max: number) => {
    const [out, was] = clip(text, max);
    shortened ||= was;
    return out;
  };
  const caveats = e.caveats
    .slice(0, DISPLAY_LIMITS.caveats)
    .map((c) => cut(c, DISPLAY_LIMITS.caveat));
  if (e.caveats.length > DISPLAY_LIMITS.caveats) shortened = true;
  return {
    explanation: {
      headline: cut(e.headline, DISPLAY_LIMITS.headline),
      e_step: cut(e.e_step, DISPLAY_LIMITS.e_step),
      m_step: cut(e.m_step, DISPLAY_LIMITS.m_step),
      log_likelihood: cut(e.log_likelihood, DISPLAY_LIMITS.log_likelihood),
      caveats,
    },
    shortened,
  };
}

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

const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
  "⁺": "+",
};

/**
 * Rewrite scientific notation in its written forms as e-notation, so that
 * "1.5 × 10⁻⁵", "1.5 x 10^-5", "10^-6" and "10⁻⁶" are read as 1.5e-5 and 1e-6.
 */
export function normaliseScientific(text: string): string {
  return (
    text
      // superscript exponents (10⁻⁶, σ²) become ^-6, ^2
      .replace(/[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((c) => SUPERSCRIPT[c]).join("")}`)
      // mantissa × 10^k
      .replace(
        /(\d+(?:\.\d+)?)\s*[×x*·]\s*10\s*\^\s*\(?([-−+]?\d+)\)?/g,
        (_m, mant: string, exp: string) => `${mant}e${exp}`,
      )
      // a bare power of ten, 10^k
      .replace(
        /(^|[^A-Za-z0-9_.])10\s*\^\s*\(?([-−+]?\d+)\)?/g,
        (_m, pre: string, exp: string) => `${pre}1e${exp}`,
      )
  );
}

export interface WrittenNumber {
  raw: string;
  value: number;
  /** digits after the decimal point in the mantissa */
  decimals: number;
  /** the power of ten in e-notation (0 when there is none) */
  exponent: number;
  scientific: boolean;
}

/** Numbers written in free text, skipping identifiers such as γ1 or mu2. */
export function extractNumbers(text: string): WrittenNumber[] {
  const out: WrittenNumber[] = [];
  // the leading group stands in for a lookbehind: a number must not follow a letter, digit or dot
  const re = /(^|[^A-Za-z0-9_.Ͱ-Ͽ₀-₉])([-−]?\d+(?:\.\d+)?(?:[eE][-−+]?\d+)?)/g;
  for (const m of normaliseScientific(text).matchAll(re)) {
    const raw = m[2].replace(/−/g, "-");
    const [mantissa, exp] = raw.split(/[eE]/);
    const decimals = mantissa.includes(".") ? mantissa.split(".")[1].length : 0;
    out.push({
      raw: m[2],
      value: Number(raw),
      decimals,
      exponent: exp === undefined ? 0 : Number(exp),
      scientific: exp !== undefined,
    });
  }
  return out;
}

/**
 * Numbers in `text` that cannot be matched (after rounding to the precision they
 * are written with, exponent included: 3.1e-2 means 0.031 ± 0.0005) to any
 * number in `snapshot`. Whole numbers from 0 to 10 written without an exponent
 * are not checked: they are usually counts, ratings or ordinals ("two
 * components"). Percentages are also matched as proportions (62% against 0.62).
 */
export function findUngroundedNumbers(text: string, snapshot: unknown): string[] {
  const known: number[] = [];
  collectNumbers(snapshot, known);
  const bad = new Set<string>();
  const proportions = known.map((k) => k * 100);
  for (const n of extractNumbers(text)) {
    if (!n.scientific && n.decimals === 0 && Math.abs(n.value) <= 10) continue;
    // half a unit in the last written digit, with a little room for float error
    const tol = 0.5 * 10 ** (n.exponent - n.decimals) * (1 + 1e-6);
    const match = (k: number) => Math.abs(Math.abs(n.value) - Math.abs(k)) <= tol;
    if (!known.some(match) && !proportions.some(match)) bad.add(n.raw);
  }
  return [...bad];
}

/** What the grounding check covers, in the words used on screen and on /methods. */
export const GROUNDING_SCOPE =
  "numbers with decimals, numbers above 10 and anything in scientific notation; whole numbers from 0 to 10 are not checked";
