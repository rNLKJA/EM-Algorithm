"use client";

import { useCallback, useState } from "react";
import { useEmWorker } from "@/hooks/use-em-worker";
import type { InferenceTask, InferenceTaskResult } from "@/lib/inference/tasks";

type Kind = InferenceTask["task"];
type ResultOf<K extends Kind> = Extract<InferenceTaskResult, { task: K }>["result"];

function buildTask(kind: Kind, size: number, seed: number): InferenceTask {
  if (kind === "bootstrap") return { task: kind, seed, B: size };
  if (kind === "coverage") return { task: kind, seed, S: size };
  return { task: kind, seed, starts: size };
}

export interface RerunState<K extends Kind> {
  /** what to show: the published result, or the reader's own run */
  result: ResultOf<K>;
  seed: number;
  published: boolean;
  running: boolean;
  /** seconds the last run took in this browser */
  seconds: number | null;
  /** the last run used the published seed and reproduced the published numbers */
  reproduced: boolean | null;
  error: string | null;
  run: (seed: number) => void;
  reset: () => void;
}

/** True when every number in a and b agrees to `rel` (the artefact keeps 10 significant digits). */
export function sameNumbers(a: unknown, b: unknown, rel = 1e-8): boolean {
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => sameNumbers(v, b[i], rel));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    return (
      ka.length === Object.keys(b as object).length &&
      ka.every((k) =>
        sameNumbers((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], rel),
      )
    );
  }
  return a === b;
}

/**
 * Re-run one of the /inference analyses in the Web Worker with a seed the reader
 * picks. `size` is B (bootstrap), S (coverage) or the number of starts (convergence).
 */
export function useRerun<K extends Kind>(
  kind: K,
  size: number,
  published: ResultOf<K>,
  publishedSeed: number,
): RerunState<K> {
  const { runInference } = useEmWorker();
  // stored untyped: TypeScript cannot narrow ResultOf<K> through the worker's union
  const [own, setOwn] = useState<{ seed: number; result: unknown; seconds: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (seed: number) => {
      setRunning(true);
      setError(null);
      const t0 = performance.now();
      runInference(buildTask(kind, size, seed))
        .then((r) => {
          setOwn({ seed, result: r.result, seconds: (performance.now() - t0) / 1000 });
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setRunning(false));
    },
    [runInference, kind, size],
  );

  return {
    result: own ? (own.result as ResultOf<K>) : published,
    seed: own?.seed ?? publishedSeed,
    published: own === null,
    running,
    seconds: own?.seconds ?? null,
    reproduced: own && own.seed === publishedSeed ? sameNumbers(own.result, published) : null,
    error,
    run,
    reset: () => setOwn(null),
  };
}
