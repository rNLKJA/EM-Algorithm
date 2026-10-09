"use client";

import { useCallback, useEffect, useRef } from "react";
import { fit } from "@/lib/em/em";
import { runRestarts, type RestartConfig, type RestartSummary } from "@/lib/em/restarts";
import type { FitResult } from "@/lib/em/types";
import type { FitPayload, WorkerRequest, WorkerResponse } from "@/workers/protocol";

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/**
 * One shared Web Worker per component tree for heavy EM loops. If workers are
 * unavailable (very old browsers, some test runners) the same functions run on
 * the main thread after a tick, so callers never need a second code path.
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
      worker.onerror = () => {
        for (const [, entry] of waiting) entry.reject(new Error("The EM worker crashed."));
        waiting.clear();
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
    const worker = workerRef.current;
    if (!worker) {
      return new Promise<T>((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(fallback());
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }, 0),
      );
    }
    const id = nextId.current++;
    return new Promise<T>((resolve, reject) => {
      pending.current.set(id, { resolve: resolve as (v: unknown) => void, reject });
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
