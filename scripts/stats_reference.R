# R cross-check for the web app's statistics helpers.
#
# Reads the Python reference (web/src/lib/stats/__fixtures__/reference.json) for
# the mixture MLE, then computes with base R and numDeriv:
#   * Wilson intervals with prop.test(correct = FALSE)
#   * chi-square and normal quantiles (qchisq, qnorm)
#   * observed-information standard errors from numDeriv::hessian
# and writes web/src/lib/stats/__fixtures__/reference-r.json.
#
#   Rscript scripts/stats_reference.R     (from the repository root)

suppressPackageStartupMessages({
  library(jsonlite)
  library(numDeriv)
})

fixtures <- file.path("web", "src", "lib", "stats", "__fixtures__")
ref <- fromJSON(file.path(fixtures, "reference.json"))
run <- fromJSON(file.path("web", "public", "data", "notebook-run.json"))
x <- run$ratings

ll <- function(t) {
  sum(log(t[1] * dnorm(x, t[2], t[4]) + (1 - t[1]) * dnorm(x, t[3], t[5])))
}
theta <- ref$mixture$theta
H <- numDeriv::hessian(ll, theta)
se <- sqrt(diag(solve(-H)))

wilson <- lapply(list(c(0, 10), c(10, 10), c(181, 200), c(433, 500), c(80, 500)), function(kn) {
  ci <- prop.test(kn[1], kn[2], correct = FALSE)$conf.int
  c(kn[1], kn[2], 0.95, ci[1], ci[2])
})

out <- list(
  generator = "scripts/stats_reference.R",
  r_version = R.version.string,
  wilson = wilson,
  qchisq95 = lapply(1:5, function(k) c(k, qchisq(0.95, k))),
  qnorm = lapply(c(0.025, 0.5, 0.975), function(p) c(p, qnorm(p))),
  mixture = list(theta = theta, se = se)
)
writeLines(toJSON(out, digits = NA, auto_unbox = TRUE, pretty = TRUE),
           file.path(fixtures, "reference-r.json"))
cat("wrote", file.path(fixtures, "reference-r.json"), "\n")
