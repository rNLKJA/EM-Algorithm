"use client";

import { useCallback, useEffect, useRef } from "react";
import { fit } from "@/lib/em/em";
import { runRestarts, type RestartConfig, type RestartSummary } from "@/lib/em/restarts";
import type { FitResult } from "@/lib/em/types";
import type { FitPayload, WorkerRequest, WorkerResponse } from "@/workers/protocol";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  /** the same computation on the main thread, used if the worker dies */
  fallback: () => unknown;
};

/** Run `fallback` on the main thread after a tick, so the UI can paint a spinner first. */
function settleLater(
  fallback: () => unknown,
  resolve: (value: unknown) => void,
  reject: (error: Error) => void,
) {
  setTimeout(() => {
    try {
      resolve(fallback());
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }, 0);
}

/**
 * One shared Web Worker per component tree for heavy EM loops. If workers are
 * unavailable (very old browsers, some test runners), or the worker fails to
 * load or crashes, the same functions run on the main thread after a tick, so
 * callers never need a second code path and no request is left hanging.
 */
export function useEmWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);

  useEffect(() => {
    const waiting = pending.current;
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("../workers/em.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        const entry = waiting.get(message.id);
        if (!entry) return;
        waiting.delete(message.id);
        if (message.ok) entry.resolve(message.result);
        else entry.reject(new Error(message.error));
      };
      worker.onerror = (event) => {
        // The script failed to load or threw at the top level. Retire it and finish
        // everything still waiting on the main thread; later requests go there too.
        event.preventDefault();
        worker?.terminate();
        workerRef.current = null;
        const stranded = [...waiting.values()];
        waiting.clear();
        for (const entry of stranded) settleLater(entry.fallback, entry.resolve, entry.reject);
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }
    return () => {
      worker?.terminate();
      workerRef.current = null;
      waiting.clear();
    };
  }, []);

  const post = useCallback(<T>(request: Omit<WorkerRequest, "id">, fallback: () => T) => {
    return new Promise<T>((resolve, reject) => {
      const done = resolve as (value: unknown) => void;
      const worker = workerRef.current;
      if (!worker) {
        settleLater(fallback, done, reject);
        return;
      }
      const id = nextId.current++;
      pending.current.set(id, { resolve: done, reject, fallback });
      worker.postMessage({ ...request, id } as WorkerRequest);
    });
  }, []);

  const runFit = useCallback(
    (payload: FitPayload) =>
      post<FitResult>({ kind: "fit", payload }, () =>
        fit(payload.data, payload.init, payload.options),
      ),
    [post],
  );

  const runRestartsAsync = useCallback(
    (payload: RestartConfig) =>
      post<RestartSummary>({ kind: "restarts", payload }, () => runRestarts(payload)),
    [post],
  );

  return { runFit, runRestarts: runRestartsAsync };
}
