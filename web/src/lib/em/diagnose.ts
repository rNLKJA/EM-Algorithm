/**
 * Why a run stopped as "degenerate". The port keeps the notebook's maths exactly,
 * so a bad start can break it in more than one way, and they need different
 * explanations:
 *
 * - underflow: a rating sits so many standard deviations (about 38 or more) from
 *   both means that both densities round to 0 in floating point. Its
 *   responsibilities are then 0/0 = NaN, and every parameter after that is NaN.
 *   The notebook's `normal_pdf` does exactly the same. A numerical failure of the
 *   start, not a property of the likelihood.
 * - empty: one component's responsibility rounded to 0 for every rating, so its
 *   mean is 0/0.
 * - collapse: a component's sigma shrank to (nearly) zero on a single rating, the
 *   unbounded spike described on the pitfalls page.
 */
import { SIGMA_EPS, isNonDegenerate, paramsAt, type Data } from "./em";
import { normalPdf } from "./gaussian";
import type { FitResult, MixtureParams } from "./types";

export type Degeneracy =
  | {
      kind: "underflow";
      /** the first rating whose two weighted densities were both exactly 0 */
      x: number;
      /** its distance from mu1 and mu2, in standard deviations, under the E-step's parameters */
      z: [number, number];
    }
  | { kind: "empty"; component: 1 | 2 }
  | { kind: "collapse"; component: 1 | 2; sigma: number };

export function paramsFinite(p: MixtureParams): boolean {
  return (
    Number.isFinite(p.pi1) &&
    Number.isFinite(p.pi2) &&
    Number.isFinite(p.mu1) &&
    Number.isFinite(p.mu2) &&
    Number.isFinite(p.sigma1) &&
    Number.isFinite(p.sigma2)
  );
}

/**
 * Diagnose one EM iteration that went from `before` (the parameters its E-step used)
 * to `after` (what its M-step produced). Null when `after` is a valid fit.
 */
export function diagnoseStep(
  data: Data,
  before: MixtureParams,
  after: MixtureParams,
): Degeneracy | null {
  if (isNonDegenerate(after)) return null;
  if (isNonDegenerate(before)) {
    for (let i = 0; i < data.length; i++) {
      const x = data[i];
      const w1 = before.pi1 * normalPdf(x, before.mu1, before.sigma1);
      const w2 = before.pi2 * normalPdf(x, before.mu2, before.sigma2);
      if (w1 + w2 === 0) {
        return {
          kind: "underflow",
          x,
          z: [Math.abs(x - before.mu1) / before.sigma1, Math.abs(x - before.mu2) / before.sigma2],
        };
      }
    }
  }
  if (after.pi1 === 0) return { kind: "empty", component: 1 };
  if (after.pi2 === 0) return { kind: "empty", component: 2 };
  const ok1 =
    Number.isFinite(after.mu1) && Number.isFinite(after.sigma1) && after.sigma1 > SIGMA_EPS;
  const component = ok1 ? 2 : 1;
  return { kind: "collapse", component, sigma: component === 1 ? after.sigma1 : after.sigma2 };
}

/** Diagnose the last iteration of a fit that stopped as degenerate (null otherwise). */
export function diagnoseFit(data: Data, result: FitResult): Degeneracy | null {
  if (result.stopReason !== "degenerate") return null;
  const n = result.iterations.length;
  return diagnoseStep(data, paramsAt(result, n - 1), result.iterations[n - 1].params);
}
