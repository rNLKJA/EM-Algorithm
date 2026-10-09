---
id: DR-003
title: A variance floor for the inference fits, never for the parity path
status: Accepted
date: 2026-10-09
applies-to: /inference, /pitfalls#variance-collapse, web/src/lib/inference, web/src/lib/em/em.ts (varianceFloor)
---

# DR-003: A variance floor for the inference fits, never for the parity path

**Decision in one line:** every fit behind /inference uses σ ≥ 0.1 (a tenth of a rating point) and reports how often the floor was binding; the notebook-parity code keeps no floor, so it stays exactly the notebook's algorithm.

## Context

A Gaussian mixture's likelihood has no maximum: put one component on a single rating and shrink its σ, and the log-likelihood goes to +∞. The notebook's data make this easy, because clipping at 10 piled seven ratings onto exactly 10.0. The notebook's own run never got close (its σ stayed above 0.6), and the revival already had an opt-in floor for the collapse demo plus a guard that stops a run once σ falls below 10⁻⁸.

The upgrade fits hundreds of thousands of mixtures: K = 3 and 4 for model choice, and K = 2 on data simulated from a single normal for the likelihood-ratio test. Those are exactly the fits that find spikes. Without a bound some of them degenerate, and simply discarding them would bias the test's null distribution, because the replicates where a spike wins are the ones that matter.

## Decision

All inference fits (standard errors, bootstrap, coverage, choosing K, the LRT, convergence studies of simulated data) use a floor of σ ≥ 0.1. The parity code path (`fit` with the default `varianceFloor = 0`) is unchanged. Every analysis counts the fits where the floor ended up binding and the page shows those counts.

## Options considered

1. **No floor; drop degenerate runs.** Biases the LRT null, as above.
2. **Absolute floor, σ ≥ 0.1** (chosen). Interpretable in rating points and far below any real group's spread (the true σ are 1.2 and 1.5).
3. **Relative floor** (for example 5% of the sample SD) or scikit-learn's `reg_covar = 1e-6` added to each variance. Scale-free, but 10⁻⁶ is far too small to stop a spike on seven identical values.
4. **A prior on σ²** (penalised or MAP EM, as in Chen and Tan's penalised likelihood), which also has theory for testing the number of components. The principled option, but a different estimator from the notebook's.
5. **Model the clipping** with a censored likelihood, so no component needs to absorb the pile at 10. Fixes the cause rather than the symptom.

## Why

The floor is the smallest change that makes every fit well defined while leaving the fits that matter untouched, and it is easy to state and to check.

## What happened

- The floor never bound for the notebook's fit, its 1,000 bootstrap refits, or the coverage-study fits.
- It decides how much the pile at 10.0 is worth when choosing K. The best three-component fit puts its third component on the clipped ratings with σ held at the floor (4.0% at μ = 9.96, ℓ = −403.23), and BIC picks K = 3 (BIC 848.85, against 851.79 for K = 4 and 854.47 for K = 2); AIC picks 4. The floor prevents degenerate spikes; it does nothing about misspecification.
- That K = 3 fit was missed at first. Review found that none of the ordinary starts (k-means++, Forgy, random) could isolate seven identical values, so the first version reported a lower K = 3 maximum (ℓ = −409.17) and said both criteria chose K = 4. The fitter now adds starts with a narrow component on any value tied three or more times, and a test pins the K = 3 maximum and BIC's choice.
- The choice moves with the floor. BIC picks K = 3 at σ ≥ 0.05 and 0.1, and K = 4 at σ ≥ 0.25, where K = 2, 3 and 4 are within 1.1 BIC points of each other. Without the seven clipped ratings the floor never binds and BIC picks K = 2.
- It did bind in the LRT: in 40 of the 500 data sets simulated under the single-normal null, the best two-component fit had a component at σ = 0.1. The null distribution therefore depends on the floor. Leaving those 40 out moves the bootstrap's 95% point only from 11.49 to 11.10, still far above the χ² value of 7.81, so the conclusion does not hinge on it.

## What I'd change

- Report the LRT for several floors (0.05, 0.1, 0.25) as a sensitivity check, as the choice of K now is.
- Replace the floor with a weak inverse-gamma prior on σ², which keeps the likelihood bounded without a hard edge.
- Fit a censored mixture for ratings at 1 and 10, so the pile at 10 stops being a "component".
