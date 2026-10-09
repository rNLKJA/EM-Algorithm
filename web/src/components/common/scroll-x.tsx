"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Overflow = { overflow: boolean; start: boolean; end: boolean };

/**
 * A sideways scroll box for wide equations and tables. Only when its content
 * actually overflows does it become a focusable, labelled region (so keyboard
 * users can scroll it with the arrow keys) and fade the edge that hides more
 * content, so readers can see there is more.
 */
export function ScrollX({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Overflow>({ overflow: false, start: true, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const overflow = el.scrollWidth > el.clientWidth + 1;
      const start = el.scrollLeft <= 1;
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      setState((s) =>
        s.overflow === overflow && s.start === start && s.end === end
          ? s
          : { overflow, start, end },
      );
    };
    // ResizeObserver reports once on observe, so this also measures the first layout
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("scroll-x", className)}
      data-fade-start={state.overflow && !state.start ? "" : undefined}
      data-fade-end={state.overflow && !state.end ? "" : undefined}
      tabIndex={state.overflow ? 0 : undefined}
      role={state.overflow ? "region" : undefined}
      aria-label={state.overflow ? `${label} (scrolls sideways)` : undefined}
    >
      {children}
    </div>
  );
}
