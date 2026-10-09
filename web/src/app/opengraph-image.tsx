import { ImageResponse } from "next/og";
import { linePath, linearScale } from "@/lib/charts/scale";
import { normalPdf } from "@/lib/em/gaussian";
import { notebookFinal } from "@/lib/em/notebook-run";

export const alt = "EM, one step at a time: an interactive companion to an EM algorithm explainer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const p = notebookFinal;
  const x = linearScale([0.5, 10.5], [60, 1140]);
  const y = linearScale([0, 0.25], [560, 300]);
  const grid = Array.from({ length: 160 }, (_, i) => 0.5 + (10 * i) / 159);
  const c1 = linePath(grid.map((v) => [x(v), y(p.pi1 * normalPdf(v, p.mu1, p.sigma1))]));
  const c2 = linePath(grid.map((v) => [x(v), y(p.pi2 * normalPdf(v, p.mu2, p.sigma2))]));
  const mix = linePath(
    grid.map((v) => [
      x(v),
      y(p.pi1 * normalPdf(v, p.mu1, p.sigma1) + p.pi2 * normalPdf(v, p.mu2, p.sigma2)),
    ]),
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f6f1e7",
        color: "#1d2a30",
        padding: "56px 64px",
        position: "relative",
      }}
    >
      <div style={{ fontSize: 26, letterSpacing: 4, color: "#56636b", display: "flex" }}>
        EXPECTATION–MAXIMISATION, BY DOING
      </div>
      <div style={{ fontSize: 92, fontWeight: 700, marginTop: 18, display: "flex" }}>
        EM, one step at a time
      </div>
      <div style={{ fontSize: 30, color: "#56636b", marginTop: 14, display: "flex" }}>
        Step through four ratings · watch 200 converge · see where it goes wrong
      </div>
      <svg
        width="1200"
        height="630"
        viewBox="0 0 1200 630"
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <path d={c1} fill="none" stroke="#0f7f7a" strokeWidth="6" />
        <path d={c2} fill="none" stroke="#d65a3c" strokeWidth="6" strokeDasharray="18 10" />
        <path d={mix} fill="none" stroke="#1d2a30" strokeWidth="5" />
        <line
          x1="60"
          x2="1140"
          y1="562"
          y2="562"
          stroke="#1d2a30"
          strokeOpacity="0.5"
          strokeWidth="3"
        />
      </svg>
    </div>,
    size,
  );
}
