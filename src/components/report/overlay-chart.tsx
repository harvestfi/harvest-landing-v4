"use client";

// Multi-maturity "max fixed rate" overlay for the XRP report. Each Spectra
// stXRP maturity is one line, all drawn on a shared calendar axis so the fixed
// rate can be read across pools at once. Because matured markets still return
// their full history, overlaying them reaches back much further than the two
// live PTs alone. Hover scrubs a shared crosshair; the legend shows each
// maturity's value on the hovered day (or its latest value at rest).

import { useMemo, useState } from "react";

export interface OverlayPoint {
  d: string; // YYYY-MM-DD
  apy: number;
}
export interface OverlaySeries {
  label: string;
  maturityDate: string | null;
  expired: boolean;
  points: OverlayPoint[];
}

const W = 720;
const H = 240;
const PAD_T = 16;
const PAD_B = 8;

// Distinct, legible line colors. Assigned by maturity order; matured lines are
// rendered a touch softer via opacity, not a separate palette.
const COLORS = [
  "#e8663d",
  "#ffb936",
  "#2a9d8f",
  "#3b82f6",
  "#7c3aed",
  "#d1477a",
  "#8a6d1f",
  "#4c9a2a",
];

const dayMs = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const fmtShort = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(2)}%`);

export function OverlayChart({
  series,
  title,
  subtitle,
}: {
  series: OverlaySeries[];
  title: string;
  subtitle?: string;
}) {
  const [hoverMs, setHoverMs] = useState<number | null>(null);

  const calc = useMemo(() => {
    const clean = series.filter((s) => s.points.length >= 2);
    if (clean.length === 0) return null;
    let minMs = Infinity;
    let maxMs = -Infinity;
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of clean) {
      for (const p of s.points) {
        const t = dayMs(p.d);
        if (t < minMs) minMs = t;
        if (t > maxMs) maxMs = t;
        if (p.apy < lo) lo = p.apy;
        if (p.apy > hi) hi = p.apy;
      }
    }
    if (!Number.isFinite(minMs) || maxMs <= minMs) return null;
    const base = lo >= 0 && lo < hi * 0.5 ? 0 : lo - (hi - lo) * 0.12;
    const top = hi + (hi - lo) * 0.12 || hi + 1;
    const innerH = H - PAD_T - PAD_B;
    const xOf = (t: number) => ((t - minMs) / (maxMs - minMs)) * W;
    const yOf = (v: number) => PAD_T + (1 - (v - base) / (top - base || 1)) * innerH;
    const lines = clean.map((s, i) => ({
      ...s,
      color: COLORS[i % COLORS.length],
      d: s.points
        .map((p, j) => `${j === 0 ? "M" : "L"}${xOf(dayMs(p.d)).toFixed(1)} ${yOf(p.apy).toFixed(1)}`)
        .join(" "),
      last: s.points[s.points.length - 1],
    }));
    return { lines, minMs, maxMs, xOf, yOf, base, top };
  }, [series]);

  if (!calc) return null;
  const { lines, minMs, maxMs, xOf, yOf } = calc;
  const gridYs = Array.from({ length: 4 }, (_, i) => PAD_T + (i / 3) * (H - PAD_T - PAD_B));

  // Value on (or just before) the hovered day for each series, for the legend.
  const valueAt = (s: OverlaySeries): OverlayPoint | null => {
    if (hoverMs == null) return s.points[s.points.length - 1] ?? null;
    let chosen: OverlayPoint | null = null;
    for (const p of s.points) {
      if (dayMs(p.d) <= hoverMs) chosen = p;
      else break;
    }
    return chosen;
  };

  return (
    <div className="rp-chart-card rp-overlay-card">
      <div className="rp-chart-head">
        <span className="rp-chart-title">
          {title}
          {subtitle ? <span className="rp-chart-sub">{subtitle}</span> : null}
        </span>
        <span className="rp-chart-now">
          {hoverMs != null ? fmtDate(hoverMs) : `${fmtShort(minMs)} – now`}
        </span>
      </div>
      <div className="rp-chart rp-chart-live">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}: ${lines.length} stXRP maturities overlaid`}
          style={{ cursor: "crosshair", touchAction: "pan-y" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W;
            setHoverMs(minMs + Math.max(0, Math.min(1, x / W)) * (maxMs - minMs));
          }}
          onMouseLeave={() => setHoverMs(null)}
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.touches[0].clientX - rect.left) / rect.width) * W;
            setHoverMs(minMs + Math.max(0, Math.min(1, x / W)) * (maxMs - minMs));
          }}
          onTouchEnd={() => setHoverMs(null)}
        >
          {gridYs.map((y, i) => (
            <line
              key={i}
              x1={0}
              y1={y}
              x2={W}
              y2={y}
              stroke="var(--rp-chart-grid, #e7e8ea)"
              strokeWidth="1"
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {lines.map((l) => (
            <path
              key={l.label}
              d={l.d}
              fill="none"
              stroke={l.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={l.expired ? 0.62 : 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {hoverMs != null && (
            <line
              x1={xOf(hoverMs)}
              y1={PAD_T - 6}
              x2={xOf(hoverMs)}
              y2={H - PAD_B}
              stroke="var(--rp-chart-cross, #b9bbbe)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {hoverMs != null &&
            lines.map((l) => {
              const p = valueAt(l);
              if (!p) return null;
              return (
                <circle
                  key={`dot-${l.label}`}
                  cx={xOf(hoverMs)}
                  cy={yOf(p.apy)}
                  r="3.2"
                  fill={l.color}
                  stroke="var(--rp-card-bg, #fff)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </svg>
      </div>
      <div className="rp-chart-axis">
        <span>{fmtShort(minMs)}</span>
        <span>{fmtShort(maxMs)}</span>
      </div>
      <ul className="rp-overlay-legend">
        {lines.map((l) => {
          const p = valueAt(l);
          return (
            <li key={l.label} className="rp-overlay-key">
              <span className="rp-overlay-swatch" style={{ background: l.color }} aria-hidden="true" />
              <span className="rp-overlay-lab">{l.label}</span>
              <span className={`rp-overlay-status${l.expired ? " is-matured" : ""}`}>
                {l.expired ? "Matured" : "Live"}
              </span>
              <span className="rp-overlay-val">{pct(p?.apy)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
