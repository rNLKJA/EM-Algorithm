import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/common/callout";
import { ScrollX } from "@/components/common/scroll-x";
import { PageHeader } from "@/components/common/page-header";
import { M, MathBlock } from "@/components/maths/tex";
import { Stepper } from "@/components/stepper/stepper";
import { CORRECTIONS } from "@/lib/em/corrections";
import { smart } from "@/lib/format";
import { repoFile } from "@/lib/site";

export const metadata: Metadata = {
  title: "Stepper: four ratings, by hand",
  description:
    "Step through the explainer's hand-worked EM example on the ratings 2, 3, 7 and 8: E-step responsibilities, M-step updates and the exact numbers beside the hand-worked ones.",
};

export default function StepperPage() {
  const readmeCorrections = CORRECTIONS.filter((c) => c.id.startsWith("readme"));
  return (
    <>
      <PageHeader eyebrow="Stepper" title="Four ratings, two groups, one step at a time">
        <p>
          The explainer works EM through by hand on just four movie ratings,{" "}
          <span className="num text-foreground">[2, 3, 7, 8]</span>. Here you can replay it: each
          E-step works out how likely each rating is to belong to each group, and each M-step
          redraws the groups from those probabilities.
        </p>
      </PageHeader>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Stepper
          formulas={{
            eStep: (
              <MathBlock>
                {String.raw`\gamma_{ik} = \frac{\pi_k\, f(x_i \mid \mu_k, \sigma_k)}{\pi_1 f(x_i \mid \mu_1, \sigma_1) + \pi_2 f(x_i \mid \mu_2, \sigma_2)}`}
              </MathBlock>
            ),
            mStep: (
              <MathBlock>
                {String.raw`\pi_k = \tfrac{1}{n}\sum_i \gamma_{ik}, \qquad \mu_k = \frac{\sum_i \gamma_{ik} x_i}{\sum_i \gamma_{ik}}, \qquad \sigma_k = \sqrt{\frac{\sum_i \gamma_{ik} (x_i - \mu_k)^2}{\sum_i \gamma_{ik}}}`}
              </MathBlock>
            ),
            logLik: (
              <M>
                {String.raw`\ell(\theta) = \sum_i \log\big(\pi_1 f(x_i \mid \mu_1, \sigma_1) + \pi_2 f(x_i \mid \mu_2, \sigma_2)\big)`}
              </M>
            ),
          }}
        />

        <section
          className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.1fr]"
          aria-labelledby="corrections"
        >
          <div className="prose-notebook">
            <h2 id="corrections" className="text-2xl font-semibold">
              What the hand-worked numbers got wrong (and right)
            </h2>
            <p className="mt-3">
              The explainer&apos;s worked example is the clearest part of it, so it is worth being
              exact about it. The density values it plugs in are off, but the story they tell is
              right: ratings 2 and 3 land in group 1 with near certainty, 7 and 8 in group 2, and
              the first M-step returns μ = 2.5 and 7.5 with σ = 0.5 and π = 0.5. In fact the
              starting guess was already a fixed point, so the second iteration changes nothing,
              exactly as the explainer says.
            </p>
            <p>
              The original text is kept unchanged in{" "}
              <a href={repoFile("original/em-explainer.md")}>original/em-explainer.md</a>. The{" "}
              <Link href="/maths">Maths page</Link> lists every correction in context.
            </p>
          </div>
          <ScrollX label="Corrections to the worked example" className="sheet p-1">
            <table className="w-full text-sm">
              <caption className="sr-only">Corrections to the worked example</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2.5 font-normal sm:whitespace-nowrap">
                    quantity
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-normal sm:whitespace-nowrap">
                    as written
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-normal sm:whitespace-nowrap">
                    exact
                  </th>
                </tr>
              </thead>
              <tbody className="num">
                {readmeCorrections.map((c) => (
                  <tr key={c.id} className="border-t align-top">
                    <th scope="row" className="px-3 py-2.5 text-left font-normal">
                      {c.quantity}
                      <span className="mt-0.5 block font-sans text-xs text-muted-foreground">
                        {c.why}
                      </span>
                    </th>
                    <td className="px-3 py-2.5 text-correction line-through decoration-correction/60">
                      {c.asWritten}
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      {smart(c.exact, 4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        </section>

        <Callout className="mt-10" title="Want more than four points?">
          The{" "}
          <Link className="link" href="/playground">
            playground
          </Link>{" "}
          runs the same algorithm on the notebook&apos;s 200 synthetic ratings, or on data you
          generate.
        </Callout>
      </div>
    </>
  );
}
