"use client";

// Five-segment timeframe picker used in the top-right of each
// Acquisition chart header. Same flagship treatment as the active
// funnel tab + sidebar item: gold pill on the active segment,
// muted ink on the rest. Mono labels so the row reads as a
// numeric chip rather than a copy element.

export type Timeframe = "7d" | "30d" | "90d" | "180d" | "all";

const OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "all", label: "All" },
  { value: "180d", label: "180d" },
  { value: "90d", label: "90d" },
  { value: "30d", label: "30d" },
  { value: "7d", label: "7d" },
];

// Number of days the timeframe represents. For "all" we compute the
// span from the data and cap at maxDays so the bar count stays
// readable.
export function timeframeFixedDays(tf: Timeframe): number | null {
  if (tf === "7d") return 7;
  if (tf === "30d") return 30;
  if (tf === "90d") return 90;
  if (tf === "180d") return 180;
  return null;
}

export function resolveDays(
  tf: Timeframe,
  oldestTimestampMs: number | null,
  maxDays = 365,
  fallback = 30,
): number {
  const fixed = timeframeFixedDays(tf);
  if (fixed !== null) return fixed;
  if (!oldestTimestampMs) return fallback;
  const span = Math.ceil((Date.now() - oldestTimestampMs) / 86_400_000);
  return Math.min(Math.max(7, span), maxDays);
}

export function TimeframeSelector({
  value,
  onChange,
}: {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}) {
  return (
    <div className="aq-timeframe" role="tablist" aria-label="Chart timeframe">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`aq-timeframe-tab${value === opt.value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
