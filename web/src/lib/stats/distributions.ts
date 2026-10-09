/**
 * Normal and chi-square distribution functions, accurate to about 1e-14, built
 * on the regularised incomplete gamma function (series below a + 1, Lentz's
 * continued fraction above). Checked against SciPy in stats.reference.test.ts.
 */
import { logGamma } from "../em/gaussian";

const EPS = 1e-16;
const TINY = 1e-300;
const MAX_TERMS = 1000;

function gammaPrefix(a: number, x: number): number {
  return Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/** Regularised lower incomplete gamma P(a, x) = gamma(a, x) / Gamma(a). */
export function regularizedGammaP(a: number, x: number): number {
  if (!(a > 0) || Number.isNaN(x)) return Number.NaN;
  if (x <= 0) return 0;
  if (x === Infinity) return 1;
  if (x < a + 1) return gammaSeries(a, x);
  return 1 - gammaContinuedFraction(a, x);
}

/** Regularised upper incomplete gamma Q(a, x) = 1 - P(a, x), without cancellation. */
export function regularizedGammaQ(a: number, x: number): number {
  if (!(a > 0) || Number.isNaN(x)) return Number.NaN;
  if (x <= 0) return 1;
  if (x === Infinity) return 0;
  if (x < a + 1) return 1 - gammaSeries(a, x);
  return gammaContinuedFraction(a, x);
}

function gammaSeries(a: number, x: number): number {
  let ap = a;
  let term = 1 / a;
  let sum = term;
  for (let i = 0; i < MAX_TERMS; i++) {
    ap += 1;
    term *= x / ap;
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * EPS) break;
  }
  return sum * gammaPrefix(a, x);
}

function gammaContinuedFraction(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= MAX_TERMS; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return gammaPrefix(a, x) * h;
}

/** Standard normal CDF. */
export function normalCdf(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  if (x === 0) return 0.5;
  const tail = 0.5 * regularizedGammaQ(0.5, (x * x) / 2);
  return x < 0 ? tail : 1 - tail;
}

/** Standard normal density. */
export function normalDensity(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Acklam's rational approximation (relative error 1.15e-9), then one Halley step.
const A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
];
const B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
];
const C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

/** Standard normal quantile (inverse CDF), refined to full double precision. */
export function normalQuantile(p: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return Number.NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  // work in the lower tail, where the CDF used for refinement keeps full relative precision
  if (p > 0.5) return -normalQuantile(1 - p);
  const pLow = 0.02425;
  let x: number;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
      ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) /
      (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  }
  // Halley refinement against the accurate CDF
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Two-sided critical value z such that P(|Z| <= z) = level (1.959964 for 95%). */
export function zCritical(level = 0.95): number {
  return normalQuantile(1 - (1 - level) / 2);
}

/** Chi-square CDF with `df` degrees of freedom. */
export function chiSquareCdf(x: number, df: number): number {
  if (x <= 0) return 0;
  return regularizedGammaP(df / 2, x / 2);
}

/** Chi-square upper tail P(X > x): the p-value of an observed statistic x. */
export function chiSquareSf(x: number, df: number): number {
  if (x <= 0) return 1;
  return regularizedGammaQ(df / 2, x / 2);
}

/** Chi-square density. */
export function chiSquarePdf(x: number, df: number): number {
  if (x < 0) return 0;
  if (x === 0) return df === 2 ? 0.5 : df < 2 ? Infinity : 0;
  const k = df / 2;
  return Math.exp((k - 1) * Math.log(x) - x / 2 - k * Math.LN2 - logGamma(k));
}

/** Chi-square quantile by bisection on the CDF (monotone, so always converges). */
export function chiSquareQuantile(p: number, df: number): number {
  if (!(p >= 0 && p <= 1)) return Number.NaN;
  if (p === 0) return 0;
  if (p === 1) return Infinity;
  let lo = 0;
  let hi = Math.max(1, df);
  while (chiSquareCdf(hi, df) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-13 * Math.max(1, hi); i++) {
    const mid = (lo + hi) / 2;
    if (chiSquareCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
