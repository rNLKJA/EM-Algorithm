"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True while an element scrolls vertically and has content hidden below its bottom
 * edge, so the caller can fade that edge (the playground's sticky settings column).
 */
export function useMoreBelow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);
  return [ref, moreBelow] as const;
}
