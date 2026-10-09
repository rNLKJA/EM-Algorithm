"use client";

import { useCallback, useId, useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import { jitter, pointFill, triangle } from "@/lib/charts/marks";
import { formatLinearTicks } from "@/lib/charts/axes";
import { areaPath, linePath, linearScale, niceTicks } from "@/lib/charts/scale";
import { eStep, mixtureDensity } from "@/lib/em/em";
import { normalPdf } from "@/lib/em/gaussian";
import type { MixtureParams } from "@/lib/em/types";
import { histogram } from "@/lib/stats";
import { cn } from "@/lib/utils";

export interface MixtureChartProps {
  data: ArrayLike<number>;
  params: MixtureParams;
  /** dotted reference mixture (e.g. the true generating parameters) */
  truth?: MixtureParams | null;
  domain?: [number, number];
  histRange?: [number, number];
  bins?: number;
  height?: number;
  /** "strip": a jittered rug under the axis (many points); "markers": big labelled points */
  pointsMode?: "strip" | "markers" | "none";
  /** responsibilities to colour points by; computed from `params` when omitted */
  gamma1?: ArrayLike<number>;
  showHistogram?: boolean;
  /** fixed y-axis maximum so animation does not rescale every frame */
  yMax?: number;
  draggable?: boolean;
  onMeansChange?: (mu1: number, mu2: number) => void;
  annotate?: boolean;
  componentLabels?: [string, string];
  ariaLabel: string;
  className?: string;
}

const MARGIN = { top: 18, right: 14, left: 46 };

export function MixtureChart({
  data,
  params,
  truth = null,
  domain = [0.5, 10.5],
  histRange = [1, 10],
  bins = 20,
  height = 300,
  pointsMode = "strip",
  gamma1,
  showHistogram = true,
  yMax,
  draggable = false,
  onMeansChange,
  annotate = true,
  componentLabels = ["component 1", "component 2"],
  ariaLabel,
  className,
}: MixtureChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const clipId = useId();
  const stripClipId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<1 | 2 | null>(null);
  const compact = width < 520;

  const stripHeight = pointsMode === "strip" ? (compact ? 30 : 36) : 0;
  const markerSpace = pointsMode === "markers" ? 12 : 0;
  const bottom = 30 + (stripHeight ? stripHeight + 12 : 0) + markerSpace;
  const innerW = Math.max(10, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(10, height - MARGIN.top - bottom);

  const x = useMemo(
    () => linearScale(domain, [MARGIN.left, MARGIN.left + innerW]),
    [domain, innerW],
  );

  const hist = useMemo(
    () => (showHistogram ? histogram(data, histRange[0], histRange[1], bins) : []),
    [data, histRange, bins, showHistogram],
  );

  const grid = useMemo(() => {
    const n = Math.min(320, Math.max(120, Math.round(innerW / 2.5)));
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(domain[0] + ((domain[1] - domain[0]) * i) / (n - 1));
    return out;
  }, [domain, innerW]);

  const curves = useMemo(() => {
    const c1 = grid.map((v) => params.pi1 * normalPdf(v, params.mu1, params.sigma1));
    const c2 = grid.map((v) => params.pi2 * normalPdf(v, params.mu2, params.sigma2));
    const mix = grid.map((_, i) => c1[i] + c2[i]);
    const tru = truth ? grid.map((v) => mixtureDensity(v, truth)) : null;
    return { c1, c2, mix, tru };
  }, [grid, params, truth]);

  const top = useMemo(() => {
    if (yMax) return yMax;
    const histMax = hist.reduce((m, b) => Math.max(m, b.density), 0);
    const mixMax = curves.mix.reduce((m, v) => (Number.isFinite(v) ? Math.max(m, v) : m), 0);
    const truMax = curves.tru ? Math.max(...curves.tru) : 0;
    const base = Math.max(histMax, truMax, 0.05);
    // a collapsing spike would flatten everything else; cap it and let it clip
    return Math.max(base, Math.min(mixMax, base * 1.8)) * 1.12;
  }, [yMax, hist, curves]);

  const y = useMemo(() => linearScale([0, top], [MARGIN.top + innerH, MARGIN.top]), [top, innerH]);
  const baseline = MARGIN.top + innerH;

  const gammas = useMemo(() => {
    if (pointsMode === "none") return null;
    if (gamma1) return gamma1;
    return eStep(data, params).gamma1;
  }, [pointsMode, gamma1, data, params]);

  const xTicks = useMemo(() => {
    const t = niceTicks(domain[0], domain[1], compact ? 5 : 10);
    return t.filter((v) => v >= domain[0] && v <= domain[1]);
  }, [domain, compact]);
  const yTicks = useMemo(() => niceTicks(0, top, compact ? 3 : 4), [top, compact]);
  const yTickLabels = useMemo(() => formatLinearTicks(yTicks), [yTicks]);
  // ratings beyond the x axis are neither counted nor drawn: say so rather than hide them
  const outside = useMemo(() => {
    let count = 0;
    for (let i = 0; i < data.length; i++) if (data[i] < domain[0] || data[i] > domain[1]) count++;
    return count;
  }, [data, domain]);

  const pathOf = (values: number[]) =>
    linePath(grid.map((v, i) => [x(v), y(Math.min(values[i], top * 4))]));
  // a collapsed component (sigma = 0) has NaN densities: its paths come out empty and are skipped
  const c1Path = pathOf(curves.c1);
  const c2Path = pathOf(curves.c2);
  const paths = {
    tru: curves.tru ? pathOf(curves.tru) : "",
    c1: c1Path,
    c2: c2Path,
    mix: pathOf(curves.mix),
    area1: areaPath(c1Path, x(domain[0]), x(domain[1]), baseline),
    area2: areaPath(c2Path, x(domain[0]), x(domain[1]), baseline),
  };

  const clampMean = (v: number) => Math.min(domain[1] - 0.25, Math.max(domain[0] + 0.25, v));

  const setMean = useCallback(
    (k: 1 | 2, v: number) => {
      if (!onMeansChange) return;
      const value = Math.round(clampMean(v) * 100) / 100;
      if (k === 1) onMeansChange(value, params.mu2);
      else onMeansChange(params.mu1, value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onMeansChange, params.mu1, params.mu2, domain],
  );

  const pointerToValue = (event: PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return x.invert(((event.clientX - rect.left) / rect.width) * width);
  };

  const onPointerDown = (k: 1 | 2) => (event: PointerEvent<SVGGElement>) => {
    if (!draggable) return;
    dragging.current = k;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    event.preventDefault();
    (event.currentTarget as SVGGElement).focus({ preventScroll: true });
  };
  const onPointerMove = (event: PointerEvent<SVGGElement>) => {
    if (!dragging.current) return;
    const v = pointerToValue(event);
    if (v !== null) setMean(dragging.current, v);
  };
  const onPointerUp = (event: PointerEvent<SVGGElement>) => {
    dragging.current = null;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
  };
  const onKey = (k: 1 | 2) => (event: KeyboardEvent<SVGGElement>) => {
    const step = event.shiftKey ? 0.5 : 0.1;
    const current = k === 1 ? params.mu1 : params.mu2;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") setMean(k, current - step);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") setMean(k, current + step);
    else if (event.key === "Home") setMean(k, domain[0]);
    else if (event.key === "End") setMean(k, domain[1]);
    else return;
    event.preventDefault();
  };

  const handles = ([1, 2] as const).map((k) => {
    const mu = k === 1 ? params.mu1 : params.mu2;
    const pi = k === 1 ? params.pi1 : params.pi2;
    const sigma = k === 1 ? params.sigma1 : params.sigma2;
    if (!Number.isFinite(mu)) return null;
    const peak = pi * normalPdf(mu, mu, sigma);
    const py = Math.max(MARGIN.top + 6, y(Math.min(Number.isFinite(peak) ? peak : top, top)));
    return { k, mu, px: x(clampMean(mu)), py };
  });

  const stripTop = baseline + 26 + markerSpace;

  return (
    <div ref={ref} className={cn("relative w-full select-none", className)}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        // children of role="img" are presentational, which would hide the slider handles
        role={draggable ? "group" : "img"}
        aria-label={ariaLabel}
        className="block max-w-full overflow-visible"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={MARGIN.left} y={MARGIN.top - 4} width={innerW} height={innerH + 4} />
          </clipPath>
          <clipPath id={stripClipId}>
            <rect
              x={MARGIN.left - 6}
              y={stripTop - 6}
              width={innerW + 12}
              height={stripHeight + 12}
            />
          </clipPath>
        </defs>

        {/* y grid + ticks */}
        {yTicks.map((t, i) => (
          <g key={`y${t}`}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + innerW}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeOpacity={t === 0 ? 0.55 : 0.08}
            />
            <text
              x={MARGIN.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {yTickLabels[i]}
            </text>
          </g>
        ))}
        <text
          transform={`translate(12 ${MARGIN.top + innerH / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-muted-foreground text-[10.5px]"
        >
          density
        </text>

        {/* histogram */}
        <g aria-hidden>
          {hist.map((b) => (
            <rect
              key={b.x0}
              x={x(b.x0) + 0.75}
              y={y(Math.min(b.density, top))}
              width={Math.max(0, x(b.x1) - x(b.x0) - 1.5)}
              height={Math.max(0, baseline - y(Math.min(b.density, top)))}
              rx={1.5}
              className="fill-foreground/[0.09] dark:fill-foreground/[0.11]"
            />
          ))}
        </g>

        <g clipPath={`url(#${clipId})`} aria-hidden>
          {paths.tru && (
            <path
              d={paths.tru}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.45}
              strokeWidth={1.5}
              strokeDasharray="1.5 4"
              strokeLinecap="round"
            />
          )}
          {paths.area1 && <path d={paths.area1} fill="var(--comp-1)" fillOpacity={0.1} />}
          {paths.area2 && <path d={paths.area2} fill="var(--comp-2)" fillOpacity={0.1} />}
          {paths.c1 && <path d={paths.c1} fill="none" stroke="var(--comp-1)" strokeWidth={2.25} />}
          {paths.c2 && (
            <path
              d={paths.c2}
              fill="none"
              stroke="var(--comp-2)"
              strokeWidth={2.25}
              strokeDasharray="7 4"
            />
          )}
          {paths.mix && (
            <path
              d={paths.mix}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeOpacity={0.9}
            />
          )}
        </g>

        {/* x axis */}
        {xTicks.map((t) => (
          <g key={`x${t}`} aria-hidden>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={baseline}
              y2={baseline + 4}
              stroke="currentColor"
              strokeOpacity={0.5}
            />
            <text
              x={x(t)}
              y={baseline + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10.5px]"
            >
              {t < 0 ? `−${-t}` : t}
            </text>
          </g>
        ))}

        {/* mean handles */}
        {handles.map((h) => {
          if (!h) return null;
          const colour = h.k === 1 ? "var(--comp-1)" : "var(--comp-2)";
          const label = componentLabels[h.k - 1];
          return (
            <g
              key={h.k}
              role={draggable ? "slider" : undefined}
              tabIndex={draggable ? 0 : undefined}
              aria-label={draggable ? `Mean of ${label}` : undefined}
              aria-valuemin={draggable ? domain[0] : undefined}
              aria-valuemax={draggable ? domain[1] : undefined}
              aria-valuenow={draggable ? Number(h.mu.toFixed(2)) : undefined}
              aria-valuetext={draggable ? `μ = ${h.mu.toFixed(2)}` : undefined}
              onPointerDown={onPointerDown(h.k)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={draggable ? onKey(h.k) : undefined}
              className={cn(
                "outline-none",
                draggable &&
                  "cursor-ew-resize touch-none [&:focus-visible_.knob]:stroke-ring [&:focus-visible_.knob]:stroke-[3px]",
              )}
            >
              {draggable && (
                <rect x={h.px - 14} y={MARGIN.top} width={28} height={innerH} fill="transparent" />
              )}
              <line
                x1={h.px}
                x2={h.px}
                y1={h.py}
                y2={baseline}
                stroke={colour}
                strokeOpacity={0.7}
                strokeWidth={1.25}
                strokeDasharray="3 3"
              />
              {h.k === 1 ? (
                <circle
                  className="knob"
                  cx={h.px}
                  cy={h.py}
                  r={draggable ? 7.5 : 5}
                  fill={colour}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ) : (
                <path
                  className="knob"
                  d={triangle(h.px, h.py, draggable ? 9.5 : 6.5)}
                  fill={colour}
                  stroke="var(--card)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              )}
              {annotate && (
                <text
                  x={h.px + (h.k === 1 ? -10 : 10)}
                  y={Math.max(MARGIN.top + 10, h.py - 8)}
                  textAnchor={h.k === 1 ? "end" : "start"}
                  className="hand"
                  style={{
                    fill: h.k === 1 ? "var(--comp-1-ink)" : "var(--comp-2-ink)",
                    fontSize: compact ? 16 : 19,
                  }}
                >
                  μ{h.k === 1 ? "₁" : "₂"} {h.mu.toFixed(2)}
                </text>
              )}
            </g>
          );
        })}

        {/* points */}
        {gammas && pointsMode === "strip" && (
          <g aria-hidden clipPath={`url(#${stripClipId})`}>
            {Array.from({ length: data.length }, (_, i) => {
              const g1 = gammas[i];
              const cx = x(data[i]);
              const cy = stripTop + jitter(i) * (stripHeight - 8) + 4;
              const fill = pointFill(g1);
              return g1 >= 0.5 || Number.isNaN(g1) ? (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={compact ? 2.6 : 3.1}
                  fill={fill}
                  stroke="var(--card)"
                  strokeWidth={0.6}
                />
              ) : (
                <path
                  key={i}
                  d={triangle(cx, cy, compact ? 3.6 : 4.2)}
                  fill={fill}
                  stroke="var(--card)"
                  strokeWidth={0.6}
                />
              );
            })}
          </g>
        )}
        {gammas && pointsMode === "markers" && (
          <g aria-hidden>
            {Array.from({ length: data.length }, (_, i) => {
              const g1 = Number.isFinite(gammas[i]) ? gammas[i] : 0;
              const cx = x(data[i]);
              const fill = pointFill(gammas[i]);
              return (
                <g key={i}>
                  {g1 >= 0.5 ? (
                    <circle
                      cx={cx}
                      cy={baseline}
                      r={8}
                      fill={fill}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  ) : (
                    <path
                      d={triangle(cx, baseline - 1, 10.5)}
                      fill={fill}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  )}
                  <rect
                    x={cx - 16}
                    y={baseline + 25}
                    width={32}
                    height={7}
                    rx={3.5}
                    fill="var(--comp-2)"
                  />
                  <rect
                    x={cx - 16}
                    y={baseline + 25}
                    width={Math.round(32 * g1 * 100) / 100}
                    height={7}
                    rx={3.5}
                    fill="var(--comp-1)"
                  />
                </g>
              );
            })}
          </g>
        )}
        {pointsMode !== "markers" && (
          <text
            x={MARGIN.left + innerW}
            y={height - 3}
            textAnchor="end"
            className="fill-muted-foreground text-[10.5px]"
            aria-hidden
          >
            rating →
          </text>
        )}
        {outside > 0 && (
          <text x={MARGIN.left} y={height - 3} className="fill-muted-foreground text-[10.5px]">
            {outside} {outside === 1 ? "rating" : "ratings"} outside {domain[0]} to {domain[1]} not
            shown
          </text>
        )}
      </svg>
    </div>
  );
}
