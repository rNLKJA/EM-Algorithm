import type { Metadata } from "next";
import Link from "next/link";
import { LineChart } from "@/components/charts/line-chart";
import { StaticMixture } from "@/components/charts/static-mixture";
import { Callout } from "@/components/common/callout";
import { ConsoleBlock } from "@/components/common/console";
import { Ell } from "@/components/common/ell";
import { ComponentSwatch, Legend } from "@/components/common/legend";
import { PageHeader } from "@/components/common/page-header";
import { ScrollX } from "@/components/common/scroll-x";
import { M, MathBlock } from "@/components/maths/tex";
import { CollapseDemo } from "@/components/pitfalls/collapse-demo";
import { RestartGallery } from "@/components/pitfalls/restart-gallery";
import { SwitchCensus } from "@/components/pitfalls/switch-census";
import { fit } from "@/lib/em/em";
import { accuracyMatched, correctMatched, matchByMean } from "@/lib/em/labels";
import { NOTEBOOK_GROUP_NAMES, notebookFinal, notebookRun } from "@/lib/em/notebook-run";
import type { MixtureParams } from "@/lib/em/types";
import { minus, pyPercent, signed } from "@/lib/format";
import { pageMetadata } from "@/lib/site";
import { wilsonInterval } from "@/lib/stats/intervals";
import { pairedMeanDifference } from "@/lib/stats/paired";

export const metadata: Metadata = pageMetadata({
  title: "Pitfalls: where EM quietly goes wrong",
  description:
    "Label switching in the original notebook, stopping before convergence, local maxima across random restarts, and variance collapse when a component sits on a single point.",
  path: "/pitfalls",
});

const SECTIONS = [
  { id: "label-switching", title: "Label switching", blurb: "Component 1 is not “sci-fi lovers”." },
  { id: "stopping-early", title: "Stopping early", blurb: "15 iterations was not convergence." },
  { id: "local-maxima", title: "Local maxima", blurb: "Different starts, different answers." },
  {
    id: "variance-collapse",
    title: "Variance collapse",
    blurb: "A spike on one point wins forever.",
  },
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
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t pt-12">
      <p className="eyebrow">pitfall {index}</p>
      <h2 id={`${id}-h`} className="mt-2 text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

export default function PitfallsPage() {
  const run = notebookRun;
  const final = notebookFinal;
  const swapped = matchByMean(final, run.trueParams).swapped;

  // Same start as the notebook, run until its own tolerance is met (TS port, parity-tested).
  const long = fit(run.ratings, run.init, { maxIterations: 1000, tolerance: run.fit.tolerance });
  const longFinal = long.iterations.at(-1)!.params;
  const longMatching = matchByMean(longFinal, run.trueParams);
  const longAcc = accuracyMatched(long.finalGamma1, run.trueGroups, longMatching);
  const lls = long.iterations.map((it) => it.logLikelihood);
  // the same 200 users classified by both fits: a paired comparison
  const accLong = wilsonInterval(Math.round(longAcc * run.n), run.n);
  const acc15 = wilsonInterval(Math.round(run.summary.accuracyMatched * run.n), run.n);
  const drop = pairedMeanDifference(
    correctMatched(long.finalGamma1, run.trueGroups, longMatching),
    correctMatched(run.finalGamma1, run.trueGroups, matchByMean(final, run.trueParams)),
    { seed: 15, B: 4000 },
  );
  const seed0 = run.otherSeeds.find((s) => s.seed === 0);

  const stopRows = [
    { label: "notebook, t = 15", p: final, ll: lls[14] },
    { label: `converged, t = ${long.iterations.length}`, p: longFinal, ll: lls.at(-1)! },
    { label: "true", p: run.trueParams, ll: null },
  ];

  const sortedRow = (p: MixtureParams) =>
    p.mu1 <= p.mu2
      ? [p.pi1, p.mu1, p.sigma1, p.pi2, p.mu2, p.sigma2]
      : [p.pi2, p.mu2, p.sigma2, p.pi1, p.mu1, p.sigma1];

  return (
    <>
      <PageHeader eyebrow="Pitfalls" title="Where EM quietly goes wrong">
        <p>
          EM always makes progress, which is exactly why its failures are easy to miss: nothing
          crashes, the log-likelihood goes up, and the answer can still be mislabelled, unfinished,
          stuck or degenerate. Each one below shows up in, or right next to, the original notebook.
        </p>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-16 px-4 sm:px-6">
        <nav aria-label="Pitfalls on this page">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="sheet block h-full p-4 transition-colors hover:border-foreground/30"
                >
                  <span className="num text-xs text-muted-foreground">0{i + 1}</span>
                  <span className="mt-1 block font-heading text-lg font-semibold">{s.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{s.blurb}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="label-switching" index={1} title="Label switching">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="prose-notebook">
              <p>
                EM has no idea what its components mean. &ldquo;Component 1&rdquo; is just whichever
                bump the first random guess happened to steer towards. The notebook generated its
                data with group 1 as <strong>sci-fi lovers</strong> (mean 7.5), but after fitting,
                its component 1 sat on the <strong>low</strong> ratings: μ₁ = {final.mu1.toFixed(2)}
                .
              </p>
              <p>
                Its last cell then asked about a new user who rated a film 8.5, and read component 1
                as &ldquo;sci-fi lover&rdquo;. The answer it printed, kept here exactly as it ran,
                is the wrong way round: 8.5 sits squarely in the high-mean component.
              </p>
            </div>
            <ConsoleBlock label="as-run output · original notebook, final cell">
              {run.printed.newUserCell.trimEnd()}
            </ConsoleBlock>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="sheet p-4 sm:p-5">
              <h3 className="text-base font-semibold">
                What each fitted component actually captured
              </h3>
              <ScrollX label="Fitted components" className="mt-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-1.5 pr-3 font-normal">
                        component
                      </th>
                      <th scope="col" className="py-1.5 pr-3 font-normal">
                        fitted μ
                      </th>
                      <th scope="col" className="py-1.5 pr-3 font-normal">
                        notebook calls it
                      </th>
                      <th scope="col" className="py-1.5 font-normal">
                        matched by mean
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {([1, 2] as const).map((k) => (
                      <tr key={k} className="border-t">
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          <span className="flex items-center gap-1.5">
                            <ComponentSwatch k={k} /> {k}
                          </span>
                        </th>
                        <td className="num py-2 pr-3">
                          {(k === 1 ? final.mu1 : final.mu2).toFixed(3)}
                        </td>
                        <td className="py-2 pr-3 text-correction">{NOTEBOOK_GROUP_NAMES[k - 1]}</td>
                        <td className="py-2">{NOTEBOOK_GROUP_NAMES[(swapped ? 3 - k : k) - 1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The fix is bookkeeping, not maths: after fitting, match each component to the group
                whose mean it is closest to (or simply sort components by mean). Every comparison
                with the true groups on this site does that first.
              </p>
            </div>
            <Callout variant="correction" title="The 90.5% accuracy is right, for a lucky reason">
              <p>
                The notebook scores <span className="num">(em.gamma1 &gt; 0.5).astype(int)</span>{" "}
                against labels where <span className="num">1</span> means romance lover. So it
                silently assumes component 1 is the romance group, which only holds because the
                labels switched. Matched by mean, the fit is still{" "}
                {pyPercent(run.summary.accuracyMatched)} right.
              </p>
              {seed0 && (
                <p className="mt-2">
                  Run the same notebook with seed 0 and the labels do not switch: the same line then
                  reports <strong>{pyPercent(seed0.accuracyAsWritten)}</strong> for a fit that is{" "}
                  {pyPercent(seed0.accuracyMatched)} right.
                </p>
              )}
            </Callout>
          </div>
          <SwitchCensus />
        </Section>

        <Section id="stopping-early" index={2} title="Stopping early">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div className="prose-notebook">
              <p>
                The notebook calls{" "}
                <span className="num">fit(max_iterations=15, tolerance=1e-4)</span>. Its tolerance
                was never reached: at iteration 15 the log-likelihood was still rising by{" "}
                <span className="num">0.029</span> per step, nearly 300 times the tolerance. The
                printed &ldquo;final&rdquo; parameters are a snapshot of a run in progress.
              </p>
              <p>
                Continue from the same start and EM needs {long.iterations.length} iterations to
                meet its own stopping rule. It ends somewhere noticeably different, with a higher
                likelihood ({minus(lls.at(-1)!.toFixed(2))}) but a <em>lower</em> classification
                accuracy: {pyPercent(longAcc)} (Wilson 95% CI {pyPercent(accLong.lower)} to{" "}
                {pyPercent(accLong.upper)}) against {pyPercent(run.summary.accuracyMatched)} (
                {pyPercent(acc15.lower)} to {pyPercent(acc15.upper)}).
              </p>
              <p>
                Both fits classify the same 200 users, so the fair comparison is paired: a change of{" "}
                {signed(100 * drop.estimate, 1)} percentage points (paired bootstrap 95% CI{" "}
                {signed(100 * drop.interval.lower, 1)} to {signed(100 * drop.interval.upper, 1)}).{" "}
                {drop.aLower} users went from right to wrong and {drop.aHigher} from wrong to right;
                the other {drop.ties} were classified the same way by both.
              </p>
              <p>
                That is not a bug. EM maximises the likelihood of the data it is given, and these
                ratings were clipped at 10, piling seven of them onto one value and skewing the high
                group. The best-fitting pair of normal curves for <em>that</em> shape is not the
                pair that generated it.
              </p>
            </div>
            <div className="space-y-4">
              <div className="sheet p-4 sm:p-5">
                <h3 className="text-sm font-semibold">
                  Log-likelihood, same start, run to the notebook&apos;s tolerance
                </h3>
                <LineChart
                  height={210}
                  xStart={1}
                  yLabel="ℓ(θ)"
                  markers={[{ x: 15, label: "notebook stops" }]}
                  series={[
                    {
                      id: "ll",
                      label: "log-likelihood",
                      values: lls,
                      colour: "var(--foreground)",
                      dots: false,
                    },
                  ]}
                  ariaLabel={`Log-likelihood over ${lls.length} iterations, rising from ${lls[0].toFixed(2)} to ${lls.at(-1)!.toFixed(2)}; the notebook stopped at iteration 15 with ${lls[14].toFixed(2)}.`}
                />
              </div>
              {/* phones: one card per run; sm and up: the full table */}
              <ul className="grid gap-2 sm:hidden" aria-label="Parameters sorted by mean">
                {stopRows.map((row) => (
                  <li key={row.label} className="sheet px-3 py-2.5">
                    <p className="flex items-baseline justify-between gap-2 text-sm font-medium">
                      {row.label}
                      {row.ll !== null && (
                        <span className="num text-xs font-normal text-muted-foreground">
                          <Ell /> = {row.ll.toFixed(2)}
                        </span>
                      )}
                    </p>
                    <dl className="num mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                      {(["low", "high"] as const).map((group, g) => {
                        const v = sortedRow(row.p).slice(g * 3, g * 3 + 3);
                        return (
                          <div key={group} className="contents">
                            <dt className="font-sans text-muted-foreground">{group} group</dt>
                            <dd>
                              π {v[0].toFixed(2)} · μ {v[1].toFixed(2)} · σ {v[2].toFixed(2)}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </li>
                ))}
              </ul>
              <div className="sheet hidden p-1 sm:block">
                <table className="num w-full text-xs sm:text-sm">
                  <caption className="sr-only">
                    Parameters sorted by mean: low group then high group
                  </caption>
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th scope="col" className="px-3 py-2 font-sans font-normal">
                        <span className="sr-only">run</span>
                      </th>
                      <th scope="col" className="px-2 py-2 font-normal" colSpan={3}>
                        low group: π μ σ
                      </th>
                      <th scope="col" className="px-2 py-2 font-normal" colSpan={3}>
                        high group: π μ σ
                      </th>
                      <th scope="col" className="px-2 py-2 font-normal">
                        <Ell />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stopRows.map((row) => (
                      <tr key={row.label} className="border-t">
                        <th
                          scope="row"
                          className="px-3 py-2 text-left font-sans font-normal whitespace-nowrap"
                        >
                          {row.label}
                        </th>
                        {sortedRow(row.p).map((v, i) => (
                          <td key={i} className="px-2 py-2">
                            {v.toFixed(2)}
                          </td>
                        ))}
                        <td className="px-2 py-2">{row.ll === null ? "" : row.ll.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <figure className="sheet p-2.5">
                  <StaticMixture
                    data={run.ratings}
                    params={final}
                    width={300}
                    height={130}
                    yMax={0.3}
                    className="h-auto w-full"
                    ariaLabel="Fit after 15 iterations"
                  />
                  <figcaption className="mt-1 text-center text-xs text-muted-foreground">
                    after 15 (notebook)
                  </figcaption>
                </figure>
                <figure className="sheet p-2.5">
                  <StaticMixture
                    data={run.ratings}
                    params={longFinal}
                    width={300}
                    height={130}
                    yMax={0.3}
                    className="h-auto w-full"
                    ariaLabel={`Fit after ${long.iterations.length} iterations`}
                  />
                  <figcaption className="mt-1 text-center text-xs text-muted-foreground">
                    after {long.iterations.length} (converged)
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Try it in the{" "}
            <Link className="link" href="/playground">
              playground
            </Link>
            : keep the notebook&apos;s data and start, and raise the iteration cap.
          </p>
        </Section>

        <Section id="local-maxima" index={3} title="Local maxima">
          <div className="prose-notebook">
            <p>
              EM climbs uphill from wherever it starts, so it finds <em>a</em> peak of the
              likelihood, not necessarily <em>the</em> peak. The standard remedy is cheap: start
              from several guesses and keep the run with the highest log-likelihood. Below, each
              card is a complete EM run (up to 1,000 iterations, tolerance 10⁻⁶) from its own random
              start, best first. The fits run in a Web Worker so the page stays responsive.
            </p>
            <p>
              Give EM three bumps but only two components and it has to choose which two bumps to
              merge; where it starts decides which it picks, and the two answers differ by about 14
              in log-likelihood. A k-means++ start finds the better merge every time here.
            </p>
            <p>
              On the notebook&apos;s own data nearly every random start reaches the answer the
              notebook&apos;s run was heading for (<Ell /> = −415.37). Now and then one finds a
              different peak with an even higher likelihood (<Ell /> ≈ −413.99): a narrow component
              sitting on a cluster of high ratings. Switch the data and draw new starts a few times
              to catch one, or see on the{" "}
              <Link className="link" href="/inference#convergence">
                inference page
              </Link>{" "}
              how often it happens and what it means for &ldquo;keep the best of many starts&rdquo;.
            </p>
          </div>
          <RestartGallery />
          <Legend className="justify-end" />
        </Section>

        <Section id="variance-collapse" index={4} title="Variance collapse">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="prose-notebook">
              <p>
                The mixture likelihood has no ceiling. Put one component&apos;s mean exactly on a
                data point and shrink its spread: that point&apos;s density grows without limit
                while every other point is still covered by the other component, so the
                log-likelihood heads to +∞. EM, doing its job, follows it there.
              </p>
              <p>
                The notebook&apos;s data has a ready-made trap: clipping at 10 turned seven ratings
                into the identical value 10.0. A component that starts on them with a small spread
                shrinks every iteration until σ is zero (the next step divides zero by zero) or
                floating-point residue that no longer moves, which a naive loop would happily call
                &ldquo;converged&rdquo;. The notebook&apos;s random start (σ ≥ 0.5) never got close,
                so its run was safe.
              </p>
            </div>
            <div className="sheet p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">
                With component 2 sitting on one point <M>{String.raw`x_j`}</M>, the log-likelihood
                is at least
              </p>
              <MathBlock
                narrow={String.raw`\begin{aligned} \ell(\theta) \;\ge\;& \log\frac{\pi_2}{\sigma_2\sqrt{2\pi}} \\ &+ \sum_{i \ne j} \log\big(\pi_1 f(x_i \mid \mu_1, \sigma_1)\big) \end{aligned}`}
              >{String.raw`\ell(\theta) \;\ge\; \log\frac{\pi_2}{\sigma_2\sqrt{2\pi}} \;+\; \sum_{i \ne j} \log\big(\pi_1 f(x_i \mid \mu_1, \sigma_1)\big)`}</MathBlock>
              <p className="text-sm text-muted-foreground">
                and the first term goes to <M>{String.raw`+\infty`}</M> as{" "}
                <M>{String.raw`\sigma_2 \to 0`}</M> while the rest stays put.
              </p>
              <p className="text-sm text-muted-foreground">
                The usual guards are a floor on σ (or a prior on it), dropping components whose
                weight collapses, and restarting.
              </p>
            </div>
          </div>
          <CollapseDemo />
        </Section>
      </div>
    </>
  );
}
