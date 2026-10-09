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

## Overview

This is a personal project, not coursework. In September 2025 I wrote a long explainer of the EM algorithm, framed around the Netflix sparse-ratings problem, together with a Jupyter notebook that fits a two-component Gaussian mixture to 200 synthetic "movie ratings" with an `EMAnalyzer` class written from scratch. Both are preserved unchanged in [`original/`](original/).

In 2026 I rebuilt them as a small web lab. The TypeScript port of the notebook's EM code reproduces the notebook's printed results exactly, and the site turns the explainer's derivations and worked example into things you can step through and break:

| Page | What you can do |
| --- | --- |
| **Overview** (`/`) | The idea in two steps, the original notebook's results, honest notes, and the project background. |
| **Stepper** (`/stepper`) | Replay the explainer's hand-worked example on the ratings `[2, 3, 7, 8]`: E-step responsibilities, M-step updates and the log-likelihood, with the explainer's numbers shown beside the exact ones. Try other starting guesses, or drag your own. |
| **Playground** (`/playground`) | Run EM on the notebook's 200 ratings (exact data, exported from the notebook) or on data you generate. Start from the notebook's own random draw, k-means++ or means you drag on the chart; change the iteration cap, tolerance and an optional variance floor; check that the log-likelihood never decreases; classify a new rating; and compare the run with the notebook's trace. |
| **Pitfalls** (`/pitfalls`) | Label switching (as it happened in the notebook), stopping before convergence, local maxima across a gallery of restarts, and variance collapse onto a single point. |
| **Inference** (`/inference`) | How sure, how many, how stable. Standard errors from the observed information and parametric-bootstrap intervals for π, μ and σ; a coverage study of those intervals with Wilson intervals on every coverage rate; choosing K = 1 to 4 by AIC and BIC, with a parametric-bootstrap likelihood-ratio test of one group against two; convergence diagnostics across random starts and a paired comparison of starting strategies. The fast analyses can be re-run in your browser with any seed. |
| **Maths** (`/maths`) | The explainer's derivations rendered with KaTeX: likelihood, the E-step via Bayes' theorem, the M-step updates, the mean-update derivation, a Normal + Beta mixture and convergence, with corrections labelled and a short addendum. |
| **Methods** (`/methods`) | Data provenance, method, evaluation design, assumptions, limitations and what I'd change; the decision records; a model card for the fitted mixture; and the AI use statement. |
| **AI audit log** (`/ai-log`) | Every call made by the optional "Explain this iteration" feature from your browser, with JSON and CSV export. |

## Results from the original notebook

Reproduced by the TypeScript port to within 10⁻⁶ (every iteration), and the notebook's console output is regenerated character for character:

| | Notebook (seed 42) |
| --- | --- |
| Ratings | 200, average 6.21, range 1.2 to 10.0 |
| Log-likelihood | −425.50 after iteration 1 → −416.51 after iteration 15 (+8.98) |
| Classification accuracy | 90.5% (181 of 200; Wilson 95% CI 85.6% to 93.8%) |
| Estimated (true) parameters, matched by mean | sci-fi lovers π 0.656 (0.6), μ 7.361 (7.5), σ 1.273 (1.2); romance lovers π 0.344 (0.4), μ 4.022 (4.0), σ 1.249 (1.5) |

## Honest notes

Rebuilding the notebook number for number turned up a few things. The originals are left as they were; the site shows what happened and why.

- **Some hand-worked densities in the explainer are off.** It uses `normal_pdf(2; 2.5, 0.5) = 0.8` and `normal_pdf(3; 2.5, 0.5) = 0.6`, but both are 0.4839, and the cross-group densities are about 10⁻¹⁸ to 10⁻²⁷ rather than 0.0001. The responsibilities and updated parameters still come out right. A few numbers in later examples (the E-step example and the Normal + Beta example) have similar slips. Every exact value is computed in [`corrections.ts`](web/src/lib/em/corrections.ts) and shown beside the original.
- **The labels switched.** The fitted component 1 is the *low*-mean group, so the notebook's "classify a new user" cell prints `P(Sci-fi lover | rating=8.5): 0.001` and calls an 8.5 rater a romance lover. The as-run output stays visible on the site; everywhere else, fitted components are matched to the true groups by mean. The 90.5% accuracy is correct, but only because the accuracy line happens to encode labels the switched way; under seed 0 the same line reports 10.0% for a fit that is 90.0% right.
- **Fifteen iterations was not convergence.** The run stops at its cap while still improving by 0.029 per iteration. Run to the notebook's own tolerance, the same start takes 90 iterations and ends at a higher likelihood (−415.37) but a lower accuracy (83.5%).

## Statistical rigour (2026 upgrade)

The notebook printed point estimates. The upgrade adds the analysis around them, and leaves the original results as they were. Every number below is on `/inference`, precomputed with the seeds shown there; the full method is on `/methods`.

| Question | Method | What came out |
| --- | --- | --- |
| How precise is the fit? | The notebook's run finished from its own start (170 iterations to \|Δℓ\| < 10⁻¹⁰); standard errors from the observed information (central-difference Hessian, checked against numdifftools and R's numDeriv); parametric bootstrap, B = 1,000, seed 42 | π₁ = 0.221 (SE 0.054, bootstrap 95% CI 0.110 to 0.359), μ₁ = 3.36 (0.27), μ₂ = 7.02 (0.19), σ₁ = 0.86 (0.18), σ₂ = 1.46 (0.14). On this sample, 4 of 5 Wald intervals and 3 of 5 bootstrap intervals miss the true value. |
| Do the 95% intervals cover 95%? | 500 simulated data sets of 200 per scenario (model exactly; clipped like the notebook) for Wald intervals, 200 for percentile-bootstrap intervals paired with Wald on the same data sets | No. Wald intervals cover 84% to 91%; bootstrap intervals 90% to 92%, better on the same data sets (for π₁, +6.5 points, paired 95% CI +3.0 to +10.0). |
| How many groups? | K = 1 to 4, best of 60 starts each, AIC and BIC; sensitivity without the 7 clipped ratings; selection rates on 100 fresh samples; parametric-bootstrap LRT of K = 1 against K = 2, B = 500 | AIC and BIC both pick K = 4 on this sample: the fourth component sits on the ratings clipped to 10.0. Without them BIC picks 2; on fresh samples BIC picks 2 in 91 of 100. LRT: 2Δℓ = 19.9, bootstrap p = 0.002. The χ²₃ reference would reject a true single normal 16% of the time, not 5%, because the null sits on the boundary of the parameter space. |
| Does the answer depend on the start? | 200 random starts, full log-likelihood traces; best-of-R analysis; random start against k-means++ paired over 200 simulated data sets | The log-likelihood never decreased (200 of 200). 5% of starts (Wilson 2.7% to 9.0%) reach a higher, narrow-component maximum. k-means++ needs 31.8 fewer iterations on average (95% CI 23.8 to 39.5); both reach the best-known maximum on all 200 data sets. |

Statistical helpers live in [`web/src/lib/stats/`](web/src/lib/stats/) (Wilson, percentile and Wald intervals, normal and χ² functions, a numerical Hessian, AIC and BIC, paired differences) and are tested against SciPy, statsmodels and R values generated by [`scripts/stats_reference.py`](scripts/stats_reference.py) and [`scripts/stats_reference.R`](scripts/stats_reference.R). The inference code is in [`web/src/lib/inference/`](web/src/lib/inference/).

## Decision records and model card

Decisions are recorded in [`docs/decisions/`](docs/decisions/) (Context; Decision; Options considered; Why; What happened, weak numbers included; What I'd change) and rendered on `/methods`:

- [DR-001](docs/decisions/DR-001-precomputed-seeded-parity-data.md): precomputed, seeded data for parity with the notebook
- [DR-002](docs/decisions/DR-002-label-switching.md): label switching, and how fitted components are named
- [DR-003](docs/decisions/DR-003-variance-floor.md): a variance floor for the inference fits, never for the parity path
- [DR-004](docs/decisions/DR-004-precomputed-inference-artefact.md): precompute the slow simulations, and test the artefact
- [DR-005](docs/decisions/DR-005-byok-explain-iteration.md): "Explain this iteration": optional, bring your own key, grounded and audited

The [model card](docs/model-card.md) covers intended use, training data provenance, evaluation with intervals, known failure modes and ethical considerations. Records are never edited after the fact; a new record supersedes an old one.

## Optional AI: bring your own key

The site works fully without AI. One optional feature, **Explain this iteration** on the stepper and the playground, writes a short plain-language reading of the EM iteration on screen.

- **Your key, your browser.** Open *AI settings* (the key icon in the header), choose Anthropic (default: Claude Haiku 4.5, or Claude Sonnet 5.5) or OpenAI (default `gpt-5-mini`, editable), and paste your own API key. It is kept in `sessionStorage` (this tab) unless you tick *Remember on this device* (`localStorage`); *Forget key* removes it. Calls go straight from your browser to the provider (Anthropic with the `anthropic-dangerous-direct-browser-access` header). The key is never sent to this site, never logged and never committed; the site has no server and no key of its own.
- **Grounded and structured.** Only that iteration's numbers are sent (parameters before and after, responsibilities, log-likelihood, stopping rule). The reply must match a JSON schema and is validated with zod. A grounding check lists any number in the reply that was not in what was sent.
- **Labelled, reviewed and audited.** Every output is marked "AI-generated" with its model, latency and token usage. You accept, edit or reject it, and every call (failures included) is recorded without the key in an IndexedDB audit log.
- **Viewing the audit log.** Open [`/ai-log`](https://em-algorithm-lab.vercel.app/ai-log) (also linked from the footer and the AI settings dialog) to see each call's input, output, latency, tokens and your decision, and export the log as JSON or CSV. The log exists only in your browser.

The design is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency principles and the NIST AI Risk Management Framework; it is not a claim of compliance with any of them. The client code is in [`web/src/lib/ai/`](web/src/lib/ai/), tested with the network mocked.

## Tech stack

| | Original (2025) | Revived (2026) |
| --- | --- | --- |
| Writing | Markdown with LaTeX | KaTeX rendered at build time (no maths JavaScript in the browser) |
| Computation | Python 3, NumPy (EM), SciPy (plot densities) | TypeScript port of `EMAnalyzer`; long loops in a Web Worker |
| Figures | Matplotlib | Hand-drawn, responsive SVG charts |
| App | Jupyter notebook | Next.js 16 (App Router, static), React 19, Tailwind CSS v4, shadcn/ui, next-themes |
| Inference | None | Observed-information SEs, parametric bootstrap, coverage simulation, AIC/BIC, bootstrap LRT, convergence diagnostics (TypeScript, precomputed by a seeded script) |
| AI | None | Optional, bring your own key: Anthropic or OpenAI from the browser, zod-validated, audit log in IndexedDB |
| Checks | Printed output | Vitest unit, parity and reference tests (SciPy, statsmodels, R), ESLint, Prettier, GitHub Actions |

Everything is static or runs in the browser: no backend, database or account, and no API key of the site's own (the optional AI feature uses the visitor's key, from their browser). The site is deployed on Vercel as the project `em-algorithm-lab`, with `web/` as its root; set `NEXT_PUBLIC_SITE_URL` there if the domain ever changes (it feeds the canonical and Open Graph URLs).

The port adds two things the notebook does not have, both off the notebook's path: an optional variance floor (for the collapse demo) and an early stop when a component collapses, meaning σ falls below 10⁻⁸ or the parameters stop being finite. Without that guard a collapsing run can freeze at σ ≈ 1.8 × 10⁻¹⁵, see |Δℓ| = 0 and report "converged" on an unbounded spike; the notebook's own run never gets near it (its σ stays above 0.6), so parity is unaffected.

## Repository structure

```text
EM-Algorithm/
├── README.md                  this file
├── LICENSE                    MIT
├── .github/workflows/ci.yml   lint, format, typecheck, test, build (web/)
├── docs/
│   ├── decisions/             DR-001 to DR-005 (rendered on /methods)
│   └── model-card.md          the fitted mixture's model card (rendered on /methods)
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
    ├── public/data/notebook-run.json   the notebook's data, random start and trace
    ├── scripts/
    │   ├── generate-inference.ts       regenerates the /inference artefact (pnpm inference)
    │   └── sync-docs.mjs               copies ../docs into src/content (pnpm sync:docs)
    └── src/
        ├── app/               routes: /, /stepper, /playground, /pitfalls, /inference, /maths, /methods, /ai-log
        ├── components/        charts/, stepper/, playground/, pitfalls/, inference/, ai/, methods/, maths/, layout/, common/, ui/
        ├── content/           copies of the decision records and model card (checked against ../docs)
        ├── hooks/             playback, tweened parameters, the EM worker, element width, AI settings
        ├── lib/em/            the EM port and its tests (parity, claims, corrections, support)
        ├── lib/stats/         intervals, distributions, Hessian, criteria, paired differences (+ SciPy/R reference tests)
        ├── lib/inference/     general-K EM, uncertainty, coverage, model choice, convergence, the artefact
        ├── lib/ai/            bring-your-own-key client: providers, key storage, audit log, explain-iteration
        ├── lib/charts/        scales and marks for the SVG charts
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
```

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

The September 2025 explainer and notebook are preserved byte for byte in [`original/`](original/) (moved with `git mv`, so their history is intact). Nothing on the site is retyped from them: numbers come from re-executing the notebook, or from the TypeScript port that is tested against that execution. Where the original is wrong, the site says so beside the original rather than editing it.

## Licence

[MIT](LICENSE) © 2025–2026 Sunchuangyu Huang.
