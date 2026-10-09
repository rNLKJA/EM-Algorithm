import { useId } from "react";
import { linePath, linearScale } from "@/lib/charts/scale";
import { eStep } from "@/lib/em/em";
import { normalPdf } from "@/lib/em/gaussian";
import type { MixtureParams } from "@/lib/em/types";
import { histogram } from "@/lib/stats";
import { jitter, pointFill, triangle } from "@/lib/charts/marks";

export interface StaticMixtureProps {
  data: ArrayLike<number>;
  params: MixtureParams;
  truth?: MixtureParams | null;
  width?: number;
  height?: number;
  domain?: [number, number];
  histRange?: [number, number];
  bins?: number;
  rug?: boolean;
  annotate?: boolean;
  /** fixed y max so a grid of small multiples shares a scale */
  yMax?: number;
  ariaLabel: string;
  className?: string;
}

/**
 * A non-interactive mixture plot that scales with its viewBox. Pure render, so it
 * works in Server Components (landing page) and in big grids (restart gallery).
 */
export function StaticMixture({
  data,
  params,
  truth = null,
  width = 720,
  height = 320,
  domain = [0.5, 10.5],
  histRange = [1, 10],
  bins = 20,
  rug = false,
  annotate = false,
  yMax,
  ariaLabel,
  className,
}: StaticMixtureProps) {
  const pad = { top: annotate ? 40 : 8, right: 8, bottom: rug ? 34 : 10, left: 8 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = linearScale(domain, [pad.left, pad.left + innerW]);
  const hist = histogram(data, histRange[0], histRange[1], bins);
  const grid = Array.from(
    { length: 200 },
    (_, i) => domain[0] + ((domain[1] - domain[0]) * i) / 199,
  );
  const c1 = grid.map((v) => params.pi1 * normalPdf(v, params.mu1, params.sigma1));
  const c2 = grid.map((v) => params.pi2 * normalPdf(v, params.mu2, params.sigma2));
  const mix = grid.map((_, i) => c1[i] + c2[i]);
  const tru = truth
    ? grid.map(
        (v) =>
          truth.pi1 * normalPdf(v, truth.mu1, truth.sigma1) +
          truth.pi2 * normalPdf(v, truth.mu2, truth.sigma2),
      )
    : null;
  const histMax = hist.reduce((m, b) => Math.max(m, b.density), 0);
  const top =
    yMax ??
    Math.max(histMax, ...mix.filter(Number.isFinite).map((v) => Math.min(v, histMax * 1.8))) * 1.1;
  const y = linearScale([0, top], [pad.top + innerH, pad.top]);
  const baseline = pad.top + innerH;
  const path = (vals: number[]) =>
    linePath(grid.map((v, i) => [x(v), y(Math.min(vals[i], top * 3))]));
  const area = (vals: number[]) =>
    `${path(vals)}L${x(domain[1])},${baseline}L${x(domain[0])},${baseline}Z`;
  const gamma1 = rug ? eStep(data, params).gamma1 : null;
  const clip = useId();

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id={clip}>
          <rect x={pad.left} y={0} width={innerW} height={baseline} />
        </clipPath>
      </defs>
      {hist.map((b) => (
        <rect
          key={b.x0}
          x={x(b.x0) + 0.75}
          y={y(b.density)}
          width={Math.max(0, x(b.x1) - x(b.x0) - 1.5)}
          height={baseline - y(b.density)}
          rx={1.5}
          className="fill-foreground/[0.09] dark:fill-foreground/[0.12]"
        />
      ))}
      <g clipPath={`url(#${clip})`}>
        {tru && (
          <path
            d={path(tru)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeDasharray="1.5 4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path d={area(c1)} fill="var(--comp-1)" fillOpacity={0.12} />
        <path d={area(c2)} fill="var(--comp-2)" fillOpacity={0.12} />
        <path
          d={path(c1)}
          fill="none"
          stroke="var(--comp-1)"
          strokeWidth={2.25}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path(c2)}
          fill="none"
          stroke="var(--comp-2)"
          strokeWidth={2.25}
          strokeDasharray="7 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path(mix)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeOpacity={0.9}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <line
        x1={pad.left}
        x2={pad.left + innerW}
        y1={baseline}
        y2={baseline}
        stroke="currentColor"
        strokeOpacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
      {annotate &&
        ([1, 2] as const).map((k) => {
          const mu = k === 1 ? params.mu1 : params.mu2;
          const peak =
            (k === 1 ? params.pi1 : params.pi2) *
            normalPdf(0, 0, k === 1 ? params.sigma1 : params.sigma2);
          const px = x(mu);
          const py = y(Math.min(peak, top));
          return (
            <g key={k}>
              <line
                x1={px}
                x2={px}
                y1={py}
                y2={baseline}
                stroke={k === 1 ? "var(--comp-1)" : "var(--comp-2)"}
                strokeDasharray="3 3"
                strokeOpacity={0.8}
              />
              {k === 1 ? (
                <circle
                  cx={px}
                  cy={py}
                  r={6}
                  fill="var(--comp-1)"
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ) : (
                <path
                  d={triangle(px, py, 8)}
                  fill="var(--comp-2)"
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )}
              <text
                x={px + (k === 1 ? -12 : 12)}
                y={py - 12}
                textAnchor={k === 1 ? "end" : "start"}
                className="hand"
                style={{ fill: k === 1 ? "var(--comp-1-ink)" : "var(--comp-2-ink)", fontSize: 26 }}
              >
                μ{k === 1 ? "₁" : "₂"} ≈ {mu.toFixed(2)}
              </text>
            </g>
          );
        })}
      {gamma1 &&
        Array.from({ length: data.length }, (_, i) => {
          const j = jitter(i);
          const cx = x(data[i]);
          const cy = baseline + 8 + j * (pad.bottom - 14);
          return gamma1[i] >= 0.5 ? (
            <circle key={i} cx={cx} cy={cy} r={3} fill={pointFill(gamma1[i])} />
          ) : (
            <path key={i} d={triangle(cx, cy, 4)} fill={pointFill(gamma1[i])} />
          );
        })}
    </svg>
  );
}
