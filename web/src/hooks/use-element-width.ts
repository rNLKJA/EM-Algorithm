"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Track an element's content width with a ResizeObserver (falls back to `initial` on the server). */
export function useElementWidth<T extends HTMLElement>(initial = 720) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
