"use client";

import { useEffect, useMemo, useState } from "react";
import { useEmWorker } from "@/hooks/use-em-worker";
import { fit } from "@/lib/em/em";
import { kmeansPlusPlusInit, manualInit, notebookRandomInit } from "@/lib/em/init";
import { NOTEBOOK_GROUP_NAMES, notebookRun } from "@/lib/em/notebook-run";
import { createRng, generateRatings } from "@/lib/em/rng";
import type { FitOptions, FitResult, MixtureParams } from "@/lib/em/types";

export type DataSource = "notebook" | "custom";
export type InitStrategy = "notebook" | "kmeans++" | "manual";

export interface GenConfig {
  n: number;
  pi1: number;
  mu1: number;
  mu2: number;
  sigma1: number;
  sigma2: number;
  seed: number;
  clip: boolean;
}

export interface PlaygroundConfig {
  source: DataSource;
  gen: GenConfig;
  init: InitStrategy;
  /** 0 means "the notebook's own NumPy draw" when the data is the notebook's */
  initSeed: number;
  manual: { mu1: number; mu2: number; sigma1: number; sigma2: number };
  maxIterations: number;
  tolerance: number;
  floorOn: boolean;
  floor: number;
}

export const DEFAULT_CONFIG: PlaygroundConfig = {
  source: "notebook",
  gen: { n: 200, pi1: 0.6, mu1: 7.5, mu2: 4, sigma1: 1.2, sigma2: 1.5, seed: 2025, clip: true },
  init: "notebook",
  initSeed: 0,
  manual: { mu1: 3, mu2: 8.5, sigma1: 1, sigma2: 1 },
  maxIterations: notebookRun.fit.maxIterations,
  tolerance: notebookRun.fit.tolerance,
  floorOn: false,
  floor: 0.1,
};

/** Above this many point-iterations the fit runs in the Web Worker. */
const SYNC_BUDGET = 300_000;

export interface Dataset {
  ratings: number[];
  groups: number[];
  truth: MixtureParams;
  groupNames: [string, string];
  original: boolean;
}

export interface InitInfo {
  params: MixtureParams;
  description: string;
}

export function usePlaygroundModel(config: PlaygroundConfig) {
  const { runFit } = useEmWorker();
  const { gen, source } = config;

  const dataset: Dataset = useMemo(() => {
    if (source === "notebook") {
      return {
        ratings: notebookRun.ratings,
        groups: notebookRun.trueGroups,
        truth: notebookRun.trueParams,
        groupNames: [...NOTEBOOK_GROUP_NAMES],
        original: true,
      };
    }
    const { ratings, trueGroups } = generateRatings({
      n: gen.n,
      pi1: gen.pi1,
      mu1: gen.mu1,
      mu2: gen.mu2,
      sigma1: gen.sigma1,
      sigma2: gen.sigma2,
      seed: gen.seed,
      clip: gen.clip ? [1, 10] : null,
    });
    return {
      ratings,
      groups: trueGroups,
      truth: {
        pi1: gen.pi1,
        pi2: 1 - gen.pi1,
        mu1: gen.mu1,
        mu2: gen.mu2,
        sigma1: gen.sigma1,
        sigma2: gen.sigma2,
      },
      groupNames: ["Group 1", "Group 2"],
      original: false,
    };
  }, [source, gen.n, gen.pi1, gen.mu1, gen.mu2, gen.sigma1, gen.sigma2, gen.seed, gen.clip]);

  const init: InitInfo = useMemo(() => {
    if (config.init === "manual") {
      const m = config.manual;
      return {
        params: manualInit(m.mu1, m.mu2, m.sigma1, m.sigma2),
        description: "Your guess: the means you dragged, π = 0.5 each.",
      };
    }
    if (config.init === "kmeans++") {
      const r = kmeansPlusPlusInit(dataset.ratings, createRng(config.initSeed + 1));
      return {
        params: r.params,
        description: `k-means++ seeds at ${r.seeds[0].toFixed(2)} and ${r.seeds[1].toFixed(2)}, then ${r.lloydIterations} rounds of k-means.`,
      };
    }
    if (source === "notebook" && config.initSeed === 0) {
      return {
        params: notebookRun.init,
        description:
          "The notebook's own random start: NumPy drew μ ~ U(3, 8) and σ ~ U(0.5, 2) right after generating the data.",
      };
    }
    return {
      params: notebookRandomInit(createRng(config.initSeed + 101)),
      description:
        "The notebook's recipe (μ ~ U(3, 8), σ ~ U(0.5, 2), π = 0.5), redrawn with this site's seeded generator.",
    };
  }, [config.init, config.manual, config.initSeed, dataset.ratings, source]);

  const options: FitOptions = useMemo(
    () => ({
      maxIterations: config.maxIterations,
      tolerance: config.tolerance,
      varianceFloor: config.floorOn ? config.floor : 0,
    }),
    [config.maxIterations, config.tolerance, config.floorOn, config.floor],
  );

  const sync = dataset.ratings.length * options.maxIterations <= SYNC_BUDGET;
  const syncResult = useMemo(
    () => (sync ? fit(dataset.ratings, init.params, options) : null),
    [sync, dataset.ratings, init.params, options],
  );

  const [asyncState, setAsyncState] = useState<{
    key: object;
    result: FitResult | null;
    error: string | null;
  } | null>(null);
  // a fresh object whenever the inputs change, so stale worker replies are ignored
  const asyncKey = useMemo(() => ({ dataset, init, options }), [dataset, init, options]);

  useEffect(() => {
    if (sync) return;
    let cancelled = false;
    runFit({ data: dataset.ratings, init: init.params, options })
      .then((result) => {
        if (!cancelled) setAsyncState({ key: asyncKey, result, error: null });
      })
      .catch((error: Error) => {
        if (!cancelled) setAsyncState({ key: asyncKey, result: null, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [sync, runFit, dataset.ratings, init.params, options, asyncKey]);

  const current = asyncState && asyncState.key === asyncKey ? asyncState : null;
  const result = sync ? syncResult : (current?.result ?? null);
  const pending = !sync && !current;
  const error = !sync ? (current?.error ?? null) : null;

  return { dataset, init, options, result, pending, error, inWorker: !sync };
}
