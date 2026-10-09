"use client";

import { useEffect, useRef, useState } from "react";
import type { MixtureParams } from "@/lib/em/types";
import { PARAM_KEYS } from "@/lib/em/types";
import { useReducedMotion } from "./use-reduced-motion";

function lerpParams(a: MixtureParams, b: MixtureParams, t: number): MixtureParams {
  const out = { ...b };
  for (const k of PARAM_KEYS) {
    const from = a[k];
    const to = b[k];
    out[k] = Number.isFinite(from) && Number.isFinite(to) ? from + (to - from) * t : to;
  }
  return out;
}

const ease = (t: number) => 1 - (1 - t) ** 3;

/** Smoothly animate the drawn mixture between EM iterations (instant with reduced motion). */
export function useTweenedParams(target: MixtureParams, duration = 420): MixtureParams {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const from = shownRef.current;
    if (reduced || duration <= 0) {
      shownRef.current = target;
      frame.current = requestAnimationFrame(() => setShown(target));
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = lerpParams(from, target, ease(t));
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, reduced]);

  return shown;
}
