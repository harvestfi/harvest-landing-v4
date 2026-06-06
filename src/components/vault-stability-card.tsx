// Combined Stability + Yield Sources card for /test. Replaces the
// separate ConsistencyScore and YieldBreakdown sections, which each
// looked sparse on their own (most vaults have a single yield
// source, so the bar chart was a lonely row). The stability card
// folds the score gauge, key stats and source chips into one
// horizontal block with a clean White Smoke surface.

import type { FullVaultHistory } from "@/lib/history-api";
import { freshness } from "@/lib/freshness";
import { formatAPY } from "@/lib/format";
import { AssetIcon } from "./token-icons";

interface Props {
  history: FullVaultHistory;
  asset: string;
}

const DAY = 24 * 60 * 60;

function computeStability(history: FullVaultHistory) {
  const valid = history.apyHistory.filter((p) => p.apy >= 0);
  if (valid.length === 0) return null;

  // Anchor to the freshest reading across series, not the APY tail. If
  // the APY feed has gone stale while another series stays fresh, the
  // recent window holds no APY points and the card suppresses itself -
  // rather than scoring "last 30 days" stability from year-old data.
  const { freshestTs } = freshness(history);
  const windowStart = freshestTs - 30 * DAY;
  const recent = valid.filter((p) => p.timestamp >= windowStart);
  if (recent.length < 5) return null;

  const values = recent.map((p) => p.apy);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean <= 0) return null;

  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Score lands in 0..100 from the CV ramp. Label is derived
  // strictly from the score per the editorial 5-zone mapping so the
  // two never disagree (the previous "label set in the CV branch"
  // approach drifted out of sync with score thresholds, e.g.
  // CV-based label said "Highly variable" while the score was 10
  // which the spec maps to "Very volatile").
  let score: number;
  if (cv < 0.1) {
    score = Math.round(100 - (cv / 0.1) * 10);
  } else if (cv < 0.2) {
    score = Math.round(89 - ((cv - 0.1) / 0.1) * 19);
  } else if (cv < 0.4) {
    score = Math.round(69 - ((cv - 0.2) / 0.2) * 29);
  } else {
    const clampedCv = Math.min(cv, 1.0);
    score = Math.round(39 - ((clampedCv - 0.4) / 0.6) * 39);
    score = Math.max(0, score);
  }
  const label = labelForScore(score);

  // Suppress the score (but keep the stats) for genuinely fresh
  // vaults. A vault with five days of tracking and six readings has
  // not had time to demonstrate stability one way or the other -
  // rendering "Score: 0 / 100 - Very volatile" misreads as a verdict.
  // Established vaults with sparse snapshots remain meaningful, so
  // both conditions (under 30 days tracked AND under 14 readings)
  // must hold before suppression triggers.
  const trackedDays = Math.round(
    (valid[valid.length - 1].timestamp - valid[0].timestamp) / DAY,
  );
  const readingsIndexed = valid.length;
  const suppressScore = trackedDays < 30 && readingsIndexed < 14;

  return {
    score,
    label,
    mean,
    stdDev,
    minApy: Math.min(...values),
    maxApy: Math.max(...values),
    dataPoints: values.length,
    suppressScore,
  };
}

// Map score (0..100) to the editorial 5-zone label per the
// punch-list spec. Boundaries are inclusive on the lower end and
// exclusive on the upper end so each score maps to exactly one
// label and the two never disagree at thresholds.
function labelForScore(score: number): string {
  if (score >= 80) return "Very consistent";
  if (score >= 60) return "Consistent";
  if (score >= 40) return "Moderately variable";
  if (score >= 20) return "Highly variable";
  return "Very volatile";
}

// Label colour follows a 5-zone ramp matching the score thresholds
// so the headline status word inherits the tier colour and the
// gauge + label visually agree on what "92" or "10" means.
function labelColorForScore(score: number): string {
  if (score < 20) return "#c2362f"; // Very volatile - deep red
  if (score < 40) return "#e5484d"; // Highly variable - red
  if (score < 60) return "#f4801a"; // Moderately variable - amber
  if (score < 80) return "#ffb936"; // Consistent - gold
  return "#27a567"; // Very consistent - green
}

export function VaultStabilityCard({ history, asset }: Props) {
  const s = computeStability(history);

  // Window framing: with under a month of data, "the last 30 days"
  // overstates the window, so the subtitle / sublabel / range say
  // "since launch" instead of claiming a 30-day window.
  const apyTs = history.apyHistory
    .filter((p) => p.apy >= 0)
    .map((p) => p.timestamp);
  const trackedDays =
    apyTs.length >= 2
      ? Math.round((Math.max(...apyTs) - Math.min(...apyTs)) / 86400)
      : 0;
  const young = trackedDays > 0 && trackedDays < 30;
  const subtitle = young
    ? "Based on APY volatility since launch. Higher scores indicate steadier yields."
    : "Based on APY volatility over the last 30 days. Higher scores indicate steadier yields.";

  if (!s) {
    return (
      <section className="pp-section uni-stability" id="consistency">
        <h2>Strategy stability</h2>
        <p className="uni-stability-subtitle">{subtitle}</p>
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
      <p className="uni-stability-subtitle">{subtitle}</p>
      <div className="uni-stability-card">
        <div className="uni-stability-grid">
        <div className="uni-stability-left">
        {s.suppressScore ? (
          // Fresh-vault suppression: keep the stats block but replace
          // the score gauge with a "not available" notice. A score of
          // 0/100 from six readings reads as a verdict, which it
          // isn't.
          <div className="uni-stability-empty-block">
            <p className="uni-stability-empty">
              Score not available - insufficient data (less than 14
              daily readings indexed within the first 30 days of
              tracking).
            </p>
          </div>
        ) : (
          <>
            <div className="uni-stability-head">
              <div className="uni-stability-score-block">
                <div className="uni-stability-score">{s.score}</div>
                <div className="uni-stability-out-of">/ 100</div>
              </div>
              <div className="uni-stability-label-block">
                <div
                  className="uni-stability-label"
                  data-tooltip="Lower coefficient-of-variation in 30-day APY = higher score. 80-100 Very consistent, 60-79 Consistent, 40-59 Moderately variable, 20-39 Highly variable, 0-19 Very volatile."
                  style={{ color: labelColorForScore(s.score) }}
                >
                  {s.label}
                </div>
                <div className="uni-stability-sublabel">
                  {young ? "Since launch" : "Last 30 days"} · {s.dataPoints} {s.dataPoints === 1 ? "reading" : "readings"} indexed
                </div>
              </div>
            </div>

            {/* VU-meter style score gauge: 20 vertical ticks ramping
                from short (left) to tall (right). Filled gold when
                the tick index falls within the score band; staggered
                fade-in so it reads as "the dial winding up to max",
                not a static progress bar. */}
            <div
              className="uni-stability-meter"
              role="meter"
              aria-valuenow={s.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Stability score ${s.score} of 100`}
            >
              {Array.from({ length: 20 }).map((_, i) => {
                const tickScore = (i + 1) * 5;
                const isFilled = tickScore <= s.score;
                const heightPct = 38 + (i / 19) * 62;
                const tickColor = labelColorForScore(s.score);
                return (
                  <span
                    key={i}
                    className={`uni-stab-tick${isFilled ? " on" : ""}`}
                    style={{
                      height: `${heightPct}%`,
                      animationDelay: `${i * 22}ms`,
                      ...(isFilled ? { background: tickColor } : {}),
                    }}
                  />
                );
              })}
            </div>
          </>
        )}
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
              {young ? "Range since launch" : "30-day range"}
            </div>
            <div className="uni-stability-stat-value">
              {s.minApy.toFixed(2)}% to {s.maxApy.toFixed(2)}%
            </div>
          </div>
          <div className="uni-stability-stat">
            <div
              className="uni-stability-stat-label"
              data-tooltip="The underlying asset this strategy emits yield in. Deposits + accrued returns are denominated in this token."
            >
              Yield Output
            </div>
            <div className="uni-stability-sources">
              <span className="uni-stability-source-chip">
                <AssetIcon asset={asset} size={16} />
                <span className="uni-stability-source-ticker">{asset}</span>
              </span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
