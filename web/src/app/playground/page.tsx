import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Playground } from "@/components/playground/playground";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Playground: a mixture you can watch converge",
  description:
    "Run the notebook's EM algorithm on its 200 synthetic movie ratings or on data you generate, from a random, k-means++ or hand-placed start, and watch the log-likelihood climb.",
  path: "/playground",
});

export default function PlaygroundPage() {
  return (
    <>
      <PageHeader eyebrow="Playground" title="Two hidden groups in 200 ratings">
        <p>
          This is the notebook&apos;s experiment, live. Its 200 ratings come from two kinds of
          viewer, but nothing says who is who. Press play to watch EM find the groups one iteration
          at a time, or change the data, the starting guess and the stopping rule. The{" "}
          <Link className="link" href="/pitfalls">
            pitfalls page
          </Link>{" "}
          covers the ways this can go wrong.
        </p>
      </PageHeader>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Playground />
      </div>
    </>
  );
}
