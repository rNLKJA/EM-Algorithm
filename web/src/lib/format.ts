/** Number formatting shared by tables, traces and the notebook console replay. */

/**
 * Python-style fixed formatting (`f"{x:.{d}f}"`). Matches `toFixed` except for the
 * non-finite spellings Python prints (nan, inf, -inf).
 */
export function pyFixed(x: number, digits: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  return x.toFixed(digits);
}

/** Python-style percentage (`f"{x:.1%}"`). */
export function pyPercent(x: number, digits = 1): string {
  return `${pyFixed(x * 100, digits)}%`;
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
  if (!Number.isFinite(x)) return pyFixed(x, digits);
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
  if (!Number.isFinite(x)) return pyFixed(x, digits);
  const ax = Math.abs(x);
  if (ax !== 0 && ax < 10 ** -digits) return sci(x, 2);
  return x.toFixed(digits);
}

/** Signed fixed formatting, e.g. "+8.98" / "−0.03" with a true minus sign. */
export function signed(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return pyFixed(x, digits);
  const s = Math.abs(x).toFixed(digits);
  return x >= 0 ? `+${s}` : `−${s}`;
}

/** Replace ASCII hyphen-minus with a typographic minus for display. */
export function minus(s: string): string {
  return s.replace(/^-/, "−");
}
