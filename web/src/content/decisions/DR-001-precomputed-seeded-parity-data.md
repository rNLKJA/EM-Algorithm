---
id: DR-001
title: Precomputed, seeded data for parity with the notebook
status: Accepted
date: 2026-10-09
applies-to: scripts/export_parity.py, web/public/data/notebook-run.json, /playground, every "original run" number on the site
---

# DR-001: Precomputed, seeded data for parity with the notebook

**Decision in one line:** re-execute the original notebook in a script and export its data and trace, instead of trying to reproduce NumPy's random numbers in TypeScript; everything the browser generates uses its own seeded generator and is labelled as not the original.

## Context

The notebook draws its 200 ratings, the hidden groups and EM's random starting guess from NumPy's global random stream after `np.random.seed(42)`. That stream (the legacy Mersenne Twister, NumPy's `legacy_gauss` normal sampler and its uniform conversion) is not available in the browser. The revived site needed the exact same data and the exact same starting guess to claim that its TypeScript port of `EMAnalyzer` reproduces the notebook, and it needed fresh random data for the "make your own" playground and the restart galleries.

## Decision

Run the notebook's code cells verbatim in `scripts/export_parity.py` (same order, same seed, same class), fail unless every printed line matches the output saved in the notebook, and export the ratings, true groups, random start and per-iteration trace to `web/public/data/notebook-run.json`. The TypeScript port is tested against that trace. Anything generated in the browser uses a separate seeded generator (xoshiro128\*\* seeded through splitmix32) and the interface says it is not the notebook's data.

## Options considered

1. **Port NumPy's generator to TypeScript** (MT19937 plus the legacy normal sampler). Possible, but a large amount of code whose only purpose is to reproduce one draw, and any floating-point difference in the sampler would silently change the data.
2. **Copy the numbers out of the notebook by hand.** The notebook never prints all 200 ratings or the full-precision starting guess, so this is not even possible without re-running it.
3. **Run Python in the browser (Pyodide).** Exact, but a download of tens of megabytes for a page that only needs 24 KB of numbers.
4. **Re-execute and export with a script** (chosen).

## Why

Provenance is the point of the revival: every number on the site should trace back to the original code. A script that refuses to export unless the notebook's own printed output is reproduced is a stronger guarantee than any reimplementation, and it keeps the browser code simple.

## What happened

- The port matches the exported trace to within 10⁻⁶ in every π, μ, σ and log-likelihood of all 15 iterations, and the regenerated console output is identical, character for character, to what the notebook printed (`em.parity.test.ts`).
- The export records the environment it ran in: Python 3.13.9 and NumPy 2.5.3.
- The weak spot is the second random stream. The same seed gives different numbers in the playground than in NumPy, so "seed 2025" on the site and in Python describe different data sets. The site says so wherever generated data appear, but it is still a thing a reader has to keep in mind.
- The same pattern now covers the inference results: a seeded script writes a committed artefact and a test re-runs it (DR-004).

## What I'd change

- Pin the export's dependencies exactly (`uv lock --script`) rather than with lower bounds, so a future NumPy cannot change the regenerated file.
- Re-run `export_parity.py` in CI and fail on any diff, instead of relying on the parity tests against a committed file.
