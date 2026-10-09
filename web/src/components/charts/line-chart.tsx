"use client";

import { useMemo } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import { linePath, linearScale, niceTicks } from "@/lib/charts/scale";
import { cn } from "@/lib/utils";

export interface Series {
  id: string;
  /** values[i] is plotted at x = xStart + i */
  values: number[];
  colour: string;
  dashed?: boolean;
  label: string;
  /** draw dots at each value (auto-off for long series) */
  dots?: boolean;
}

export interface LineChartProps {
  series: Series[];
  xStart?: number;
  /** highlight this x value with a cursor */
  cursor?: number | null;
  /** vertical marker lines, e.g. "notebook stops here" */
  markers?: { x: number; label: string }[];
  height?: number;
  yLabel: string;
  xLabel?: string;
  logY?: boolean;
  /** format for y tick labels */
  yFormat?: (v: number) => string;
  ariaLabel: string;
  className?: string;
}

const M = { top: 14, right: 16, bottom: 34, left: 58 };

/**
 * Small multi-series line chart (log-likelihood traces, sigma traces). Non-finite
 * values break the line and are flagged with a cross at the top edge.
 */
export function LineChart({
  series,
  xStart = 1,
  cursor = null,
  markers = [],
  height = 220,
  yLabel,
  xLabel = "iteration",
  logY = false,
  yFormat,
  ariaLabel,
  className,
}: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = Math.max(10, height - M.top - M.bottom);

  const tf = (v: number) => (logY ? (v > 0 ? Math.log10(v) : Number.NaN) : v);

  const { xMax, yLo, yHi } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    let n = 0;
    for (const s of series) {
      n = Math.max(n, s.values.length);
      for (const v of s.values) {
        const t = tf(v);
        if (!Number.isFinite(t)) continue;
        lo = Math.min(lo, t);
        hi = Math.max(hi, t);
      }
    }
    if (!Number.isFinite(lo)) {
      lo = 0;
      hi = 1;
    }
    if (hi - lo < 1e-9) {
      lo -= 0.5;
      hi += 0.5;
    }
    const pad = (hi - lo) * 0.08;
    return { xMax: xStart + Math.max(1, n - 1), yLo: lo - pad, yHi: hi + pad };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, xStart, logY]);

  const x = linearScale([xStart, xMax], [M.left, M.left + innerW]);
  const y = linearScale([yLo, yHi], [M.top + innerH, M.top]);
  const yTicks = logY
    ? niceTicks(Math.ceil(yLo), Math.floor(yHi), 4).filter((t) => Number.isInteger(t))
    : niceTicks(yLo, yHi, 4);
  const xTicks = niceTicks(xStart, xMax, width < 480 ? 4 : 8).filter(
    (t) => Number.isInteger(t) && t >= xStart && t <= xMax,
  );
  const fmt = yFormat ?? ((v: number) => (logY ? `1e${v}` : String(Number(v.toFixed(2)))));

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="block max-w-full overflow-visible"
      >
        {yTicks.map((t) => (
          <g key={t} aria-hidden>
            <line
              x1={M.left}
              x2={M.left + innerW}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeOpacity={0.08}
            />
            <text
              x={M.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {fmt(t)}
            </text>
          </g>
        ))}
        <line
          x1={M.left}
          x2={M.left + innerW}
          y1={M.top + innerH}
          y2={M.top + innerH}
          stroke="currentColor"
          strokeOpacity={0.5}
        />
        {xTicks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={M.top + innerH + 16}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px]"
            aria-hidden
          >
            {t}
          </text>
        ))}
        <text
          x={M.left + innerW}
          y={height - 2}
          textAnchor="end"
          className="fill-muted-foreground text-[10.5px]"
        >
          {xLabel}
        </text>
        <text
          transform={`translate(12 ${M.top + innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-muted-foreground text-[10.5px]"
        >
          {yLabel}
        </text>

        {markers.map((m) => (
          <g key={`${m.x}-${m.label}`} aria-hidden>
            <line
              x1={x(m.x)}
              x2={x(m.x)}
              y1={M.top}
              y2={M.top + innerH}
              stroke="var(--correction)"
              strokeDasharray="4 3"
              strokeWidth={1.25}
            />
            <text
              x={x(m.x) + 6}
              y={M.top + 12}
              className="hand"
              style={{ fill: "var(--correction)", fontSize: 17 }}
            >
              {m.label}
            </text>
          </g>
        ))}

        {cursor !== null && cursor >= xStart && cursor <= xMax && (
          <line
            x1={x(cursor)}
            x2={x(cursor)}
            y1={M.top}
            y2={M.top + innerH}
            stroke="currentColor"
            strokeOpacity={0.25}
            aria-hidden
          />
        )}

        {series.map((s) => {
          const pts = s.values.map((v, i) => [x(xStart + i), y(tf(v))] as [number, number]);
          const showDots = s.dots ?? s.values.length <= 40;
          return (
            <g key={s.id} aria-hidden>
              <path
                d={linePath(pts)}
                fill="none"
                stroke={s.colour}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                strokeLinejoin="round"
              />
              {showDots &&
                pts.map(([px, py], i) =>
                  Number.isFinite(py) ? (
                    <circle
                      key={i}
                      cx={px}
                      cy={py}
                      r={cursor === xStart + i ? 4.5 : 2.6}
                      fill={cursor === xStart + i ? s.colour : "var(--card)"}
                      stroke={s.colour}
                      strokeWidth={1.6}
                    />
                  ) : null,
                )}
              {s.values.map((v, i) =>
                Number.isFinite(tf(v)) ? null : (
                  <g key={`bad${i}`} transform={`translate(${x(xStart + i)} ${M.top + 6})`}>
                    <path d="M-5,-5L5,5M5,-5L-5,5" stroke="var(--destructive)" strokeWidth={2} />
                    <text
                      x={7}
                      y={4}
                      className="font-mono text-[10px]"
                      style={{ fill: "var(--destructive)" }}
                    >
                      {Number.isNaN(v) ? "NaN" : logY && v === 0 ? "0" : v > 0 ? "∞" : "−∞"}
                    </text>
                  </g>
                ),
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
