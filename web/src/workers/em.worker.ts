/**
 * Web Worker for EM loops that can take more than a few milliseconds: long
 * playground runs on big generated data, restart galleries, the
 * label-switching census and the re-runs on /inference. The maths is the same module the pages use.
 */
import { fit } from "@/lib/em/em";
import { runRestarts } from "@/lib/em/restarts";
import { runInferenceTask } from "@/lib/inference/tasks";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

ctx.onmessage = (event) => {
  const request = event.data;
  try {
    if (request.kind === "fit") {
      const { data, init, options } = request.payload;
      ctx.postMessage({ id: request.id, ok: true, kind: "fit", result: fit(data, init, options) });
    } else if (request.kind === "inference") {
      ctx.postMessage({
        id: request.id,
        ok: true,
        kind: "inference",
        result: runInferenceTask(request.payload),
      });
    } else {
      ctx.postMessage({
        id: request.id,
        ok: true,
        kind: "restarts",
        result: runRestarts(request.payload),
      });
    }
  } catch (error) {
    ctx.postMessage({ id: request.id, ok: false, error: String(error) });
  }
};
