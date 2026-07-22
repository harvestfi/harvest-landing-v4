"use client";

// Area chart for the XRP Yield Landscape section: total tracked TVL over time,
// with hover scrubbing (crosshair + the header value/date follow the cursor).
// Same interaction language as ReportChart, but an area/line for a $ magnitude
// series rather than per-day rate bars. Solid flagship-yellow fill.

import { useMemo, useState } from "react";

export interface TvlPoint {
  d: string; // YYYY-MM-DD
  tvl: number;
}

const W = 680;
const H = 220;
const PAD_T = 14;
const PAD_B = 6;

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
const usd = (n: number | null | undefined) =>
  n == null
    ? "n/a"
    : n >= 1_000_000_000
      ? `$${(n / 1_000_000_000).toFixed(2)}B`
      : n >= 1_000_000
        ? `$${(n / 1_000_000).toFixed(1)}M`
        : `$${Math.round(n / 1_000)}k`;

export function LandscapeChart({
  series,
  title,
  subtitle,
  nowLabel,
  color = "#ffb936",
}: {
  series: TvlPoint[];
  title: string;
  subtitle?: string;
  nowLabel: string;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const calc = useMemo(() => {
    const h = (series ?? []).filter((p) => Number.isFinite(p.tvl));
    if (h.length < 2) return null;
    const vals = h.map((r) => r.tvl);
    const hi = Math.max(...vals) * 1.08 || 1;
    const base = 0; // $ magnitude reads from a true zero floor
    const innerW = W;
    const innerH = H - PAD_T - PAD_B;
    const n = h.length;
    const xOf = (i: number) => (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yOf = (v: number) => PAD_T + (1 - (v - base) / (hi - base || 1)) * innerH;
    return { h, hi, innerH, n, xOf, yOf };
  }, [series]);

  if (!calc) return null;
  const { h, n, xOf, yOf } = calc;
  const active = hover != null ? h[hover] : null;
  const zeroY = H - PAD_B;

  const linePath = h.map((r, i) => `${i ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(r.tvl).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xOf(n - 1).toFixed(1)},${zeroY} L${xOf(0).toFixed(1)},${zeroY} Z`;
  const gridYs = Array.from({ length: 4 }, (_, i) => PAD_T + (i / 3) * (H - PAD_T - PAD_B));

  return (
    <div className="rp-chart-card rp-landscape-card">
      <div className="rp-chart-head">
        <span className="rp-chart-title">
          {title}
          {subtitle ? <span className="rp-chart-sub">{subtitle}</span> : null}
        </span>
        <span className="rp-chart-now">
          {usd(active ? active.tvl : h[h.length - 1].tvl)}
          <small>{active ? fmtDate(active.d) : nowLabel}</small>
        </span>
      </div>
      <div className="rp-chart rp-chart-live">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title} over time, ${usd(h[0].tvl)} to ${usd(h[h.length - 1].tvl)}`}
          style={{ cursor: "crosshair", touchAction: "pan-y" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W;
            setHover(Math.max(0, Math.min(n - 1, Math.round((x / W) * (n - 1)))));
          }}
          onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.touches[0].clientX - rect.left) / rect.width) * W;
            setHover(Math.max(0, Math.min(n - 1, Math.round((x / W) * (n - 1)))));
          }}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id="rp-landscape-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
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
          <path d={areaPath} fill="url(#rp-landscape-fill)" stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {hover != null && (
            <>
              <line
                x1={xOf(hover)}
                y1={PAD_T - 4}
                x2={xOf(hover)}
                y2={H - PAD_B}
                stroke="var(--rp-chart-cross, #b9bbbe)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={xOf(hover)} cy={yOf(h[hover].tvl)} r="3.5" fill={color} />
              <circle
                cx={xOf(hover)}
                cy={yOf(h[hover].tvl)}
                r="3.5"
                fill="none"
                stroke="var(--rp-card-bg, #fff)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
      </div>
      <div className="rp-chart-axis">
        <span>{fmtDate(h[0].d)}</span>
        <span>{fmtDate(h[h.length - 1].d)}</span>
      </div>
    </div>
  );
}
