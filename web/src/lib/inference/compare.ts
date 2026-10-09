/**
 * "Same seed, same numbers?" for a re-run in the browser against the published
 * artefact.
 *
 * Counts (coverage hits, failed fits, iterations, seeds) are integers and must
 * match exactly. Every other number is compared to a relative tolerance,
 * because JavaScript engines do not all round Math.exp and Math.log the same
 * way: Chrome 155's V8 returns correctly rounded results where Node 26's
 * sometimes differs in the last bit, and the numerical Hessian magnifies that
 * to about 3e-7 relative in standard errors and interval widths. The default
 * 1e-5 is far above that and far below the 3 to 4 significant digits shown on
 * screen.
 */
export const RERUN_RELATIVE_TOLERANCE = 1e-5;

export function sameNumbers(a: unknown, b: unknown, rel = RERUN_RELATIVE_TOLERANCE): boolean {
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (Number.isInteger(a) && Number.isInteger(b)) return a === b;
    return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => sameNumbers(v, b[i], rel));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    return (
      ka.length === Object.keys(b as object).length &&
      ka.every((k) =>
        sameNumbers((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], rel),
      )
    );
  }
  return a === b;
}
