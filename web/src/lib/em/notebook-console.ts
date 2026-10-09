/**
 * Re-creates the text `EMAnalyzer.fit()` and notebook cell 9 print, from a TS fit.
 * The parity suite checks it character for character against the output stored
 * in the notebook, and the playground shows it as a "notebook console" replay.
 */
import { pyFixed } from "../format";
import { PARAM_KEYS, type FitResult, type MixtureParams } from "./types";

const RULE = "=".repeat(50);

export function fitConsole(result: FitResult, n: number): string {
  const lines: string[] = ["Starting EM Algorithm...", RULE];
  let previous: MixtureParams = result.init;
  for (const it of result.iterations) {
    const p = it.params;
    lines.push(
      "",
      `--- ITERATION ${it.iteration} ---`,
      "",
      "=== E-STEP ===",
      `Posterior probabilities computed for ${n} users`,
      `Average P(group 1): ${pyFixed(it.gammaMean1, 3)}`,
      `Average P(group 2): ${pyFixed(it.gammaMean2, 3)}`,
      "",
      "=== M-STEP ===",
      `Mixing proportions: π₁ = ${pyFixed(p.pi1, 3)} (was ${pyFixed(previous.pi1, 3)})`,
      `                 π₂ = ${pyFixed(p.pi2, 3)} (was ${pyFixed(previous.pi2, 3)})`,
      `Means: μ₁ = ${pyFixed(p.mu1, 3)} (was ${pyFixed(previous.mu1, 3)})`,
      `       μ₂ = ${pyFixed(p.mu2, 3)} (was ${pyFixed(previous.mu2, 3)})`,
      `Std devs: σ₁ = ${pyFixed(p.sigma1, 3)} (was ${pyFixed(previous.sigma1, 3)})`,
      `          σ₂ = ${pyFixed(p.sigma2, 3)} (was ${pyFixed(previous.sigma2, 3)})`,
      "",
      `Log-likelihood: ${pyFixed(it.logLikelihood, 2)}`,
    );
    if (it.improvement !== null) lines.push(`Improvement: ${pyFixed(it.improvement, 4)}`);
    if (result.stopReason === "converged" && it === result.iterations.at(-1)) {
      lines.push("", `Converged after ${it.iteration} iterations!`);
    }
    previous = p;
  }
  return lines.join("\n") + "\n";
}

/** Cell 9's own prints after `fit()` returns. */
export function finalResultsConsole(estimated: MixtureParams, truth: MixtureParams): string {
  const lines = ["", RULE, "FINAL RESULTS", RULE, "", "Estimated Parameters:"];
  for (const k of PARAM_KEYS) lines.push(`  ${k}: ${pyFixed(estimated[k], 3)}`);
  lines.push("", "True Parameters:");
  for (const k of PARAM_KEYS) lines.push(`  ${k}: ${pyFixed(truth[k], 3)}`);
  return lines.join("\n") + "\n";
}
