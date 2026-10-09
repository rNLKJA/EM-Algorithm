"use client";

import { useElementWidth } from "@/hooks/use-element-width";
import { linePath, linearScale, niceTicks } from "@/lib/charts/scale";
import type { Histogram } from "@/lib/inference/histogram";
import { chiSquarePdf } from "@/lib/stats/distributions";
import { cn } from "@/lib/utils";
import { fmt } from "./format";

const M = { top: 26, right: 16, bottom: 32, left: 16 };

/**
 * The bootstrap null distribution of the LRT statistic (bars, as a density)
 * against the χ² density the textbook test would use, with both 95% points
 * and the observed statistic.
 */
export function LrtPlot({
  histogram,
  total,
  df,
  null95,
  chi95,
  observed,
  className,
}: {
  histogram: Histogram;
  total: number;
  df: number;
  null95: number;
  chi95: number;
  observed: number;
  className?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  const height = 270;
  const xMaxData = histogram.x0 + histogram.width * histogram.counts.length;
  const base95 = Math.max(xMaxData, chi95, null95);
  // show the observed statistic on the axis unless it is far out in the tail
  const observedOff = observed > 2.5 * base95;
  const xMax = (observedOff ? base95 : Math.max(base95, observed)) * 1.06;
  const x = linearScale([0, xMax], [M.left, width - M.right - (observedOff ? 64 : 0)]);
  const density = histogram.counts.map((c) => c / (total * histogram.width));
  const grid = Array.from({ length: 160 }, (_, i) => 0.05 + (i / 159) * (xMax - 0.05));
  const chi = grid.map((v) => chiSquarePdf(v, df));
  const yMax = Math.max(...density, ...chi.slice(4)) * 1.08;
  const base = height - M.bottom;
  const y = linearScale([0, yMax], [base, M.top]);
  const ticks = niceTicks(0, xMax, width < 480 ? 4 : 8);
  const right = width - M.right;

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Bootstrap null distribution of the likelihood-ratio statistic from ${total} simulated data sets, against the chi-square density with ${df} degrees of freedom. The bootstrap 95% point is ${fmt(null95)}, the chi-square 95% point ${fmt(chi95)}, and the observed statistic ${fmt(observed)}.`}
        className="block max-w-full"
      >
        {histogram.counts.map((c, i) => {
          const x0 = x(histogram.x0 + i * histogram.width);
          const x1 = x(histogram.x0 + (i + 1) * histogram.width);
          return c > 0 ? (
            <rect
              key={i}
              x={x0 + 0.5}
              y={y(density[i])}
              width={Math.max(0.5, x1 - x0 - 1)}
              height={base - y(density[i])}
              rx={1}
              className="fill-comp-1/35"
            />
          ) : null;
        })}
        <path
          d={linePath(grid.map((v, i) => [x(v), y(Math.min(chi[i], yMax * 1.2))]))}
          fill="none"
          stroke="var(--comp-2)"
          strokeWidth={2}
          strokeDasharray="6 4"
          aria-hidden
        />
        {[
          { v: chi95, colour: "var(--comp-2-ink)" },
          { v: null95, colour: "var(--comp-1-ink)" },
        ].map((m) => (
          <line
            key={m.colour}
            x1={x(m.v)}
            x2={x(m.v)}
            y1={M.top - 4}
            y2={base}
            stroke={m.colour}
            strokeWidth={1.6}
            aria-hidden
          />
        ))}
        {observedOff ? (
          <g aria-hidden>
            <path
              d={`M${right - 58},${base - 40}L${right - 6},${base - 40}`}
              stroke="currentColor"
              strokeWidth={1.6}
            />
            <path
              d={`M${right - 10},${base - 45}L${right - 2},${base - 40}L${right - 10},${base - 35}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
            />
            <text
              x={right - 2}
              y={base - 50}
              textAnchor="end"
              className="hand"
              style={{ fontSize: 17, fill: "currentColor" }}
            >
              observed {fmt(observed, 1)}
            </text>
          </g>
        ) : (
          <g aria-hidden>
            <line
              x1={x(observed)}
              x2={x(observed)}
              y1={M.top - 4}
              y2={base}
              stroke="currentColor"
              strokeWidth={2.2}
            />
            <text
              x={x(observed) - 5}
              y={M.top + 8}
              textAnchor="end"
              className="hand"
              style={{ fontSize: 18, fill: "currentColor" }}
            >
              observed
            </text>
          </g>
        )}
        <line
          x1={M.left}
          x2={right}
          y1={base}
          y2={base}
          stroke="currentColor"
          strokeOpacity={0.45}
        />
        {ticks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={base + 15}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px]"
            aria-hidden
          >
            {t}
          </text>
        ))}
        <text
          x={right}
          y={height - 2}
          textAnchor="end"
          className="fill-muted-foreground text-[10.5px]"
          aria-hidden
        >
          2(<tspan className="ell">ℓ</tspan>₂ − <tspan className="ell">ℓ</tspan>₁)
        </text>
      </svg>
    </div>
  );
}
