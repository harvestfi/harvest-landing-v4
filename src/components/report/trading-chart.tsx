"use client";

// Daily trading-volume bars for the "stXRP yield-market trading" section.
// Combined buy+sell volume per day across the Spectra stXRP markets, with hover
// scrubbing (the header value/date follow the cursor and split buy vs sell).
// Solid flagship-yellow bars, same visual language as the rate charts.

import { useMemo, useState } from "react";

export interface VolPoint {
  d: string; // YYYY-MM-DD
  buyUsd: number;
  sellUsd: number;
}

const W = 680;
const H = 200;
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
    ? "—"
    : n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
        ? `$${Math.round(n / 1_000)}k`
        : `$${Math.round(n)}`;

export function TradingChart({
  series,
  title,
  subtitle,
  color = "#ffb936",
}: {
  series: VolPoint[];
  title: string;
  subtitle?: string;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const calc = useMemo(() => {
    const h = (series ?? []).map((p) => ({ ...p, total: (p.buyUsd || 0) + (p.sellUsd || 0) }));
    if (h.length < 2) return null;
    const hi = Math.max(...h.map((r) => r.total)) * 1.08 || 1;
    const innerW = W;
    const innerH = H - PAD_T - PAD_B;
    const n = h.length;
    const slot = innerW / n;
    const bw = Math.max(1, Math.min(slot * 0.7, 10));
    const yOf = (v: number) => PAD_T + (1 - v / hi) * innerH;
    const xOf = (i: number) => i * slot + slot / 2;
    return { h, hi, innerH, slot, bw, yOf, xOf, n };
  }, [series]);

  if (!calc) return null;
  const { h, bw, yOf, xOf, n, slot } = calc;
  const zeroY = H - PAD_B;
  const active = hover != null ? h[hover] : null;
  const totalAll = h.reduce((s, r) => s + r.total, 0);
  const gridYs = Array.from({ length: 4 }, (_, i) => PAD_T + (i / 3) * (H - PAD_T - PAD_B));

  return (
    <div className="rp-chart-card rp-landscape-card">
      <div className="rp-chart-head">
        <span className="rp-chart-title">
          {title}
          {subtitle ? <span className="rp-chart-sub">{subtitle}</span> : null}
        </span>
        <span className="rp-chart-now">
          {usd(active ? active.total : totalAll)}
          <small>{active ? fmtDate(active.d) : "total"}</small>
        </span>
      </div>
      <div className="rp-chart rp-chart-live">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Daily stXRP yield-market trading volume, ${fmtDate(h[0].d)} to ${fmtDate(h[h.length - 1].d)}`}
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
          {h.map((r, i) => {
            const y = yOf(r.total);
            const on = hover === i;
            return (
              <rect
                key={i}
                x={xOf(i) - bw / 2}
                y={Math.min(y, zeroY)}
                width={bw}
                height={Math.max(1, zeroY - y)}
                rx={Math.min(bw / 2, 2)}
                fill={color}
                opacity={hover == null || on ? 1 : 0.4}
              />
            );
          })}
          {hover != null && (
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
          )}
        </svg>
      </div>
      <div className="rp-chart-axis">
        <span>{fmtDate(h[0].d)}</span>
        {active ? (
          <span className="rp-vol-split">
            buy {usd(active.buyUsd)} · sell {usd(active.sellUsd)}
          </span>
        ) : null}
        <span>{fmtDate(h[h.length - 1].d)}</span>
      </div>
    </div>
  );
}
