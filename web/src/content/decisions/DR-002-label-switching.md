---
id: DR-002
title: Label switching, and how fitted components are named
status: Accepted
date: 2026-10-09
applies-to: /pitfalls#label-switching, /playground, /inference, web/src/lib/em/labels.ts, web/src/lib/inference
---

# DR-002: Label switching, and how fitted components are named

**Decision in one line:** keep the notebook's mislabelled output visible exactly as it ran; everywhere else, match fitted components to the true groups by mean, and in all inference order components by mean (component 1 is always the low-mean group).

## Context

EM numbers its components arbitrarily: "component 1" is whichever bump the starting guess happened to steer towards. The notebook generated group 1 as the sci-fi lovers (mean 7.5), but its fitted component 1 ended up on the low ratings (μ₁ = 4.02). Its final cell then read component 1 as "sci-fi lover" and printed that a user who rates a film 8.5 is probably a romance lover. Its 90.5% accuracy is correct only because the accuracy line happens to encode the labels the switched way.

The upgrade made the problem bigger. A parametric bootstrap refits EM a thousand times and a coverage study refits it hundreds of times. Every refit has to name its components the same way, or the replicates of "μ₁" mix two different quantities.

## Decision

- The notebook's as-run output stays on the site, unchanged and labelled as such.
- Wherever the truth is known (accuracy, the parameter tables, the playground), fitted components are matched to the true groups by mean before any comparison.
- In every inference calculation (standard errors, bootstrap, coverage, choosing K), components are ordered by mean, μ₁ < μ₂. In one dimension, ordering by mean and matching to the truth by mean give the same pairing.

## Options considered

1. **Fix the notebook's output.** Rejected: the original stays as it ran (DR-001's principle).
2. **Order by mean** (chosen): the usual identifiability constraint, easy to explain ("component 1 is the low group").
3. **Match each refit to a reference fit** by its nearest parameters, or Stephens' relabelling algorithm. More robust when groups overlap, but harder to explain and unnecessary here.
4. **Order by weight.** Unstable when the weights are similar.
5. **Report only label-free quantities** (the mixture density, the sorted means). Honest but less useful for a reader who wants "the share of romance lovers".

## Why

The notebook's groups are far apart (fitted means about 3.4 and 7.0, with standard errors near 0.2 to 0.3), so the ordering constraint never bites and its meaning is obvious to a reader.

## What happened

- In the label-switching census (100 notebook-style random starts, seed 7), 46 runs ended with component 1 as the low-mean group (46%, Wilson 95% CI 36.6% to 55.7%). The switch is close to a coin toss, not bad luck.
- In the parametric bootstrap (B = 1,000, warm-started at the fit), the two means never crossed: 0 of 1,000 replicates needed relabelling.
- Under seed 0 the notebook's own accuracy line reports 10.0% for a fit that is 90.0% right once labels are matched. The matched number is the one the site uses.
- The weak spot: ordering by mean truncates the sampling distribution when the means are close. With overlapping groups (which a visitor can make in the playground) bootstrap intervals for the means would be biased. Nothing on /inference uses such data, but the rule would not be safe there.

## What I'd change

- Use a relabelling algorithm (or report label-free summaries) whenever the bootstrap means come within a few standard errors of each other, and flag it on screen.
- Have the playground warn when the fitted means are too close for "component 1" to mean anything.
