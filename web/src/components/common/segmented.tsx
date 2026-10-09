"use client";

import { ToggleGroup } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: string;
}

/** A single-choice segmented control (radio semantics, arrow-key navigation). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={ariaLabel}
      className={cn("inline-flex flex-wrap gap-1 rounded-xl border bg-muted/60 p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          title={o.description}
          className={cn(
            "flex-1 rounded-lg px-3 font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm",
            size === "sm" ? "h-7 text-[0.8rem]" : "h-8.5 text-sm",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
