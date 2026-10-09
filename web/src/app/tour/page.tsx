import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/page-header";
import { ScreenshotGallery, type GalleryItem } from "@/components/tour/screenshot-gallery";
import { WalkthroughPlayer } from "@/components/tour/walkthrough-player";
import {
  MOCKED_AI,
  SCREENSHOTS,
  WALKTHROUGHS,
  screenshotMedia,
  spokenDuration,
  walkthroughMedia,
} from "@/lib/showcase";
import { MANIFEST } from "@/lib/showcase-manifest";
import { pageMetadata, repoFile } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Guided tour",
  description:
    "Three recorded walkthroughs of the main journeys (stepping through EM by hand, fitting the notebook's mixture and landing in a local maximum, and putting intervals and a choice of K on the fit), with step-by-step transcripts and screenshots of every key feature.",
  path: "/tour",
});

/** Recording size of the walkthroughs (Playwright recordVideo). */
const VIDEO = { width: 1280, height: 800 };

const ROUTE_LABEL: Record<string, string> = {
  "/": "Overview",
  "/stepper": "Stepper",
  "/playground": "Playground",
  "/pitfalls#local-maxima": "Local maxima",
  "/inference#uncertainty": "Uncertainty",
  "/inference#choosing-k": "Choosing K",
};

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t pt-10">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-h`} className="mt-2 text-2xl font-semibold sm:text-3xl">
        {title}
      </h2>
      {intro ? (
        <div className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{intro}</div>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function TourPage() {
  const totalSeconds = WALKTHROUGHS.reduce(
    (sum, w) => sum + (MANIFEST.walkthroughs[w.id]?.duration ?? 0),
    0,
  );
  const gallery: GalleryItem[] = SCREENSHOTS.flatMap((s) => {
    const size = MANIFEST.screenshots[s.id];
    if (!size) return [];
    const media = screenshotMedia(s.id);
    return [
      {
        ...s,
        full: { src: media.full, width: size.width, height: size.height },
        thumb: { src: media.thumb, width: size.thumbWidth, height: size.thumbHeight },
      },
    ];
  });

  return (
    <>
      <PageHeader eyebrow="Guided tour · start here" title="EM in three walkthroughs">
        <p>
          Three short screen recordings of the main journeys
          {totalSeconds > 0 ? <>, about {Math.round(totalSeconds / 60)} minutes in all</> : null}:
          stepping through EM by hand on four ratings, fitting the notebook&apos;s mixture to 200
          ratings (and watching a bad start get stuck), and asking how sure the fit is. Each step is
          listed beside its video as a transcript; press a step to jump to it. Below them,
          screenshots of every key feature.
        </p>
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-14 px-4 sm:px-6">
        <nav aria-label="On this page">
          <ol className="flex flex-wrap gap-2">
            {WALKTHROUGHS.map((w, i) => (
              <li key={w.id}>
                <a
                  href={`#${w.id}`}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-foreground/30"
                >
                  <span className="num text-xs text-muted-foreground">{i + 1}</span>
                  {w.title}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#screenshots"
                className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-foreground/30"
              >
                Screenshots
              </a>
            </li>
          </ol>
        </nav>

        {WALKTHROUGHS.map((w, i) => {
          const info = MANIFEST.walkthroughs[w.id];
          return (
            <Section
              key={w.id}
              id={w.id}
              eyebrow={`Walkthrough ${i + 1} of ${WALKTHROUGHS.length}${info ? ` · ${spokenDuration(info.duration)}` : ""}`}
              title={w.title}
              intro={<p>{w.summary}</p>}
            >
              {info ? (
                <WalkthroughPlayer
                  title={w.title}
                  steps={w.steps}
                  cues={info.cues}
                  media={walkthroughMedia(w.id)}
                  width={VIDEO.width}
                  height={VIDEO.height}
                />
              ) : (
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {w.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              )}
              <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                <dt className="font-medium">Data and settings</dt>
                <dd className="text-muted-foreground">{w.setup}</dd>
                <dt className="font-medium">Try it yourself</dt>
                <dd className="flex flex-wrap gap-x-4 gap-y-1">
                  {w.routes.map((r) => (
                    <Link
                      key={r}
                      href={r}
                      className="inline-flex items-center gap-1 font-medium text-comp-1-ink underline-offset-4 hover:underline"
                    >
                      {ROUTE_LABEL[r] ?? r} <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  ))}
                </dd>
              </dl>
            </Section>
          );
        })}

        <Section
          id="screenshots"
          eyebrow="Key features"
          title="Screenshots"
          intro={
            <p>
              Desktop shots at 1440 × 900 in light mode (the overview in dark mode too) and three
              phone shots. Select one to enlarge it, then use the arrow keys to move through them.
              The two AI shots show a {MOCKED_AI.replace(/^Mocked/, "mocked")}: no key was entered
              and no provider was called.
            </p>
          }
        >
          {gallery.length ? (
            <ScreenshotGallery items={gallery} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No screenshots yet: run <code className="num">pnpm showcase</code> to make them.
            </p>
          )}
        </Section>

        <Section id="how" eyebrow="Reproducible" title="How these were made">
          <div className="prose-notebook text-muted-foreground">
            <p>
              Every frame comes from a script, not a screen-capture session. A Playwright tour (
              <a href={repoFile("web/e2e/showcase.spec.ts")}>web/e2e/showcase.spec.ts</a>) drives
              the site in Google Chrome at 1280 × 800, adds the caption banner and the cursor
              highlight, and records the video. It also checks what it shows: the explainer&apos;s
              densities against the exact 0.4839, the notebook&apos;s log-likelihood after 15
              iterations and at convergence, the lower maximum the bad start reaches, the bootstrap
              interval for π₁ and the browser re-run that reproduces it, BIC&apos;s choice of K and
              the bootstrap likelihood-ratio test. A broken feature fails the tour rather than
              producing a misleading video.
            </p>
            <p>
              The ratings are the notebook&apos;s own, exported from it, and every simulation on the
              site is seeded, so a rerun records the same numbers. No API key is entered anywhere:
              the AI settings dialog is only opened, and the AI explanation in the screenshots is a
              mocked reply served inside the test browser, labelled as such on screen.
            </p>
          </div>
        </Section>
      </div>
    </>
  );
}
