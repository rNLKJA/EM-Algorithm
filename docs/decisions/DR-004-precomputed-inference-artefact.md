---
id: DR-004
title: Precompute the slow simulations, and test the artefact
status: Accepted
date: 2026-10-09
applies-to: /inference, web/scripts/generate-inference.ts, web/src/lib/inference/__generated__/inference.json
---

# DR-004: Precompute the slow simulations, and test the artefact

**Decision in one line:** the numbers on /inference come from a seeded generator (`pnpm inference`) that writes a committed JSON artefact; a test re-runs the fast analyses in full and small versions of the slow ones, and the fast ones can be re-run in the browser with any seed.

## Context

The inference page needs about 40,000 EM fits for the bootstrap coverage study alone (200 simulated data sets, each fitted once and refitted 200 times in its bootstrap), plus 500 null data sets for the likelihood-ratio test with nine starts each, and 200 data sets for the model-selection rates. On one laptop core that takes about two minutes. The site is static and deployed from `web/`.

## Decision

Keep every seed and size in `settings.ts`. A script computes all results and writes `__generated__/inference.json` (about 90 KB). The page imports the artefact. `artefact.test.ts` recomputes the MLE, standard errors, bootstrap intervals, Wald coverage, model choice and convergence study in full, and checks the slow studies through small versions stored beside them with the same seeds. The bootstrap, the coverage study and the convergence study can be re-run in a Web Worker from the page.

## Options considered

1. **Compute at build time** in Server Components. One source of truth, but two minutes on every build and on every dev reload of the page.
2. **Compute in the browser** on demand. Honest and interactive, but a visitor would wait minutes for the headline numbers, and the page would have nothing to show without JavaScript.
3. **Precompute with a script and test the artefact** (chosen), with in-browser re-runs for the fast parts.

## Why

It is the same trade as the notebook parity data (DR-001): a committed, regenerable artefact plus a test that fails when the code and the artefact disagree.

## What happened

- Generation takes about 130 seconds; the artefact test takes about 10 seconds.
- Re-running the bootstrap in the browser with seed 42 reproduces the published intervals exactly, which is the simplest possible reproducibility check for a reader.
- The weak spot: the slow studies are verified only through their small versions. A change that altered only large-sample behaviour would slip through until someone regenerated, and a regeneration with an edited setting would not be flagged unless the settings test noticed.

## What I'd change

- Regenerate the artefact in a scheduled CI job and fail on any diff.
- Spread the slow studies across worker threads so the generator finishes in seconds and could run at build time.
