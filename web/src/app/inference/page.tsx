import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Callout } from "@/components/common/callout";
import { Ell } from "@/components/common/ell";
import { PageHeader } from "@/components/common/page-header";
import { ScrollX } from "@/components/common/scroll-x";
import { BootstrapSection } from "@/components/inference/bootstrap-section";
import { ConvergenceSection } from "@/components/inference/convergence-section";
import { CoverageSection } from "@/components/inference/coverage-section";
import { count, fmt, pct, pctInterval, THETA_ROWS } from "@/components/inference/format";
import { LrtPlot } from "@/components/inference/lrt-plot";
import { SeedsTable } from "@/components/inference/seeds-table";
import { M, MathBlock } from "@/components/maths/tex";
import { fit } from "@/lib/em/em";
import { notebookFinal, notebookRun } from "@/lib/em/notebook-run";
import type { KRow } from "@/lib/inference/model-choice";
import { pairedCoverageDifferences } from "@/lib/inference/paired-coverage";
import { inference } from "@/lib/inference/results";
import { seedRows } from "@/lib/inference/seeds";
import { INFERENCE_SETTINGS } from "@/lib/inference/settings";
import { toTheta } from "@/lib/inference/uncertainty";
import { sci } from "@/lib/format";
import { pageMetadata, repoFile } from "@/lib/site";
import { wilsonInterval } from "@/lib/stats/intervals";

export const metadata: Metadata = pageMetadata({
  title: "Inference: how sure, how many, how stable",
  description:
    "Standard errors and parametric-bootstrap intervals for the notebook's mixture, a coverage study of those intervals, choosing the number of components by AIC, BIC and a bootstrap likelihood-ratio test, and convergence diagnostics across random starts.",
  path: "/inference",
});

const SECTIONS = [
  { id: "uncertainty", title: "Uncertainty", blurb: "Standard errors and bootstrap intervals." },
  { id: "coverage", title: "Coverage", blurb: "Do 95% intervals cover 95% of the time?" },
  { id: "choosing-k", title: "Choosing K", blurb: "AIC, BIC and a bootstrap LRT." },
  { id: "convergence", title: "Convergence", blurb: "Ascent, speed and restarts." },
];

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t pt-12">
      <p className="eyebrow">question {index}</p>
      <h2 id={`${id}-h`} className="mt-2 text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

/** "π₁, μ₁ and σ₁" */
function listSymbols(symbols: string[]): string {
  if (symbols.length <= 1) return symbols.join("");
  return `${symbols.slice(0, -1).join(", ")} and ${symbols.at(-1)}`;
}

function gmmSummary(r: KRow) {
  if (!r.params) return "no fit";
  return r.params.means
    .map(
      (m, k) =>
        `${fmt(100 * r.params!.weights[k], 0)}% at ${fmt(m, 2)} (σ ${fmt(r.params!.sds[k], 2)})`,
    )
    .join(" · ");
}

export default function InferencePage() {
  const a = inference;
  const s = INFERENCE_SETTINGS;
  const truth = toTheta(notebookRun.trueParams);
  const notebook15 = toTheta(notebookFinal);
  // the notebook's own start, run to each tolerance of the convergence study
  const notebookTo = s.convergence.tolerances.map((tolerance) => {
    const r = fit(notebookRun.ratings, notebookRun.init, {
      maxIterations: s.convergence.maxIterations,
      tolerance,
    });
    return r.stopReason === "converged" ? r.iterations.length : null;
  });

  const misses = (lo: (j: number) => number, hi: (j: number) => number) =>
    truth.filter((t, j) => t < lo(j) || t > hi(j)).length;
  const waldMisses = a.mle.wald
    ? misses(
        (j) => a.mle.wald![j].lower,
        (j) => a.mle.wald![j].upper,
      )
    : 0;
  const bootMisses = misses(
    (j) => a.bootstrap.intervals[j].lower,
    (j) => a.bootstrap.intervals[j].upper,
  );
  const other = a.otherMaximum;

  const covRange = (rates: number[]) =>
    `${pct(Math.min(...rates), 0)} and ${pct(Math.max(...rates), 0)}`;
  // both Wald scenarios (model exactly, clipped like the notebook), so the range covers every rate in the table
  const waldRates = [a.coverage.model, a.coverage.clipped].flatMap((sc) =>
    sc.params.map((p) => p.wald.coverage.estimate),
  );
  const bootRates = a.bootstrapCoverage.params.map((p) => p.bootstrap!.coverage.estimate);
  // the comparison sentence is built from the paired intervals, so it claims no more than they show
  const pairedDiffs = pairedCoverageDifferences(a.bootstrapCoverage);
  const clearlyBetter = THETA_ROWS.filter((_, j) => (pairedDiffs[j]?.interval.lower ?? 0) > 0).map(
    (r) => r.symbol,
  );
  const withinNoise = THETA_ROWS.filter((_, j) => {
    const d = pairedDiffs[j];
    return d !== null && d.interval.lower <= 0 && d.interval.upper >= 0;
  }).map((r) => r.symbol);
  const wider = a.bootstrapCoverage.params.filter(
    (p) => p.bootstrap && p.bootstrap.medianWidth > p.wald.medianWidth,
  ).length;

  const full = a.modelChoice.full;
  const trimmed = a.modelChoice.withoutClipped;
  // how often each criterion picks K on fresh samples (the sentence quotes these, not adjectives)
  const picked = (rows: typeof a.selection.model.bic, K: number) =>
    rows.find((r) => r.K === K)!.picked;
  const selBic1 = picked(a.selection.model.bic, 1);
  const selBic2 = picked(a.selection.model.bic, 2);
  const selBic3 = picked(a.selection.model.bic, 3);
  const selBic1Clipped = picked(a.selection.clipped.bic, 1);
  const selBic2Clipped = picked(a.selection.clipped.bic, 2);
  const selBic3Clipped = picked(a.selection.clipped.bic, 3);
  const selAic2 = picked(a.selection.model.aic, 2);
  const selAic2Clipped = picked(a.selection.clipped.aic, 2);
  const bicRow = full.rows.find((r) => r.K === full.bestByBic);
  // the highest-mean component of BIC's choice: the one sitting on the ratings clipped to 10.0
  const pile = bicRow?.params
    ? {
        weight: bicRow.params.weights.at(-1)!,
        mean: bicRow.params.means.at(-1)!,
        sd: bicRow.params.sds.at(-1)!,
      }
    : null;
  const pileRow = full.rows.find((r) => r.pileRuns > 0);
  const pileStarts = pileRow?.pileRuns ?? 0;
  const ordinaryStarts = s.modelChoice.restarts;
  const onlyPilesFoundIt = full.rows.filter(
    (r) => r.pileRuns > 0 && r.reachedBest > 0 && r.reachedBest === r.reachedBestFromPiles,
  );
  const floors = [
    { floor: s.modelChoice.varianceFloor, choice: full },
    ...a.modelChoice.floorSensitivity.map((m) => ({ floor: m.options.varianceFloor, choice: m })),
  ].sort((x, y) => x.floor - y.floor);
  const floorsPicking = (K: number) =>
    floors.filter((f) => f.choice.bestByBic === K).map((f) => `${f.floor}`);
  const otherFloors = floors.filter((f) => f.choice.bestByBic !== full.bestByBic);
  const closeCall = (m: (typeof floors)[number]["choice"]) => {
    const spread = m.rows
      .map((r) => r.deltaBic)
      .filter((d) => d < 2)
      .sort((x, y) => x - y);
    return { within: spread.length, max: Math.max(...spread) };
  };
  const lrt = a.lrt;
  const naive = wilsonInterval(lrt.naiveRejections, lrt.options.B);
  const floorBound = wilsonInterval(lrt.floorBinding, lrt.options.B);
  const ic = a.initComparison;
  const faster = wilsonInterval(ic.iterations.difference.aHigher, ic.iterations.difference.n);
  const seeds = seedRows(a);

  return (
    <>
      <PageHeader eyebrow="Inference" title="How sure? How many? How stable?">
        <p>
          The notebook printed point estimates. This page asks the questions a statistician would
          ask next: how precise those estimates are, whether the intervals around them can be
          trusted, how many groups the data support, and whether EM&apos;s answer depends on where
          it starts. Every number is precomputed from a fixed seed, listed with its sizes under{" "}
          <a className="link" href="#seeds">
            seeds and sizes
          </a>{" "}
          at the end, and the fast ones can be re-run in your browser.
        </p>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-16 px-4 sm:px-6">
        <nav aria-label="Questions on this page">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECTIONS.map((sec, i) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  className="sheet block h-full p-4 transition-colors hover:border-foreground/30"
                >
                  <span className="num text-xs text-muted-foreground">0{i + 1}</span>
                  <span className="mt-1 block font-heading text-lg font-semibold">{sec.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{sec.blurb}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="uncertainty" index={1} title="How sure are the fitted parameters?">
          <div className="prose-notebook">
            <p>
              Standard errors only mean something at a maximum of the likelihood, and the
              notebook&apos;s 15 iterations had not reached one. So the run is finished first: same
              data, same random start, until the log-likelihood moves by less than 10⁻¹⁰ (
              {a.mle.iterations} iterations, <Ell /> = {fmt(a.mle.logLikelihood, 3)}). The
              notebook&apos;s own estimates stay in the first column, unchanged. Components are
              ordered by mean (<Link href="/methods#dr-002">DR-002</Link>): component 1 is the low
              group, the notebook&apos;s romance lovers.
            </p>
            <p>
              Two kinds of uncertainty sit beside each estimate. The <strong>Hessian</strong>{" "}
              standard error measures how sharply the log-likelihood falls away from its peak: the
              observed information (minus the matrix of second derivatives of <Ell /> at the
              maximum), inverted. It gives a Wald interval,{" "}
              <M>{String.raw`\hat\theta \pm 1.96\,\mathrm{SE}`}</M>. The{" "}
              <strong>parametric bootstrap</strong> simulates {count(a.bootstrap.B)} new data sets
              of 200 ratings from the fitted mixture (seed {a.bootstrap.seed}), refits EM to each
              and reads the 2.5% and 97.5% points of the {count(a.bootstrap.B)} estimates.
            </p>
          </div>

          <BootstrapSection
            mle={a.mle}
            notebook15={notebook15}
            truth={truth}
            published={a.bootstrap}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <Callout variant="correction" title="This sample's intervals miss the truth">
              {waldMisses} of 5 Wald intervals and {bootMisses} of 5 bootstrap intervals exclude the
              value used to generate the data. The converged fit gives the low group a share of{" "}
              {fmt(a.mle.theta[0], 2)} against a true 0.4. One data set cannot tell bad luck from
              bad intervals; the coverage study below can.
            </Callout>
            {other ? (
              <Callout title="A second, higher maximum">
                {other.startsReaching} of {other.starts} random starts (Wilson{" "}
                {pctInterval(wilsonInterval(other.startsReaching, other.starts), 1)}; seed{" "}
                {a.convergence.options.seed}, see{" "}
                <a className="link" href="#convergence">
                  convergence
                </a>
                ) reach a different maximum, <Ell /> = {fmt(other.logLikelihood, 2)}, higher by{" "}
                {fmt(other.logLikelihood - a.mle.logLikelihood, 2)}: a broad component (
                {fmt(100 * other.theta[0], 0)}% at {fmt(other.theta[1], 2)}, σ{" "}
                {fmt(other.theta[3], 2)}) plus a narrow one at {fmt(other.theta[2], 2)} (σ{" "}
                {fmt(other.theta[4], 2)}). The intervals above describe the notebook&apos;s maximum
                only. When two peaks are this close in height, intervals around one of them
                understate the uncertainty.
              </Callout>
            ) : null}
          </div>
        </Section>

        <Section id="coverage" index={2} title="Do the 95% intervals cover 95% of the time?">
          <div className="prose-notebook">
            <p>
              A 95% interval should contain the true value in 95% of repeated samples. That is
              checkable: simulate data sets from the notebook&apos;s true mixture (60% at 7.5 with σ
              1.2, 40% at 4.0 with σ 1.5, n = 200), fit each by EM from a k-means++ start, build the
              intervals and count. {count(a.coverage.model.S)} data sets per scenario for Wald
              intervals (seed {a.coverage.model.seed}), once with the model exactly and once clipped
              to 1 to 10 like the notebook; {count(a.bootstrapCoverage.S)} for the percentile
              bootstrap (B = {a.bootstrapCoverage.bootstrapB} each, seed {a.bootstrapCoverage.seed}
              ), paired with the Wald intervals on the same data sets.
            </p>
            <p>
              <strong>Neither reaches 95%.</strong> Wald intervals covered between{" "}
              {covRange(waldRates)} of the time; percentile-bootstrap intervals between{" "}
              {covRange(bootRates)}.
              {clearlyBetter.length ? (
                <>
                  {" "}
                  On the same data sets the bootstrap covered more often for{" "}
                  {listSymbols(clearlyBetter)} (paired 95% intervals exclude 0)
                  {withinNoise.length ? (
                    <>; for {listSymbols(withinNoise)} the difference is within simulation noise</>
                  ) : null}
                  .
                </>
              ) : (
                <> On the same data sets no difference is distinguishable from simulation noise.</>
              )}{" "}
              Part of the gain comes from width: the bootstrap intervals are wider for {wider} of
              the 5 parameters (median widths in the table). At n = 200 with groups this close, the
              log-likelihood is not yet the parabola the Wald interval assumes. Clipping, perhaps
              surprisingly, changes little.
            </p>
          </div>
          <CoverageSection published={a.coverage} bootstrapCoverage={a.bootstrapCoverage} />
        </Section>

        <Section id="choosing-k" index={3} title="How many groups do the data support?">
          <div className="prose-notebook">
            <p>
              The notebook assumed two groups. Fitting K = 1 to 4 components (variance floor σ ≥{" "}
              {s.modelChoice.varianceFloor}, <Link href="/methods#dr-003">DR-003</Link>) and scoring
              each with AIC and BIC gives an uncomfortable answer:{" "}
              <strong>
                BIC prefers {full.bestByBic} components and AIC {full.bestByAic}
              </strong>
              {full.bestByBic !== 2 && full.bestByAic !== 2 ? ", and neither picks two" : ""}.
              {pile && bicRow ? (
                <>
                  {" "}
                  BIC&apos;s extra component is small and narrow: {fmt(100 * pile.weight, 1)}% of
                  the ratings at μ = {fmt(pile.mean, 2)} with σ = {fmt(pile.sd, 2)}
                  {bicRow.floorBinding ? ", held at the floor" : ""}. That is the pile of{" "}
                  {a.modelChoice.dropped} ratings the notebook&apos;s clipping put at exactly 10.0,
                  not another kind of viewer.
                </>
              ) : null}
            </p>
            <p>
              Each K gets the best of {ordinaryStarts} ordinary starts (k-means++, Forgy and random;
              seed {full.options.seed}) and {pileStarts} <em>pile starts</em>, which put a narrow
              component on the {a.modelChoice.dropped} tied ratings at 10.0. The pile starts matter:
              ordinary starts spread their means over the bulk of the ratings with wide spreads, so
              none of them isolates seven identical values.
              {onlyPilesFoundIt.length ? (
                <>
                  {" "}
                  For K = {onlyPilesFoundIt.map((r) => r.K).join(" and ")} only pile starts reached
                  the best fit
                  {onlyPilesFoundIt.length === 1
                    ? ` (${onlyPilesFoundIt[0].reachedBestFromPiles} of ${onlyPilesFoundIt[0].pileRuns})`
                    : ""}
                  ; without them the table would report lower maxima for those K.
                </>
              ) : null}
            </p>
            {otherFloors.length ? (
              <p>
                The choice also depends on the floor. BIC picks K = {full.bestByBic} at σ ≥{" "}
                {listSymbols(floorsPicking(full.bestByBic))}
                {otherFloors.map((f) => {
                  const c = closeCall(f.choice);
                  return (
                    <span key={f.floor}>
                      , but K = {f.choice.bestByBic} at σ ≥ {f.floor}
                      {c.within > 1
                        ? `, where ${c.within} values of K are within ${fmt(c.max, 1)} BIC points of each other`
                        : ""}
                    </span>
                  );
                })}
                . A narrow component on tied values gains likelihood as its σ shrinks, so the floor
                sets how much the pile is worth (
                <Link className="link" href="/methods#dr-003">
                  DR-003
                </Link>
                ).
              </p>
            ) : null}
          </div>

          <ScrollX label="Model comparison for K = 1 to 4" className="sheet p-1">
            <table className="w-full min-w-[50rem] text-sm">
              <caption className="sr-only">
                Log-likelihood, AIC and BIC for one to four components, on all 200 ratings and
                without the clipped ones
              </caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    K
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-normal">
                    params
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-normal">
                    <Ell />
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-normal">
                    ΔAIC
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-normal">
                    ΔBIC
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-normal">
                    starts at best
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-normal">
                    σ at floor
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-normal">
                    components (weight at mean)
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    ΔBIC without the {a.modelChoice.dropped} at 10.0
                  </th>
                </tr>
              </thead>
              <tbody className="num">
                {full.rows.map((r, i) => (
                  <tr key={r.K} className="border-t align-top">
                    <th scope="row" className="px-3 py-2.5 text-left">
                      {r.K}
                    </th>
                    <td className="px-2 py-2.5">{r.p}</td>
                    <td className="px-2 py-2.5">{fmt(r.ll, 2)}</td>
                    <td
                      className={
                        r.K === full.bestByAic
                          ? "px-2 py-2.5 font-semibold text-comp-1-ink"
                          : "px-2 py-2.5"
                      }
                    >
                      {fmt(r.deltaAic, 1)}
                    </td>
                    <td
                      className={
                        r.K === full.bestByBic
                          ? "px-2 py-2.5 font-semibold text-comp-1-ink"
                          : "px-2 py-2.5"
                      }
                    >
                      {fmt(r.deltaBic, 1)}
                    </td>
                    <td className="px-2 py-2.5">
                      {r.reachedBest}/{r.restarts}
                      {r.pileRuns > 0 ? (
                        <span className="block text-[0.7rem] text-muted-foreground">
                          {r.reachedBestFromPiles} from pile starts
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 font-sans">{r.floorBinding ? "yes" : "no"}</td>
                    <td className="px-2 py-2.5 font-sans text-xs text-muted-foreground">
                      {gmmSummary(r)}
                    </td>
                    <td
                      className={
                        trimmed.rows[i].K === trimmed.bestByBic
                          ? "px-3 py-2.5 font-semibold text-comp-1-ink"
                          : "px-3 py-2.5"
                      }
                    >
                      {fmt(trimmed.rows[i].deltaBic, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
          <p className="text-xs text-muted-foreground">
            Δ is the criterion minus the smallest in its column (0 marks the choice). &ldquo;Starts
            at best&rdquo; counts the starts that ended within 0.01 of the best log-likelihood, out
            of {ordinaryStarts} ordinary starts plus {pileStarts} pile starts; that so few find it
            is itself a warning about multimodal likelihoods. &ldquo;σ at floor&rdquo; marks a best
            fit with a component held at σ = {s.modelChoice.varianceFloor}. Without the clipped
            ratings there is no pile, and BIC picks K = {trimmed.bestByBic} (AIC still picks{" "}
            {trimmed.bestByAic}).
          </p>

          <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
            <div className="prose-notebook">
              <h3 className="text-xl font-semibold">Is that unusual for the recipe?</h3>
              <p className="mt-3">
                The notebook&apos;s data are one draw. Drawing {a.selection.model.options.S} fresh
                samples of 200 from the same recipe (seed {a.selection.model.options.seed};{" "}
                {a.selection.model.options.restarts} starts per K, plus{" "}
                {a.selection.model.options.pileStarts} pile starts wherever clipping piled three or
                more ratings onto one value) shows how the criteria behave in general. BIC picks two
                components in {selBic2.successes} of {selBic2.n} samples (Wilson{" "}
                {pctInterval(selBic2, 0)}) and in {selBic2Clipped.successes} of {selBic2Clipped.n}{" "}
                when clipped; otherwise it picks one component ({selBic1.successes} and{" "}
                {selBic1Clipped.successes} times) or three ({selBic3.successes} and{" "}
                {selBic3Clipped.successes}). AIC overfits: it picks two in only {selAic2.successes}{" "}
                and {selAic2Clipped.successes} of {selAic2.n}, and clipping makes it worse. So
                BIC&apos;s K = {full.bestByBic} on the notebook&apos;s sample is a property of this
                particular draw, not of the recipe.
              </p>
            </div>
            <ScrollX label="How often each criterion picks each K" className="sheet p-1">
              <table className="w-full min-w-[30rem] text-sm">
                <caption className="sr-only">
                  Share of {a.selection.model.options.S} simulated data sets on which BIC and AIC
                  chose each number of components, with Wilson intervals
                </caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-3 py-2.5 font-normal">
                      picked K
                    </th>
                    <th scope="col" className="px-2 py-2.5 font-normal">
                      BIC, model
                    </th>
                    <th scope="col" className="px-2 py-2.5 font-normal">
                      BIC, clipped
                    </th>
                    <th scope="col" className="px-2 py-2.5 font-normal">
                      AIC, model
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-normal">
                      AIC, clipped
                    </th>
                  </tr>
                </thead>
                <tbody className="num">
                  {a.selection.model.bic.map((row, i) => (
                    <tr key={row.K} className="border-t align-top">
                      <th scope="row" className="px-3 py-2 text-left">
                        {row.K}
                      </th>
                      {[
                        a.selection.model.bic[i],
                        a.selection.clipped.bic[i],
                        a.selection.model.aic[i],
                        a.selection.clipped.aic[i],
                      ].map((c, j) => (
                        <td key={j} className="px-2 py-2">
                          {c.picked.successes}
                          <span className="block text-[0.7rem] text-muted-foreground">
                            {pctInterval(c.picked, 0)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-semibold">
              One group or two? A bootstrap likelihood-ratio test
            </h3>
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="prose-notebook">
                <p>
                  The textbook test compares twice the gain in log-likelihood with a χ² distribution
                  whose degrees of freedom are the extra parameters, here 5 − 2 = 3. That rests on
                  Wilks&apos; theorem, which needs the null hypothesis to sit inside the parameter
                  space with every parameter identified. A single normal is a two-component mixture
                  with
                </p>
                <MathBlock>{String.raw`\begin{aligned} &\pi_2 = 0 \\ &\qquad (\mu_2,\ \sigma_2 \text{ anything}) \\ \text{or}\quad &\mu_1 = \mu_2,\ \sigma_1 = \sigma_2 \\ &\qquad (\pi_1 \text{ anything}) \end{aligned}`}</MathBlock>
                <p>
                  so the null lies on the edge of the space (π₂ cannot go below 0) and some
                  parameters vanish from the model there. Wilks&apos; theorem does not apply. The
                  parametric bootstrap side-steps it: fit one normal, simulate{" "}
                  {count(lrt.options.B)} data sets from it (seed {lrt.options.seed}), run the same
                  two-component fit ({lrt.options.restarts} starts) on each, and use those
                  statistics as the null distribution.
                </p>
              </div>
              <div className="sheet space-y-3 p-4 sm:p-5 lg:self-start">
                <LrtPlot
                  histogram={lrt.nullHistogram}
                  total={lrt.nullStatistics.length}
                  df={lrt.df}
                  null95={lrt.null95}
                  chi95={lrt.chiSquare95}
                  observed={lrt.statistic}
                />
                <ul className="grid gap-x-5 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-4 rounded-sm bg-comp-1/35" aria-hidden />
                    bootstrap null ({count(lrt.options.B)} data sets, seed {lrt.options.seed})
                  </li>
                  <li className="flex items-center gap-1.5">
                    <svg viewBox="0 0 16 8" className="h-2 w-4" aria-hidden>
                      <path
                        d="M0,4H16"
                        stroke="var(--comp-2)"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                    </svg>
                    χ² density with {lrt.df} df
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-0.5 bg-comp-1-ink" aria-hidden />
                    bootstrap 95% point: <span className="num">{fmt(lrt.null95)}</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-0.5 bg-comp-2-ink" aria-hidden />
                    χ² 95% point: <span className="num">{fmt(lrt.chiSquare95)}</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-0.5 bg-foreground" aria-hidden />
                    observed: <span className="num">{fmt(lrt.statistic)}</span>
                  </li>
                </ul>
              </div>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sheet p-4">
                <dt className="text-sm text-muted-foreground">
                  observed 2(
                  <Ell />₂ − <Ell />
                  ₁)
                </dt>
                <dd className="num mt-1 text-2xl font-medium">{fmt(lrt.statistic, 2)}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  <Ell />₁ = {fmt(lrt.ll1, 2)}, <Ell />₂ = {fmt(lrt.ll2, 2)}
                </dd>
              </div>
              <div className="sheet p-4">
                <dt className="text-sm text-muted-foreground">bootstrap p-value</dt>
                <dd className="num mt-1 text-2xl font-medium">{fmt(lrt.pValue, 3)}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  (1 + {lrt.exceed}) / ({count(lrt.options.B)} + 1): no null statistic was as large,
                  and p cannot be smaller with B = {count(lrt.options.B)}
                </dd>
              </div>
              <div className="sheet p-4">
                <dt className="text-sm text-muted-foreground">χ²₃ p-value (not valid here)</dt>
                <dd className="num mt-1 text-2xl font-medium">{sci(lrt.chiSquarePValue, 1)}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  tiny here too, but only because the effect is large: the reference is wrong
                </dd>
              </div>
              <div className="sheet p-4">
                <dt className="text-sm text-muted-foreground">
                  χ²₃ test&apos;s real false-alarm rate
                </dt>
                <dd className="num mt-1 text-2xl font-medium">{pct(naive.estimate, 0)}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  {lrt.naiveRejections} of {count(lrt.options.B)} null data sets exceed{" "}
                  {fmt(lrt.chiSquare95)} (Wilson {pctInterval(naive, 1)}), not 5%
                </dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">
              The bootstrap&apos;s 95% point is {fmt(lrt.null95)} against χ²₃&apos;s{" "}
              {fmt(lrt.chiSquare95)}. The variance floor bound in {lrt.floorBinding} of the{" "}
              {count(lrt.options.B)} null fits (Wilson {pctInterval(floorBound, 1)}); leaving those
              out moves the 95% point to {fmt(lrt.null95Unfloored)}, so the gap is not an artefact
              of the floor (
              <Link className="link" href="/methods#dr-003">
                DR-003
              </Link>
              ).
              {other && other.logLikelihood > lrt.ll2 + 0.01 ? (
                <>
                  {" "}
                  The {lrt.options.restarts} starts on the observed data (plus{" "}
                  {lrt.options.pileStarts} pile starts) found <Ell />₂ = {fmt(lrt.ll2, 2)}, not the
                  higher maximum at {fmt(other.logLikelihood, 2)}, so the observed statistic, if
                  anything, understates the evidence.
                </>
              ) : null}
            </p>
          </div>
        </Section>

        <Section id="convergence" index={4} title="Does EM's answer depend on where it starts?">
          <div className="prose-notebook">
            <p>
              {count(a.convergence.runs.length)} notebook-style random starts (μ ~ U(3, 8), σ ~
              U(0.5, 2), π = 0.5; seed {a.convergence.options.seed}) on the notebook&apos;s 200
              ratings, each run until |Δ
              <Ell />| &lt; 10⁻¹² with its whole log-likelihood trace kept. The ascent property
              holds in every run. The answer does depend on the start: most runs reach the maximum
              the notebook was heading for, and a few find the narrow-component maximum with a
              higher likelihood. &ldquo;Keep the best of many starts&rdquo; maximises the
              likelihood; here that means more starts make the implausible answer more likely, not
              less.
            </p>
          </div>
          <ConvergenceSection published={a.convergence} notebookIterations={notebookTo} />

          <div className="sheet grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h3 className="text-xl font-semibold">
                Random start or k-means++? A paired comparison
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The same {count(ic.options.S)} simulated data sets (the notebook&apos;s recipe,
                clipped; seed {ic.options.seed}), each fitted once from the notebook&apos;s random
                start and once from k-means++ (tolerance{" "}
                {ic.options.tolerance.toExponential(0).replace("e-", "e−")}). Pairing by data set
                removes the variation between data sets from the comparison.
              </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <dt className="text-xs text-muted-foreground">
                  extra iterations for the random start
                </dt>
                <dd className="num mt-1 text-2xl font-medium">
                  {fmt(ic.iterations.difference.estimate, 1)}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  mean paired difference, 95% CI {fmt(ic.iterations.difference.interval.lower, 1)}{" "}
                  to {fmt(ic.iterations.difference.interval.upper, 1)} (bootstrap over data sets, B
                  = {count(ic.iterations.difference.B)}, seed {ic.iterations.difference.seed});
                  medians {ic.iterations.random.median} vs {ic.iterations.kmeans.median}
                </dd>
              </div>
              <div className="rounded-xl border p-3">
                <dt className="text-xs text-muted-foreground">k-means++ was faster</dt>
                <dd className="num mt-1 text-2xl font-medium">
                  {ic.iterations.difference.aHigher}/{ic.iterations.difference.n}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  data sets ({pctInterval(faster, 0)}); {ic.iterations.difference.ties} ties
                </dd>
              </div>
              <div className="rounded-xl border p-3 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">reached the best-known maximum</dt>
                <dd className="num mt-1 text-lg font-medium">
                  random {ic.reachedBest.random.successes}/{ic.reachedBest.random.n} · k-means++{" "}
                  {ic.reachedBest.kmeans.successes}/{ic.reachedBest.kmeans.n}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  Wilson 95% CI for each: {pctInterval(ic.reachedBest.random, 1)} and{" "}
                  {pctInterval(ic.reachedBest.kmeans, 1)}. On these data sets the starts differ in
                  speed, not in where they end up.
                </dd>
              </div>
            </dl>
          </div>
        </Section>

        <section id="seeds" aria-labelledby="seeds-h" className="scroll-mt-20 border-t pt-12">
          <p className="eyebrow">reproducibility</p>
          <h2 id="seeds-h" className="mt-2 text-3xl font-semibold sm:text-4xl">
            Seeds and sizes
          </h2>
          <div className="mt-6 space-y-4">
            <p className="prose-notebook">
              Every simulation on this page starts from a fixed seed, so the same code with the same
              seed and sizes gives the same numbers. The &ldquo;Run in your browser&rdquo; buttons
              check that for the bootstrap, the Wald coverage study and the random starts; any other
              seed shows how much a result moves from one simulation to the next.
            </p>
            <SeedsTable rows={seeds} />
          </div>
        </section>

        <Callout title="Where these numbers come from">
          Every number on this page is computed by{" "}
          <a className="link" href={repoFile("web/scripts/generate-inference.ts")}>
            generate-inference.ts
          </a>{" "}
          (<span className="num">pnpm inference</span>, about two minutes) with the seeds and sizes
          in{" "}
          <a className="link" href={repoFile("web/src/lib/inference/settings.ts")}>
            settings.ts
          </a>
          , and a test re-runs it on every push (
          <Link className="link" href="/methods#dr-004">
            DR-004
          </Link>
          ). The statistics helpers are checked against SciPy and R. Simulated data use this
          site&apos;s generator, not NumPy&apos;s (
          <Link className="link" href="/methods#dr-001">
            DR-001
          </Link>
          ). Methods, assumptions and limitations are on the{" "}
          <Link className="link" href="/methods">
            methods page
          </Link>
          .
        </Callout>
      </div>
    </>
  );
}
