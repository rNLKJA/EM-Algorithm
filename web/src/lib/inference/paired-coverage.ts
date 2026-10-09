/**
 * Bootstrap minus Wald coverage on the same simulated data sets: the paired
 * difference in coverage (as a proportion) with a percentile bootstrap
 * interval from resampling data sets. Used by the /inference table and by the
 * sentence above it, so the prose can only claim what the intervals support.
 */
import { pairedMeanDifference, type PairedDifference } from "../stats/paired";
import type { CoverageResult, PairedCoverage } from "./uncertainty";

export function pairedCoverageDifference(t: PairedCoverage, seed: number): PairedDifference {
  const wald: number[] = [];
  const boot: number[] = [];
  const push = (w: number, b: number, k: number) => {
    for (let i = 0; i < k; i++) {
      wald.push(w);
      boot.push(b);
    }
  };
  push(1, 1, t.both);
  push(1, 0, t.waldOnly);
  push(0, 1, t.bootOnly);
  push(0, 0, t.neither);
  return pairedMeanDifference(boot, wald, { seed, B: 4000 });
}

/** One paired difference per parameter (seed 100 + j), null where there is no pairing. */
export function pairedCoverageDifferences(bc: CoverageResult): (PairedDifference | null)[] {
  return bc.params.map((p, j) => (p.paired ? pairedCoverageDifference(p.paired, 100 + j) : null));
}
