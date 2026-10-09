/**
 * The explainer's hand-worked example: four ratings [2, 3, 7, 8], two groups,
 * starting from mu = 2.5 / 7.5, sigma = 0.5, pi = 0.5 (original/em-explainer.md,
 * "A Complete Example: Let's Do This Step by Step").
 *
 * `README_AS_WRITTEN` copies the numbers exactly as printed in the explainer. The
 * densities there are not right: normal_pdf(2; 2.5, 0.5) and normal_pdf(3; 2.5, 0.5)
 * are both 0.4839 (each rating is exactly one sigma from 2.5), not 0.8 and 0.6, and
 * the cross-group densities are ~1e-18 to 1e-27, not 0.0001. The exact numbers
 * come from the same EM code as the playground, so the stepper can show both.
 */
import { eStep, logLikelihood, mStep } from "./em";
import type { EStepResult, MixtureParams } from "./types";

export const README_RATINGS = [2, 3, 7, 8] as const;

export const README_INIT: MixtureParams = {
  pi1: 0.5,
  pi2: 0.5,
  mu1: 2.5,
  mu2: 7.5,
  sigma1: 0.5,
  sigma2: 0.5,
};

export interface AsWrittenRow {
  rating: number;
  /** the density value the explainer plugs in for group 1 / group 2 */
  f1: number;
  f2: number;
  /** pi_k x f_k as written */
  w1: number;
  w2: number;
  total: number;
  gamma1: number;
  gamma2: number;
}

/** Iteration 1, E-step, exactly as written in the explainer. */
export const README_AS_WRITTEN: {
  eStep: AsWrittenRow[];
  mStep: {
    pi1: number;
    pi2: number;
    mu1Numerator: number;
    mu2Numerator: number;
    denominator: number;
    mu1: number;
    mu2: number;
    sigma1: number;
    sigma2: number;
  };
} = {
  eStep: [
    {
      rating: 2,
      f1: 0.8,
      f2: 0.0001,
      w1: 0.4,
      w2: 0.00005,
      total: 0.40005,
      gamma1: 0.9999,
      gamma2: 0.0001,
    },
    {
      rating: 3,
      f1: 0.6,
      f2: 0.0001,
      w1: 0.3,
      w2: 0.00005,
      total: 0.30005,
      gamma1: 0.9998,
      gamma2: 0.0002,
    },
    {
      rating: 7,
      f1: 0.0001,
      f2: 0.8,
      w1: 0.00005,
      w2: 0.4,
      total: 0.40005,
      gamma1: 0.0001,
      gamma2: 0.9999,
    },
    {
      rating: 8,
      f1: 0.0001,
      f2: 0.6,
      w1: 0.00005,
      w2: 0.3,
      total: 0.30005,
      gamma1: 0.0002,
      gamma2: 0.9998,
    },
  ],
  mStep: {
    pi1: 0.5,
    pi2: 0.5,
    mu1Numerator: 5.0015,
    mu2Numerator: 14.9985,
    denominator: 2.0,
    mu1: 2.5,
    mu2: 7.5,
    sigma1: 0.5,
    sigma2: 0.5,
  },
};

export type StepperStage =
  | { kind: "init"; index: number; iteration: 0; params: MixtureParams; logLikelihood: number }
  | {
      kind: "e";
      index: number;
      iteration: number;
      params: MixtureParams;
      e: EStepResult;
      logLikelihood: number;
    }
  | {
      kind: "m";
      index: number;
      iteration: number;
      before: MixtureParams;
      params: MixtureParams;
      e: EStepResult;
      sums: MSums;
      logLikelihood: number;
      improvement: number;
    };

/** The weighted sums behind each M-step update, shown line by line in the stepper. */
export interface MSums {
  g1: number;
  g2: number;
  g1x: number;
  g2x: number;
  g1sq: number;
  g2sq: number;
}

function mSums(data: readonly number[], e: EStepResult, next: MixtureParams): MSums {
  let g1 = 0;
  let g2 = 0;
  let g1x = 0;
  let g2x = 0;
  let g1sq = 0;
  let g2sq = 0;
  data.forEach((x, i) => {
    g1 += e.gamma1[i];
    g2 += e.gamma2[i];
    g1x += e.gamma1[i] * x;
    g2x += e.gamma2[i] * x;
    g1sq += e.gamma1[i] * (x - next.mu1) ** 2;
    g2sq += e.gamma2[i] * (x - next.mu2) ** 2;
  });
  return { g1, g2, g1x, g2x, g1sq, g2sq };
}

/**
 * Initial guess, then alternating E and M stages until the log-likelihood moves by
 * less than `tolerance` (after at least `minIterations`) or `maxIterations` is reached.
 */
export function buildStages(
  data: readonly number[],
  init: MixtureParams,
  maxIterations = 8,
  tolerance = 1e-6,
  minIterations = 1,
): StepperStage[] {
  const stages: StepperStage[] = [];
  let params = init;
  let ll = logLikelihood(data, params);
  stages.push({ kind: "init", index: 0, iteration: 0, params, logLikelihood: ll });
  for (let t = 1; t <= maxIterations; t++) {
    const e = eStep(data, params);
    stages.push({ kind: "e", index: stages.length, iteration: t, params, e, logLikelihood: ll });
    const next = mStep(data, e.gamma1, e.gamma2);
    const nextLl = logLikelihood(data, next);
    stages.push({
      kind: "m",
      index: stages.length,
      iteration: t,
      before: params,
      params: next,
      e,
      sums: mSums(data, e, next),
      logLikelihood: nextLl,
      improvement: nextLl - ll,
    });
    const done =
      (t >= minIterations && Math.abs(nextLl - ll) < tolerance) || !Number.isFinite(nextLl);
    params = next;
    ll = nextLl;
    if (done) break;
  }
  return stages;
}

export interface StepperPreset {
  id: string;
  label: string;
  description: string;
  init: MixtureParams;
}

export const STEPPER_PRESETS: StepperPreset[] = [
  {
    id: "readme",
    label: "The explainer's guess",
    description: "μ = 2.5 / 7.5, σ = 0.5, π = 0.5. Already at the answer, so EM stops at once.",
    init: README_INIT,
  },
  {
    id: "overlap",
    label: "A muddled guess",
    description: "Both groups start in the middle (μ = 4.5 / 5.5, σ = 2). Watch them pull apart.",
    init: { pi1: 0.5, pi2: 0.5, mu1: 4.5, mu2: 5.5, sigma1: 2, sigma2: 2 },
  },
  {
    id: "lopsided",
    label: "A lopsided guess",
    description: "Group 1 starts wide and heavy (π = 0.8, σ = 3), group 2 narrow at 9.",
    init: { pi1: 0.8, pi2: 0.2, mu1: 5, mu2: 9, sigma1: 3, sigma2: 0.7 },
  },
];
