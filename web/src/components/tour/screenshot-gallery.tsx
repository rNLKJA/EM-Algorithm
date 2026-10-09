"use client";

import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface GalleryItem {
  id: string;
  title: string;
  caption: string;
  viewport: "desktop" | "mobile";
  full: { src: string; width: number; height: number };
  thumb: { src: string; width: number; height: number };
}

/** A title as a sentence: adds a full stop unless it already ends in one (or ? or !). */
const sentence = (t: string) => (/[.?!]$/.test(t) ? t : `${t}.`);

/**
 * Screenshot grid with a lightbox. Thumbnails are half-size WebP copies, lazy-loaded; the full
 * image loads only when opened. Arrow keys (or the buttons) move through the set inside the
 * lightbox, and Escape closes it.
 */
export function ScreenshotGallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const desktop = items.filter((s) => s.viewport === "desktop");
  const mobile = items.filter((s) => s.viewport === "mobile");
  const current = open === null ? null : items[open];

  const step = (delta: number) =>
    setOpen((i) => (i === null ? i : (i + delta + items.length) % items.length));

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setOpen((i) => (i === null ? i : (i + 1) % items.length));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setOpen((i) => (i === null ? i : (i - 1 + items.length) % items.length));
      }
    };
    // capture phase: the dialog's focus management handles key events before they bubble
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, items.length]);

  const tile = (s: GalleryItem, sizes: string) => (
    <li key={s.id}>
      <figure className="group">
        <button
          type="button"
          onClick={() => setOpen(items.indexOf(s))}
          className="relative block w-full overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden"
          aria-label={`Enlarge screenshot: ${s.title}`}
        >
          <Image
            src={s.thumb.src}
            width={s.thumb.width}
            height={s.thumb.height}
            sizes={sizes}
            alt={`${sentence(s.title)} ${s.caption}`}
            unoptimized
            className="block h-auto w-full"
          />
          <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-md border bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Maximize2 className="size-3.5" aria-hidden />
          </span>
        </button>
        <figcaption className="mt-2 text-sm leading-snug">
          <span className="font-medium">{sentence(s.title)}</span>{" "}
          <span className="text-muted-foreground">{s.caption}</span>
        </figcaption>
      </figure>
    </li>
  );

  return (
    <>
      <ul className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {desktop.map((s) => tile(s, "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"))}
      </ul>
      {mobile.length > 0 ? (
        <>
          <h3 className="mt-12 mb-4 text-xl font-semibold">On a phone (390 px wide)</h3>
          <ul className="grid max-w-3xl grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3">
            {mobile.map((s) => tile(s, "(min-width: 640px) 240px, 50vw"))}
          </ul>
        </>
      ) : null}

      <Dialog open={current !== null} onOpenChange={(o) => (o ? undefined : setOpen(null))}>
        {current && open !== null ? (
          <DialogContent className="w-[min(72rem,calc(100vw-1.5rem))] max-w-none">
            <DialogHeader>
              <DialogTitle>{current.title}</DialogTitle>
              <DialogDescription>{current.caption}</DialogDescription>
            </DialogHeader>
            <Image
              key={current.id}
              src={current.full.src}
              width={current.full.width}
              height={current.full.height}
              sizes="(min-width: 1152px) 1100px, 100vw"
              alt={`${sentence(current.title)} ${current.caption}`}
              unoptimized
              className={cn(
                "mx-auto block h-auto w-auto max-w-full rounded-lg border",
                current.viewport === "mobile"
                  ? "max-h-[calc(100dvh-14rem)]"
                  : "max-h-[calc(100dvh-13rem)]",
              )}
            />
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => step(-1)}
                aria-label="Previous screenshot"
                className="rounded-full"
              >
                <ChevronLeft aria-hidden /> Previous
              </Button>
              <p className="num text-xs text-muted-foreground" aria-live="polite">
                {open + 1} / {items.length}
              </p>
              <Button
                variant="outline"
                onClick={() => step(1)}
                aria-label="Next screenshot"
                className="rounded-full"
              >
                Next <ChevronRight aria-hidden />
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
