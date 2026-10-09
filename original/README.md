# Original explainer and notebook

This folder holds the project as it stood before the 2026 web revival, moved here with `git mv` so its history is intact. The files are unchanged; the interactive site in [`../web`](../web) is built on top of them.

| Path | What it is |
| --- | --- |
| `em-explainer.md` | The long-form EM walkthrough (formerly the repository README, June 2026 house-style edition): the Netflix missing-data framing, the hand-worked `[2, 3, 7, 8]` example, likelihood and log-likelihood, the E-step and M-step derivations, a Normal + Beta mixture and the convergence property. |
| `em_algorithm_demo.ipynb` | The runnable demo (September 2025): 200 synthetic "movie ratings" from a two-group Gaussian mixture (seed 42), an `EMAnalyzer` class written from scratch, convergence plots and a "classify a new user" example. Outputs are saved in the notebook. |
| `_archive/README.original.md` | The first version of the explainer (September 2025), before the house-style rewrite. |
| `pyproject.toml` | Formatter settings (black, isort) used when the notebook was tidied. It does not declare dependencies. |

## Running the notebook

No environment file is needed. With [uv](https://docs.astral.sh/uv/) installed, from the repository root:

```bash
# open it in JupyterLab
uv run --with numpy --with scipy --with matplotlib --with pandas --with jupyter \
  jupyter lab original/em_algorithm_demo.ipynb

# or execute it headlessly into a scratch copy
uv run --with numpy --with scipy --with matplotlib --with pandas --with jupyter \
  jupyter nbconvert --to notebook --execute original/em_algorithm_demo.ipynb \
  --output /tmp/em_algorithm_demo.executed.ipynb
```

The notebook reads no files, so it runs from this folder unchanged. With `np.random.seed(42)` it prints the same results every time: an average rating of 6.21 (range 1.2 to 10.0), a log-likelihood that rises from -425.50 to -416.51 over 15 iterations, and 90.5% classification accuracy.

## Known issues, kept as they are

The site keeps these visible rather than editing the originals:

- **Hand-worked densities in `em-explainer.md`.** The example uses `normal_pdf(2; 2.5, 0.5) = 0.8` and `normal_pdf(3; 2.5, 0.5) = 0.6`; both are really 0.4839, and the cross-group densities are around 10⁻¹⁸ to 10⁻²⁷ rather than 0.0001. The responsibilities and updated parameters still come out right. A few numbers in the later examples are off in the same way. The site's Maths page and stepper show "as written" beside "exact".
- **Label switching in the notebook.** After fitting, component 1 is the *low*-mean group, so the "classify a new user" cell reports `P(Sci-fi lover | 8.5) = 0.001` and calls an 8.5 rater a romance lover. The 90.5% accuracy is correct, but only because the labels switched (the accuracy line maps component 1 to the "romance" label). The site matches components to groups by mean.
- **Stopping at 15 iterations.** The run stops at `max_iterations=15` while the log-likelihood is still rising by about 0.03 per iteration. Run to convergence, the same start ends at a different fit (log-likelihood -415.37 after 90 iterations).

## How the site uses this folder

[`../scripts/export_parity.py`](../scripts/export_parity.py) executes the notebook's code cells verbatim, checks that every printed line matches the outputs saved here, and exports the 200 ratings, the random initial parameters and the per-iteration trace to `web/public/data/notebook-run.json`. The TypeScript port of `EMAnalyzer` is tested against that trace.
