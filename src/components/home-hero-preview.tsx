"use client";

// Interactive preview card on the right half of the homepage hero.
// Reads as a tilted screenshot of a single-product-page hero rising
// from the bottom edge of the gold box: gives a visual cue of what a
// vault page actually looks like, anchors the empty right side of
// the hero, and reinforces the brand without a marketing image.
//
// Interactive: metric (TVL / APY / Share price), timeframe (1M /
// 3M / 1Y / ALL) and chart style (bars / line / step) all toggle
// against deterministic dummy data so the card behaves like the
// real chart on /[slug] without a live data dependency.

import { useState } from "react";
import { AssetIcon, ChainIcon } from "./token-icons";

type Metric = "apy" | "tvl" | "sharePrice";
type Range = "1M" | "3M" | "1Y" | "ALL";
type Style = "bars" | "line" | "step";

// Deterministic dummy series per metric x range. Values are
// percentages of the chart-area height (0..100). Lengths are tuned
// per range so the chart density feels right without dropping below
// 16 bars on the longest window.
const SERIES: Record<Metric, Record<Range, number[]>> = {
  apy: {
    "1M": [62, 71, 58, 84, 76, 90, 88, 95, 82, 78, 70, 92, 86, 81, 74, 88, 79, 84, 90, 76, 83, 87, 84, 100],
    "3M": [48, 55, 60, 52, 64, 70, 65, 72, 78, 74, 80, 82, 76, 84, 88, 82, 86, 90, 86, 92, 88, 94, 90, 100],
    "1Y": [40, 44, 48, 52, 50, 56, 60, 58, 62, 66, 70, 68, 74, 78, 76, 82, 80, 86, 88, 84, 92, 90, 95, 100],
    ALL: [22, 30, 28, 36, 42, 38, 46, 52, 50, 58, 62, 60, 66, 70, 68, 74, 80, 78, 84, 88, 90, 94, 96, 100],
  },
  tvl: {
    "1M": [50, 54, 58, 62, 60, 66, 64, 68, 72, 70, 74, 78, 76, 80, 82, 84, 82, 86, 88, 90, 88, 92, 94, 100],
    "3M": [38, 42, 46, 50, 54, 58, 56, 60, 64, 62, 66, 70, 68, 72, 76, 74, 78, 82, 80, 84, 88, 90, 92, 100],
    "1Y": [28, 32, 36, 40, 44, 42, 48, 52, 50, 56, 60, 58, 64, 68, 66, 72, 76, 74, 80, 84, 86, 90, 94, 100],
    ALL: [12, 18, 24, 30, 36, 32, 40, 46, 42, 50, 56, 52, 60, 66, 62, 70, 76, 72, 80, 86, 88, 92, 96, 100],
  },
  sharePrice: {
    "1M": [86, 87, 87, 88, 88, 89, 89, 90, 91, 91, 92, 92, 93, 93, 94, 94, 95, 95, 96, 96, 97, 98, 98, 100],
    "3M": [78, 80, 81, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 92, 93, 94, 95, 96, 96, 97, 98, 98, 99, 100],
    "1Y": [60, 64, 66, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 91, 92, 94, 95, 96, 97, 98, 99, 99, 100],
    ALL: [40, 46, 50, 54, 58, 62, 66, 70, 73, 76, 79, 82, 84, 86, 88, 90, 92, 94, 96, 97, 98, 99, 99, 100],
  },
};

const HEADLINE: Record<Metric, { value: string; label: string }> = {
  apy: { value: "12.93%", label: "24h APY" },
  tvl: { value: "$2.0M", label: "Total value locked" },
  sharePrice: { value: "1.0481", label: "Share price" },
};

const RANGES: Range[] = ["1M", "3M", "1Y", "ALL"];

// Optional vault override: when supplied (e.g. from /admin/studio),
// the card renders real production data instead of the dummy
// landing-page series. Range pills + chart-style toggles still
// work as visual states, they just don't change the underlying
// snapshot series.
export type HeroPreviewVault = {
  productName: string;
  asset: string;
  chain: string;
  protocol: string;
  vaultType?: string;
  apy24h: number;
  apy30d: number;
  tvl: number;
  apySpark: number[];
  tvlSpark: number[];
};

function formatAPY(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}
function formatTVL(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1000)}K`;
  return `$${value.toFixed(0)}`;
}

// Normalize a real spark series to bar heights on the 24-bar grid
// the dummy series uses. Two guarantees:
//   - empty/short series get padded with the average of the real
//     values (was: padded with the first value, which left a
//     visible "flat shelf" at the start of the chart)
//   - heights map to 30..100 (not 0..100), so no bar collapses
//     into the chart floor and the row never reads as "empty".
//     30% is enough to register visually while preserving the
//     relative shape between min and max.
function normalizeSeries(values: number[], target: number = 24): number[] {
  if (!values || values.length === 0) {
    return Array.from({ length: target }, () => 60);
  }
  let sampled: number[];
  if (values.length >= target) {
    const step = (values.length - 1) / (target - 1);
    sampled = Array.from(
      { length: target },
      (_, i) => values[Math.round(i * step)],
    );
  } else {
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    sampled = [
      ...Array.from({ length: target - values.length }, () => avg),
      ...values,
    ];
  }
  const max = Math.max(...sampled);
  const min = Math.min(...sampled);
  const span = max - min;
  if (span === 0) return sampled.map(() => 60);
  return sampled.map((v) => 30 + ((v - min) / span) * 70);
}

export function HomeHeroPreview({
  vault,
  headlineValueOverride,
  headlineLabelOverride,
  lastBarHeightOverride,
  secondLastBarHeightOverride,
  apyTabLabel,
  variant = "home",
}: {
  vault?: HeroPreviewVault;
  // Studio override: when a non-empty string is supplied, replace
  // the auto-derived headline value/label. Empty string or
  // undefined falls back to the vault-driven default.
  headlineValueOverride?: string;
  headlineLabelOverride?: string;
  // Studio overrides: manually pin the last and/or second-to-last
  // bar to a specific height (0..100 in the chart's normalized
  // space). Lets us dramatize the trend on the rightmost bars
  // for social posts.
  lastBarHeightOverride?: number;
  secondLastBarHeightOverride?: number;
  // Optional label override for the "APY" tab in the footer row
  // (e.g. "Perf." for performance). Other tabs unchanged.
  // Defaults to "APY" when undefined or empty.
  apyTabLabel?: string;
  // "home" (default): original layout used on the landing page -
  //   View CTA floats absolute in the top-right corner, no
  //   Harvest mark inside the card.
  // "studio": extra topbar row with Harvest mark on the left and
  //   View pill on the right, so the title row below has the full
  //   card width for long product names.
  variant?: "home" | "studio";
} = {}) {
  const [metric, setMetric] = useState<Metric>("apy");
  const [range, setRange] = useState<Range>("1M");
  const [style, setStyle] = useState<Style>("bars");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // When a real vault is supplied, the underlying series + headline
  // override the dummy data. Range toggles still flip the visual
  // active pill but reuse the same snapshot series (we only have
  // one daily-aggregated set, not per-range bucketing).
  const baseSeries = vault
    ? normalizeSeries(metric === "tvl" ? vault.tvlSpark : vault.apySpark)
    : SERIES[metric][range];
  // Studio overrides: clamp the rightmost two bars to user-set
  // heights (0..100) when supplied, so the trailing trend can be
  // dramatized without rebuilding the series.
  const series = (() => {
    if (baseSeries.length === 0) return baseSeries;
    const clamp = (v: number) => Math.max(4, Math.min(100, v));
    const last = baseSeries.length - 1;
    const next = [...baseSeries];
    if (
      typeof secondLastBarHeightOverride === "number" &&
      Number.isFinite(secondLastBarHeightOverride) &&
      last - 1 >= 0
    ) {
      next[last - 1] = clamp(secondLastBarHeightOverride);
    }
    if (
      typeof lastBarHeightOverride === "number" &&
      Number.isFinite(lastBarHeightOverride)
    ) {
      next[last] = clamp(lastBarHeightOverride);
    }
    return next;
  })();
  const baseHeadline = vault
    ? {
        value:
          metric === "tvl"
            ? formatTVL(vault.tvl)
            : metric === "apy"
              ? formatAPY(vault.apy24h)
              : "1.0000",
        label:
          metric === "tvl"
            ? "Total value locked"
            : metric === "apy"
              ? "24h APY"
              : "Share price",
      }
    : HEADLINE[metric];
  const headline = {
    value: headlineValueOverride?.trim() || baseHeadline.value,
    label: headlineLabelOverride?.trim() || baseHeadline.label,
  };

  // Build SVG paths for line + step modes once per (series).
  // viewBox is 0..100 wide and 0..100 tall (top), so we invert y.
  const linePath = series
    .map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * 100;
      const y = 100 - v;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const stepPath = series
    .map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * 100;
      const y = 100 - v;
      if (i === 0) return `M${x.toFixed(2)},${y.toFixed(2)}`;
      const prevY = 100 - series[i - 1];
      return `L${x.toFixed(2)},${prevY.toFixed(2)} L${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  // When hovering a bar, the headline shows that bar's value
  // remapped from 0..100 percentage back to a metric-shaped string.
  const display =
    hoverIdx === null
      ? headline
      : { value: synthesizeValue(metric, series[hoverIdx]), label: headline.label };

  return (
    <aside className="uni-home-hero-preview" aria-hidden="true">
      <div className="uni-home-hero-preview-card">
        {variant === "studio" ? (
          // Studio variant: dedicated topbar row with Harvest mark
          // on the left and View pill on the right. Frees the title
          // row below for full-width text so long product names
          // don't get clipped by the absolute-positioned CTA.
          <header className="prevcard-topbar">
            <span className="prevcard-mark">
              <span>Harvest</span>
              <span className="prevcard-mark-dot" aria-hidden="true" />
            </span>
            <span className="prevcard-cta">
              View
              <span className="prevcard-cta-arrow">↗</span>
            </span>
          </header>
        ) : (
          // Homepage default: View CTA floats absolute in the
          // top-right corner of the card, no Harvest mark.
          <span className="prevcard-cta">
            View
            <span className="prevcard-cta-arrow">↗</span>
          </span>
        )}

        {/* Title row: icon + product name + byline */}
        <header className="prevcard-head">
          <span className="prevcard-icon">
            <AssetIcon asset={vault?.asset ?? "USDC"} size={36} />
          </span>
          <div className="prevcard-id">
            <h3 className="prevcard-name">
              {vault?.productName ?? "USDC Alpha V2"}
            </h3>
            <p className="prevcard-byline">
              <span className="prevcard-byline-chain">
                <ChainIcon chain={vault?.chain ?? "Base"} size={11} />
                {vault?.chain ?? "Base"}
              </span>
              <span aria-hidden="true">·</span>
              <span>{vault?.protocol ?? "Harvest"}</span>
              <span aria-hidden="true">·</span>
              <span>{vault?.vaultType || "Morpho"}</span>
            </p>
          </div>
        </header>

        {/* Big number */}
        <div className="prevcard-bignum">
          <span className="prevcard-bignum-value">{display.value}</span>
          <span className="prevcard-bignum-label">{display.label}</span>
        </div>

        {/* Range pills */}
        <div className="prevcard-ranges" role="tablist" aria-label="Range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={r === range}
              className={`prevcard-range${r === range ? " active" : ""}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div
          className="prevcard-chart"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {style === "bars" ? (
            <div className="prevcard-bars">
              {series.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Bar ${i + 1}`}
                  className={`prevcard-bar${hoverIdx === i ? " hover" : ""}`}
                  style={{ height: `${h}%` }}
                  onMouseEnter={() => setHoverIdx(i)}
                  onFocus={() => setHoverIdx(i)}
                  onBlur={() => setHoverIdx(null)}
                />
              ))}
            </div>
          ) : (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="prevcard-line"
            >
              <path
                d={style === "line" ? linePath : stepPath}
                fill="none"
                stroke="#ffb936"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </div>

        {/* Tabs row + style selector */}
        <div className="prevcard-foot">
          <div className="prevcard-tabs" role="tablist" aria-label="Metric">
            {(["tvl", "apy", "sharePrice"] as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={m === metric}
                className={`prevcard-tab${m === metric ? " active" : ""}`}
                onClick={() => setMetric(m)}
              >
                {m === "tvl"
                  ? "TVL"
                  : m === "apy"
                    ? apyTabLabel?.trim() || "APY"
                    : "Share price"}
              </button>
            ))}
          </div>
          <div className="prevcard-style" role="tablist" aria-label="Chart style">
            <button
              type="button"
              role="tab"
              aria-selected={style === "bars"}
              aria-label="Bars"
              className={`prevcard-style-btn${style === "bars" ? " active" : ""}`}
              onClick={() => setStyle("bars")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="7" width="2" height="5" rx="0.5" fill="currentColor" />
                <rect x="6" y="4" width="2" height="8" rx="0.5" fill="currentColor" />
                <rect x="10" y="6" width="2" height="6" rx="0.5" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={style === "line"}
              aria-label="Line"
              className={`prevcard-style-btn${style === "line" ? " active" : ""}`}
              onClick={() => setStyle("line")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 10 5 6 8 8 12 3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={style === "step"}
              aria-label="Step"
              className={`prevcard-style-btn${style === "step" ? " active" : ""}`}
              onClick={() => setStyle("step")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 10 5 10 5 6 8 6 8 8 12 8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Map a 0..100 percentage back to a metric-shaped display string so
// the bignum updates plausibly when a bar is hovered. Pure cosmetic;
// the absolute values aren't backed by anything.
function synthesizeValue(metric: Metric, pct: number): string {
  switch (metric) {
    case "apy": {
      // Range roughly 0.50% .. 13.5%
      const v = 0.5 + (pct / 100) * 13;
      return `${v.toFixed(2)}%`;
    }
    case "tvl": {
      // Range roughly $200K .. $2.1M
      const v = 200_000 + (pct / 100) * 1_900_000;
      if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      return `$${Math.round(v / 1000)}K`;
    }
    case "sharePrice": {
      // Range 1.000 .. 1.050
      const v = 1 + (pct / 100) * 0.05;
      return v.toFixed(4);
    }
  }
}
