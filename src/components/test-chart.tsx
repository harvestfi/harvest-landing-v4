"use client";

// Interactive bar chart for /test. Holds time-range and metric state
// internally so the time pills + TVL/APY/Share price tabs actually
// filter the displayed series. Pure CSS heights for the bars; the
// page passes in full per-metric histories and we slice by the
// selected range in the client.

import { useRef, useState } from "react";

type Metric = "tvl" | "apy" | "sharePrice";
type Range = "1M" | "3M" | "1Y" | "ALL";

interface Point { t: number; v: number }

export interface ChartSeries {
  tvl: Point[];
  apy: Point[];
  sharePrice: Point[];
}

interface Props {
  series: ChartSeries;
}

const RANGES: Range[] = ["1M", "3M", "1Y", "ALL"];

const RANGE_SECONDS: Record<Exclude<Range, "ALL">, number> = {
  "1M": 30 * 86400,
  "3M": 90 * 86400,
  "1Y": 365 * 86400,
};

// Cap the number of bars so 1Y/ALL views (300+ daily points) don't
// overflow the chart container. Average values within fixed-size
// buckets so visual density stays clean while still showing trend.
const MAX_BARS = 90;

function downsample(points: Point[]): Point[] {
  if (points.length <= MAX_BARS) return points;
  const bucketSize = points.length / MAX_BARS;
  const out: Point[] = [];
  for (let i = 0; i < MAX_BARS; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.min(points.length, Math.floor((i + 1) * bucketSize));
    if (start >= end) continue;
    const slice = points.slice(start, end);
    const avgV = slice.reduce((s, p) => s + p.v, 0) / slice.length;
    const midT = slice[Math.floor(slice.length / 2)].t;
    out.push({ t: midT, v: avgV });
  }
  return out;
}

// Default headline label vs the short "metric only" label that shows
// while a bar is actually under the cursor. "Current APY (24h)" reads
// as a live ticker by default, but stops making sense the moment you
// scrub back through history - on hover we collapse to "APY". Same
// treatment for "Total deposits" → "TVL". Share price reads the same
// in both states.
function metricLabel(m: Metric, isHovering: boolean): string {
  if (m === "tvl") return isHovering ? "TVL" : "Total deposits";
  if (m === "apy") return isHovering ? "APY" : "Current APY (24h)";
  return "Share price";
}

function formatValue(m: Metric, v: number): string {
  if (m === "tvl") {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  }
  if (m === "apy") return `${v.toFixed(2)}%`;
  return v.toFixed(6);
}

function fmtDate(t: number): string {
  // "6 May 2026" - day, full month, full year. en-GB orders the
  // day before the month so the format matches the format the user
  // asked for explicitly.
  return new Date(t * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateShort(t: number): string {
  // Compact axis label form, e.g. "Jun 2025" - used at the chart edges.
  return new Date(t * 1000).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function TestChart({ series }: Props) {
  const [metric, setMetric] = useState<Metric>("tvl");
  const [range, setRange] = useState<Range>("ALL");
  // Index of the bar currently under the cursor; null means "no hover,
  // show the latest point". Resets to null whenever the metric or range
  // changes so we don't carry a stale index across point arrays.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const all = series[metric] ?? [];
  const sorted = [...all].sort((a, b) => a.t - b.t);

  let raw: Point[] = sorted;
  if (range !== "ALL" && sorted.length > 0) {
    const last = sorted[sorted.length - 1].t;
    const cutoff = last - RANGE_SECONDS[range];
    raw = sorted.filter((p) => p.t >= cutoff);
    if (raw.length === 0) raw = sorted;
  }
  const points = downsample(raw);

  // The hovered bar drives the bignum; when no hover, fall back to the
  // most recent point so the headline always shows something. We track
  // isHovering separately so the latest bar isn't visually styled as
  // active (and dimmed) by default - it only takes the gold-extension
  // treatment when the cursor is actually over the chart.
  const isHovering =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < points.length;
  const activeIdx = isHovering ? hoverIdx! : points.length - 1;
  const activePoint = points[activeIdx];
  const latest = activePoint ? activePoint.v : 0;

  // Mouse-move on the bars container picks the column under the cursor
  // by x-position, so hovering between bar gaps OR over the empty space
  // above a bar still selects the right column.
  const barsRef = useRef<HTMLDivElement | null>(null);
  const onBarsMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = barsRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || points.length === 0) return;
    const relX = e.clientX - rect.left;
    const idx = Math.min(
      points.length - 1,
      Math.max(0, Math.floor((relX / rect.width) * points.length)),
    );
    if (idx !== hoverIdx) setHoverIdx(idx);
  };

  // Min-max scaling so changes are legible even for slow-moving series
  // like share price (typically 1.00 → 1.09, ~9% absolute movement).
  // Bars span the 8-100% band: smallest is 8% tall (clearly visible),
  // largest is 100%. Without this, bars all land in a narrow 90-100%
  // band and the chart reads as flat.
  const values = points.map((p) => p.v);
  const minV = values.length > 0 ? Math.min(...values) : 0;
  const maxV = values.length > 0 ? Math.max(...values) : 0;
  const span = maxV - minV;
  const heightFor = (v: number): number => {
    if (span <= 0) return 60; // perfectly flat data: show a uniform mid bar
    return ((v - minV) / span) * 92 + 8;
  };

  return (
    <div className="uni-chart-wrap">
      <div className="uni-bignum" id="performance">
        <div className="uni-bignum-value">{formatValue(metric, latest)}</div>
        <div className="uni-bignum-meta">
          <span className="uni-bignum-label">{metricLabel(metric, isHovering)}</span>
          {isHovering && activePoint && (
            <>
              <span className="uni-bignum-dot" aria-hidden="true">·</span>
              <span className="uni-bignum-date">{fmtDate(activePoint.t)}</span>
            </>
          )}
        </div>
      </div>

      <div className="uni-chart">
        {points.length === 0 ? (
          <div className="uni-chart-empty">No data for this range.</div>
        ) : (
          <>
            <div
              ref={barsRef}
              className="uni-chart-bars"
              onMouseMove={onBarsMove}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {points.map((p, i) => (
                <div
                  key={p.t}
                  className={`uni-bar-col${isHovering && i === hoverIdx ? " active" : ""}`}
                >
                  <span
                    className="uni-chart-bar"
                    style={{ height: `${heightFor(p.v)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="uni-chart-axis">
              <span>{fmtDateShort(points[0].t)}</span>
              <span>{fmtDateShort(points[points.length - 1].t)}</span>
            </div>
          </>
        )}
      </div>

      <div className="uni-chart-controls">
        <div className="uni-tab-pills" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`uni-pill-btn${range === r ? " active" : ""}`}
              onClick={() => { setRange(r); setHoverIdx(null); }}
              aria-pressed={range === r}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="uni-tab-text" role="tablist" aria-label="Metric">
          {(["tvl", "apy", "sharePrice"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`uni-tab-btn${metric === m ? " active" : ""}`}
              onClick={() => { setMetric(m); setHoverIdx(null); }}
              aria-pressed={metric === m}
            >
              {m === "tvl" ? "TVL" : m === "apy" ? "APY" : "Share price"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
