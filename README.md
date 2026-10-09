<div align="center">

# EM, one step at a time

**An interactive companion to a maths-complete explainer of the Expectation–Maximisation algorithm.**
Step through four ratings by hand, watch a 200-rating Gaussian mixture converge, and see where EM quietly goes wrong.

**Live demo:** _coming soon_ (Vercel project `em-algorithm-lab`)

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
| **Maths** (`/maths`) | The explainer's derivations rendered with KaTeX: likelihood, the E-step via Bayes' theorem, the M-step updates, the mean-update derivation, a Normal + Beta mixture and convergence, with corrections labelled and a short addendum. |

## Results from the original notebook

Reproduced by the TypeScript port to within 10⁻⁶ (every iteration), and the notebook's console output is regenerated character for character:

| | Notebook (seed 42) |
| --- | --- |
| Ratings | 200, average 6.21, range 1.2 to 10.0 |
| Log-likelihood | −425.50 after iteration 1 → −416.51 after iteration 15 (+8.98) |
| Classification accuracy | 90.5% |
| Estimated (true) parameters, matched by mean | sci-fi lovers π 0.656 (0.6), μ 7.361 (7.5), σ 1.273 (1.2); romance lovers π 0.344 (0.4), μ 4.022 (4.0), σ 1.249 (1.5) |

## Honest notes

Rebuilding the notebook number for number turned up a few things. The originals are left as they were; the site shows what happened and why.

- **Some hand-worked densities in the explainer are off.** It uses `normal_pdf(2; 2.5, 0.5) = 0.8` and `normal_pdf(3; 2.5, 0.5) = 0.6`, but both are 0.4839, and the cross-group densities are about 10⁻¹⁸ to 10⁻²⁷ rather than 0.0001. The responsibilities and updated parameters still come out right. A few numbers in later examples (the E-step example and the Normal + Beta example) have similar slips. Every exact value is computed in [`corrections.ts`](web/src/lib/em/corrections.ts) and shown beside the original.
- **The labels switched.** The fitted component 1 is the *low*-mean group, so the notebook's "classify a new user" cell prints `P(Sci-fi lover | rating=8.5): 0.001` and calls an 8.5 rater a romance lover. The as-run output stays visible on the site; everywhere else, fitted components are matched to the true groups by mean. The 90.5% accuracy is correct, but only because the accuracy line happens to encode labels the switched way; under seed 0 the same line reports 10.0% for a fit that is 90.0% right.
- **Fifteen iterations was not convergence.** The run stops at its cap while still improving by 0.029 per iteration. Run to the notebook's own tolerance, the same start takes 90 iterations and ends at a higher likelihood (−415.37) but a lower accuracy (83.5%).

## Tech stack

| | Original (2025) | Revived (2026) |
| --- | --- | --- |
| Writing | Markdown with LaTeX | KaTeX rendered at build time (no maths JavaScript in the browser) |
| Computation | Python 3, NumPy (EM), SciPy (plot densities) | TypeScript port of `EMAnalyzer`; long loops in a Web Worker |
| Figures | Matplotlib | Hand-drawn, responsive SVG charts |
| App | Jupyter notebook | Next.js 16 (App Router, static), React 19, Tailwind CSS v4, shadcn/ui, next-themes |
| Checks | Printed output | Vitest unit and parity tests, ESLint, Prettier, GitHub Actions |

Everything is static or runs in the browser: no backend, database, account or API key.

The port adds two things the notebook does not have, both off the notebook's path: an optional variance floor (for the collapse demo) and an early stop when a component collapses, meaning σ falls below 10⁻⁸ or the parameters stop being finite. Without that guard a collapsing run can freeze at σ ≈ 1.8 × 10⁻¹⁵, see |Δℓ| = 0 and report "converged" on an unbounded spike; the notebook's own run never gets near it (its σ stays above 0.6), so parity is unaffected.

## Repository structure

```text
EM-Algorithm/
├── README.md                  this file
├── LICENSE                    MIT
├── .github/workflows/ci.yml   lint, format, typecheck, test, build (web/)
├── original/                  the 2025 explainer and notebook, unchanged (see original/README.md)
│   ├── em-explainer.md        the long-form explainer (formerly this README)
│   ├── em_algorithm_demo.ipynb
│   ├── _archive/              the first draft of the explainer
│   └── pyproject.toml         black/isort settings used on the notebook
├── scripts/
│   ├── export_parity.py       re-runs the notebook and exports the parity artefacts (uv, PEP 723)
│   └── make_og_fonts.py       converts the site's fonts to static TTFs for the Open Graph image
└── web/                       the Next.js app (Vercel root)
    ├── assets/og-fonts/       TTF fonts for opengraph-image.tsx (generated, OFL)
    ├── public/data/notebook-run.json   the notebook's data, random start and trace
    └── src/
        ├── app/               routes: /, /stepper, /playground, /pitfalls, /maths
        ├── components/        charts/, stepper/, playground/, pitfalls/, maths/, layout/, common/, ui/
        ├── hooks/             playback, tweened parameters, the EM worker, element width
        ├── lib/em/            the EM port and its tests (parity, claims, corrections, support)
        ├── lib/charts/        scales and marks for the SVG charts
        └── workers/           em.worker.ts (fits and restarts off the main thread)
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
pnpm test           # Vitest: parity with the notebook, plus unit tests
pnpm build          # static production build
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

The data are synthetic, so there is nothing private in them. The "make your own" data on the site come from a seeded generator in the browser and are labelled as not the original.

## Credits

- **Sunchuangyu (Rin) Huang** ([@rNLKJA](https://github.com/rNLKJA)): the explainer, the notebook and this site.
- Open-source tools that make it work: Next.js, React, Tailwind CSS, shadcn/ui and Radix, KaTeX, lucide icons, Vitest; NumPy, SciPy, pandas and Matplotlib for the original.

## Provenance

The September 2025 explainer and notebook are preserved byte for byte in [`original/`](original/) (moved with `git mv`, so their history is intact). Nothing on the site is retyped from them: numbers come from re-executing the notebook, or from the TypeScript port that is tested against that execution. Where the original is wrong, the site says so beside the original rather than editing it.

## Licence

[MIT](LICENSE) © 2025–2026 Sunchuangyu Huang.
