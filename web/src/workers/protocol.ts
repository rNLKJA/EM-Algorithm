import type { RestartConfig, RestartSummary } from "@/lib/em/restarts";
import type { InferenceTask, InferenceTaskResult } from "@/lib/inference/tasks";
import type { FitOptions, FitResult, MixtureParams } from "@/lib/em/types";

export interface FitPayload {
  data: number[];
  init: MixtureParams;
  options: FitOptions;
}

export type WorkerRequest =
  | { id: number; kind: "fit"; payload: FitPayload }
  | { id: number; kind: "restarts"; payload: RestartConfig }
  | { id: number; kind: "inference"; payload: InferenceTask };

export type WorkerResponse =
  | { id: number; ok: true; kind: "fit"; result: FitResult }
  | { id: number; ok: true; kind: "restarts"; result: RestartSummary }
  | { id: number; ok: true; kind: "inference"; result: InferenceTaskResult }
  | { id: number; ok: false; error: string };
