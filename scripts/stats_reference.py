# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "numpy>=1.26",
#   "scipy>=1.11",
#   "statsmodels>=0.14",
#   "numdifftools>=0.9.41",
# ]
# ///
"""Reference values for the web app's statistics helpers (web/src/lib/stats).

Computes, with SciPy, statsmodels and numdifftools, the values the TypeScript
helpers are tested against in web/src/lib/stats/stats.reference.test.ts:

* normal and chi-square CDFs, survival functions, densities and quantiles;
* the regularised incomplete gamma function;
* Wilson score intervals (statsmodels ``proportion_confint(method="wilson")``);
* type-7 quantiles (``numpy.quantile``, the default "linear" method);
* the two-component mixture MLE on the notebook's 200 ratings (EM from the
  notebook's own start, run to |Δℓ| < 1e-12) and its observed-information
  standard errors from a Richardson-extrapolated numerical Hessian.

Writes web/src/lib/stats/__fixtures__/reference.json. Run from the repository root:

    uv run scripts/stats_reference.py
    Rscript scripts/stats_reference.R   # adds the R cross-check (prop.test, numDeriv)
"""

from __future__ import annotations

import json
from pathlib import Path

import numdifftools as nd
import numpy as np
from scipy import special, stats
from statsmodels.stats.proportion import proportion_confint

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / "web" / "public" / "data" / "notebook-run.json"
OUT = ROOT / "web" / "src" / "lib" / "stats" / "__fixtures__" / "reference.json"


def mixture_ll(theta: np.ndarray, x: np.ndarray) -> float:
    p, m1, m2, s1, s2 = theta
    return float(
        np.sum(np.log(p * stats.norm.pdf(x, m1, s1) + (1 - p) * stats.norm.pdf(x, m2, s2)))
    )


def em_to_convergence(x: np.ndarray, init: dict) -> np.ndarray:
    p, m1, m2, s1, s2 = init["pi1"], init["mu1"], init["mu2"], init["sigma1"], init["sigma2"]
    prev = None
    for _ in range(100_000):
        a = p * stats.norm.pdf(x, m1, s1)
        b = (1 - p) * stats.norm.pdf(x, m2, s2)
        g = a / (a + b)
        p = g.mean()
        m1 = np.sum(g * x) / g.sum()
        m2 = np.sum((1 - g) * x) / (1 - g).sum()
        s1 = np.sqrt(np.sum(g * (x - m1) ** 2) / g.sum())
        s2 = np.sqrt(np.sum((1 - g) * (x - m2) ** 2) / (1 - g).sum())
        cur = mixture_ll(np.array([p, m1, m2, s1, s2]), x)
        if prev is not None and abs(cur - prev) < 1e-12:
            break
        prev = cur
    theta = np.array([p, m1, m2, s1, s2])
    if m1 > m2:  # order components by mean (DR-002)
        theta = np.array([1 - p, m2, m1, s2, s1])
    return theta


def main() -> None:
    run = json.loads(RUN.read_text())
    x = np.array(run["ratings"])

    z_points = [-8.0, -3.0, -1.959963984540054, -0.5, 0.0, 0.3, 1.0, 2.5, 6.0]
    p_points = [1e-10, 1e-3, 0.025, 0.1, 0.5, 0.8, 0.975, 0.999, 1 - 1e-10]
    chi_points = [(0.1, 1), (3.84, 1), (7.8147, 3), (19.8794, 3), (2.0, 2), (11.5, 3), (50.0, 5)]
    gamma_points = [(0.5, 0.01), (0.5, 2.0), (1.5, 0.7), (3.0, 10.0), (10.0, 4.0), (2.5, 2.5)]
    wilson_points = [(0, 10), (10, 10), (1, 20), (181, 200), (433, 500), (10, 200), (80, 500)]
    q_data = [3.2, -1.0, 7.5, 0.0, 2.2, 9.9, 4.4, 4.4, 1.1, 6.0, 5.5]
    q_points = [0.0, 0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975, 1.0]

    theta = em_to_convergence(x, run["init"])
    hess = nd.Hessian(lambda t: mixture_ll(t, x), method="central")(theta)
    cov = np.linalg.inv(-hess)

    out = {
        "generator": "scripts/stats_reference.py",
        "normal": {
            "cdf": [[z, float(stats.norm.cdf(z))] for z in z_points],
            "ppf": [[p, float(stats.norm.ppf(p))] for p in p_points],
        },
        "chi2": {
            "cdf": [[x_, k, float(stats.chi2.cdf(x_, k))] for x_, k in chi_points],
            "sf": [[x_, k, float(stats.chi2.sf(x_, k))] for x_, k in chi_points],
            "pdf": [[x_, k, float(stats.chi2.pdf(x_, k))] for x_, k in chi_points],
            "ppf95": [[k, float(stats.chi2.ppf(0.95, k))] for k in range(1, 6)],
        },
        "gammainc": [[a, x_, float(special.gammainc(a, x_))] for a, x_ in gamma_points],
        "wilson": [
            [k, n, level, *map(float, proportion_confint(k, n, alpha=1 - level, method="wilson"))]
            for k, n in wilson_points
            for level in (0.95, 0.9)
        ],
        "quantile7": {
            "data": q_data,
            "points": [[p, float(np.quantile(q_data, p))] for p in q_points],
        },
        "mixture": {
            "description": "EM from the notebook's start to |dl| < 1e-12; components ordered by mean",
            "theta": theta.tolist(),
            "logLikelihood": mixture_ll(theta, x),
            "se": np.sqrt(np.diag(cov)).tolist(),
            "hessian": hess.tolist(),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
