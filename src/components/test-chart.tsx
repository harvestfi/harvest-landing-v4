"use client";

// Interactive chart for /test. Holds time-range, metric and chart-
// style state internally. Bars mode = gold columns (default). Line
// mode = smooth gold line with a soft yellow gradient area below.
// Mouse-move on the bars container picks the column under the
// cursor by x-position so hovering between gaps OR over empty space
// above a bar still selects the right column in either mode.

import { useMemo, useRef, useState, useTransition } from "react";

type Metric = "tvl" | "apy" | "sharePrice";
type Range = "1M" | "3M" | "1Y" | "ALL";
type ChartStyle = "bars" | "line" | "step";

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

// Each non-ALL range is bucketized to a fixed visual density so the
// bar count stays predictable regardless of how dense the indexer's
// data happens to be. Empty buckets forward-fill from the previous
// bucket so 1M always renders ~30 bars even when the indexer only
// emitted 14 raw points in the last 30 days.
const TARGET_BARS: Record<Range, number> = {
  "1M": 30,
  "3M": 45,
  "1Y": 90,
  ALL: 90,
};

function bucketByTime(sorted: Point[], range: Range): Point[] {
  if (sorted.length === 0) return [];
  const targetBars = TARGET_BARS[range];

  if (range === "ALL") {
    if (sorted.length <= targetBars) return sorted;
    const bucketSize = sorted.length / targetBars;
    const out: Point[] = [];
    for (let i = 0; i < targetBars; i++) {
      const start = Math.floor(i * bucketSize);
      const end = Math.min(sorted.length, Math.floor((i + 1) * bucketSize));
      if (start >= end) continue;
      const slice = sorted.slice(start, end);
      const avgV = slice.reduce((s, p) => s + p.v, 0) / slice.length;
      const midT = slice[Math.floor(slice.length / 2)].t;
      out.push({ t: midT, v: avgV });
    }
    return out;
  }

  // Time-window bucket fill: anchor to the latest observation, walk
  // backward in `targetBars` equal slots, average points that fall
  // inside each slot, forward-fill the most recent prior value when
  // a slot is empty so the chart stays a smooth stairway instead of
  // collapsing to a sparse handful of bars.
  const lastTs = sorted[sorted.length - 1].t;
  const spanSec = RANGE_SECONDS[range as Exclude<Range, "ALL">];
  const startTs = lastTs - spanSec;
  const bucketSec = spanSec / targetBars;

  const firstAtOrAfter = sorted.findIndex((p) => p.t >= startTs);
  let prevValue: number | null = null;
  if (firstAtOrAfter > 0) {
    prevValue = sorted[firstAtOrAfter - 1].v;
  } else if (firstAtOrAfter === 0) {
    prevValue = null;
  } else {
    // No point inside the window; everything is before startTs - use
    // the latest existing value as the seed for forward-fill.
    prevValue = sorted[sorted.length - 1].v;
  }
  let cursor = Math.max(0, firstAtOrAfter);

  const out: Point[] = [];
  for (let i = 0; i < targetBars; i++) {
    const bStart = startTs + i * bucketSec;
    const bEnd = bStart + bucketSec;
    let sum = 0;
    let count = 0;
    while (cursor < sorted.length && sorted[cursor].t < bEnd) {
      if (sorted[cursor].t >= bStart) {
        sum += sorted[cursor].v;
        count++;
      }
      cursor++;
    }
    let v: number;
    if (count > 0) {
      v = sum / count;
      prevValue = v;
    } else if (prevValue !== null) {
      v = prevValue;
    } else {
      continue;
    }
    out.push({ t: bStart + bucketSec / 2, v });
  }
  return out;
}

function metricLabel(m: Metric, isHovering: boolean): string {
  if (m === "tvl") return isHovering ? "TVL" : "Total deposits";
  if (m === "apy") return isHovering ? "APY" : "Current APY (24h)";
  return "Share price";
}

function metricTooltip(m: Metric, latestShare: number | null): string {
  if (m === "tvl") {
    return "Total Value Locked: the USD value of all deposits currently held by the vault contract. Updated every hour from the chain.";
  }
  if (m === "apy") {
    return "Annual Percentage Yield: the latest 24-hour annualized yield reported by our indexer. Variable - moves with market conditions, liquidity and the underlying protocol's reward streams.";
  }
  // Share price
  if (latestShare != null && latestShare > 0) {
    const valueOf1k = latestShare * 1000;
    return `Each deposit mints a share token. Share price starts at 1.0 and grows as yield compounds. Right now this vault's share price is ${latestShare.toFixed(4)}, so $1,000 deposited at inception would today be worth ~$${valueOf1k.toFixed(2)}.`;
  }
  return "Each deposit mints a share token; share price grows above 1.0 as the vault accrues yield. Track its slope to see how the strategy is compounding.";
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
  return new Date(t * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateShort(t: number): string {
  return new Date(t * 1000).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

// Sharp 90-degree staircase: hold each value horizontally until the
// next x, then step vertically to the next y. Reads as a discrete
// "value held until refresh" view of the same series.
function buildStepPaths(ys: number[]): { line: string; area: string } {
  if (ys.length === 0) return { line: "", area: "" };
  if (ys.length === 1) {
    const y = ys[0];
    return {
      line: `M0,${y} L100,${y}`,
      area: `M0,${y} L100,${y} L100,100 L0,100 Z`,
    };
  }
  const xs = ys.map((_, i) => (i / (ys.length - 1)) * 100);
  let line = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 1; i < ys.length; i++) {
    line += ` H${xs[i].toFixed(2)} V${ys[i].toFixed(2)}`;
  }
  const area = `${line} L100,100 L0,100 Z`;
  return { line, area };
}

// SVG path builder: smooth-ish line through point heights via cubic
// catmull-rom segments. Returns both the line path and the matching
// area path (line, then drop to baseline, close back to start).
function buildSmoothPaths(
  ys: number[],
): { line: string; area: string } {
  if (ys.length === 0) return { line: "", area: "" };
  if (ys.length === 1) {
    const y = ys[0];
    return { line: `M0,${y}`, area: `M0,${y} L0,100 Z` };
  }
  const xs = ys.map((_, i) => (i / (ys.length - 1)) * 100);

  let line = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < ys.length - 1; i++) {
    const x0 = xs[Math.max(0, i - 1)];
    const y0 = ys[Math.max(0, i - 1)];
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[i + 1];
    const y2 = ys[i + 1];
    const x3 = xs[Math.min(ys.length - 1, i + 2)];
    const y3 = ys[Math.min(ys.length - 1, i + 2)];

    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    line += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`;
  }
  const area = `${line} L${xs[xs.length - 1].toFixed(2)},100 L0,100 Z`;
  return { line, area };
}

export function TestChart({ series }: Props) {
  const [metric, setMetric] = useState<Metric>("sharePrice");
  const [range, setRange] = useState<Range>("ALL");
  const [style, setStyle] = useState<ChartStyle>("bars");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // Heavy computation memoized on (series, metric, range) only - so
  // mouse-move (which fires hoverIdx updates ~60×/s) and chart-style
  // toggles do NOT re-run sort + filter + downsample + path build.
  // This was the root cause of the perceived "lag" when switching
  // between timeframes: every prior click was followed by a stream
  // of mouse-moves each triggering the whole computation again.
  const { points, heightFor, linePath, areaPath, stepLinePath, stepAreaPath } = useMemo(() => {
    const all = series[metric] ?? [];
    const sorted = [...all].sort((a, b) => a.t - b.t);
    const downs = bucketByTime(sorted, range);

    // Manual min/max loop is faster than Math.min(...values) for
    // arrays larger than a few hundred entries (no spread overhead).
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of downs) {
      if (p.v < minV) minV = p.v;
      if (p.v > maxV) maxV = p.v;
    }
    if (!Number.isFinite(minV)) minV = 0;
    if (!Number.isFinite(maxV)) maxV = 0;
    const span = maxV - minV;
    const heightFor = (v: number): number => {
      if (span <= 0) return 60;
      return ((v - minV) / span) * 92 + 8;
    };

    const ys = downs.map((p) => 100 - heightFor(p.v));
    const smooth = buildSmoothPaths(ys);
    const step = buildStepPaths(ys);

    return {
      points: downs,
      heightFor,
      linePath: smooth.line,
      areaPath: smooth.area,
      stepLinePath: step.line,
      stepAreaPath: step.area,
    };
  }, [series, metric, range]);

  const isHovering =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < points.length;
  const activeIdx = isHovering ? hoverIdx! : points.length - 1;
  const activePoint = points[activeIdx];

  // Default headline value uses the most recent RAW observation for
  // the selected metric (not the last bucket's average). With
  // bucketization the last bucket can average several days of data
  // and drift away from the side-card "24h APY" value, which reads
  // as a data inconsistency. On hover we use the bucketed value so
  // the scrubber still matches what the bar represents.
  const latestRawByMetric = useMemo(() => {
    const out: Record<Metric, number> = { tvl: 0, apy: 0, sharePrice: 0 };
    (["tvl", "apy", "sharePrice"] as Metric[]).forEach((m) => {
      const arr = series[m];
      if (!arr || arr.length === 0) return;
      let max = arr[0];
      for (const p of arr) if (p.t > max.t) max = p;
      out[m] = max.v;
    });
    return out;
  }, [series]);

  const latest = isHovering && activePoint
    ? activePoint.v
    : latestRawByMetric[metric];

  const activeX =
    points.length > 1 ? (activeIdx / (points.length - 1)) * 100 : 50;
  const activeYpct = activePoint ? heightFor(activePoint.v) : 0;

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

  // Range + metric clicks are wrapped in startTransition so React can
  // keep the button feedback snappy and yield to the browser before
  // committing the heavy chart re-render. Hover state is reset
  // synchronously so the headline number snaps to the latest point
  // immediately on click.
  const onRange = (r: Range) => {
    setHoverIdx(null);
    startTransition(() => setRange(r));
  };
  const onMetric = (m: Metric) => {
    setHoverIdx(null);
    startTransition(() => setMetric(m));
  };

  return (
    <div className={`uni-chart-wrap uni-chart--${style}`}>
      <div className="uni-chart-header">
        <div className="uni-bignum" id="performance">
          <div className="uni-bignum-value">{formatValue(metric, latest)}</div>
          <div className="uni-bignum-meta">
            <span
              className="uni-bignum-label"
              data-tooltip={metricTooltip(metric, latestRawByMetric.sharePrice || null)}
            >
              {metricLabel(metric, isHovering)}
            </span>
            {isHovering && activePoint && (
              <>
                <span className="uni-bignum-dot" aria-hidden="true">·</span>
                <span className="uni-bignum-date">{fmtDate(activePoint.t)}</span>
              </>
            )}
          </div>
        </div>
        <div className="uni-tab-text" role="tablist" aria-label="Metric">
          {(["tvl", "apy", "sharePrice"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`uni-tab-btn${metric === m ? " active" : ""}`}
              onClick={() => onMetric(m)}
              aria-pressed={metric === m}
            >
              {m === "tvl" ? "TVL" : m === "apy" ? "APY" : "Share price"}
            </button>
          ))}
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
              {(style === "line" || style === "step") && (
                <svg
                  className="uni-chart-line"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="uni-gold-fade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffb936" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#ffb936" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={style === "line" ? areaPath : stepAreaPath}
                    fill="url(#uni-gold-fade)"
                    stroke="none"
                  />
                  <path
                    d={style === "line" ? linePath : stepLinePath}
                    fill="none"
                    stroke="#ffb936"
                    strokeWidth="2"
                    strokeLinecap={style === "line" ? "round" : "square"}
                    strokeLinejoin={style === "line" ? "round" : "miter"}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
              {(style === "line" || style === "step") && isHovering && activePoint && (
                <>
                  <span
                    className="uni-chart-line-cursor"
                    style={{ left: `${activeX}%` }}
                    aria-hidden="true"
                  />
                  <span
                    className="uni-chart-line-dot"
                    style={{ left: `${activeX}%`, bottom: `${activeYpct}%` }}
                    aria-hidden="true"
                  />
                </>
              )}
            </div>
            <div className="uni-chart-axis">
              <span>{fmtDateShort(points[0].t)}</span>
              {points.length >= 3 && (
                <span>{fmtDateShort(points[Math.floor(points.length / 2)].t)}</span>
              )}
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
              onClick={() => onRange(r)}
              aria-pressed={range === r}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="uni-style-mini" role="tablist" aria-label="Chart style">
          <button
            type="button"
            className={`uni-style-mini-btn${style === "bars" ? " active" : ""}`}
            onClick={() => setStyle("bars")}
            aria-pressed={style === "bars"}
            aria-label="Bar chart"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="13" width="3.5" height="8" rx="1" />
              <rect x="10.25" y="8" width="3.5" height="13" rx="1" />
              <rect x="16.5" y="11" width="3.5" height="10" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            className={`uni-style-mini-btn${style === "line" ? " active" : ""}`}
            onClick={() => setStyle("line")}
            aria-pressed={style === "line"}
            aria-label="Line chart"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 17l6-6 4 4 8-8" />
            </svg>
          </button>
          <button
            type="button"
            className={`uni-style-mini-btn${style === "step" ? " active" : ""}`}
            onClick={() => setStyle("step")}
            aria-pressed={style === "step"}
            aria-label="Step chart"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
              <path d="M3 17 H8 V12 H13 V8 H18 V14 H21" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
