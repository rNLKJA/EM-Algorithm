<div align="center">

# EM, one step at a time

**An interactive companion to a maths-complete explainer of the Expectation–Maximisation algorithm.**
Step through four ratings by hand, watch a 200-rating Gaussian mixture converge, see where EM quietly goes wrong, and find out how much the fitted numbers can be trusted.

**Live demo:** [em-algorithm-lab.vercel.app](https://em-algorithm-lab.vercel.app)

[![CI](https://github.com/rNLKJA/EM-Algorithm/actions/workflows/ci.yml/badge.svg)](https://github.com/rNLKJA/EM-Algorithm/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/original-Python%20%2B%20NumPy-3776AB?logo=python&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

</div>

## Showcase

![Walkthrough 2 as a GIF: the notebook's 200 ratings, EM played from the notebook's random start, the run finished past its 15-iteration cap, then a dragged bad start that converges to a lower local maximum](docs/showcase/fit-the-mixture.gif)

_Fitting the notebook's mixture, then landing in a local maximum (walkthrough 2 below). The GIFs here play a little faster than real time, with waits and scrolls cut; the [guided tour](https://em-algorithm-lab.vercel.app/tour) has the full-speed videos with captions, a step-by-step transcript and every screenshot in a lightbox._

### Key features

Desktop at 1440 × 900 (light mode, plus the overview in dark mode), and three phone shots at 390 px. The two AI shots show a **mocked AI response for illustration**: no API key was entered and no provider was called.

|                                                                                                                                                                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <img src="docs/showcase/01-landing-light.png" alt="Overview. The notebook's fit, the idea in two steps and the six ways in."><br>**Overview.** The notebook's fit, the idea in two steps and the six ways in.                                                                                                             | <img src="docs/showcase/02-landing-dark.png" alt="Overview, dark mode. The same page in dark mode."><br>**Overview, dark mode.** The same page in dark mode.                                                                                                                                                                   |
| <img src="docs/showcase/03-stepper-e-step.png" alt="Stepper: the E-step. Responsibilities for [2, 3, 7, 8], with the explainer's hand-worked numbers beside them."><br>**Stepper: the E-step.** Responsibilities for [2, 3, 7, 8], with the explainer's hand-worked numbers beside them.                                  | <img src="docs/showcase/04-stepper-m-step.png" alt="Stepper: the M-step. Each update as a weighted average, the explainer's working underneath."><br>**Stepper: the M-step.** Each update as a weighted average, the explainer's working underneath.                                                                           |
| <img src="docs/showcase/05-playground.png" alt="Playground. The notebook's 200 ratings, its random start and the log-likelihood by iteration."><br>**Playground.** The notebook's 200 ratings, its random start and the log-likelihood by iteration.                                                                      | <img src="docs/showcase/06-playground-local-maximum.png" alt="A bad start, a local maximum. A dragged start converges to ℓ = −423.63, below the −415.37 of the notebook's start."><br>**A bad start, a local maximum.** A dragged start converges to ℓ = −423.63, below the −415.37 of the notebook's start.                   |
| <img src="docs/showcase/07-pitfalls-label-switching.png" alt="Pitfall: label switching. The notebook's last cell as it ran, and the components matched by mean."><br>**Pitfall: label switching.** The notebook's last cell as it ran, and the components matched by mean.                                                | <img src="docs/showcase/08-pitfalls-local-maxima.png" alt="Pitfall: local maxima. Complete EM runs from 24 random starts, best first, run in a Web Worker."><br>**Pitfall: local maxima.** Complete EM runs from 24 random starts, best first, run in a Web Worker.                                                            |
| <img src="docs/showcase/09-inference-uncertainty.png" alt="Standard errors and bootstrap intervals. Hessian SEs, Wald and parametric-bootstrap 95% intervals, with the misses marked."><br>**Standard errors and bootstrap intervals.** Hessian SEs, Wald and parametric-bootstrap 95% intervals, with the misses marked. | <img src="docs/showcase/10-inference-coverage.png" alt="Do 95% intervals cover 95%? Coverage across simulated data sets, each rate with its Wilson interval."><br>**Do 95% intervals cover 95%?** Coverage across simulated data sets, each rate with its Wilson interval.                                                     |
| <img src="docs/showcase/11-inference-choosing-k.png" alt="Choosing K. AIC and BIC for one to four components, with and without the clipped ratings."><br>**Choosing K.** AIC and BIC for one to four components, with and without the clipped ratings.                                                                    | <img src="docs/showcase/12-inference-lrt.png" alt="Bootstrap likelihood-ratio test. The bootstrap null against the χ² reference that Wilks' theorem would suggest."><br>**Bootstrap likelihood-ratio test.** The bootstrap null against the χ² reference that Wilks' theorem would suggest.                                    |
| <img src="docs/showcase/13-maths.png" alt="Maths. The explainer's derivations rendered with KaTeX, corrections labelled."><br>**Maths.** The explainer's derivations rendered with KaTeX, corrections labelled.                                                                                                           | <img src="docs/showcase/14-methods.png" alt="Methods. Data provenance, method, evaluation design, assumptions and limitations."><br>**Methods.** Data provenance, method, evaluation design, assumptions and limitations.                                                                                                      |
| <img src="docs/showcase/15-decision-record.png" alt="Decision record DR-002. Label switching: the decision first, then the options, what happened and changes."><br>**Decision record DR-002.** Label switching: the decision first, then the options, what happened and changes.                                         | <img src="docs/showcase/16-model-card.png" alt="Model card. Intended use, data provenance, evaluation with intervals and known failure modes."><br>**Model card.** Intended use, data provenance, evaluation with intervals and known failure modes.                                                                           |
| <img src="docs/showcase/17-ai-settings.png" alt="Bring your own key. Optional AI settings: Anthropic by default, the key stays in this browser."><br>**Bring your own key.** Optional AI settings: Anthropic by default, the key stays in this browser.                                                                   | <img src="docs/showcase/18-ai-explanation.png" alt="Explain this iteration (mocked). Mocked AI response for illustration: labelled AI-generated, grounding-checked, awaiting review."><br>**Explain this iteration (mocked).** Mocked AI response for illustration: labelled AI-generated, grounding-checked, awaiting review. |
| <img src="docs/showcase/19-ai-log.png" alt="AI audit log (mocked entry). Mocked AI response for illustration: the call, the reviewer's decision and JSON/CSV export."><br>**AI audit log (mocked entry).** Mocked AI response for illustration: the call, the reviewer's decision and JSON/CSV export.                    |                                                                                                                                                                                                                                                                                                                                |

<img src="docs/showcase/20-mobile-landing.png" width="32%" alt="Phone: overview. The overview at 390 px."> <img src="docs/showcase/21-mobile-stepper.png" width="32%" alt="Phone: stepper. The E-step and the explainer's numbers on a phone."> <img src="docs/showcase/22-mobile-inference.png" width="32%" alt="Phone: inference. The bootstrap histograms, one per parameter.">

### Workflow walkthrough

Three recorded journeys, each step as it appears in the on-screen caption.

#### 1. Step through EM by hand (0:54)

![Walkthrough 1 as a GIF: the stepper on the ratings 2, 3, 7 and 8, the E-step and M-step twice, with the explainer's hand-worked numbers beside the exact ones](docs/showcase/step-through-em.gif)

The explainer's worked example on four ratings, one E-step and one M-step at a time, twice over, with the explainer's hand-worked numbers shown beside the exact ones.

1. Start from the explainer's worked example: four movie ratings, [2, 3, 7, 8]
2. The explainer's starting guess: μ = 2.5 and 7.5, σ = 0.5, π = 0.5 for both groups
3. E-step 1: each rating's responsibility γ by Bayes' theorem, the explainer's numbers alongside
4. The explainer's densities of 0.8 and 0.6 are off: both are 0.4839, one σ from 2.5
5. M-step 1: weighted averages give back μ = 2.5 and 7.5, σ = 0.5 and π = 0.5, as written
6. Iteration 2 repeats iteration 1: the starting guess was already a fixed point
7. The log-likelihood stays at −5.6758, so EM stops; every correction, as written and exact

_Data and settings:_ Ratings [2, 3, 7, 8]; the explainer's starting guess μ = 2.5 and 7.5, σ = 0.5, π = 0.5; tolerance 10⁻⁶. No randomness is involved. [Watch it with captions](https://em-algorithm-lab.vercel.app/tour#step-through-em).

#### 2. Fit the mixture to 200 ratings (1:21)

_The GIF at the top of this section._

The notebook's own experiment, live: its 200 ratings and its random start, the log-likelihood climbing and the responsibilities settling, the run finished past the notebook's 15-iteration cap, then a bad start that lands on a lower local maximum.

1. The notebook's 200 synthetic ratings and its own random start, capped at 15 iterations
2. Press play: the log-likelihood climbs from −425.50 and the responsibilities settle
3. Stopped at the cap of 15 with ℓ = −416.51, still rising by 0.0293 per step: not converged
4. Raise the cap: from the same start EM converges after 90 iterations, at ℓ = −415.37
5. Now a bad start: drag μ₁ into the middle of the data and narrow σ₁ to 0.2
6. EM converges again, to a local maximum: ℓ = −423.63, a spike on 2.4% of the ratings at 6.48
7. The log-likelihood never decreased, yet this peak is 8.3 lower: EM cannot see the better one

_Data and settings:_ The notebook's 200 synthetic ratings (np.random.seed(42), exported from the notebook) and its own random start; tolerance 10⁻⁴. The bad start is a dragged guess: μ₁ moved to about 6.3 with σ₁ = 0.2, μ₂ = 8.5 and σ₂ = 1 left as they were. [Watch it with captions](https://em-algorithm-lab.vercel.app/tour#fit-the-mixture).

#### 3. How sure are we? Intervals and the number of groups (1:03)

![Walkthrough 3 as a GIF: Hessian standard errors and bootstrap intervals, the bootstrap re-run in the browser with seed 42, AIC and BIC for K = 1 to 4 and the bootstrap likelihood-ratio test](docs/showcase/how-sure.gif)

Uncertainty around the notebook's fit: observed-information standard errors and parametric-bootstrap intervals, re-run in the browser with the published seed, then AIC and BIC for one to four groups and a bootstrap likelihood-ratio test of one group against two.

1. The notebook printed point estimates; this page asks how sure, how many and how stable
2. The notebook's run finished from its own start (170 iterations), with Hessian standard errors
3. Parametric bootstrap, B = 1,000 at seed 42: π₁ = 0.221, 95% CI 0.110 to 0.359
4. Re-run the bootstrap in this browser with seed 42: 1,000 refits in a Web Worker
5. Same seed, same numbers: the browser reproduced the published intervals
6. How many groups? BIC picks K = 3 and AIC K = 4; the third is the pile of ratings clipped to 10.0
7. Without the 7 clipped ratings BIC picks K = 2, as it does on 91 of 100 fresh samples
8. One group or two? Bootstrap LRT p = 0.002; the χ²₃ test would falsely reject 16% of the time

_Data and settings:_ Parametric bootstrap with B = 1,000 at seed 42 (re-run in the browser's Web Worker during the recording). Model choice: K = 1 to 4, best of 60 ordinary and 30 pile starts per K, variance floor σ ≥ 0.1. LRT: B = 500. [Watch it with captions](https://em-algorithm-lab.vercel.app/tour#how-sure).

Every screenshot and recording is made by a Playwright script, [`web/e2e/showcase.spec.ts`](web/e2e/showcase.spec.ts), which drives the site in Google Chrome and checks the numbers it shows on the way (the corrected densities, the notebook's log-likelihoods, the local maximum, the bootstrap interval and its browser re-run, BIC's choice and the LRT), so a broken feature fails the tour instead of producing a misleading video. Everything it uses is deterministic: the notebook's exported ratings and seeded simulations. `cd web && pnpm showcase` remakes all of it (see [Local development](#local-development)).

## Overview

This is a personal project, not coursework. In September 2025 I wrote a long explainer of the EM algorithm, framed around the Netflix sparse-ratings problem, together with a Jupyter notebook that fits a two-component Gaussian mixture to 200 synthetic "movie ratings" with an `EMAnalyzer` class written from scratch. Both are preserved unchanged in [`original/`](original/), as last edited in June 2026.

In 2026 I rebuilt them as a small web lab. The TypeScript port of the notebook's EM code reproduces the notebook's printed results exactly, and the site turns the explainer's derivations and worked example into things you can step through and break:

| Page                           | What you can do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview** (`/`)             | The idea in two steps, the original notebook's results, honest notes, and the project background.                                                                                                                                                                                                                                                                                                                                                                                              |
| **Stepper** (`/stepper`)       | Replay the explainer's hand-worked example on the ratings `[2, 3, 7, 8]`: E-step responsibilities, M-step updates and the log-likelihood, with the explainer's numbers shown beside the exact ones. Try other starting guesses, or drag your own.                                                                                                                                                                                                                                              |
| **Playground** (`/playground`) | Run EM on the notebook's 200 ratings (exact data, exported from the notebook) or on data you generate. Start from the notebook's own random draw, k-means++ or means you drag on the chart; change the iteration cap, tolerance and an optional variance floor; check that the log-likelihood never decreases; classify a new rating; and compare the run with the notebook's trace.                                                                                                           |
| **Pitfalls** (`/pitfalls`)     | Label switching (as it happened in the notebook), stopping before convergence, local maxima across a gallery of restarts, and variance collapse onto a single point.                                                                                                                                                                                                                                                                                                                           |
| **Inference** (`/inference`)   | How sure, how many, how stable. Standard errors from the observed information and parametric-bootstrap intervals for π, μ and σ; a coverage study of those intervals with Wilson intervals on every coverage rate; choosing K = 1 to 4 by AIC and BIC, with a parametric-bootstrap likelihood-ratio test of one group against two; convergence diagnostics across random starts and a paired comparison of starting strategies. The fast analyses can be re-run in your browser with any seed. |
| **Maths** (`/maths`)           | The explainer's derivations rendered with KaTeX: likelihood, the E-step via Bayes' theorem, the M-step updates, the mean-update derivation, a Normal + Beta mixture and convergence, with corrections labelled and a short addendum.                                                                                                                                                                                                                                                           |
| **Methods** (`/methods`)       | Data provenance, method, evaluation design, assumptions, limitations and what I'd change; the decision records; a model card for the fitted mixture; and the AI use statement.                                                                                                                                                                                                                                                                                                                 |
| **AI audit log** (`/ai-log`)   | Every call made by the optional "Explain this iteration" feature from your browser, with JSON and CSV export.                                                                                                                                                                                                                                                                                                                                                                                  |
| **Tour** (`/tour`)             | Three recorded walkthroughs (stepping through EM by hand, fitting the mixture, and how sure the fit is) with step-by-step transcripts and captions, and screenshots of every key feature.                                                                                                                                                                                                                                                                                                      |

## Results from the original notebook

Reproduced by the TypeScript port to within 10⁻⁶ (every iteration), and the notebook's console output is regenerated character for character:

|                                              | Notebook (seed 42)                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Ratings                                      | 200, average 6.21, range 1.2 to 10.0                                                                                  |
| Log-likelihood                               | −425.50 after iteration 1 → −416.51 after iteration 15 (+8.98)                                                        |
| Classification accuracy                      | 90.5% (181 of 200; Wilson 95% CI 85.6% to 93.8%)                                                                      |
| Estimated (true) parameters, matched by mean | sci-fi lovers π 0.656 (0.6), μ 7.361 (7.5), σ 1.273 (1.2); romance lovers π 0.344 (0.4), μ 4.022 (4.0), σ 1.249 (1.5) |

## Honest notes

Rebuilding the notebook number for number turned up a few things. The originals are left as they were; the site shows what happened and why.

- **Some hand-worked densities in the explainer are off.** It uses `normal_pdf(2; 2.5, 0.5) = 0.8` and `normal_pdf(3; 2.5, 0.5) = 0.6`, but both are 0.4839, and the cross-group densities are about 10⁻¹⁸ to 10⁻²⁷ rather than 0.0001. The responsibilities and updated parameters still come out right. A few numbers in later examples (the E-step example and the Normal + Beta example) have similar slips. Every exact value is computed in [`corrections.ts`](web/src/lib/em/corrections.ts) and shown beside the original.
- **The labels switched.** The fitted component 1 is the _low_-mean group, so the notebook's "classify a new user" cell prints `P(Sci-fi lover | rating=8.5): 0.001` and calls an 8.5 rater a romance lover. The as-run output stays visible on the site; everywhere else, fitted components are matched to the true groups by mean. The 90.5% accuracy is correct, but only because the accuracy line happens to encode labels the switched way; under seed 0 the same line reports 10.0% for a fit that is 90.0% right.
- **Fifteen iterations was not convergence.** The run stops at its cap while still improving by 0.029 per iteration. Run to the notebook's own tolerance, the same start takes 90 iterations and ends at a higher likelihood (−415.37) but a lower accuracy (83.5%).

## Statistical rigour (2026 upgrade)

The notebook printed point estimates. The upgrade adds the analysis around them, and leaves the original results as they were. Every number below is on `/inference`, precomputed with the seeds shown there; the full method is on `/methods`.

| Question                             | Method                                                                                                                                                                                                                                                                                       | What came out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How precise is the fit?              | The notebook's run finished from its own start (170 iterations to \|Δℓ\| < 10⁻¹⁰); standard errors from the observed information (central-difference Hessian, checked against numdifftools and R's numDeriv); parametric bootstrap, B = 1,000, seed 42                                       | π₁ = 0.221 (SE 0.054, bootstrap 95% CI 0.110 to 0.359), μ₁ = 3.36 (0.27), μ₂ = 7.02 (0.19), σ₁ = 0.86 (0.18), σ₂ = 1.46 (0.14). On this sample, 4 of 5 Wald intervals and 3 of 5 bootstrap intervals miss the true value.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Do the 95% intervals cover 95%?      | 500 simulated data sets of 200 per scenario (model exactly; clipped like the notebook) for Wald intervals, 200 for percentile-bootstrap intervals paired with Wald on the same data sets                                                                                                     | No. Wald intervals cover 84% to 92% (84% to 91% with the model exactly, 85% to 92% clipped); bootstrap intervals 90% to 92%. On the same data sets the bootstrap covers more often for π₁, μ₁ and σ₁ (for π₁, +6.5 points, paired 95% CI +3.0 to +10.0); for μ₂ and σ₂ the difference is within simulation noise, and part of the gain is width (the bootstrap intervals are wider for 4 of the 5 parameters).                                                                                                                                                                                                                                                |
| How many groups?                     | K = 1 to 4, best of 60 ordinary starts plus 30 starts with a narrow component on the 7 ratings piled at 10.0, AIC and BIC; sensitivity to the variance floor and without the clipped ratings; selection rates on 100 fresh samples; parametric-bootstrap LRT of K = 1 against K = 2, B = 500 | On this sample BIC picks K = 3 and AIC K = 4. BIC's third component is the pile of ratings clipped to 10.0 (4.0% at 9.96, σ held at the 0.1 floor); at a floor of 0.25 BIC tips to 4 in a near-tie. Without the clipped ratings BIC picks 2; on fresh samples BIC picks 2 in 91 of 100. LRT: 2Δℓ = 19.9, bootstrap p = 0.002 (the LRT's 18 starts found the notebook's maximum, ℓ₂ = −415.37; the best K = 2 maximum, ℓ = −413.99, would give 22.6, so the statistic understates the evidence and p is unchanged). The χ²₃ reference would reject a true single normal 16% of the time, not 5%, because the null sits on the boundary of the parameter space. |
| Does the answer depend on the start? | 200 random starts, full log-likelihood traces; best-of-R analysis; random start against k-means++ paired over 200 simulated data sets                                                                                                                                                        | The log-likelihood never decreased (200 of 200). 5% of starts (Wilson 2.7% to 9.0%) reach a higher, narrow-component maximum. k-means++ needs 31.8 fewer iterations on average (95% CI 23.8 to 39.5); both reach the best-known maximum on all 200 data sets.                                                                                                                                                                                                                                                                                                                                                                                                 |

Statistical helpers live in [`web/src/lib/stats/`](web/src/lib/stats/) (Wilson, percentile and Wald intervals, normal and χ² functions, a numerical Hessian, AIC and BIC, paired differences) and are tested against SciPy, statsmodels and R values generated by [`scripts/stats_reference.py`](scripts/stats_reference.py) and [`scripts/stats_reference.R`](scripts/stats_reference.R). The inference code is in [`web/src/lib/inference/`](web/src/lib/inference/).

## Decision records and model card

Decisions are recorded in [`docs/decisions/`](docs/decisions/) (Context; Decision; Options considered; Why; What happened, weak numbers included; What I'd change) and rendered on `/methods`:

- [DR-001](docs/decisions/DR-001-precomputed-seeded-parity-data.md): precomputed, seeded data for parity with the notebook
- [DR-002](docs/decisions/DR-002-label-switching.md): label switching, and how fitted components are named
- [DR-003](docs/decisions/DR-003-variance-floor.md): a variance floor for the inference fits, never for the parity path
- [DR-004](docs/decisions/DR-004-precomputed-inference-artefact.md): precompute the slow simulations, and test the artefact
- [DR-005](docs/decisions/DR-005-byok-explain-iteration.md): "Explain this iteration": optional, bring your own key, grounded and audited
- [DR-006](docs/decisions/DR-006-ai-disclosure-accuracy.md): say exactly what the AI feature sends, which model answered, and how the site was built (supersedes DR-005 in part)

The [model card](docs/model-card.md) covers intended use, training data provenance, evaluation with intervals, known failure modes and ethical considerations. Records are never edited after the fact; a new record supersedes an old one.

## Optional AI: bring your own key

The site works fully without AI. One optional feature, **Explain this iteration** on the stepper and the playground, writes a short plain-language reading of the EM iteration on screen.

- **Your key, your browser.** Open _AI settings_ (the key icon in the header), choose Anthropic (default: Claude Haiku 4.5, or Claude Sonnet 5.5) or OpenAI (default `gpt-5-mini`, editable), and paste your own API key. It is kept in `sessionStorage` (this tab) unless you tick _Remember on this device_ (`localStorage`); _Forget key_ removes it. Calls go straight from your browser to the provider (Anthropic with the `anthropic-dangerous-direct-browser-access` header). The key is never sent to this site, never logged and never committed; the site has no server and no key of its own.
- **Grounded and structured.** Only that iteration's numbers are sent (parameters before and after, responsibilities, log-likelihood, stopping rule), with the page name, a one-line description of the data set and fixed notes on how to read the numbers; no personal data. `/methods` lists every field, and a test checks the snapshot against that list. The reply must match a JSON schema and is validated with zod against exactly that schema. A grounding check lists any number in the reply that was not in what was sent; it checks numbers with decimals, numbers above 10 and anything in scientific notation, and leaves whole numbers from 0 to 10 alone.
- **Labelled, reviewed and audited.** Every output is marked "AI-generated" with its model, latency and token usage. You accept, edit or reject it, and every call is recorded without the key in an IndexedDB audit log. Failed calls are recorded too, and a refusal, a cut-off reply or one that failed validation keeps the reply and token usage it cost. Claude Sonnet 5.5 calls opt into Anthropic's server-side refusal fallback (`fallbacks: "default"`); the log records the model asked, the model that answered and whether the fallback ran.
- **Viewing the audit log.** Open [`/ai-log`](https://em-algorithm-lab.vercel.app/ai-log) (also linked from the footer and the AI settings dialog) to see each call's input, output, latency, tokens and your decision, and export the log as JSON or CSV. The log exists only in your browser.

- **How this site was built.** Nothing on the site calls an AI model at runtime except this optional feature. The site's code and text were developed with an AI coding assistant (Claude Code), as the commit history shows; every number comes from the code, the tests and the seeded scripts, not from a language model, and `original/` holds the 2025 explainer and notebook as they were.

The design is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency principles and the NIST AI Risk Management Framework; it is not a claim of compliance with any of them. The client code is in [`web/src/lib/ai/`](web/src/lib/ai/), tested with the network mocked.

## Tech stack

|             | Original (2025)                              | Revived (2026)                                                                                                                                                    |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writing     | Markdown with LaTeX                          | KaTeX rendered at build time (no maths JavaScript in the browser)                                                                                                 |
| Computation | Python 3, NumPy (EM), SciPy (plot densities) | TypeScript port of `EMAnalyzer`; long loops in a Web Worker                                                                                                       |
| Figures     | Matplotlib                                   | Hand-drawn, responsive SVG charts                                                                                                                                 |
| App         | Jupyter notebook                             | Next.js 16 (App Router, static), React 19, Tailwind CSS v4, shadcn/ui, next-themes                                                                                |
| Inference   | None                                         | Observed-information SEs, parametric bootstrap, coverage simulation, AIC/BIC, bootstrap LRT, convergence diagnostics (TypeScript, precomputed by a seeded script) |
| AI          | None                                         | Optional, bring your own key: Anthropic or OpenAI from the browser, zod-validated, audit log in IndexedDB                                                         |
| Checks      | Printed output                               | Vitest unit, parity and reference tests (SciPy, statsmodels, R), a Playwright end-to-end tour, ESLint, Prettier, GitHub Actions                                   |

Everything is static or runs in the browser: no backend, database or account, and no API key of the site's own (the optional AI feature uses the visitor's key, from their browser). The site is deployed on Vercel as the project `em-algorithm-lab`, with `web/` as its root; set `NEXT_PUBLIC_SITE_URL` there if the domain ever changes (it feeds the canonical and Open Graph URLs).

The port adds two things the notebook does not have, both off the notebook's path: an optional variance floor (for the collapse demo) and an early stop when a component collapses, meaning σ falls below 10⁻⁸ or the parameters stop being finite. Without that guard a collapsing run can freeze at σ ≈ 1.8 × 10⁻¹⁵, see |Δℓ| = 0 and report "converged" on an unbounded spike; the notebook's own run never gets near it (its σ stays above 0.6), so parity is unaffected.

## Repository structure

```text
EM-Algorithm/
├── README.md                  this file
├── LICENSE                    MIT
├── .github/workflows/ci.yml   lint, format, typecheck, test, build (web/)
├── docs/
│   ├── decisions/             DR-001 to DR-006 (rendered on /methods)
│   ├── model-card.md          the fitted mixture's model card (rendered on /methods)
│   └── showcase/              README screenshots and GIFs (made by pnpm showcase)
├── original/                  the 2025 explainer and notebook, unchanged (see original/README.md)
│   ├── em-explainer.md        the long-form explainer (formerly this README)
│   ├── em_algorithm_demo.ipynb
│   ├── _archive/              the first draft of the explainer
│   └── pyproject.toml         black/isort settings used on the notebook
├── scripts/
│   ├── export_parity.py       re-runs the notebook and exports the parity artefacts (uv, PEP 723)
│   ├── make_og_fonts.py       converts the site's fonts to static TTFs for the Open Graph image
│   ├── stats_reference.py     SciPy / statsmodels / numdifftools values for the statistics tests (uv)
│   └── stats_reference.R      the R cross-check (prop.test, qchisq, numDeriv)
└── web/                       the Next.js app (Vercel root)
    ├── assets/og-fonts/       TTF fonts for opengraph-image.tsx (generated, OFL)
    ├── e2e/                   the Playwright guided tour (showcase.spec.ts) and its helpers
    ├── playwright.config.ts   BASE_URL (default: production), system Chrome, no browser download
    ├── public/data/notebook-run.json   the notebook's data, random start and trace
    ├── public/showcase/       /tour videos (MP4), captions (WebVTT), posters and screenshot copies
    ├── scripts/
    │   ├── generate-inference.ts       regenerates the /inference artefact (pnpm inference)
    │   ├── showcase.mjs                runs the tour and rebuilds the media (pnpm showcase)
    │   ├── showcase-media.mjs          screenshots, MP4, GIF, captions and posters from the raw tour output
    │   └── sync-docs.mjs               copies ../docs into src/content (pnpm sync:docs)
    └── src/
        ├── app/               routes: /, /stepper, /playground, /pitfalls, /inference, /maths, /methods, /ai-log, /tour
        ├── components/        charts/, stepper/, playground/, pitfalls/, inference/, ai/, methods/, maths/, layout/, common/, ui/
        ├── content/           copies of the decision records and model card (checked against ../docs)
        ├── hooks/             playback, tweened parameters, the EM worker, element width, AI settings
        ├── lib/em/            the EM port and its tests (parity, claims, corrections, support)
        ├── lib/stats/         intervals, distributions, Hessian, criteria, paired differences (+ SciPy/R reference tests)
        ├── lib/inference/     general-K EM, uncertainty, coverage, model choice, convergence, the artefact
        ├── lib/ai/            bring-your-own-key client: providers, key storage, audit log, explain-iteration
        ├── lib/charts/        scales, axis ticks and marks for the SVG charts
        └── workers/           em.worker.ts (fits, restarts and /inference re-runs off the main thread)
```

## Local development

Requires Node 20+ and pnpm 10.

```bash
cd web
pnpm install
pnpm dev            # http://localhost:3000

pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm typecheck      # next typegen && tsc --noEmit
pnpm test           # Vitest: parity with the notebook, statistics against SciPy/R, the inference artefact, the AI client (mocked)
pnpm build          # static production build
pnpm inference      # regenerate the /inference artefact (about two minutes; seeds in src/lib/inference/settings.ts)
pnpm sync:docs      # copy docs/ into web/src/content after editing a decision record or the model card

pnpm showcase       # the guided tour against production: e2e checks, screenshots, recordings, then the media
BASE_URL=http://localhost:3410 pnpm showcase   # the same against a local `pnpm build` (the server is started for you)
pnpm showcase:test  # the journeys as quick end-to-end tests: no pauses, no video
```

`pnpm showcase` uses the Google Chrome already installed (Playwright's `chrome` channel) and the `ffmpeg` on your PATH; it never downloads a browser. It writes the raw output to `web/.showcase/` (git-ignored), then `docs/showcase/` (PNG screenshots under 600 KB, GIFs under 8 MB) and `web/public/showcase/` (H.264 MP4s under 8 MB, WebVTT captions, posters and WebP copies for `/tour`).

The site needs no keys or secrets. Its two optional settings are documented in [`web/.env.example`](web/.env.example): `NEXT_PUBLIC_SITE_URL` (the canonical and Open Graph base URL, defaulting to `https://em-algorithm-lab.vercel.app`) and `NEXT_PUBLIC_REPO_REF` (the git ref the "view source" links point at, defaulting to `main`). Copy the file to `web/.env.local` to override them; a value left blank counts as unset.

To run the original notebook, see [`original/README.md`](original/README.md).

## How the data artefacts are generated

NumPy's seeded global random stream cannot be reproduced in TypeScript, so the site never tries. Instead [`scripts/export_parity.py`](scripts/export_parity.py) executes the notebook's code cells verbatim (same order, `np.random.seed(42)`, same `EMAnalyzer` class), fails unless every printed line matches the output saved in the notebook, and writes:

- `web/public/data/notebook-run.json` (about 24 KB): the 200 ratings, true groups, the random initial parameters, the per-iteration trace (log-likelihood, π, μ, σ), the final responsibilities, the notebook's printed text, and accuracy summaries for a few other seeds.
- `web/src/lib/__fixtures__/parity.json`: extra traces used only by the tests (other seeds, a run to convergence, a run to a 300-iteration cap, and the explainer's four-rating example computed exactly with SciPy).

Regenerate them with [uv](https://docs.astral.sh/uv/) (dependencies are declared inline):

```bash
uv run scripts/export_parity.py      # or: cd web && pnpm parity
```

The Open Graph image is drawn with the site's own fonts. `next/og` cannot read WOFF2 and draws variable fonts at their default weight, so [`scripts/make_og_fonts.py`](scripts/make_og_fonts.py) converts the self-hosted WOFF2 files into static TTFs in `web/assets/og-fonts/` (all SIL Open Font License; the licence texts sit beside them):

```bash
uv run scripts/make_og_fonts.py
```

The statistics tests compare against values computed independently in Python and R:

```bash
uv run scripts/stats_reference.py    # SciPy, statsmodels, numdifftools -> web/src/lib/stats/__fixtures__/reference.json
Rscript scripts/stats_reference.R    # prop.test, qchisq, numDeriv     -> web/src/lib/stats/__fixtures__/reference-r.json
```

The numbers on `/inference` come from `pnpm inference` (in `web/`), which writes `web/src/lib/inference/__generated__/inference.json`. A test re-runs the fast analyses in full and small versions of the slow ones with the same seeds, so CI fails if the code and the artefact disagree (DR-004).

The data are synthetic, so there is nothing private in them. The "make your own" data on the site come from a seeded generator in the browser and are labelled as not the original.

## Credits

- **Sunchuangyu (Rin) Huang** ([@rNLKJA](https://github.com/rNLKJA)): the explainer, the notebook and this site.
- Open-source tools that make it work: Next.js, React, Tailwind CSS, shadcn/ui and Radix, KaTeX, lucide icons, zod, react-markdown, Vitest; NumPy, SciPy, pandas and Matplotlib for the original; SciPy, statsmodels, numdifftools and R (numDeriv) for the reference values.

## Provenance

The explainer and notebook (first written in September 2025, last edited in June 2026) are preserved byte for byte in [`original/`](original/) (moved with `git mv`, so their history is intact); the September 2025 draft of the explainer is in [`original/_archive/`](original/_archive/). Nothing on the site is retyped from them: numbers come from re-executing the notebook, or from the TypeScript port that is tested against that execution. Where the original is wrong, the site says so beside the original rather than editing it.

## Licence

[MIT](LICENSE) © 2025–2026 Sunchuangyu Huang.
