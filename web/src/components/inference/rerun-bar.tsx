"use client";

import { Check, Cpu, Loader2, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Published with seed 42 · run it yourself": a seed box, a run button and the
 * outcome, including whether a re-run with the published seed reproduced it.
 */
export function RerunBar({
  what,
  seed,
  publishedSeed,
  published,
  running,
  seconds,
  reproduced,
  error,
  onRun,
  onReset,
  className,
}: {
  /** e.g. "B = 1,000 bootstrap data sets" */
  what: string;
  seed: number;
  publishedSeed: number;
  published: boolean;
  running: boolean;
  seconds: number | null;
  reproduced: boolean | null;
  error: string | null;
  onRun: (seed: number) => void;
  onReset: () => void;
  className?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(publishedSeed));
  const parsed = Number(draft);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed < 2 ** 31;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-muted/40 px-3.5 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="min-w-0 text-muted-foreground">
        {published ? (
          <>
            Published result: <span className="num text-foreground">seed {publishedSeed}</span>,{" "}
            {what}.
          </>
        ) : (
          <>
            Your run in this browser: <span className="num text-foreground">seed {seed}</span>,{" "}
            {what}
            {seconds !== null ? `, ${seconds.toFixed(1)} s` : ""}.
          </>
        )}
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onRun(parsed);
        }}
      >
        <label htmlFor={id} className="text-xs text-muted-foreground">
          seed
        </label>
        <input
          id={id}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          className="num h-8 w-20 rounded-md border border-input bg-background px-2 text-sm"
          aria-invalid={!valid}
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={running || !valid}
          className="rounded-full"
        >
          {running ? (
            <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
          ) : (
            <Cpu data-icon="inline-start" aria-hidden />
          )}
          {running ? "Running…" : "Run in your browser"}
        </Button>
        {!published ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="rounded-full"
          >
            <RotateCcw data-icon="inline-start" aria-hidden /> Published
          </Button>
        ) : null}
      </form>
      <div aria-live="polite" className="w-full empty:hidden">
        {error ? <p className="text-xs text-destructive">The run failed: {error}</p> : null}
        {reproduced === true ? (
          <p className="flex items-center gap-1.5 text-xs text-ok">
            <Check className="size-3.5" aria-hidden /> Same seed, same numbers: your browser
            reproduced the published result.
          </p>
        ) : reproduced === false ? (
          <p className="text-xs text-destructive">
            Same seed, different numbers: the published artefact is out of date.
          </p>
        ) : null}
      </div>
    </div>
  );
}
