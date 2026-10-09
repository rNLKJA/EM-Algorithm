"use client";

import { useElementWidth } from "@/hooks/use-element-width";
import { linearScale, niceTicks } from "@/lib/charts/scale";
import type { Spread } from "@/lib/inference/convergence";
import { cn } from "@/lib/utils";

const M = { top: 8, right: 14, bottom: 30, left: 52 };

/**
 * Horizontal box plots (min, quartiles, median, max) of iterations to each
 * tolerance. A row's `marker` (e.g. the notebook's own start) is drawn as a
 * dashed tick inside that row only, so it never reads as a value for another
 * tolerance.
 */
export function IterationBoxes({
  rows,
  ariaLabel,
  className,
}: {
  rows: { label: string; spread: Spread; marker?: number | null }[];
  ariaLabel: string;
  className?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const band = 34;
  const height = M.top + rows.length * band + M.bottom;
  const max = Math.max(...rows.map((r) => Math.max(r.spread.max, r.marker ?? 0)));
  const x = linearScale([0, max * 1.05], [M.left, width - M.right]);
  const ticks = niceTicks(0, max * 1.05, width < 480 ? 4 : 7);
  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block max-w-full"
      >
        {ticks.map((t) => (
          <g key={t} aria-hidden>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={M.top}
              y2={height - M.bottom}
              stroke="currentColor"
              strokeOpacity={0.07}
            />
            <text
              x={x(t)}
              y={height - M.bottom + 15}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {t}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = M.top + i * band + band / 2;
          const s = r.spread;
          return (
            <g key={r.label} aria-hidden>
              <text
                x={M.left - 10}
                y={cy}
                dy="0.32em"
                textAnchor="end"
                className="fill-foreground font-mono text-[12px]"
              >
                {r.label}
              </text>
              <line
                x1={x(s.min)}
                x2={x(s.max)}
                y1={cy}
                y2={cy}
                stroke="currentColor"
                strokeOpacity={0.5}
              />
              <rect
                x={x(s.q1)}
                y={cy - 9}
                width={Math.max(1, x(s.q3) - x(s.q1))}
                height={18}
                rx={3}
                className="fill-comp-1/20 stroke-comp-1"
                strokeWidth={1.4}
              />
              <line
                x1={x(s.median)}
                x2={x(s.median)}
                y1={cy - 9}
                y2={cy + 9}
                stroke="var(--comp-1-ink)"
                strokeWidth={2.4}
              />
              <line
                x1={x(s.min)}
                x2={x(s.min)}
                y1={cy - 5}
                y2={cy + 5}
                stroke="currentColor"
                strokeOpacity={0.5}
              />
              <line
                x1={x(s.max)}
                x2={x(s.max)}
                y1={cy - 5}
                y2={cy + 5}
                stroke="currentColor"
                strokeOpacity={0.5}
              />
              {r.marker != null ? (
                <line
                  x1={x(r.marker)}
                  x2={x(r.marker)}
                  y1={cy - band / 2 + 3}
                  y2={cy + band / 2 - 3}
                  stroke="var(--correction)"
                  strokeDasharray="4 3"
                  strokeWidth={1.6}
                />
              ) : null}
            </g>
          );
        })}
        <text
          x={width - M.right}
          y={height - 2}
          textAnchor="end"
          className="fill-muted-foreground text-[10.5px]"
          aria-hidden
        >
          iterations
        </text>
      </svg>
    </div>
  );
}
