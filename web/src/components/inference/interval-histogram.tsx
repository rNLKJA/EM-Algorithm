"use client";

import { useElementWidth } from "@/hooks/use-element-width";
import { linearScale, niceTicks } from "@/lib/charts/scale";
import type { Histogram } from "@/lib/inference/histogram";
import type { Interval } from "@/lib/stats/intervals";
import { cn } from "@/lib/utils";
import { fmt } from "./format";

const M = { top: 10, right: 10, bottom: 30, left: 10 };

/**
 * Bootstrap distribution of one parameter: bars, the estimate (solid line), the
 * percentile interval (shaded), the Wald interval (bracket above) and the true
 * value (dotted).
 */
export function IntervalHistogram({
  histogram,
  estimate,
  percentile,
  wald,
  truth,
  digits,
  title,
  className,
}: {
  histogram: Histogram;
  estimate: number;
  percentile: Interval;
  wald: Interval | null;
  truth: number;
  digits: number;
  title: string;
  className?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(240);
  const height = 132;
  const lo = Math.min(histogram.x0, truth, wald?.lower ?? Infinity);
  const hi = Math.max(
    histogram.x0 + histogram.width * histogram.counts.length,
    truth,
    wald?.upper ?? -Infinity,
  );
  const pad = (hi - lo) * 0.04;
  const x = linearScale([lo - pad, hi + pad], [M.left, width - M.right]);
  const maxCount = Math.max(1, ...histogram.counts);
  const base = height - M.bottom;
  const top = M.top + 14;
  const y = linearScale([0, maxCount], [base, top]);
  const ticks = niceTicks(lo, hi, width < 260 ? 3 : 4);

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: bootstrap distribution. Estimate ${fmt(estimate, digits)}, 95% percentile interval ${fmt(percentile.lower, digits)} to ${fmt(percentile.upper, digits)}${wald ? `, Wald interval ${fmt(wald.lower, digits)} to ${fmt(wald.upper, digits)}` : ""}, true value ${fmt(truth, digits)}.`}
        className="block max-w-full"
      >
        <rect
          x={x(percentile.lower)}
          y={top}
          width={Math.max(0, x(percentile.upper) - x(percentile.lower))}
          height={base - top}
          className="fill-comp-1/12"
        />
        {histogram.counts.map((c, i) => {
          const x0 = x(histogram.x0 + i * histogram.width);
          const x1 = x(histogram.x0 + (i + 1) * histogram.width);
          return c > 0 ? (
            <rect
              key={i}
              x={x0 + 0.5}
              y={y(c)}
              width={Math.max(0.5, x1 - x0 - 1)}
              height={base - y(c)}
              rx={1}
              className="fill-foreground/25"
            />
          ) : null;
        })}
        {wald ? (
          <g aria-hidden stroke="var(--comp-2)" strokeWidth={1.6}>
            <line x1={x(wald.lower)} x2={x(wald.upper)} y1={M.top + 4} y2={M.top + 4} />
            <line x1={x(wald.lower)} x2={x(wald.lower)} y1={M.top} y2={M.top + 8} />
            <line x1={x(wald.upper)} x2={x(wald.upper)} y1={M.top} y2={M.top + 8} />
          </g>
        ) : null}
        <line
          x1={x(estimate)}
          x2={x(estimate)}
          y1={top - 2}
          y2={base}
          stroke="var(--comp-1)"
          strokeWidth={2}
        />
        <line
          x1={x(truth)}
          x2={x(truth)}
          y1={top - 2}
          y2={base}
          stroke="currentColor"
          strokeOpacity={0.75}
          strokeWidth={1.6}
          strokeDasharray="1.5 3.5"
          strokeLinecap="round"
        />
        <line
          x1={M.left}
          x2={width - M.right}
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
            {fmt(t, t % 1 === 0 ? 0 : (String(t).split(".")[1]?.length ?? 1))}
          </text>
        ))}
      </svg>
    </div>
  );
}
