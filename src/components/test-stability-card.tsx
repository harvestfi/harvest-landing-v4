// Combined Stability + Yield Sources card for /test. Replaces the
// separate ConsistencyScore and YieldBreakdown sections, which each
// looked sparse on their own (most vaults have a single yield
// source, so the bar chart was a lonely row). The stability card
// folds the score gauge, key stats and source chips into one
// horizontal block with a clean White Smoke surface.

import type { FullVaultHistory } from "@/lib/history-api";
import { formatAPY } from "@/lib/format";

interface ApySource {
  source: string;
  apy: number;
}

interface Props {
  history: FullVaultHistory;
  asset: string;
  apyBreakdown: ApySource[];
  boostedApy: number | null;
}

const DAY = 24 * 60 * 60;

function computeStability(history: FullVaultHistory) {
  const valid = history.apyHistory.filter((p) => p.apy >= 0);
  if (valid.length === 0) return null;

  const latestTs = valid[valid.length - 1].timestamp;
  const windowStart = latestTs - 30 * DAY;
  const recent = valid.filter((p) => p.timestamp >= windowStart);
  if (recent.length < 5) return null;

  const values = recent.map((p) => p.apy);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean <= 0) return null;

  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  let score: number;
  let label: string;
  if (cv < 0.1) {
    score = Math.round(100 - (cv / 0.1) * 10);
    label = "Very consistent";
  } else if (cv < 0.2) {
    score = Math.round(89 - ((cv - 0.1) / 0.1) * 19);
    label = "Consistent";
  } else if (cv < 0.4) {
    score = Math.round(69 - ((cv - 0.2) / 0.2) * 29);
    label = "Variable";
  } else {
    const clampedCv = Math.min(cv, 1.0);
    score = Math.round(39 - ((clampedCv - 0.4) / 0.6) * 39);
    score = Math.max(0, score);
    label = "Highly variable";
  }

  return {
    score,
    label,
    mean,
    stdDev,
    minApy: Math.min(...values),
    maxApy: Math.max(...values),
    dataPoints: values.length,
  };
}

export function TestStabilityCard({
  history,
  asset,
  apyBreakdown,
  boostedApy,
}: Props) {
  const s = computeStability(history);

  const sources: ApySource[] = [...apyBreakdown];
  if (boostedApy && boostedApy > 0) {
    sources.push({ source: "Compounding boost", apy: boostedApy });
  }
  const positiveSources = sources.filter((src) => src.apy > 0);

  if (!s) {
    return (
      <section className="pp-section uni-stability" id="consistency">
        <h2>Strategy stability</h2>
        <div className="uni-stability-card">
          <p className="uni-stability-empty">
            Insufficient APY history to score stability for this strategy yet.
            At least 5 daily observations in the last 30 days are required.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pp-section uni-stability" id="consistency">
      <h2>Strategy stability</h2>
      <div className="uni-stability-card">
        <div className="uni-stability-grid">
        <div className="uni-stability-left">
        <div className="uni-stability-head">
          <div className="uni-stability-score-block">
            <div className="uni-stability-score">{s.score}</div>
            <div className="uni-stability-out-of">/ 100</div>
          </div>
          <div className="uni-stability-label-block">
            <div
              className="uni-stability-label"
              data-tooltip="Lower coefficient-of-variation in 30-day APY = higher score. 90-100 Very consistent, 70-89 Consistent, 40-69 Variable, 0-39 Highly variable."
            >
              {s.label}
            </div>
            <div className="uni-stability-sublabel">
              Last 30 days · {s.dataPoints} {s.dataPoints === 1 ? "reading" : "readings"} indexed
            </div>
          </div>
        </div>

        {/* VU-meter style score gauge: 20 vertical ticks ramping from
            short (left) to tall (right). Filled gold when the tick
            index falls within the score band; staggered fade-in so
            it reads as "the dial winding up to max", not a static
            progress bar. */}
        <div
          className="uni-stability-meter"
          role="meter"
          aria-valuenow={s.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Stability score ${s.score} of 100`}
        >
          {Array.from({ length: 20 }).map((_, i) => {
            const tickScore = (i + 1) * 5; // 5, 10, 15, ... 100
            const isFilled = tickScore <= s.score;
            // Height ramps from 38% (leftmost) to 100% (rightmost)
            const heightPct = 38 + (i / 19) * 62;
            return (
              <span
                key={i}
                className={`uni-stab-tick${isFilled ? " on" : ""}`}
                style={{
                  height: `${heightPct}%`,
                  animationDelay: `${i * 22}ms`,
                }}
              />
            );
          })}
        </div>
        </div>

        <div className="uni-stability-stats">
          <div className="uni-stability-stat">
            <div
              className="uni-stability-stat-label"
              data-tooltip="Mean of all 30-day APY observations."
            >
              Mean APY
            </div>
            <div className="uni-stability-stat-value">{formatAPY(s.mean)}</div>
          </div>
          <div className="uni-stability-stat">
            <div
              className="uni-stability-stat-label"
              data-tooltip="Standard deviation of daily APY across the 30-day window. Smaller = steadier yield."
            >
              Volatility
            </div>
            <div className="uni-stability-stat-value">±{s.stdDev.toFixed(2)}%</div>
          </div>
          <div className="uni-stability-stat">
            <div
              className="uni-stability-stat-label"
              data-tooltip="Lowest and highest single APY observation in the last 30 days."
            >
              30-day range
            </div>
            <div className="uni-stability-stat-value">
              {s.minApy.toFixed(2)}% to {s.maxApy.toFixed(2)}%
            </div>
          </div>
          <div className="uni-stability-stat">
            <div
              className="uni-stability-stat-label"
              data-tooltip="Where this strategy's yield comes from. Multiple sources are listed with their individual APY contribution."
            >
              Yield from
            </div>
            <div className="uni-stability-sources">
              {positiveSources.length === 0 ? (
                <span className="uni-stability-stat-value">{asset}</span>
              ) : (
                positiveSources.map((src) => (
                  <span key={src.source} className="uni-stability-source-chip">
                    <span className="uni-stability-source-name">{src.source}</span>
                    <span className="uni-stability-source-apy">{src.apy.toFixed(2)}%</span>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
