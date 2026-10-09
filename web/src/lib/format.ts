/** Number formatting shared by tables, traces and the notebook console replay. */

/**
 * Python-style fixed formatting (`f"{x:.{d}f}"`). Both Python and `toFixed` round the
 * exact binary value of `x`, so they agree except in two places, handled here: the
 * non-finite spellings Python prints (nan, inf, -inf), and exact ties, where `toFixed`
 * rounds away from zero and Python rounds half to even (0.125 -> "0.12", 2.5 -> "2").
 */
export function pyFixed(x: number, digits: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  const fixed = x.toFixed(digits);
  // toFixed switches to exponent notation from 1e21; no fractional ties up there.
  if (Math.abs(x) >= 1e21) return fixed;
  // A tie needs |x| >= 0.5 * 10^-digits, and a double that close to one differs from it
  // within ~17 significant digits, so digits + 30 places show any non-tie for certain.
  const exact = Math.abs(x).toFixed(Math.min(100, digits + 30));
  const point = exact.indexOf(".");
  if (!/^50*$/.test(exact.slice(point + 1 + digits))) return fixed;
  const kept = digits > 0 ? exact.slice(0, point + 1 + digits) : exact.slice(0, point);
  // Odd last digit: rounding up makes it even, which is what toFixed already did.
  if (Number(kept.at(-1)) % 2 === 1) return fixed;
  return (x < 0 ? "-" : "") + kept;
}

/** Python-style percentage (`f"{x:.1%}"`). */
export function pyPercent(x: number, digits = 1): string {
  return `${pyFixed(x * 100, digits)}%`;
}

/** UI spelling for non-finite values (NaN, ∞, −∞); the Python spellings stay in pyFixed. */
export function nonFinite(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  return x > 0 ? "∞" : "−∞";
}

const SUPERSCRIPTS: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
};

/** 4.2376e-27 -> "4.24 × 10⁻²⁷" (readable scientific notation for tiny densities). */
export function sci(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return nonFinite(x);
  if (x === 0) return "0";
  const [mantissa, exponent] = x.toExponential(digits).split("e");
  const exp = Number(exponent);
  if (exp === 0) return mantissa;
  const sup = String(exp)
    .split("")
    .map((c) => SUPERSCRIPTS[c] ?? c)
    .join("");
  return `${mantissa} × 10${sup}`;
}

/** Fixed notation for ordinary magnitudes, scientific for very small ones. */
export function smart(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return nonFinite(x);
  const ax = Math.abs(x);
  if (ax !== 0 && ax < 10 ** -digits) return sci(x, 2);
  return x.toFixed(digits);
}

/** Signed fixed formatting, e.g. "+8.98" / "−0.03" with a true minus sign. */
export function signed(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return nonFinite(x);
  const s = Math.abs(x).toFixed(digits);
  return x >= 0 ? `+${s}` : `−${s}`;
}

/** Replace ASCII hyphen-minus with a typographic minus for display. */
export function minus(s: string): string {
  return s.replace(/^-/, "−");
}
