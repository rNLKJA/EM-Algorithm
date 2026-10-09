import { ArrowRight, BookOpenText, FlaskConical, Footprints, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { StaticMixture } from "@/components/charts/static-mixture";
import { ComponentSwatch } from "@/components/common/legend";
import { ScrollX } from "@/components/common/scroll-x";
import { GithubMark } from "@/components/layout/github-mark";
import { M, MathBlock } from "@/components/maths/tex";
import { Button } from "@/components/ui/button";
import { alignParams, matchByMean } from "@/lib/em/labels";
import { NOTEBOOK_GROUP_NAMES, notebookFinal, notebookRun } from "@/lib/em/notebook-run";
import { minus, pyPercent, signed } from "@/lib/format";
import { repoFile, site } from "@/lib/site";

const ENTRY_POINTS = [
  {
    href: "/stepper",
    icon: Footprints,
    title: "Stepper",
    text: "The explainer's four ratings, [2, 3, 7, 8], one E-step and M-step at a time, with the hand-worked numbers beside the exact ones.",
  },
  {
    href: "/playground",
    icon: FlaskConical,
    title: "Playground",
    text: "The notebook's 200 ratings, or data you make. Pick a starting guess, press play and watch the curves and the log-likelihood move.",
  },
  {
    href: "/pitfalls",
    icon: TriangleAlert,
    title: "Pitfalls",
    text: "Label switching, stopping too early, local maxima and variance collapse: four ways a run can look fine and still be wrong.",
  },
  {
    href: "/maths",
    icon: BookOpenText,
    title: "Maths",
    text: "Bayes' theorem for the E-step, calculus for the M-step, a Normal + Beta mixture and why the likelihood never goes down.",
  },
];

export default function Home() {
  const run = notebookRun;
  const s = run.summary;
  const matching = matchByMean(notebookFinal, run.trueParams);
  const aligned = alignParams(notebookFinal, matching);

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-[max(1rem,calc(50%-36rem))] hidden w-px bg-rule sm:block"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="sm:pl-6">
            <p className="eyebrow">Expectation–Maximisation, by doing</p>
            <h1 className="mt-4 text-5xl leading-[0.98] font-semibold sm:text-6xl lg:text-7xl">
              EM, <span className="font-normal italic">one step</span>
              <br />
              at a time
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Imagine knowing only how people rate films, not what kind of viewer they are, and
              still recovering the groups behind the ratings. That is what the EM algorithm does.
              This site turns a long, maths-complete explainer and its Python notebook into
              something you can step through, poke and break.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 rounded-full px-5 text-[0.95rem]">
                <Link href="/stepper">
                  Step through four ratings
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 rounded-full px-5 text-[0.95rem]"
              >
                <Link href="/playground">Open the playground</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              A personal project by {site.author} · written 2025, revived 2026
            </p>
          </div>

          <figure className="sheet relative p-4 sm:p-6">
            <span className="hand absolute -top-4 right-6 rotate-[-4deg] rounded-md bg-correction-bg px-2 py-1 text-xl text-correction shadow-sm">
              the notebook&apos;s fit
            </span>
            <StaticMixture
              data={run.ratings}
              params={notebookFinal}
              truth={run.trueParams}
              rug
              annotate
              width={640}
              height={330}
              className="h-auto w-full text-foreground"
              ariaLabel={`Histogram of the notebook's 200 ratings with the fitted two-component mixture: means ${notebookFinal.mu1.toFixed(2)} and ${notebookFinal.mu2.toFixed(2)}, and the true mixture dotted.`}
            />
            <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ComponentSwatch k={1} /> component 1
              </span>
              <span className="flex items-center gap-1.5">
                <ComponentSwatch k={2} /> component 2
              </span>
              <span>dotted: the true mixture · 200 ratings, iteration 15</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* two steps */}
      <section aria-labelledby="two-steps" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-2xl">
          <p className="eyebrow">The idea</p>
          <h2 id="two-steps" className="mt-3 text-3xl font-semibold sm:text-4xl">
            Guess, then improve the guess. Repeat.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            The explainer calls EM a smart detective. It cannot see who belongs to which group, so
            it alternates between two easier questions until the answers stop changing.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="sheet p-6">
            <p className="num text-sm text-comp-1-ink">E-step · expectation</p>
            <h3 className="mt-2 text-xl font-semibold">
              Which group does each rating probably belong to?
            </h3>
            <p className="mt-2 text-muted-foreground">
              Using the current guess of each group, Bayes&apos; theorem gives every rating a
              probability of coming from each group: its responsibility.
            </p>
            <MathBlock>{String.raw`\gamma_{ik} = \frac{\pi_k\, f(x_i \mid \mu_k, \sigma_k)}{\sum_j \pi_j\, f(x_i \mid \mu_j, \sigma_j)}`}</MathBlock>
          </article>
          <article className="sheet p-6">
            <p className="num text-sm text-comp-2-ink">M-step · maximisation</p>
            <h3 className="mt-2 text-xl font-semibold">
              Given those probabilities, what does each group look like?
            </h3>
            <p className="mt-2 text-muted-foreground">
              Each group&apos;s share, average and spread become weighted averages, with ratings
              counting in proportion to how much they belong.
            </p>
            <MathBlock>{String.raw`\mu_k = \frac{\sum_i \gamma_{ik}\, x_i}{\sum_i \gamma_{ik}}, \quad \pi_k = \frac{1}{n}\sum_i \gamma_{ik}`}</MathBlock>
          </article>
        </div>
      </section>

      {/* results */}
      <section aria-labelledby="results" className="border-y bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="eyebrow">What the original notebook found</p>
              <h2 id="results" className="mt-3 text-3xl font-semibold sm:text-4xl">
                200 ratings, two hidden groups, 15 iterations
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                The notebook draws 200 &ldquo;movie ratings&rdquo;: 60% from sci-fi lovers around
                7.5 and 40% from romance lovers around 4.0, clipped to 1 to 10. It then hides the
                labels and lets EM, written from scratch, find the groups from a random start. These
                are its printed results, reproduced by this site&apos;s TypeScript port to within
                10⁻⁶.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="sheet p-4">
                <dt className="text-sm text-muted-foreground">average rating</dt>
                <dd className="num mt-1 text-3xl font-medium">{s.ratingMean.toFixed(2)}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  range {s.ratingMin.toFixed(1)} to {s.ratingMax.toFixed(1)}
                </dd>
              </div>
              <div className="sheet p-4">
                <dt className="text-sm text-muted-foreground">log-likelihood</dt>
                <dd className="num mt-1 text-3xl font-medium">
                  {minus(s.finalLogLikelihood.toFixed(2))}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  from {minus(s.firstLogLikelihood.toFixed(2))} after iteration 1 (
                  {signed(s.totalImprovement)})
                </dd>
              </div>
              <div className="sheet p-4">
                <dt className="text-sm text-muted-foreground">classified correctly</dt>
                <dd className="num mt-1 text-3xl font-medium">{pyPercent(s.accuracyAsWritten)}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  of the 200 users, using γ &gt; 0.5
                </dd>
              </div>
              <div className="sheet p-4">
                <dt className="text-sm text-muted-foreground">iterations</dt>
                <dd className="num mt-1 text-3xl font-medium">{s.iterationsRun}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">
                  the cap it was given; not yet converged
                </dd>
              </div>
            </dl>
          </div>

          <ScrollX label="Estimated and true parameters" className="sheet mt-8 p-1">
            <table className="w-full text-sm sm:min-w-[34rem]">
              <caption className="sr-only">
                Estimated parameters (true value underneath), matched to the true groups by mean
              </caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-3 font-normal sm:px-4">
                    group
                  </th>
                  <th scope="col" className="px-2 py-3 font-normal sm:px-3">
                    share π
                  </th>
                  <th scope="col" className="px-2 py-3 font-normal sm:px-3">
                    mean μ
                  </th>
                  <th scope="col" className="px-2 py-3 font-normal sm:px-3">
                    spread σ
                  </th>
                  <th scope="col" className="hidden px-4 py-3 font-normal sm:table-cell">
                    fitted as
                  </th>
                </tr>
              </thead>
              <tbody className="num">
                {([1, 2] as const).map((k) => {
                  const est =
                    k === 1
                      ? [aligned.pi1, aligned.mu1, aligned.sigma1]
                      : [aligned.pi2, aligned.mu2, aligned.sigma2];
                  const tru =
                    k === 1
                      ? [run.trueParams.pi1, run.trueParams.mu1, run.trueParams.sigma1]
                      : [run.trueParams.pi2, run.trueParams.mu2, run.trueParams.sigma2];
                  const fittedAs = (matching.swapped ? 3 - k : k) as 1 | 2;
                  return (
                    <tr key={k} className="border-t align-top">
                      <th scope="row" className="px-3 py-3 text-left font-sans font-medium sm:px-4">
                        {NOTEBOOK_GROUP_NAMES[k - 1]}
                        {/* on phones the "fitted as" column folds in under the group name */}
                        <span className="mt-1 flex items-center gap-1.5 text-xs font-normal text-muted-foreground sm:hidden">
                          <ComponentSwatch k={fittedAs} /> fitted as component {fittedAs}
                        </span>
                      </th>
                      {est.map((v, i) => (
                        <td key={i} className="px-2 py-3 sm:px-3">
                          {v.toFixed(3)}
                          <span className="block text-[0.72rem] text-muted-foreground">
                            true {tru[i].toFixed(1)}
                          </span>
                        </td>
                      ))}
                      <td className="hidden px-4 py-3 font-sans sm:table-cell">
                        <span className="flex items-center gap-1.5">
                          <ComponentSwatch k={fittedAs} /> component {fittedAs}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollX>
          <p className="mt-3 text-sm text-muted-foreground">
            Note which component each group was fitted as: EM put the sci-fi lovers in component 2.
            That small detail is the first of the{" "}
            <Link className="link" href="/pitfalls#label-switching">
              pitfalls
            </Link>
            .
          </p>
        </div>
      </section>

      {/* entry points */}
      <section aria-labelledby="explore" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="eyebrow">Four ways in</p>
        <h2 id="explore" className="mt-3 text-3xl font-semibold sm:text-4xl">
          Read it, run it, break it
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {ENTRY_POINTS.map((e, i) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="sheet group flex h-full flex-col p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-foreground/30"
              >
                <span className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                    <e.icon className="size-5" aria-hidden />
                  </span>
                  <span className="num text-xs text-muted-foreground">0{i + 1}</span>
                </span>
                <span className="mt-5 font-heading text-2xl font-semibold">{e.title}</span>
                <span className="mt-2 flex-1 text-muted-foreground">{e.text}</span>
                <span className="mt-5 flex items-center gap-1.5 text-sm font-medium">
                  Open {e.title.toLowerCase()}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* honest notes */}
      <section aria-labelledby="notes" className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <div className="sheet grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.5fr]">
          <div>
            <p className="eyebrow">Honest notes</p>
            <h2 id="notes" className="mt-3 text-2xl font-semibold sm:text-3xl">
              Kept visible, not quietly fixed
            </h2>
            <p className="mt-3 text-muted-foreground">
              Rebuilding the notebook number for number turned up three things worth knowing. The
              originals stay as they were; the site shows what happened and why.
            </p>
          </div>
          <ul className="grid gap-4">
            <li className="rounded-xl border p-4">
              <p className="font-medium">Some hand-worked densities are off</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The explainer uses <M>{String.raw`f(2 \mid 2.5, 0.5) = 0.8`}</M> and{" "}
                <M>{String.raw`f(3 \mid 2.5, 0.5) = 0.6`}</M>; both are 0.4839. The conclusions
                hold.{" "}
                <Link className="link" href="/stepper">
                  See both side by side
                </Link>
                .
              </p>
            </li>
            <li className="rounded-xl border p-4">
              <p className="font-medium">The labels switched</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Component 1 ended up as the low-mean group, so the notebook&apos;s final cell calls
                an 8.5 rater a romance lover (P = {run.newUser.probGroup1.toFixed(3)} for sci-fi).{" "}
                <Link className="link" href="/pitfalls#label-switching">
                  Why it happens
                </Link>
                .
              </p>
            </li>
            <li className="rounded-xl border p-4">
              <p className="font-medium">Fifteen iterations was not convergence</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The run stopped at its cap while still improving; finishing it changes the answer.{" "}
                <Link className="link" href="/pitfalls#stopping-early">
                  Watch it finish
                </Link>
                .
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* about */}
      <section
        id="about"
        aria-labelledby="about-h"
        className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6"
      >
        <p className="eyebrow">About this project</p>
        <h2 id="about-h" className="mt-3 text-3xl font-semibold sm:text-4xl">
          A personal explainer, rebuilt as a lab
        </h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <div className="sheet p-6 lg:col-span-1">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">What</dt>
                <dd className="mt-0.5 font-medium">Personal project, not coursework</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Author</dt>
                <dd className="mt-0.5 font-medium">{site.author}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">When</dt>
                <dd className="mt-0.5 font-medium">
                  September 2025 (explainer and notebook), October 2026 (this site)
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Data</dt>
                <dd className="mt-0.5 font-medium">Synthetic ratings only; no real users</dd>
              </div>
            </dl>
            <Button asChild variant="outline" className="mt-6 rounded-full">
              <a href={site.repo}>
                <GithubMark className="size-4" />
                rNLKJA/EM-Algorithm
              </a>
            </Button>
          </div>
          <div className="sheet p-6">
            <h3 className="text-lg font-semibold">Original stack</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>Markdown explainer with LaTeX maths</li>
              <li>Python 3 in a Jupyter notebook</li>
              <li>NumPy for the EM loop, SciPy for densities in plots</li>
              <li>pandas, Matplotlib for figures</li>
            </ul>
            <h3 className="mt-6 text-lg font-semibold">Revived stack</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>Next.js 16 (App Router), React 19, TypeScript</li>
              <li>Tailwind CSS v4, shadcn/ui, KaTeX rendered at build time</li>
              <li>Hand-drawn SVG charts; EM loops in a Web Worker</li>
              <li>Vitest parity tests against the notebook&apos;s own trace</li>
            </ul>
          </div>
          <div className="sheet p-6">
            <h3 className="text-lg font-semibold">Provenance</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The explainer and notebook are kept unchanged in{" "}
              <a className="link" href={`${site.repo}/tree/main/original`}>
                original/
              </a>
              . A script,{" "}
              <a className="link" href={repoFile("scripts/export_parity.py")}>
                export_parity.py
              </a>
              , re-executes the notebook&apos;s cells with seed 42, checks every printed line
              against the saved output, and exports the ratings, the random start and the
              per-iteration trace. The TypeScript port of <span className="num">EMAnalyzer</span> is
              tested against that trace to 10⁻⁶, and regenerates the notebook&apos;s console output
              character for character. Nothing here needs a server, an account or a key.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
