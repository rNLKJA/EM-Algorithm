/**
 * Normal density, written in the same order as the notebook's `normal_pdf`:
 * `(1 / (sigma * np.sqrt(2 * np.pi))) * np.exp(-0.5 * ((x - mu) / sigma) ** 2)`.
 */
export function normalPdf(x: number, mu: number, sigma: number): number {
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

/** Beta(alpha, beta) density on [0, 1]; zero outside. Integer-friendly via log-gamma. */
export function betaPdf(x: number, alpha: number, beta: number): number {
  if (x < 0 || x > 1) return 0;
  const logB = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
  return Math.exp((alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - logB);
}

/** Lanczos approximation of log Gamma(z) (g = 607/128, 15 terms; ~1e-15 relative). */
export function logGamma(z: number): number {
  const g = 607 / 128;
  const c = [
    0.99999999999999709182, 57.156235665862923517, -59.597960355475491248, 14.136097974741747174,
    -0.49191381609762019978, 0.33994649984811888699e-4, 0.46523628927048575665e-4,
    -0.98374475304879564677e-4, 0.15808870322491248884e-3, -0.21026444172410488319e-3,
    0.2174396181152126432e-3, -0.16431810653676389022e-3, 0.84418223983852743293e-4,
    -0.2619083840158140867e-4, 0.36899182659531622704e-5,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  const zz = z - 1;
  let a = c[0];
  const t = zz + g + 0.5;
  for (let i = 1; i < c.length; i++) a += c[i] / (zz + i);
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(a);
}
