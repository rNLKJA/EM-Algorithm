import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Callout, CorrectionTag } from "@/components/common/callout";
import { PageHeader } from "@/components/common/page-header";
import { M, MathBlock } from "@/components/maths/tex";
import { CORRECTIONS, type Correction } from "@/lib/em/corrections";
import { smart } from "@/lib/format";
import { pageMetadata, repoFile } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Maths: the derivations",
  description:
    "The explainer's derivations of the EM algorithm for a two-component Gaussian mixture, rendered with KaTeX: likelihood, the E-step via Bayes' theorem, the M-step updates, a Normal + Beta mixture and convergence, with corrections labelled.",
  path: "/maths",
});

const TOC = [
  { id: "likelihood", label: "Likelihood and log-likelihood" },
  { id: "setup", label: "The mixture set-up" },
  { id: "e-step", label: "E-step: responsibilities" },
  { id: "m-step", label: "M-step: updates" },
  { id: "mean-derivation", label: "Deriving the mean update" },
  { id: "normal-beta", label: "Normal + Beta mixture" },
  { id: "algorithm", label: "The algorithm and convergence" },
  { id: "addendum", label: "Revival addendum" },
];

const byId = Object.fromEntries(CORRECTIONS.map((c) => [c.id, c])) as Record<string, Correction>;

function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 pt-6 text-2xl font-semibold sm:text-3xl">
      {children}
    </h2>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-lg font-semibold">{children}</h3>;
}

function Fix({ ids, children }: { ids: string[]; children?: ReactNode }) {
  return (
    <Callout
      variant="correction"
      title={
        <span className="flex items-center gap-2">
          Correction <CorrectionTag>2026 revival</CorrectionTag>
        </span>
      }
    >
      <ul className="num mt-1 space-y-1 text-sm">
        {ids.map((id) => {
          const c = byId[id];
          return (
            <li key={id}>
              {c.quantity}: written{" "}
              <span className="line-through decoration-correction/60">{c.asWritten}</span>, exact{" "}
              <strong className="font-medium">{smart(c.exact, 4)}</strong>
              <span className="block font-sans text-xs text-muted-foreground">{c.why}</span>
            </li>
          );
        })}
      </ul>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </Callout>
  );
}

export default function MathsPage() {
  return (
    <>
      <PageHeader eyebrow="Maths" title="The derivations, written out">
        <p>
          The maths from the original explainer, rendered properly. Equations are as Rin wrote them
          and the prose is lightly condensed. Where a hand-worked number did not survive
          recomputation, an amber box gives the exact value; the original is preserved unchanged in{" "}
          <a className="link" href={repoFile("original/em-explainer.md")}>
            original/em-explainer.md
          </a>
          .
        </p>
      </PageHeader>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-20 space-y-1.5 border-l pl-4 text-sm">
            {TOC.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="prose-notebook max-w-[72ch] space-y-5">
          <H2 id="likelihood">Likelihood and log-likelihood</H2>
          <p>
            Probability distributions describe which values are likely and which are not. For a
            normal distribution with mean <M>\mu</M> and standard deviation <M>\sigma</M> the
            density is
          </p>
          <MathBlock>{String.raw`f(x) = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x - \mu)^2}{2\sigma^2}\right)`}</MathBlock>
          <p>
            If <M>x</M> is close to <M>\mu</M> the density is high, if it is far away it is low, and{" "}
            <M>\sigma</M> controls how spread out it is. The likelihood asks how plausible the data
            are under given parameters. Multiplying many small densities underflows, so we add
            logarithms instead:
          </p>
          <MathBlock>{String.raw`\ell(\theta) = \sum_{i=1}^{n} \log f(x_i \mid \theta)`}</MathBlock>
          <p>EM is a method for maximising this log-likelihood when part of the data is hidden.</p>

          <H2 id="setup">The mixture set-up</H2>
          <p>
            Separate users into two groups (&ldquo;sci-fi lovers&rdquo; and &ldquo;romance
            lovers&rdquo;) without knowing who is in which.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Observed data: <M>{String.raw`\mathbf{X} = \{x_1, x_2, \ldots, x_n\}`}</M>, the
              ratings.
            </li>
            <li>
              Latent variables: <M>{String.raw`\mathbf{Z} = \{z_{ik}\}`}</M> with{" "}
              <M>{String.raw`z_{ik} = 1`}</M> if user <M>i</M> belongs to group <M>k</M> and 0
              otherwise; exactly one <M>{String.raw`z_{ik}`}</M> is 1 for each user.
            </li>
            <li>
              Parameters:{" "}
              <M>{String.raw`\theta = \{\pi_1, \pi_2, \mu_1, \mu_2, \sigma_1^2, \sigma_2^2\}`}</M>,
              the mixing proportions, means and variances.
            </li>
          </ul>
          <p>
            If we knew which group each user belonged to, the complete-data log-likelihood would be
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} &\log L(\theta; \mathbf{X}, \mathbf{Z}) \\ &\quad = \sum_{i=1}^{n} \sum_{k=1}^{2} z_{ik} \log\big[\pi_k f(x_i \mid \mu_k, \sigma_k^2)\big] \end{aligned}`}
          >{String.raw`\log L(\theta; \mathbf{X}, \mathbf{Z}) = \sum_{i=1}^{n} \sum_{k=1}^{2} z_{ik} \log\big[\pi_k f(x_i \mid \mu_k, \sigma_k^2)\big]`}</MathBlock>

          <H2 id="e-step">E-step: &ldquo;what&apos;s the best guess?&rdquo;</H2>
          <p>
            The E-step replaces each unknown <M>{String.raw`z_{ik}`}</M> by its expected value given
            the data and the current parameters <M>{String.raw`\theta^{(t)}`}</M>:
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} \gamma_{ik} &= E[z_{ik} \mid x_i, \theta^{(t)}] \\ &= P(z_{ik} = 1 \mid x_i, \theta^{(t)}) \end{aligned}`}
          >{String.raw`\gamma_{ik} = E[z_{ik} \mid x_i, \theta^{(t)}] = P(z_{ik} = 1 \mid x_i, \theta^{(t)})`}</MathBlock>
          <p>
            This is about group membership, not activity: every user is in exactly one group, and{" "}
            <M>{String.raw`\gamma_{ik}`}</M> is how sure we are which. By Bayes&apos; theorem,
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} &P(z_{ik} = 1 \mid x_i, \theta^{(t)}) \\ &\quad = \frac{\begin{gathered} P(x_i \mid z_{ik} = 1, \theta^{(t)}) \\ {}\times P(z_{ik} = 1 \mid \theta^{(t)}) \end{gathered}}{P(x_i \mid \theta^{(t)})} \end{aligned}`}
          >{String.raw`P(z_{ik} = 1 \mid x_i, \theta^{(t)}) = \frac{P(x_i \mid z_{ik} = 1, \theta^{(t)}) \, P(z_{ik} = 1 \mid \theta^{(t)})}{P(x_i \mid \theta^{(t)})}`}</MathBlock>
          <p>
            The three pieces are the group&apos;s density, its prior share, and the marginal density
            of the rating:
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} &P(x_i \mid z_{ik} = 1, \theta^{(t)}) \\ &\qquad = f(x_i \mid \mu_k^{(t)}, \sigma_k^{2(t)}) \\[0.4em] &P(z_{ik} = 1 \mid \theta^{(t)}) = \pi_k^{(t)} \\[0.4em] &P(x_i \mid \theta^{(t)}) \\ &\qquad = \textstyle\sum_{j=1}^{2} \pi_j^{(t)} f(x_i \mid \mu_j^{(t)}, \sigma_j^{2(t)}) \end{aligned}`}
          >{String.raw`\begin{aligned} P(x_i \mid z_{ik} = 1, \theta^{(t)}) &= f(x_i \mid \mu_k^{(t)}, \sigma_k^{2(t)}) \\ P(z_{ik} = 1 \mid \theta^{(t)}) &= \pi_k^{(t)} \\ P(x_i \mid \theta^{(t)}) &= \textstyle\sum_{j=1}^{2} \pi_j^{(t)} f(x_i \mid \mu_j^{(t)}, \sigma_j^{2(t)}) \end{aligned}`}</MathBlock>
          <p>Putting them together:</p>
          <MathBlock>{String.raw`\gamma_{ik} = \frac{\pi_k^{(t)} f(x_i \mid \mu_k^{(t)}, \sigma_k^{2(t)})}{\sum_{j=1}^{2} \pi_j^{(t)} f(x_i \mid \mu_j^{(t)}, \sigma_j^{2(t)})}`}</MathBlock>
          <p>
            The numerator is the joint probability{" "}
            <M>{String.raw`P(x_i, z_{ik} = 1 \mid \theta^{(t)})`}</M>, the denominator the marginal,
            and their ratio the conditional; so <M>{String.raw`\gamma_{i1} + \gamma_{i2} = 1`}</M>.
          </p>
          <H3>Worked example</H3>
          <p>
            A user rates &ldquo;The Matrix&rdquo; 5 stars, with current estimates{" "}
            <M>{String.raw`\mu_1 = 4.5,\ \sigma_1 = 0.8,\ \pi_1 = 0.6`}</M> (sci-fi) and{" "}
            <M>{String.raw`\mu_2 = 3.0,\ \sigma_2 = 1.2,\ \pi_2 = 0.4`}</M> (romance). The explainer
            computes <M>{String.raw`0.6 \times f(5 \mid 4.5, 0.8^2) = 0.6 \times 0.47 = 0.28`}</M>{" "}
            and <M>{String.raw`0.4 \times f(5 \mid 3.0, 1.2^2) = 0.4 \times 0.12 = 0.05`}</M>, so{" "}
            <M>{String.raw`\gamma_{i1} = 0.28 / (0.28 + 0.05) = 0.85`}</M>.
          </p>
          <Fix ids={["estep-scifi", "estep-romance", "estep-gamma"]}>
            So the user is an 88% (not 85%) likely sci-fi lover. The conclusion stands.
          </Fix>
          <p>
            The hand-worked four-rating example in the explainer has the same kind of slip; the{" "}
            <Link href="/stepper">stepper</Link> replays it with both sets of numbers side by side.
          </p>
          <Fix ids={["readme-f-2", "readme-f-3", "readme-cross-3", "readme-cross-2"]}>
            The responsibilities are essentially 1 and 0 either way, and the first M-step lands on μ
            = 2.5 / 7.5, σ = 0.5, π = 0.5 as written.
          </Fix>

          <H2 id="m-step">M-step: &ldquo;update your model&rdquo;</H2>
          <p>
            With responsibilities in hand, each group is re-estimated by weighted averages, the
            weights being how strongly each user belongs to the group:
          </p>
          <MathBlock
            narrow={String.raw`\begin{gathered} \pi_k^{(t+1)} = \frac{1}{n}\sum_{i=1}^{n} \gamma_{ik} \\[0.3em] \mu_k^{(t+1)} = \frac{\sum_{i=1}^{n} \gamma_{ik} x_i}{\sum_{i=1}^{n} \gamma_{ik}} \end{gathered}`}
          >{String.raw`\pi_k^{(t+1)} = \frac{1}{n}\sum_{i=1}^{n} \gamma_{ik}, \qquad \mu_k^{(t+1)} = \frac{\sum_{i=1}^{n} \gamma_{ik} x_i}{\sum_{i=1}^{n} \gamma_{ik}}`}</MathBlock>
          <MathBlock>{String.raw`\sigma_k^{2(t+1)} = \frac{\sum_{i=1}^{n} \gamma_{ik} (x_i - \mu_k^{(t+1)})^2}{\sum_{i=1}^{n} \gamma_{ik}}`}</MathBlock>
          <p>
            The mixing proportion is the average membership; the mean is a weighted average in which
            users more likely to be in group <M>k</M> count for more; the variance is the weighted
            spread around the new mean. The explainer&apos;s example: users with sci-fi
            probabilities 0.85, 0.20 and 0.90 rated 5, 4 and 5, so
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} \mu_{\text{sci-fi}} &= \frac{0.85 \times 5 + 0.20 \times 4 + 0.90 \times 5}{0.85 + 0.20 + 0.90} \\ &= \frac{9.55}{1.95} \approx 4.9 \end{aligned}`}
          >{String.raw`\mu_{\text{sci-fi}} = \frac{0.85 \times 5 + 0.20 \times 4 + 0.90 \times 5}{0.85 + 0.20 + 0.90} = \frac{9.55}{1.95} \approx 4.9`}</MathBlock>
          <p>
            (That one checks out.) Better groups give better memberships, which give better groups:
            a feedback loop.
          </p>

          <H2 id="mean-derivation">Deriving the mean update</H2>
          <p>Start from the expected complete-data log-likelihood:</p>
          <MathBlock
            narrow={String.raw`\begin{aligned} &Q(\theta \mid \theta^{(t)}) \\ &\;\; = \sum_{i=1}^{n} \sum_{k=1}^{2} \gamma_{ik} \log\big[\pi_k f(x_i \mid \mu_k, \sigma_k^2)\big] \\ &\;\; = \sum_{i=1}^{n} \sum_{k=1}^{2} \gamma_{ik} \big[\log \pi_k \\ &\qquad\qquad {} + \log f(x_i \mid \mu_k, \sigma_k^2)\big] \end{aligned}`}
          >{String.raw`\begin{aligned} Q(\theta \mid \theta^{(t)}) &= \sum_{i=1}^{n} \sum_{k=1}^{2} \gamma_{ik} \log\big[\pi_k f(x_i \mid \mu_k, \sigma_k^2)\big] \\ &= \sum_{i=1}^{n} \sum_{k=1}^{2} \gamma_{ik} \big[\log \pi_k + \log f(x_i \mid \mu_k, \sigma_k^2)\big] \end{aligned}`}</MathBlock>
          <p>
            Differentiate with respect to <M>{String.raw`\mu_k`}</M>:
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} \frac{\partial Q}{\partial \mu_k} &= \sum_{i=1}^{n} \gamma_{ik} \frac{\partial}{\partial \mu_k} \bigg[-\tfrac{1}{2}\log(2\pi\sigma_k^2) \\ &\hspace{6em} {} - \frac{(x_i - \mu_k)^2}{2\sigma_k^2}\bigg] \\ &= \sum_{i=1}^{n} \gamma_{ik} \frac{x_i - \mu_k}{\sigma_k^2} \end{aligned}`}
          >{String.raw`\begin{aligned} \frac{\partial Q}{\partial \mu_k} &= \sum_{i=1}^{n} \gamma_{ik} \frac{\partial}{\partial \mu_k} \left[-\tfrac{1}{2}\log(2\pi\sigma_k^2) - \frac{(x_i - \mu_k)^2}{2\sigma_k^2}\right] \\ &= \sum_{i=1}^{n} \gamma_{ik} \frac{x_i - \mu_k}{\sigma_k^2} \end{aligned}`}</MathBlock>
          <p>Set it to zero and solve:</p>
          <MathBlock
            narrow={String.raw`\begin{gathered} \sum_{i=1}^{n} \gamma_{ik} (x_i - \mu_k) = 0 \\ \Longrightarrow\;\; \mu_k = \frac{\sum_{i=1}^{n} \gamma_{ik} x_i}{\sum_{i=1}^{n} \gamma_{ik}} \end{gathered}`}
          >{String.raw`\sum_{i=1}^{n} \gamma_{ik} (x_i - \mu_k) = 0 \;\;\Longrightarrow\;\; \mu_k = \frac{\sum_{i=1}^{n} \gamma_{ik} x_i}{\sum_{i=1}^{n} \gamma_{ik}}`}</MathBlock>

          <H2 id="normal-beta">A Normal + Beta mixture</H2>
          <p>
            EM does not need the components to be the same family. Suppose tech-savvy users rate on
            a continuous 0 to 10 scale (normal) while casual users give a thumbs up or down,
            recorded on [0, 1] (beta):
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} &f_1(x \mid \mu, \sigma^2) \\ &\quad = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x - \mu)^2}{2\sigma^2}\right) \end{aligned}`}
          >{String.raw`f_1(x \mid \mu, \sigma^2) = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\left(-\frac{(x - \mu)^2}{2\sigma^2}\right)`}</MathBlock>
          <MathBlock
            narrow={String.raw`\begin{gathered} f_2(x \mid \alpha, \beta) = \frac{x^{\alpha-1}(1-x)^{\beta-1}}{B(\alpha, \beta)} \\[0.3em] B(\alpha, \beta) = \frac{\Gamma(\alpha)\Gamma(\beta)}{\Gamma(\alpha+\beta)} \end{gathered}`}
          >{String.raw`f_2(x \mid \alpha, \beta) = \frac{x^{\alpha-1}(1-x)^{\beta-1}}{B(\alpha, \beta)}, \qquad B(\alpha, \beta) = \frac{\Gamma(\alpha)\Gamma(\beta)}{\Gamma(\alpha+\beta)}`}</MathBlock>
          <p>
            The E-step is the same Bayes calculation with two different densities in the numerator:
          </p>
          <MathBlock
            narrow={String.raw`\begin{gathered} \gamma_{i1} = \frac{\pi_1^{(t)} f_1(x_i \mid \mu^{(t)}, \sigma^{2(t)})}{\begin{gathered} \pi_1^{(t)} f_1(x_i \mid \mu^{(t)}, \sigma^{2(t)}) \\ {}+ \pi_2^{(t)} f_2(x_i \mid \alpha^{(t)}, \beta^{(t)}) \end{gathered}} \\[0.3em] \gamma_{i2} = 1 - \gamma_{i1} \end{gathered}`}
          >{String.raw`\gamma_{i1} = \frac{\pi_1^{(t)} f_1(x_i \mid \mu^{(t)}, \sigma^{2(t)})}{\pi_1^{(t)} f_1(x_i \mid \mu^{(t)}, \sigma^{2(t)}) + \pi_2^{(t)} f_2(x_i \mid \alpha^{(t)}, \beta^{(t)})}, \quad \gamma_{i2} = 1 - \gamma_{i1}`}</MathBlock>
          <p>
            The mixing proportions and the normal&apos;s <M>\mu</M>, <M>{String.raw`\sigma^2`}</M>{" "}
            update exactly as before (using <M>{String.raw`\gamma_{i1}`}</M>). The beta parameters
            have no closed form; they solve
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} \frac{\partial Q}{\partial \alpha} &= \sum_{i=1}^{n} \gamma_{i2} \big[\log x_i - \psi(\alpha) \\ &\qquad {} + \psi(\alpha + \beta)\big] = 0 \\[0.4em] \frac{\partial Q}{\partial \beta} &= \sum_{i=1}^{n} \gamma_{i2} \big[\log(1-x_i) - \psi(\beta) \\ &\qquad {} + \psi(\alpha + \beta)\big] = 0 \end{aligned}`}
          >{String.raw`\begin{aligned} \frac{\partial Q}{\partial \alpha} &= \sum_{i=1}^{n} \gamma_{i2} \big[\log x_i - \psi(\alpha) + \psi(\alpha + \beta)\big] = 0 \\ \frac{\partial Q}{\partial \beta} &= \sum_{i=1}^{n} \gamma_{i2} \big[\log(1-x_i) - \psi(\beta) + \psi(\alpha + \beta)\big] = 0 \end{aligned}`}</MathBlock>
          <p>
            where <M>{String.raw`\psi(x) = \frac{d}{dx}\log\Gamma(x)`}</M> is the digamma function.
            In the explainer&apos;s example, starting from <M>{String.raw`\mu = 7,\ \sigma = 1`}</M>{" "}
            and <M>{String.raw`\alpha = \beta = 2`}</M> with equal shares, a rating of 0.2 is almost
            certainly beta and a rating of 7.5 is certainly normal, since the beta density is zero
            outside [0, 1].
          </p>
          <Fix ids={["beta-0.2", "beta-normal-0.2"]}>
            With 0.96 in place of 1.2, γ for the beta group at 0.2 is still 1 to ten decimal places.
          </Fix>

          <H2 id="algorithm">The algorithm and convergence</H2>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Initialise <M>{String.raw`\theta^{(0)}`}</M>.
            </li>
            <li>
              E-step: compute <M>{String.raw`\gamma_{ik} = E[z_{ik} \mid x_i, \theta^{(t)}]`}</M>.
            </li>
            <li>
              M-step:{" "}
              <M>{String.raw`\theta^{(t+1)} = \arg\max_{\theta} Q(\theta \mid \theta^{(t)})`}</M>.
            </li>
            <li>
              Stop if <M>{String.raw`|\ell(\theta^{(t+1)}) - \ell(\theta^{(t)})| < \epsilon`}</M>;
              otherwise repeat.
            </li>
          </ol>
          <p>EM guarantees the log-likelihood never decreases,</p>
          <MathBlock>{String.raw`\ell(\theta^{(t+1)}) \ge \ell(\theta^{(t)})`}</MathBlock>
          <p>
            so it converges to a local maximum (or a saddle point) of the likelihood. Local is the
            important word: see the <Link href="/pitfalls#local-maxima">pitfalls page</Link>.
          </p>

          <H2 id="addendum">Revival addendum</H2>
          <Callout variant="note" title="Added in 2026, not in the original explainer">
            The explainer derives the mean update; for completeness here are the other two, and a
            sketch of why the ascent property holds.
          </Callout>
          <H3>Mixing proportions (a Lagrange multiplier)</H3>
          <p>
            Maximise <M>{String.raw`\sum_i \sum_k \gamma_{ik} \log \pi_k`}</M> subject to{" "}
            <M>{String.raw`\pi_1 + \pi_2 = 1`}</M>:
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} &\frac{\partial}{\partial \pi_k}\Big[\sum_{i,k} \gamma_{ik} \log \pi_k + \lambda\big(1 - \textstyle\sum_k \pi_k\big)\Big] \\ &\quad = \frac{\sum_i \gamma_{ik}}{\pi_k} - \lambda = 0 \end{aligned}`}
          >{String.raw`\frac{\partial}{\partial \pi_k}\Big[\sum_{i,k} \gamma_{ik} \log \pi_k + \lambda\big(1 - \textstyle\sum_k \pi_k\big)\Big] = \frac{\sum_i \gamma_{ik}}{\pi_k} - \lambda = 0`}</MathBlock>
          <MathBlock>{String.raw`\Longrightarrow\;\; \pi_k = \frac{1}{n}\sum_{i=1}^{n} \gamma_{ik}`}</MathBlock>
          <p>
            since summing over <M>k</M> gives{" "}
            <M>{String.raw`\lambda = \sum_{i,k}\gamma_{ik} = n`}</M>.
          </p>
          <H3>Variances</H3>
          <MathBlock
            narrow={String.raw`\begin{aligned} \frac{\partial Q}{\partial \sigma_k^2} &= \sum_{i=1}^{n} \gamma_{ik} \bigg[-\frac{1}{2\sigma_k^2} \\ &\qquad\quad {} + \frac{(x_i - \mu_k)^2}{2\sigma_k^4}\bigg] = 0 \\[0.3em] \Longrightarrow\;\; \sigma_k^2 &= \frac{\sum_i \gamma_{ik} (x_i - \mu_k)^2}{\sum_i \gamma_{ik}} \end{aligned}`}
          >{String.raw`\frac{\partial Q}{\partial \sigma_k^2} = \sum_{i=1}^{n} \gamma_{ik} \left[-\frac{1}{2\sigma_k^2} + \frac{(x_i - \mu_k)^2}{2\sigma_k^4}\right] = 0 \;\;\Longrightarrow\;\; \sigma_k^2 = \frac{\sum_i \gamma_{ik} (x_i - \mu_k)^2}{\sum_i \gamma_{ik}}`}</MathBlock>
          <p>
            The notebook updates <M>{String.raw`\sigma_k`}</M> as the square root of this, which is
            the same update. If one component&apos;s weight concentrates on a single point, the
            numerator goes to zero: that is the{" "}
            <Link href="/pitfalls#variance-collapse">variance collapse</Link> pitfall.
          </p>
          <H3>Why the log-likelihood never decreases</H3>
          <p>
            For any distribution <M>{String.raw`q_i`}</M> over the group of user <M>i</M>,
            Jensen&apos;s inequality gives a lower bound on the log-likelihood:
          </p>
          <MathBlock
            narrow={String.raw`\begin{aligned} \ell(\theta) &= \sum_i \log \sum_k q_{ik} \frac{\pi_k f(x_i \mid \mu_k, \sigma_k)}{q_{ik}} \\ &\ge \sum_i \sum_k q_{ik} \log \frac{\pi_k f(x_i \mid \mu_k, \sigma_k)}{q_{ik}} \end{aligned}`}
          >{String.raw`\ell(\theta) = \sum_i \log \sum_k q_{ik} \frac{\pi_k f(x_i \mid \mu_k, \sigma_k)}{q_{ik}} \;\ge\; \sum_i \sum_k q_{ik} \log \frac{\pi_k f(x_i \mid \mu_k, \sigma_k)}{q_{ik}}`}</MathBlock>
          <p>
            The E-step chooses <M>{String.raw`q_{ik} = \gamma_{ik}`}</M>, which makes the bound
            touch <M>{String.raw`\ell(\theta^{(t)})`}</M>; the M-step maximises the bound over{" "}
            <M>\theta</M>. So{" "}
            <M>{String.raw`\ell(\theta^{(t+1)}) \ge \text{bound}(\theta^{(t+1)}) \ge \text{bound}(\theta^{(t)}) = \ell(\theta^{(t)})`}</M>
            . The playground checks this on every trace it draws.
          </p>
        </article>
      </div>
    </>
  );
}
