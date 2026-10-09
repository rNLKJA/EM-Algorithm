import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Callout } from "@/components/common/callout";
import { PageHeader } from "@/components/common/page-header";
import { ScrollX } from "@/components/common/scroll-x";
import { Markdown } from "@/components/methods/markdown";
import { GROUNDING_SCOPE, SNAPSHOT_FIELDS } from "@/lib/ai/explain-iteration";
import { ANTHROPIC_MODELS, OPENAI_DEFAULT_MODEL } from "@/lib/ai/models";
import { loadDecisionRecords, loadModelCard } from "@/lib/content";
import { notebookRun } from "@/lib/em/notebook-run";
import { inference } from "@/lib/inference/results";
import { INFERENCE_SETTINGS } from "@/lib/inference/settings";
import { pageMetadata, repoFile, repoTree, site } from "@/lib/site";
import { wilsonInterval } from "@/lib/stats/intervals";

export const metadata: Metadata = pageMetadata({
  title: "Methods: data, decisions and the model card",
  description:
    "How the numbers on this site were made: data provenance, the EM method and the inference added in 2026, the evaluation design, assumptions and limitations, decision records, the model card and the AI use statement.",
  path: "/methods",
});

const TOC = [
  { id: "data", label: "Data provenance" },
  { id: "method", label: "Method" },
  { id: "evaluation", label: "Evaluation design" },
  { id: "assumptions", label: "Assumptions" },
  { id: "limitations", label: "Limitations" },
  { id: "change", label: "What I'd change" },
  { id: "decisions", label: "Decision records" },
  { id: "model-card", label: "Model card" },
  { id: "ai-use", label: "AI use statement" },
];

const pct = (x: number, d = 1) => `${(100 * x).toFixed(d)}%`;

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t pt-10">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-h`} className="mt-2 text-2xl font-semibold sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export default function MethodsPage() {
  const decisions = loadDecisionRecords();
  const card = loadModelCard();
  const prov = notebookRun.provenance;
  const acc = wilsonInterval(Math.round(notebookRun.summary.accuracyAsWritten * 200), 200);
  const s = INFERENCE_SETTINGS;
  // Wald coverage across both scenarios (model exactly, clipped like the notebook)
  const waldCoverage = [inference.coverage.model, inference.coverage.clipped].flatMap((sc) =>
    sc.params.map((p) => p.wald.coverage.estimate),
  );

  const evaluation: [string, string, ReactNode][] = [
    [
      "The TypeScript port is the notebook's algorithm",
      "Every π, μ, σ and log-likelihood of all 15 iterations within 10⁻⁶ of the exported trace; the console output regenerated character for character; other seeds, a run to convergence and a 300-iteration run as extra traces",
      <code key="a">em.parity.test.ts</code>,
    ],
    [
      "The statistics helpers are right",
      "Normal and χ² functions, Wilson intervals, quantiles and the observed-information SEs checked against SciPy, statsmodels and numdifftools, and against R (prop.test, qchisq, numDeriv)",
      <code key="b">stats.reference.test.ts</code>,
    ],
    [
      "The published inference numbers are what the code produces",
      "Fast analyses re-run in full, slow ones through small stored checks with the same seeds",
      <code key="c">artefact.test.ts</code>,
    ],
    [
      "The 95% intervals deserve the name",
      `Coverage over ${s.coverage.S} simulated data sets (Wald) and ${s.bootstrapCoverage.S} (bootstrap, paired with Wald), with Wilson intervals on every coverage rate`,
      <Link key="d" className="link" href="/inference#coverage">
        /inference#coverage
      </Link>,
    ],
    [
      "The number of components",
      `AIC and BIC for K = 1 to 4 (${s.modelChoice.restarts} ordinary starts plus ${s.modelChoice.pileStarts} with a narrow component on the ratings piled at 10.0), sensitivity checks for the variance floor (${[...s.modelChoiceFloors, s.modelChoice.varianceFloor].sort((x, y) => x - y).join(", ")}) and without the clipped ratings, selection rates on ${s.selection.S} fresh samples, and a parametric bootstrap LRT (B = ${s.lrt.B})`,
      <Link key="e" className="link" href="/inference#choosing-k">
        /inference#choosing-k
      </Link>,
    ],
    [
      "EM behaves as the theory says",
      `Monotone log-likelihood and iterations to tolerance over ${s.convergence.starts} random starts; random start against k-means++ paired over ${s.initComparison.S} simulated data sets`,
      <Link key="f" className="link" href="/inference#convergence">
        /inference#convergence
      </Link>,
    ],
    [
      "The AI client is safe with a key",
      "Adapters, errors, key storage, redaction, audit log and the grounding check, with the network mocked",
      <code key="g">ai.test.ts</code>,
    ],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Methods"
        title="How the numbers were made, and what they cannot tell you"
      >
        <p>
          The data provenance, the method and its 2026 additions, how each claim on the site is
          checked, the assumptions and limits, the decisions behind them, a model card for the
          fitted mixture, and what the optional AI feature does.
        </p>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6">
        <nav aria-label="On this page">
          <ol className="flex flex-wrap gap-2">
            {TOC.map((t, i) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-foreground/30"
                >
                  <span className="num text-xs text-muted-foreground">{i + 1}</span>
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="data" eyebrow="1 · provenance" title="Data provenance">
          <div className="prose-notebook">
            <p>
              Every rating is synthetic. The 2025 notebook draws 200 &ldquo;movie ratings&rdquo;
              with <span className="num">np.random.seed(42)</span>: each user is a sci-fi lover with
              probability 0.6 (ratings from N(7.5, 1.2²)) or a romance lover (N(4.0, 1.5²)), and the
              ratings are clipped to 1 to 10, which puts seven of them at exactly 10.0. No real
              people or personal information are involved.
            </p>
            <p>
              <a href={repoFile("scripts/export_parity.py")}>export_parity.py</a> re-runs the
              notebook&apos;s cells verbatim and refuses to export unless every printed line matches
              the saved output (DR-001). It recorded Python {prov.python} and NumPy {prov.numpy}.
              Data generated in the browser (the playground&apos;s &ldquo;make your own&rdquo;,
              restart galleries, every simulation on /inference) use the site&apos;s own seeded
              generator, xoshiro128**, and are never presented as the notebook&apos;s.
            </p>
          </div>
          <ScrollX label="Generated artefacts" className="sheet p-1">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">
                Generated artefacts and the scripts that make them
              </caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    artefact
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    made by
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    holds
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "public/data/notebook-run.json",
                    "uv run scripts/export_parity.py",
                    "the 200 ratings, true groups, random start, 15-iteration trace, printed output",
                  ],
                  [
                    "src/lib/inference/__generated__/inference.json",
                    "pnpm inference",
                    "every number on /inference, with its seed and settings (DR-004)",
                  ],
                  [
                    "src/lib/stats/__fixtures__/reference*.json",
                    "uv run scripts/stats_reference.py; Rscript scripts/stats_reference.R",
                    "SciPy, statsmodels, numdifftools and R values for the statistics tests",
                  ],
                ].map(([a, b, c]) => (
                  <tr key={a} className="border-t align-top">
                    <th scope="row" className="num px-3 py-2.5 text-left text-xs font-normal">
                      {a}
                    </th>
                    <td className="num px-3 py-2.5 text-xs">{b}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </Section>

        <Section id="method" eyebrow="2 · method" title="Method">
          <div className="prose-notebook">
            <p>
              <strong>The original.</strong> A two-component Gaussian mixture fitted by EM written
              from scratch: the E-step computes each rating&apos;s responsibilities by Bayes&apos;
              theorem, the M-step updates each share, mean and spread as responsibility-weighted
              averages, and the run stops when the log-likelihood moves by less than the tolerance
              or at the iteration cap. The TypeScript port follows the notebook line for line. It
              adds two things, both off the notebook&apos;s path: an optional variance floor and a
              stop when a component collapses.
            </p>
            <p>
              <strong>Uncertainty (2026).</strong> Standard errors from the observed information,
              the negative Hessian of the observed-data log-likelihood at the MLE by central
              differences, inverted. Parametric-bootstrap percentile intervals: B data sets drawn
              from the fitted mixture, each refitted from the fit (warm start), components ordered
              by mean (DR-002). A coverage study simulates data sets from the known truth and counts
              how often each nominal 95% interval contains it.
            </p>
            <p>
              <strong>Choosing K.</strong> EM for K = 1 to 4 components, working in log space, from
              many starts (k-means++, Forgy and random) with a variance floor of σ ≥ 0.1 (DR-003);
              AIC and BIC; a parametric bootstrap likelihood-ratio test of one component against
              two, because the χ² reference fails at the boundary of the parameter space.
            </p>
            <p>
              <strong>Diagnostics and comparisons.</strong> Log-likelihood traces checked for any
              decrease; iterations to each tolerance across random starts; the share of starts that
              reach the best maximum, with a Wilson interval, turned into the chance that the best
              of R starts gets there. Two methods on the same data sets are compared as a paired
              mean difference with a bootstrap interval over data sets. Every proportion on the site
              has a Wilson interval and every seed is printed.
            </p>
          </div>
        </Section>

        <Section id="evaluation" eyebrow="3 · evaluation" title="Evaluation design">
          <p className="prose-notebook">
            Each kind of claim on the site has a check, and each check runs in CI on every push.
          </p>
          <ScrollX label="Claims and how they are checked" className="sheet p-1">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Claims and how they are checked</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    claim
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    evidence
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    where
                  </th>
                </tr>
              </thead>
              <tbody>
                {evaluation.map(([claim, evidence, where]) => (
                  <tr key={claim} className="border-t align-top">
                    <th scope="row" className="px-3 py-2.5 text-left font-medium">
                      {claim}
                    </th>
                    <td className="px-3 py-2.5 text-muted-foreground">{evidence}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </Section>

        <Section id="assumptions" eyebrow="4 · assumptions" title="Assumptions">
          <ul className="prose-notebook list-disc space-y-2 pl-5">
            <li>
              Ratings are independent draws from a mixture of normal distributions. The clipping at
              1 and 10 is not part of the model.
            </li>
            <li>
              The reported fit is the maximum the notebook&apos;s own run was heading to. Its
              standard errors and bootstrap intervals describe that maximum, not the likelihood
              surface as a whole (a second, higher maximum exists).
            </li>
            <li>
              Wald intervals assume the log-likelihood is close to quadratic near the maximum; the
              bootstrap assumes the fitted mixture is a fair stand-in for the truth.
            </li>
            <li>
              Simulations use the site&apos;s generator, not NumPy&apos;s; their conclusions do not
              depend on which generator draws the numbers.
            </li>
          </ul>
        </Section>

        <Section id="limitations" eyebrow="5 · limitations" title="Limitations">
          <ul className="prose-notebook list-disc space-y-2 pl-5">
            <li>
              One synthetic data set of 200 ratings. Its accuracy, {pct(acc.estimate)} as the
              notebook reported it, has a Wilson 95% interval of {pct(acc.lower)} to{" "}
              {pct(acc.upper)}; the converged fit&apos;s is lower (see the model card). Both are
              in-sample: the same ratings fitted the model, so the interval reflects which users
              happened to be drawn given the fitted rule, not the uncertainty of the fit itself, and
              it is optimistic about accuracy on new ratings.
            </li>
            <li>
              At n = 200 the nominal 95% intervals cover the truth less often than 95%: Wald
              intervals between {pct(Math.min(...waldCoverage), 0)} and{" "}
              {pct(Math.max(...waldCoverage), 0)}, with the model exactly right or clipped like the
              notebook.
            </li>
            <li>
              The bootstrap coverage study uses B = {s.bootstrapCoverage.B} bootstrap replicates per
              data set ({s.bootstrapCoverage.S} data sets) to keep the compute manageable, where B =
              1,000 is the usual minimum for percentile intervals. Each 2.5% and 97.5% endpoint then
              rests on about the {Math.round(0.025 * s.bootstrapCoverage.B)}th and{" "}
              {Math.round(0.975 * s.bootstrapCoverage.B)}th of {s.bootstrapCoverage.B} values, so
              the endpoints carry Monte Carlo error that this study does not quantify, and the
              bootstrap coverage rates and the paired bootstrap-against-Wald differences could move
              with a larger B.
            </li>
            <li>
              The model ignores clipping, so the pile of ratings at 10.0 can be
              &ldquo;explained&rdquo; by an extra component: on this sample BIC chooses{" "}
              {inference.modelChoice.full.bestByBic} components and AIC{" "}
              {inference.modelChoice.full.bestByAic}, and BIC&apos;s choice moves with the variance
              floor (DR-003).
            </li>
            <li>
              The likelihood-ratio test&apos;s null distribution depends on the variance floor and
              on how many starts each fit gets (DR-003).
            </li>
            <li>
              The AI feature has only been tested with the network mocked: this project has no API
              key.
            </li>
          </ul>
        </Section>

        <Section id="change" eyebrow="6 · next time" title="What I'd change">
          <ul className="prose-notebook list-disc space-y-2 pl-5">
            <li>
              Fit a censored mixture, so a rating clipped to 10 counts as &ldquo;at least 10&rdquo;
              (and one clipped to 1 as &ldquo;at most 1&rdquo;) rather than an exact value, and
              repeat the model choice.
            </li>
            <li>
              Replace the hard variance floor with a weak prior on σ², and report the LRT for
              several floors.
            </li>
            <li>
              Use profile-likelihood or bias-corrected bootstrap intervals, which should cover
              better than Wald intervals at this sample size.
            </li>
            <li>Regenerate every artefact in a scheduled CI job and fail on any diff.</li>
            <li>
              Build a small evaluation set for the AI explanations and score models on it, with
              intervals.
            </li>
          </ul>
        </Section>

        <Section id="decisions" eyebrow="7 · decisions" title="Decision records">
          <p className="prose-notebook">
            Each record states the decision first, then the options, the reasons, what actually
            happened (weak numbers included) and what I would change. Records are never edited after
            the fact; a new record supersedes an old one. The sources are in{" "}
            <a className="link" href={repoTree("docs/decisions")}>
              docs/decisions
            </a>
            .
          </p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {decisions.map((d) => (
              <li key={d.id}>
                <a
                  href={`#${d.anchor}`}
                  className="sheet block h-full p-4 transition-colors hover:border-foreground/30"
                >
                  <span className="num text-xs text-muted-foreground">{d.id}</span>
                  <span className="mt-1 block font-heading text-lg leading-snug font-semibold">
                    {d.title}
                  </span>
                </a>
              </li>
            ))}
          </ol>
          {decisions.map((d) => (
            <article
              key={d.id}
              id={d.anchor}
              aria-labelledby={`${d.anchor}-h`}
              className="sheet scroll-mt-20 p-5 sm:p-7"
            >
              <p className="eyebrow">
                {d.id} · {d.status} · {d.date}
              </p>
              <h3 id={`${d.anchor}-h`} className="mt-2 text-xl font-semibold sm:text-2xl">
                {d.title}
              </h3>
              {d.meta["applies-to"] ? (
                <p className="mt-1 text-xs [overflow-wrap:anywhere] text-muted-foreground">
                  Applies to: <span className="num break-words">{d.meta["applies-to"]}</span>
                </p>
              ) : null}
              {d.summary ? (
                <Callout variant="ok" title="Decision" className="mt-4">
                  <Markdown className="max-w-none">{d.summary}</Markdown>
                </Callout>
              ) : null}
              <Markdown sectionLevel={4} label={d.id} className="mt-2">
                {d.body}
              </Markdown>
            </article>
          ))}
        </Section>

        <Section id="model-card" eyebrow="8 · model card" title="Model card">
          <div className="sheet p-5 sm:p-7">
            <Markdown label="Model card">{card.body}</Markdown>
          </div>
        </Section>

        <Section id="ai-use" eyebrow="9 · AI use" title="AI use statement">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="sheet p-5">
              <h3 className="text-lg font-semibold">What the AI does</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                One optional feature, &ldquo;Explain this iteration&rdquo; on the stepper and the
                playground, writes a short plain-language reading of the EM iteration on screen. It
                is off until a visitor adds their own API key, and nothing else on the site calls an
                AI model while you use it.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Building the site is a different matter: its code and text were written with an AI
                coding assistant (Claude Code), as the{" "}
                <a className="link" href={`${site.repo}/commits`}>
                  commit history
                </a>{" "}
                shows. Every number on the site comes from the code, the tests and the seeded
                scripts, not from a language model, and the 2025 explainer and notebook in{" "}
                <span className="num">original/</span> are kept as they were.
              </p>
            </div>
            <div className="sheet p-5">
              <h3 className="text-lg font-semibold">What it never does</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>It never computes or changes any number shown on the site.</li>
                <li>
                  It never sees anything except this iteration&apos;s numbers and the fixed
                  description of the page and data set listed below. No personal data is sent.
                </li>
                <li>
                  It never runs without a click, and never with a key belonging to this site (there
                  is none).
                </li>
                <li>Its output is never shown without the &ldquo;AI-generated&rdquo; label.</li>
              </ul>
            </div>
            <div className="sheet p-5">
              <h3 className="text-lg font-semibold">What is sent, and where</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A fixed system prompt and a JSON snapshot with these fields and no others (a test
                checks the snapshot against this list):
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {SNAPSHOT_FIELDS.map((f) => (
                  <li key={f.keys.join()}>{f.what}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                It goes straight from the browser to the provider the visitor chose: Anthropic
                (default {ANTHROPIC_MODELS[0].label}, or {ANTHROPIC_MODELS[1].label}) or OpenAI
                (default {OPENAI_DEFAULT_MODEL}, editable). The key is kept in the browser&apos;s
                session storage, or local storage if the visitor asks, and travels only in the
                request header.
              </p>
            </div>
            <div className="sheet p-5">
              <h3 className="text-lg font-semibold">Human in the loop, and the record</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The reply must match a JSON schema and is validated again in the browser. A
                grounding check lists any number in it that was not in the snapshot; it checks{" "}
                {GROUNDING_SCOPE}. The visitor accepts, edits or rejects each explanation, and every
                call is written without the key to an audit log in the browser&apos;s IndexedDB:
                time, feature, provider, the model asked and the model that answered, input, output,
                latency, token usage and the decision. Failed calls are recorded too, and a refusal,
                a cut-off reply or one that failed validation keeps whatever the provider sent back
                and its token usage. On {ANTHROPIC_MODELS[1].label} a declined request is retried by
                Anthropic&apos;s server-side fallback within the same call; the log records the
                model that was asked, the model that answered and whether the fallback ran. View or
                export it on the{" "}
                <Link className="link" href="/ai-log">
                  AI audit log
                </Link>
                .
              </p>
            </div>
          </div>
          <Callout title="Frameworks">
            The design is informed by the Australian Government&apos;s policy for the responsible
            use of AI in government (transparency statements, human oversight), the EU AI Act&apos;s
            transparency principles (people should know when content is AI-generated) and the NIST
            AI Risk Management Framework (measure and manage, with records). It is not a claim of
            compliance with any of them. See DR-005 and DR-006 above for the trade-offs.
          </Callout>
        </Section>
      </div>
    </>
  );
}
