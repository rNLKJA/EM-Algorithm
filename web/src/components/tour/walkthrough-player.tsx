"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clock } from "@/lib/showcase";
import { cn } from "@/lib/utils";

/**
 * One recorded walkthrough: the MP4 (attached only when the player nears the viewport, so the page
 * does not fetch three videos up front) and its steps, which double as the transcript. Pressing a
 * step jumps the video to it, and the step on screen is highlighted while the video plays.
 */
export function WalkthroughPlayer({
  title,
  steps,
  cues,
  media,
  width,
  height,
}: {
  title: string;
  steps: readonly string[];
  /** When each step's caption appears, in seconds into the video. */
  cues: readonly number[];
  media: { mp4: string; poster: string; captions: string };
  width: number;
  height: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function onTimeUpdate() {
    const t = videoRef.current?.currentTime ?? 0;
    let k = -1;
    for (let i = 0; i < cues.length; i++) if (t + 0.05 >= cues[i]) k = i;
    const step = k >= 0 ? k : null;
    setCurrent((prev) => (prev === step ? prev : step));
  }

  function jumpTo(i: number) {
    const v = videoRef.current;
    if (!v) return;
    setNear(true);
    const seek = () => {
      v.currentTime = cues[i] ?? 0;
      void v.play().catch(() => undefined);
    };
    if (v.readyState >= 1) seek();
    else v.addEventListener("loadedmetadata", seek, { once: true });
    setCurrent(i);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
      <div>
        <video
          ref={videoRef}
          src={near ? media.mp4 : undefined}
          poster={media.poster}
          width={width}
          height={height}
          controls
          muted
          playsInline
          preload="metadata"
          aria-label={`${title}: silent screen recording with on-screen captions; the steps alongside are its transcript`}
          onTimeUpdate={onTimeUpdate}
          className="block aspect-[8/5] h-auto w-full rounded-xl border bg-muted shadow-sm"
        >
          {/* the step banner is burned into the video; this track is for caption readers */}
          <track kind="captions" src={media.captions} srcLang="en" label="English (steps)" />
        </video>
        <p className="mt-2 text-xs text-muted-foreground">
          No sound; the caption banner is part of the recording.{" "}
          <a href={media.mp4} className="link">
            Download the MP4
          </a>{" "}
          or the{" "}
          <a href={media.captions} className="link">
            captions (WebVTT)
          </a>
          .
        </p>
      </div>
      <div>
        <h3 className="eyebrow mb-3">Steps and transcript</h3>
        <ol className="space-y-1">
          {steps.map((step, i) => (
            <li key={step}>
              <button
                type="button"
                onClick={() => jumpTo(i)}
                aria-current={current === i ? "step" : undefined}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                  current === i && "bg-muted",
                )}
              >
                {/* the time is announced by the sr-only prefix below */}
                <span
                  aria-hidden
                  className={cn(
                    "num mt-px inline-flex min-w-[3.25rem] shrink-0 items-center justify-center gap-1 rounded-md border bg-card px-1.5 py-0.5 text-[0.7rem] text-muted-foreground",
                    current === i && "border-foreground bg-foreground text-background",
                  )}
                >
                  <Play className="size-2.5" aria-hidden />
                  {clock(cues[i] ?? 0)}
                </span>
                <span className="leading-snug text-muted-foreground group-aria-[current=step]:text-foreground">
                  <span className="sr-only">
                    Step {i + 1} of {steps.length}, play from {clock(cues[i] ?? 0)}:{" "}
                  </span>
                  {step}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
