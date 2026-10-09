"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ParamSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format = (v) => v.toFixed(2),
  accent,
  disabled,
  hint,
}: {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  /** colour the track for component 1 / 2 */
  accent?: 1 | 2;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  const range = accent === 1 ? "bg-comp-1" : accent === 2 ? "bg-comp-2" : "bg-foreground/70";
  return (
    <div className={cn("space-y-2", disabled && "opacity-50")}>
      <div className="flex items-baseline justify-between gap-3">
        <label id={id} className="text-sm font-medium">
          {label}
        </label>
        <output aria-hidden className="num text-sm text-muted-foreground">
          {format(value)}
        </output>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0])}
        className="relative flex h-5 w-full touch-none items-center select-none"
      >
        <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className={cn("absolute h-full", range)} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-labelledby={id}
          aria-valuetext={format(value)}
          className="block size-4.5 rounded-full border-2 border-foreground/80 bg-card shadow-sm transition-[box-shadow] outline-none hover:ring-4 hover:ring-ring/20 focus-visible:ring-4 focus-visible:ring-ring/40"
        />
      </SliderPrimitive.Root>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
