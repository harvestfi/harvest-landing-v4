"use client";

// Interactive daily-rate chart for the XRP report cards. Granular vertical bars
// over a dotted grid, with hover scrubbing (crosshair + the header value/date
// updating to the hovered day) — the same interaction language as the
// product-page VaultChart, kept compact for the small-multiples grid.

import { useId, useMemo, useState } from "react";

export interface RatePoint {
  d: string; // YYYY-MM-DD
  apy: number;
}

const W = 680;
const H = 200;
const PAD_T = 14;
const PAD_B = 6;

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${v.toFixed(2)}%`;

export function ReportChart({
  history,
  title,
  subtitle,
  tvlLabel,
  nowValue,
  nowLabel,
  color = "#f5a623",
}: {
  history: RatePoint[];
  title: string;
  subtitle?: string;
  tvlLabel?: string;
  nowValue: number | null;
  nowLabel: string;
  color?: string;
}) {
  const gridId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const calc = useMemo(() => {
    const h = history ?? [];
    if (h.length < 2) return null;
    const vals = h.map((r) => r.apy);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    // Bars read from a sensible floor: 0 for small positive series, else a
    // padded min so movement stays visible.
    const base = lo >= 0 && lo < hi * 0.4 ? 0 : lo - (hi - lo) * 0.15;
    hi += (hi - lo) * 0.12 || 0.2;
    const innerW = W;
    const innerH = H - PAD_T - PAD_B;
    const n = h.length;
    const slot = innerW / n;
    const bw = Math.max(1.5, Math.min(slot * 0.62, 12));
    const yOf = (v: number) =>
      PAD_T + (1 - (v - base) / (hi - base || 1)) * innerH;
    const xOf = (i: number) => i * slot + slot / 2;
    return { h, base, hi, innerH, slot, bw, yOf, xOf, n };
  }, [history]);

  if (!calc) return null;
  const { h, bw, yOf, xOf, n, slot } = calc;
  const zeroY = yOf(calc.base);
  const active = hover != null ? h[hover] : null;
  const gridYs = Array.from({ length: 4 }, (_, i) => PAD_T + (i / 3) * (H - PAD_T - PAD_B));

  return (
    <div className="rp-chart-card">
      <div className="rp-chart-head">
        <span className="rp-chart-title">
          {title}
          {subtitle ? <span className="rp-chart-sub">{subtitle}</span> : null}
          {tvlLabel ? <span className="rp-chart-tvl">{tvlLabel}</span> : null}
        </span>
        <span className="rp-chart-now">
          {pct(active ? active.apy : nowValue)}
          <small>{active ? fmtDate(active.d) : nowLabel}</small>
        </span>
      </div>
      <div className="rp-chart rp-chart-live">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title} daily rate, ${pct(h[0].apy)} to ${pct(h[h.length - 1].apy)}`}
          style={{ cursor: "crosshair", touchAction: "pan-y" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * W;
            setHover(Math.max(0, Math.min(n - 1, Math.floor(x / slot))));
          }}
          onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.touches[0].clientX - rect.left) / rect.width) * W;
            setHover(Math.max(0, Math.min(n - 1, Math.floor(x / slot))));
          }}
          onTouchEnd={() => setHover(null)}
        >
          {/* dotted horizontal grid */}
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
          <linearGradient id={gridId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
          {/* bars */}
          {h.map((r, i) => {
            const y = yOf(r.apy);
            const on = hover === i;
            return (
              <rect
                key={i}
                x={xOf(i) - bw / 2}
                y={Math.min(y, zeroY)}
                width={bw}
                height={Math.max(1, Math.abs(zeroY - y))}
                rx={Math.min(bw / 2, 2)}
                fill={`url(#${gridId})`}
                opacity={hover == null || on ? 1 : 0.4}
              />
            );
          })}
          {/* hover crosshair + marker */}
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
              <circle cx={xOf(hover)} cy={yOf(h[hover].apy)} r="3.5" fill={color} />
              <circle
                cx={xOf(hover)}
                cy={yOf(h[hover].apy)}
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
