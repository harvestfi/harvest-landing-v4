"use client";

// Interactive bar chart for /test. Holds time-range and metric state
// internally so the time pills + TVL/APY/Share price tabs actually
// filter the displayed series. Pure CSS heights for the bars; the
// page passes in full per-metric histories and we slice by the
// selected range in the client.

import { useState } from "react";

type Metric = "tvl" | "apy" | "sharePrice";
type Range = "1W" | "1M" | "3M" | "1Y" | "ALL";

interface Point { t: number; v: number }

export interface ChartSeries {
  tvl: Point[];
  apy: Point[];
  sharePrice: Point[];
}

interface Props {
  series: ChartSeries;
}

const RANGE_SECONDS: Record<Exclude<Range, "ALL">, number> = {
  "1W": 7 * 86400,
  "1M": 30 * 86400,
  "3M": 90 * 86400,
  "1Y": 365 * 86400,
};

function metricLabel(m: Metric): string {
  if (m === "tvl") return "Total deposits";
  if (m === "apy") return "Current APY (24h)";
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
  return new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TestChart({ series }: Props) {
  const [metric, setMetric] = useState<Metric>("tvl");
  const [range, setRange] = useState<Range>("1M");

  const all = series[metric] ?? [];
  const sorted = [...all].sort((a, b) => a.t - b.t);

  let points: Point[] = sorted;
  if (range !== "ALL" && sorted.length > 0) {
    const last = sorted[sorted.length - 1].t;
    const cutoff = last - RANGE_SECONDS[range];
    points = sorted.filter((p) => p.t >= cutoff);
    if (points.length === 0) points = sorted;
  }

  const latest = points.length > 0 ? points[points.length - 1].v : 0;
  const maxV = points.length > 0 ? Math.max(...points.map((p) => p.v)) : 0;
  const denom = maxV > 0 ? maxV : 1;

  return (
    <div className="uni-chart-wrap">
      <div className="uni-bignum">
        <div className="uni-bignum-value">{formatValue(metric, latest)}</div>
        <div className="uni-bignum-meta">{metricLabel(metric)}</div>
      </div>

      <div className="uni-chart">
        {points.length === 0 ? (
          <div className="uni-chart-empty">No data for this range.</div>
        ) : (
          <>
            <div className="uni-chart-bars">
              {points.map((p) => (
                <span
                  key={p.t}
                  className="uni-chart-bar"
                  style={{ height: `${(p.v / denom) * 100}%` }}
                  title={`${fmtDate(p.t)} · ${formatValue(metric, p.v)}`}
                />
              ))}
            </div>
            <div className="uni-chart-axis">
              <span>{fmtDate(points[0].t)}</span>
              <span>{fmtDate(points[points.length - 1].t)}</span>
            </div>
          </>
        )}
      </div>

      <div className="uni-chart-controls">
        <div className="uni-tab-pills" role="tablist" aria-label="Time range">
          {(["1W", "1M", "3M", "1Y", "ALL"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`uni-pill-btn${range === r ? " active" : ""}`}
              onClick={() => setRange(r)}
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
              onClick={() => setMetric(m)}
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
