"use client";

import { useElementWidth } from "@/hooks/use-element-width";
import { linearScale, niceTicks } from "@/lib/charts/scale";
import type { ProportionEstimate } from "@/lib/stats/intervals";
import { cn } from "@/lib/utils";
import { pct } from "./format";

export interface CoverageSeries {
  id: string;
  label: string;
  colour: string;
  shape: "circle" | "square" | "diamond";
  /** one estimate per row, in row order */
  values: ProportionEstimate[];
}

const M = { top: 22, right: 14, bottom: 30, left: 44 };

/** Coverage rates with Wilson intervals, one row per parameter, one mark per method. */
export function CoveragePlot({
  rows,
  series,
  nominal = 0.95,
  ariaLabel,
  className,
}: {
  rows: string[];
  series: CoverageSeries[];
  nominal?: number;
  ariaLabel: string;
  className?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  const band = 22 + series.length * 12;
  const height = M.top + rows.length * band + M.bottom;
  const lows = series.flatMap((s) => s.values.map((v) => v.lower));
  const lo = Math.max(0, Math.min(0.75, Math.floor(Math.min(...lows) * 20) / 20));
  const x = linearScale([lo, 1], [M.left, width - M.right]);
  const ticks = niceTicks(lo, 1, width < 480 ? 4 : 6);

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
              y1={M.top - 6}
              y2={height - M.bottom}
              stroke="currentColor"
              strokeOpacity={0.07}
            />
            <text
              x={x(t)}
              y={height - M.bottom + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {pct(t, 0)}
            </text>
          </g>
        ))}
        <line
          x1={x(nominal)}
          x2={x(nominal)}
          y1={M.top - 10}
          y2={height - M.bottom}
          stroke="var(--correction)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          aria-hidden
        />
        <text
          x={x(nominal)}
          y={M.top - 12}
          textAnchor="middle"
          className="hand"
          style={{ fill: "var(--correction)", fontSize: 16 }}
          aria-hidden
        >
          nominal 95%
        </text>
        {rows.map((row, r) => {
          const y0 = M.top + r * band;
          return (
            <g key={row}>
              {r > 0 && (
                <line
                  x1={M.left - 40}
                  x2={width - M.right}
                  y1={y0}
                  y2={y0}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  aria-hidden
                />
              )}
              <text
                x={M.left - 10}
                y={y0 + band / 2}
                dy="0.32em"
                textAnchor="end"
                className="fill-foreground text-[13px]"
                aria-hidden
              >
                {row}
              </text>
              {series.map((s, i) => {
                const v = s.values[r];
                const cy = y0 + 11 + i * 12 + 4;
                const cx = x(v.estimate);
                return (
                  <g key={s.id} aria-hidden>
                    <line
                      x1={x(v.lower)}
                      x2={x(v.upper)}
                      y1={cy}
                      y2={cy}
                      stroke={s.colour}
                      strokeWidth={1.8}
                    />
                    {s.shape === "circle" ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={s.colour}
                        stroke="var(--card)"
                        strokeWidth={1.2}
                      />
                    ) : s.shape === "square" ? (
                      <rect
                        x={cx - 3.8}
                        y={cy - 3.8}
                        width={7.6}
                        height={7.6}
                        fill={s.colour}
                        stroke="var(--card)"
                        strokeWidth={1.2}
                      />
                    ) : (
                      <path
                        d={`M${cx},${cy - 5}L${cx + 5},${cy}L${cx},${cy + 5}L${cx - 5},${cy}Z`}
                        fill={s.colour}
                        stroke="var(--card)"
                        strokeWidth={1.2}
                      />
                    )}
                  </g>
                );
              })}
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
          share of intervals containing the true value
        </text>
      </svg>
    </div>
  );
}

export function SeriesKey({ series }: { series: CoverageSeries[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {series.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <svg viewBox="0 0 24 12" className="h-3 w-6" aria-hidden>
            <line x1="1" x2="23" y1="6" y2="6" stroke={s.colour} strokeWidth="1.8" />
            {s.shape === "circle" ? (
              <circle cx="12" cy="6" r="4" fill={s.colour} />
            ) : s.shape === "square" ? (
              <rect x="8.2" y="2.2" width="7.6" height="7.6" fill={s.colour} />
            ) : (
              <path d="M12,1L17,6L12,11L7,6Z" fill={s.colour} />
            )}
          </svg>
          {s.label}
        </li>
      ))}
    </ul>
  );
}
