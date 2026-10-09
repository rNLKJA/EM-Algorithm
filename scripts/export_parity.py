# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "numpy>=1.26",
#   "scipy>=1.11",
#   "pandas>=2.0",
#   "matplotlib>=3.8",
# ]
# ///
"""Re-run the ORIGINAL notebook and export parity artefacts for the web app.

NumPy's seeded global RNG (``np.random.seed(42)``) cannot be reproduced in
TypeScript, so the web app does not try. Instead this script executes the code
cells of ``original/em_algorithm_demo.ipynb`` *verbatim* (same cell order, same
seed, same ``EMAnalyzer`` class), checks that every printed line matches the
output stored in the notebook, and exports:

* ``web/public/data/notebook-run.json`` - the 200 synthetic ratings, the true
  groups, the random initial parameters and the full per-iteration trace
  (log-likelihood, pi, mu, sigma) of the notebook's ``em.fit(15, 1e-4)`` run.
* ``web/src/lib/__fixtures__/parity.json`` - extra traces used only by the
  vitest parity suite: the same notebook code under other seeds, a longer run
  that hits the convergence test, and the README's hand-worked 4-rating example
  computed exactly (scipy) so the "as written vs exact" table can be checked.

Run from the repository root:

    uv run scripts/export_parity.py

Only the notebook's own code touches the RNG; the instrumentation below wraps
``EMAnalyzer`` methods to *record* values and never changes what they compute.
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import platform
import sys
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")  # the notebook calls plt.show()

import warnings  # noqa: E402

import numpy as np  # noqa: E402
from scipy.stats import norm  # noqa: E402

warnings.filterwarnings("ignore", message=".*non-interactive.*")

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "original" / "em_algorithm_demo.ipynb"
OUT_RUN = ROOT / "web" / "public" / "data" / "notebook-run.json"
OUT_FIXTURE = ROOT / "web" / "src" / "lib" / "__fixtures__" / "parity.json"

PARAM_KEYS = ["pi1", "pi2", "mu1", "mu2", "sigma1", "sigma2"]


def load_cells() -> list[dict]:
    nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    return [c for c in nb["cells"] if c["cell_type"] == "code"]


def cell_source(cell: dict) -> str:
    return "".join(cell["source"])


def stored_stdout(cell: dict) -> str:
    return "".join(
        "".join(o["text"]) for o in cell.get("outputs", []) if o.get("output_type") == "stream"
    )


def run_cell(src: str, ns: dict) -> str:
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(compile(src, "<notebook>", "exec"), ns)  # noqa: S102 - our own notebook
    return buf.getvalue()


def params_of(params: dict) -> dict:
    return {k: float(params[k]) for k in PARAM_KEYS}


def instrument(ns: dict) -> list[dict]:
    """Wrap EMAnalyzer methods so each fit() records a trace. Values are only read."""
    cls = ns["EMAnalyzer"]
    runs: list[dict] = []

    orig_init = cls.initialize_parameters
    orig_e = cls.e_step
    orig_m = cls.m_step
    orig_ll = cls.compute_log_likelihood

    def initialize_parameters(self):
        orig_init(self)
        runs.append({"init": params_of(self.params), "iterations": []})

    def e_step(self):
        out = orig_e(self)
        runs[-1]["iterations"].append(
            {
                "gammaMean1": float(self.gamma1.mean()),
                "gammaMean2": float(self.gamma2.mean()),
            }
        )
        return out

    def m_step(self):
        out = orig_m(self)
        runs[-1]["iterations"][-1]["params"] = params_of(self.params)
        return out

    def compute_log_likelihood(self):
        ll = orig_ll(self)
        if runs and runs[-1]["iterations"] and "logLikelihood" not in runs[-1]["iterations"][-1]:
            runs[-1]["iterations"][-1]["logLikelihood"] = float(ll)
        return ll

    cls.initialize_parameters = initialize_parameters
    cls.e_step = e_step
    cls.m_step = m_step
    cls.compute_log_likelihood = compute_log_likelihood
    return runs


def matched_accuracy(gamma1: np.ndarray, mu_fit: tuple[float, float], true_groups, true_mu):
    """Accuracy after matching fitted components to true groups by mean (min total |d mu|)."""
    keep = abs(mu_fit[0] - true_mu[0]) + abs(mu_fit[1] - true_mu[1])
    swap = abs(mu_fit[0] - true_mu[1]) + abs(mu_fit[1] - true_mu[0])
    # true group 0 corresponds to fitted component 1 unless swapped
    pred_fit1 = gamma1 > 0.5  # True -> fitted component 1
    if keep <= swap:
        pred_true = np.where(pred_fit1, 0, 1)
    else:
        pred_true = np.where(pred_fit1, 1, 0)
    return float(np.mean(pred_true == true_groups)), bool(swap < keep)


def simulate(cells: list[dict], seed: int, max_iterations: int, tolerance: float) -> dict:
    """Run notebook cells 1, 3, 4, 7 + a fit under another seed (same code otherwise)."""
    ns: dict = {"__name__": "__notebook__"}
    src1 = cell_source(cells[0])
    assert "np.random.seed(42)" in src1
    run_cell(src1.replace("np.random.seed(42)", f"np.random.seed({seed})"), ns)
    run_cell(cell_source(cells[1]), ns)  # true params
    run_cell(cell_source(cells[2]), ns)  # data
    run_cell(cell_source(cells[4]), ns)  # class
    runs = instrument(ns)
    ns["_max_it"], ns["_tol"] = max_iterations, tolerance
    run_cell("em = EMAnalyzer(ratings)\nlls = em.fit(max_iterations=_max_it, tolerance=_tol)", ns)
    em, true_groups = ns["em"], ns["true_groups"]
    tp = ns["true_params"]
    acc_written = float(np.mean((em.gamma1 > 0.5).astype(int) == true_groups))
    acc_matched, swapped = matched_accuracy(
        em.gamma1, (em.params["mu1"], em.params["mu2"]), true_groups, (tp["mu1"], tp["mu2"])
    )
    return {
        "seed": seed,
        "maxIterations": max_iterations,
        "tolerance": tolerance,
        "ratings": [float(x) for x in ns["ratings"]],
        "trueGroups": [int(g) for g in true_groups],
        "init": runs[0]["init"],
        "iterations": runs[0]["iterations"],
        "finalGamma1": [float(g) for g in em.gamma1],
        "accuracyAsWritten": acc_written,
        "accuracyMatched": acc_matched,
        "labelsSwapped": swapped,
    }


def readme_example() -> dict:
    """The README's 4-rating example, computed exactly with the notebook's EM maths."""
    x = np.array([2.0, 3.0, 7.0, 8.0])
    params = {"pi1": 0.5, "pi2": 0.5, "mu1": 2.5, "mu2": 7.5, "sigma1": 0.5, "sigma2": 0.5}
    densities = {
        "f1": [float(v) for v in norm.pdf(x, params["mu1"], params["sigma1"])],
        "f2": [float(v) for v in norm.pdf(x, params["mu2"], params["sigma2"])],
    }
    iterations = []
    for _ in range(3):
        l1 = norm.pdf(x, params["mu1"], params["sigma1"])
        l2 = norm.pdf(x, params["mu2"], params["sigma2"])
        n1, n2 = params["pi1"] * l1, params["pi2"] * l2
        g1, g2 = n1 / (n1 + n2), n2 / (n1 + n2)
        new = {
            "pi1": float(g1.mean()),
            "pi2": float(g2.mean()),
            "mu1": float(np.sum(g1 * x) / np.sum(g1)),
            "mu2": float(np.sum(g2 * x) / np.sum(g2)),
        }
        new["sigma1"] = float(np.sqrt(np.sum(g1 * (x - new["mu1"]) ** 2) / np.sum(g1)))
        new["sigma2"] = float(np.sqrt(np.sum(g2 * (x - new["mu2"]) ** 2) / np.sum(g2)))
        ll = float(
            np.sum(
                np.log(
                    new["pi1"] * norm.pdf(x, new["mu1"], new["sigma1"])
                    + new["pi2"] * norm.pdf(x, new["mu2"], new["sigma2"])
                    + 1e-10
                )
            )
        )
        iterations.append(
            {
                "weighted1": [float(v) for v in n1],
                "weighted2": [float(v) for v in n2],
                "gamma1": [float(v) for v in g1],
                "gamma2": [float(v) for v in g2],
                "params": new,
                "logLikelihood": ll,
            }
        )
        params = new
    return {
        "ratings": x.tolist(),
        "init": {"pi1": 0.5, "pi2": 0.5, "mu1": 2.5, "mu2": 7.5, "sigma1": 0.5, "sigma2": 0.5},
        "densities": densities,
        "iterations": iterations,
        "extraPdf": {
            # README "Example Calculation" (E-step section) and Normal+Beta example
            "f_5_4.5_0.8": float(norm.pdf(5, 4.5, 0.8)),
            "f_5_3.0_1.2": float(norm.pdf(5, 3.0, 1.2)),
            "f_0.2_7.0_1.0": float(norm.pdf(0.2, 7.0, 1.0)),
            "f_7.5_7.0_1.0": float(norm.pdf(7.5, 7.0, 1.0)),
        },
    }


def main() -> int:
    cells = load_cells()
    assert len(cells) == 9, f"expected 9 code cells, found {len(cells)}"
    ns: dict = {"__name__": "__notebook__"}
    mismatches: list[str] = []

    def check(idx: int, out: str) -> None:
        expected = stored_stdout(cells[idx])
        if out != expected:
            mismatches.append(f"cell {idx}: stdout differs from the notebook's stored output")
            sys.stderr.write(f"--- expected (cell {idx}) ---\n{expected}\n--- got ---\n{out}\n")

    # Cells in notebook order: imports+seed, true params, data, plot, class.
    for idx in range(0, 5):
        check(idx, run_cell(cell_source(cells[idx]), ns))
    runs = instrument(ns)
    check(5, run_cell(cell_source(cells[5]), ns))  # em.fit(max_iterations=15, tolerance=1e-4)
    check(6, run_cell(cell_source(cells[6]), ns))  # plots + accuracy
    check(7, run_cell(cell_source(cells[7]), ns))  # how-to prints
    check(8, run_cell(cell_source(cells[8]), ns))  # classify a new user (8.5)

    if mismatches:
        print("\n".join(mismatches), file=sys.stderr)
        return 1

    em, ratings, true_groups = ns["em"], ns["ratings"], ns["true_groups"]
    tp = ns["true_params"]
    run = runs[0]
    acc_matched, swapped = matched_accuracy(
        em.gamma1, (em.params["mu1"], em.params["mu2"]), true_groups, (tp["mu1"], tp["mu2"])
    )
    lls = [it["logLikelihood"] for it in run["iterations"]]

    payload = {
        "$schema": "notebook-run/v1",
        "provenance": {
            "source": "original/em_algorithm_demo.ipynb (code cells executed verbatim)",
            "generator": "scripts/export_parity.py",
            "seed": 42,
            "numpy": np.__version__,
            "python": platform.python_version(),
            "stdoutMatchesNotebook": True,
        },
        "trueParams": {k: float(v) for k, v in tp.items()},
        "n": int(ns["n_users"]),
        "ratings": [float(x) for x in ratings],
        "trueGroups": [int(g) for g in true_groups],
        "fit": {"maxIterations": 15, "tolerance": 1e-4},
        "init": run["init"],
        "iterations": run["iterations"],
        "finalGamma1": [float(g) for g in em.gamma1],
        "summary": {
            "ratingMin": float(ratings.min()),
            "ratingMax": float(ratings.max()),
            "ratingMean": float(ratings.mean()),
            "firstLogLikelihood": lls[0],
            "finalLogLikelihood": lls[-1],
            "totalImprovement": lls[-1] - lls[0],
            "iterationsRun": len(lls),
            "accuracyAsWritten": float(ns["accuracy"]),
            "accuracyMatched": acc_matched,
            "labelsSwapped": swapped,
        },
        "newUser": {
            "rating": float(ns["new_rating"]),
            "probGroup1": float(ns["prob_group1"]),
            "probGroup2": float(ns["prob_group2"]),
        },
        "printed": {
            "fitCell": stored_stdout(cells[5]),
            "accuracyCell": stored_stdout(cells[6]),
            "newUserCell": stored_stdout(cells[8]),
        },
    }

    fixture = {
        "$schema": "parity-fixtures/v1",
        "provenance": payload["provenance"] | {"note": "Extra traces for vitest only."},
        "seeds": [simulate(cells, s, 15, 1e-4) for s in (0, 7, 2025)],
        "longRun": simulate(cells, 42, 500, 1e-4),
        "tightRun": simulate(cells, 3, 300, 1e-8),
        "readmeExample": readme_example(),
    }

    OUT_RUN.parent.mkdir(parents=True, exist_ok=True)
    OUT_FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    OUT_RUN.write_text(json.dumps(payload, indent=1) + "\n", encoding="utf-8")
    OUT_FIXTURE.write_text(json.dumps(fixture, indent=1) + "\n", encoding="utf-8")
    print(f"stdout of all 9 code cells matches the notebook; wrote:")
    print(f"  {OUT_RUN.relative_to(ROOT)} ({OUT_RUN.stat().st_size / 1024:.1f} KB)")
    print(f"  {OUT_FIXTURE.relative_to(ROOT)} ({OUT_FIXTURE.stat().st_size / 1024:.1f} KB)")
    print(
        f"  final LL {lls[-1]:.2f}, accuracy {payload['summary']['accuracyAsWritten']:.1%}, "
        f"labels swapped: {swapped}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
