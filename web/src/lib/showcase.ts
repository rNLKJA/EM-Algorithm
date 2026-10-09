/**
 * The guided tour: three recorded walkthroughs and the key-feature screenshots.
 *
 * One source of truth for the step captions. The Playwright tour (e2e/showcase.spec.ts) shows them
 * as on-screen captions and writes them to WebVTT files, the /tour page lists them beside each
 * video, and the README's "Workflow walkthrough" repeats them. Media are produced by
 * `pnpm showcase`. This module has no JSON import so that Playwright can load it as is; the media
 * manifest lives in ./showcase-manifest.ts.
 */

export type WalkthroughId = "step-through-em" | "fit-the-mixture" | "how-sure";

export interface Walkthrough {
  id: WalkthroughId;
  title: string;
  /** Pages the walkthrough uses, linked under it as "Try it yourself". */
  routes: readonly string[];
  summary: string;
  /** Data and settings, so the recording can be reproduced by hand. */
  setup: string;
  /** On-screen captions, in order (step k is shown as "k/N"). */
  steps: readonly string[];
}

export const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: "step-through-em",
    title: "Step through EM by hand",
    routes: ["/", "/stepper"],
    summary:
      "The explainer's worked example on four ratings, one E-step and one M-step at a time, twice over, with the explainer's hand-worked numbers shown beside the exact ones.",
    setup:
      "Ratings [2, 3, 7, 8]; the explainer's starting guess μ = 2.5 and 7.5, σ = 0.5, π = 0.5; tolerance 10⁻⁶. No randomness is involved.",
    steps: [
      "Start from the explainer's worked example: four movie ratings, [2, 3, 7, 8]",
      "The explainer's starting guess: μ = 2.5 and 7.5, σ = 0.5, π = 0.5 for both groups",
      "E-step 1: each rating's responsibility γ by Bayes' theorem, the explainer's numbers alongside",
      "The explainer's densities of 0.8 and 0.6 are off: both are 0.4839, one σ from 2.5",
      "M-step 1: weighted averages give back μ = 2.5 and 7.5, σ = 0.5 and π = 0.5, as written",
      "Iteration 2 repeats iteration 1: the starting guess was already a fixed point",
      "The log-likelihood stays at −5.6758, so EM stops; every correction, as written and exact",
    ],
  },
  {
    id: "fit-the-mixture",
    title: "Fit the mixture to 200 ratings",
    routes: ["/playground", "/pitfalls#local-maxima"],
    summary:
      "The notebook's own experiment, live: its 200 ratings and its random start, the log-likelihood climbing and the responsibilities settling, the run finished past the notebook's 15-iteration cap, then a bad start that lands on a lower local maximum.",
    setup:
      "The notebook's 200 synthetic ratings (np.random.seed(42), exported from the notebook) and its own random start; tolerance 10⁻⁴. The bad start is a dragged guess: μ₁ moved to about 6.3 with σ₁ = 0.2, μ₂ = 8.5 and σ₂ = 1 left as they were.",
    steps: [
      "The notebook's 200 synthetic ratings and its own random start, capped at 15 iterations",
      "Press play: the log-likelihood climbs from −425.50 and the responsibilities settle",
      "Stopped at the cap of 15 with ℓ = −416.51, still rising by 0.0293 per step: not converged",
      "Raise the cap: from the same start EM converges after 90 iterations, at ℓ = −415.37",
      "Now a bad start: drag μ₁ into the middle of the data and narrow σ₁ to 0.2",
      "EM converges again, to a local maximum: ℓ = −423.63, a spike on 2.4% of the ratings at 6.48",
      "The log-likelihood never decreased, yet this peak is 8.3 lower: EM cannot see the better one",
    ],
  },
  {
    id: "how-sure",
    title: "How sure are we? Intervals and the number of groups",
    routes: ["/inference#uncertainty", "/inference#choosing-k"],
    summary:
      "Uncertainty around the notebook's fit: observed-information standard errors and parametric-bootstrap intervals, re-run in the browser with the published seed, then AIC and BIC for one to four groups and a bootstrap likelihood-ratio test of one group against two.",
    setup:
      "Parametric bootstrap with B = 1,000 at seed 42 (re-run in the browser's Web Worker during the recording). Model choice: K = 1 to 4, best of 60 ordinary and 30 pile starts per K, variance floor σ ≥ 0.1. LRT: B = 500.",
    steps: [
      "The notebook printed point estimates; this page asks how sure, how many and how stable",
      "The notebook's run finished from its own start (170 iterations), with Hessian standard errors",
      "Parametric bootstrap, B = 1,000 at seed 42: π₁ = 0.221, 95% CI 0.110 to 0.359",
      "Re-run the bootstrap in this browser with seed 42: 1,000 refits in a Web Worker",
      "Same seed, same numbers: the browser reproduced the published intervals",
      "How many groups? BIC picks K = 3 and AIC K = 4; the third is the pile of ratings clipped to 10.0",
      "Without the 7 clipped ratings BIC picks K = 2, as it does on 91 of 100 fresh samples",
      "One group or two? Bootstrap LRT p = 0.002; the χ²₃ test would falsely reject 16% of the time",
    ],
  },
];

export interface Screenshot {
  /** File name without extension, e.g. "01-landing-light". */
  id: string;
  title: string;
  caption: string;
  viewport: "desktop" | "mobile";
}

/** Caption prefix for the screenshots that show a mocked AI response. */
export const MOCKED_AI = "Mocked AI response for illustration";

/** Model id the mocked provider reports, so no screen or log entry names a real model. */
export const MOCK_MODEL_ID = "mocked-response-for-illustration";

export const SCREENSHOTS: readonly Screenshot[] = [
  {
    id: "01-landing-light",
    title: "Overview",
    caption: "The notebook's fit, the idea in two steps and the six ways in.",
    viewport: "desktop",
  },
  {
    id: "02-landing-dark",
    title: "Overview, dark mode",
    caption: "The same page in dark mode.",
    viewport: "desktop",
  },
  {
    id: "03-stepper-e-step",
    title: "Stepper: the E-step",
    caption:
      "Responsibilities for [2, 3, 7, 8], with the explainer's hand-worked numbers beside them.",
    viewport: "desktop",
  },
  {
    id: "04-stepper-m-step",
    title: "Stepper: the M-step",
    caption: "Each update as a weighted average, the explainer's working underneath.",
    viewport: "desktop",
  },
  {
    id: "05-playground",
    title: "Playground",
    caption: "The notebook's 200 ratings, its random start and the log-likelihood by iteration.",
    viewport: "desktop",
  },
  {
    id: "06-playground-local-maximum",
    title: "A bad start, a local maximum",
    caption: "A dragged start converges to ℓ = −423.63, below the −415.37 of the notebook's start.",
    viewport: "desktop",
  },
  {
    id: "07-pitfalls-label-switching",
    title: "Pitfall: label switching",
    caption: "The notebook's last cell as it ran, and the components matched by mean.",
    viewport: "desktop",
  },
  {
    id: "08-pitfalls-local-maxima",
    title: "Pitfall: local maxima",
    caption: "Complete EM runs from 24 random starts, best first, run in a Web Worker.",
    viewport: "desktop",
  },
  {
    id: "09-inference-uncertainty",
    title: "Standard errors and bootstrap intervals",
    caption: "Hessian SEs, Wald and parametric-bootstrap 95% intervals, with the misses marked.",
    viewport: "desktop",
  },
  {
    id: "10-inference-coverage",
    title: "Do 95% intervals cover 95%?",
    caption: "Coverage across simulated data sets, each rate with its Wilson interval.",
    viewport: "desktop",
  },
  {
    id: "11-inference-choosing-k",
    title: "Choosing K",
    caption: "AIC and BIC for one to four components, with and without the clipped ratings.",
    viewport: "desktop",
  },
  {
    id: "12-inference-lrt",
    title: "Bootstrap likelihood-ratio test",
    caption: "The bootstrap null against the χ² reference that Wilks' theorem would suggest.",
    viewport: "desktop",
  },
  {
    id: "13-maths",
    title: "Maths",
    caption: "The explainer's derivations rendered with KaTeX, corrections labelled.",
    viewport: "desktop",
  },
  {
    id: "14-methods",
    title: "Methods",
    caption: "Data provenance, method, evaluation design, assumptions and limitations.",
    viewport: "desktop",
  },
  {
    id: "15-decision-record",
    title: "Decision record DR-002",
    caption: "Label switching: the decision first, then the options, what happened and changes.",
    viewport: "desktop",
  },
  {
    id: "16-model-card",
    title: "Model card",
    caption: "Intended use, data provenance, evaluation with intervals and known failure modes.",
    viewport: "desktop",
  },
  {
    id: "17-ai-settings",
    title: "Bring your own key",
    caption: "Optional AI settings: Anthropic by default, the key stays in this browser.",
    viewport: "desktop",
  },
  {
    id: "18-ai-explanation",
    title: "Explain this iteration (mocked)",
    caption: `${MOCKED_AI}: labelled AI-generated, grounding-checked, awaiting review.`,
    viewport: "desktop",
  },
  {
    id: "19-ai-log",
    title: "AI audit log (mocked entry)",
    caption: `${MOCKED_AI}: the call, the reviewer's decision and JSON/CSV export.`,
    viewport: "desktop",
  },
  {
    id: "20-mobile-landing",
    title: "Phone: overview",
    caption: "The overview at 390 px.",
    viewport: "mobile",
  },
  {
    id: "21-mobile-stepper",
    title: "Phone: stepper",
    caption: "The E-step and the explainer's numbers on a phone.",
    viewport: "mobile",
  },
  {
    id: "22-mobile-inference",
    title: "Phone: inference",
    caption: "The bootstrap histograms, one per parameter.",
    viewport: "mobile",
  },
];

/** Public paths of a walkthrough's media (files live in web/public/showcase/). */
export function walkthroughMedia(id: WalkthroughId) {
  return {
    mp4: `/showcase/${id}.mp4`,
    poster: `/showcase/${id}-poster.webp`,
    captions: `/showcase/${id}.vtt`,
  };
}

/** Public paths of a screenshot's WebP copy (used by /tour's lightbox) and its thumbnail. */
export function screenshotMedia(id: string) {
  return {
    full: `/showcase/screens/${id}.webp`,
    thumb: `/showcase/screens/${id}-thumb.webp`,
  };
}

/** Seconds as m:ss, e.g. 84.3 -> "1:24". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds as a phrase, e.g. 84.6 -> "1 min 24 s" (whole seconds, like a video player). */
export function spokenDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
}
