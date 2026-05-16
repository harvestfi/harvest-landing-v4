import { formatAPY, formatTVL } from "@/lib/format";
import { depositRef, apyToMonthly, fmtEarnings } from "@/lib/contextualize";
import type { FullVaultHistory } from "@/lib/history-api";

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Plain-language explanations attached to each metric label as a
// data-tooltip attribute. Surfaces only render visually where CSS
// hooks them (currently /test only); production HTML carries the
// attribute as a no-op.
const APY_LABEL_TOOLTIPS: Record<string, string> = {
  "30D Low": "The lowest single APY observation recorded over the last 30 days.",
  "30D High": "The highest single APY observation recorded over the last 30 days.",
  "30D Average": "Mean of all daily APY observations in the last 30 days. Negative readings are filtered out.",
  "Median APY": "The middle value of the 30-day APY distribution. Less sensitive to outlier spikes than the mean.",
  "Best day": "The single calendar day in the last 30 days with the highest indexed APY.",
  "Worst day": "The single calendar day in the last 30 days with the lowest indexed APY.",
  "Volatility": "Standard deviation of daily APY across the 30-day window. Higher number = more day-to-day swings.",
  "APY range": "30D high minus 30D low, expressed in percentage points (pp).",
};
const TVL_LABEL_TOOLTIPS: Record<string, string> = {
  "30D Low": "The lowest TVL value recorded by the indexer over the last 30 days.",
  "30D High": "The highest TVL value recorded by the indexer over the last 30 days.",
  "30D Average": "Mean of all daily TVL observations in the last 30 days.",
  "Median TVL": "The middle value of the 30-day TVL distribution. Robust to inflow/outflow spikes.",
  "Best day": "The single calendar day in the last 30 days with the highest TVL.",
  "Worst day": "The single calendar day in the last 30 days with the lowest TVL.",
  "Current TVL": "Most recent TVL value we have indexed for this strategy.",
  "Largest daily change": "The biggest absolute movement (inflow or outflow) between two consecutive daily TVL points in the last 30 days.",
};
function tooltipFor(label: string, kind: "apy" | "tvl"): string | undefined {
  if (label.startsWith("Lifetime avg")) {
    return kind === "apy"
      ? "Mean APY across the entire indexed history of this strategy."
      : "Mean TVL across the entire indexed history of this strategy.";
  }
  return kind === "apy" ? APY_LABEL_TOOLTIPS[label] : TVL_LABEL_TOOLTIPS[label];
}

export function HistoricalStats({ history, asset }: { history: FullVaultHistory; asset: string }) {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 86400;

  const apy30d = history.apyHistory.filter((p) => p.apy >= 0 && p.timestamp >= thirtyDaysAgo);
  const allApy = history.apyHistory.filter((p) => p.apy >= 0);
  const tvl30d = history.tvlHistory.filter((p) => p.timestamp >= thirtyDaysAgo);

  if (allApy.length < 3 && tvl30d.length < 3) return null;

  const apyValues = apy30d.map((p) => p.apy);
  const allApyValues = allApy.map((p) => p.apy);

  const apyStats = apyValues.length >= 2 ? {
    low: Math.min(...apyValues),
    high: Math.max(...apyValues),
    avg: apyValues.reduce((s, v) => s + v, 0) / apyValues.length,
    lifetimeAvg: allApyValues.reduce((s, v) => s + v, 0) / allApyValues.length,
    med: median(apyValues),
    bestDay: apy30d.reduce((best, p) => p.apy > best.apy ? p : best, apy30d[0]),
    worstDay: apy30d.reduce((worst, p) => p.apy < worst.apy ? p : worst, apy30d[0]),
    vol: stdDev(apyValues),
    dataPoints: allApy.length,
    range: Math.max(...apyValues) - Math.min(...apyValues),
  } : null;

  const tvlValues = tvl30d.filter((p) => p.value > 0).map((p) => p.value);
  const allTvl = history.tvlHistory.filter((p) => p.value > 0);
  const allTvlValues = allTvl.map((p) => p.value);

  let tvlLargestChange = 0;
  if (tvl30d.length >= 2) {
    const chronological = [...tvl30d]
      .filter((p) => p.value > 0)
      .sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 1; i < chronological.length; i++) {
      const change = Math.abs(chronological[i].value - chronological[i - 1].value);
      if (change > tvlLargestChange) tvlLargestChange = change;
    }
  }

  const tvlStats = tvlValues.length >= 2 ? {
    low: Math.min(...tvlValues),
    high: Math.max(...tvlValues),
    avg: tvlValues.reduce((s, v) => s + v, 0) / tvlValues.length,
    lifetimeAvg: allTvlValues.length > 0 ? allTvlValues.reduce((s, v) => s + v, 0) / allTvlValues.length : 0,
    med: median(tvlValues),
    current: tvl30d[tvl30d.length - 1]?.value || 0,
    largestChange: tvlLargestChange,
    bestDay: tvl30d.filter((p) => p.value > 0).reduce((best, p) => p.value > best.value ? p : best, tvl30d[0]),
    worstDay: tvl30d.filter((p) => p.value > 0).reduce((worst, p) => p.value < worst.value ? p : worst, tvl30d[0]),
    dataPoints: allTvl.length,
  } : null;

  const apyRows = apyStats
    ? [
        { label: "30D Low", value: formatAPY(apyStats.low) },
        { label: "30D High", value: formatAPY(apyStats.high) },
        { label: "30D Average", value: formatAPY(apyStats.avg) },
        { label: `Lifetime avg (${apyStats.dataPoints}d)`, value: formatAPY(apyStats.lifetimeAvg) },
        { label: "Median APY", value: formatAPY(apyStats.med) },
        { label: "Best day", value: `${formatAPY(apyStats.bestDay.apy)} · ${formatDate(apyStats.bestDay.timestamp)}` },
        { label: "Worst day", value: `${formatAPY(apyStats.worstDay.apy)} · ${formatDate(apyStats.worstDay.timestamp)}` },
        { label: "Volatility", value: `${apyStats.vol.toFixed(2)} ${apyStats.vol > 5 ? "High" : apyStats.vol > 2 ? "Medium" : "Low"}` },
        { label: "APY range", value: `${apyStats.range.toFixed(2)}pp` },
      ]
    : [];

  const tvlRows = tvlStats
    ? [
        { label: "30D Low", value: formatTVL(tvlStats.low) },
        { label: "30D High", value: formatTVL(tvlStats.high) },
        { label: "30D Average", value: formatTVL(tvlStats.avg) },
        { label: `Lifetime avg (${tvlStats.dataPoints}d)`, value: formatTVL(tvlStats.lifetimeAvg) },
        { label: "Median TVL", value: formatTVL(tvlStats.med) },
        { label: "Best day", value: `${formatTVL(tvlStats.bestDay.value)} · ${formatDate(tvlStats.bestDay.timestamp)}` },
        { label: "Worst day", value: `${formatTVL(tvlStats.worstDay.value)} · ${formatDate(tvlStats.worstDay.timestamp)}` },
        { label: "Current TVL", value: formatTVL(tvlStats.current) },
        { label: "Largest daily change", value: formatTVL(tvlStats.largestChange) },
      ]
    : [];

  // Split a single block into two columns when the other block is absent
  // so the section fills the full width.
  const splitApy = apyStats && !tvlStats && apyRows.length >= 4;
  const splitTvl = tvlStats && !apyStats && tvlRows.length >= 4;
  const apyHalf = splitApy ? Math.ceil(apyRows.length / 2) : apyRows.length;
  const tvlHalf = splitTvl ? Math.ceil(tvlRows.length / 2) : tvlRows.length;

  // Narrative intro paragraph: trend direction over lifetime
  const narratives: string[] = [];

  if (apyStats && apyStats.dataPoints >= 60) {
    const ref = depositRef(asset);
    const sorted = [...allApy].sort((a, b) => a.timestamp - b.timestamp);
    const firstQuarter = sorted.slice(0, Math.ceil(sorted.length / 4));
    const lastQuarter = sorted.slice(-Math.ceil(sorted.length / 4));
    const earlyAvg = firstQuarter.reduce((s, p) => s + p.apy, 0) / firstQuarter.length;
    const lateAvg = lastQuarter.reduce((s, p) => s + p.apy, 0) / lastQuarter.length;
    const changePct = earlyAvg > 0 ? ((lateAvg - earlyAvg) / earlyAvg) * 100 : 0;
    if (Math.abs(changePct) > 10) {
      // No "upward/downward trend" framing - "trend" implies
      // persistence and forecastability the data may not support.
      // State endpoints + delta neutrally; let the user infer.
      const direction = changePct > 0 ? "increase" : "decrease";
      let text = `Over the past ${apyStats.dataPoints} days, this vault's APY has moved from ${earlyAvg.toFixed(2)}% to ${lateAvg.toFixed(2)}%, a ${Math.abs(changePct).toFixed(1)}% ${direction}.`;

      // Always render the monthly-earnings comparison. The outer
      // gate (changePct > 10%) already filters out windows where the
      // delta is too small to be meaningful, so by this point both
      // sentences carry information. The previous $1/mo threshold
      // suppressed the comparison for non-USD vaults (where ref.amount
      // = 1 instead of 1000 makes the unit-denominated diff tiny even
      // when the underlying APY change is large).
      const earlyMonthly = apyToMonthly(earlyAvg, ref.amount);
      const lateMonthly = apyToMonthly(lateAvg, ref.amount);
      text += ` At the start of the window, ${ref.label} would have earned ${fmtEarnings(earlyMonthly, asset)}/mo at then-current rates; at recent rates, ${fmtEarnings(lateMonthly, asset)}/mo.`;

      narratives.push(text);
    }
  }

  if (tvlStats) {
    const sorted = [...history.tvlHistory]
      .filter((p) => p.value > 0)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length >= 2) {
      // Conditional TVL narrative per the editorial spec. The
      // inception-comparison framing (old default) produced
      // misleading +312% percentages when inception TVL was near
      // zero. 80% of peak is the cutoff between "near peak / still
      // trending" (narrative A) and "past peak" (narrative B).
      // Below 10 data points we fall back to a minimal sentence so
      // the section always carries a TVL paragraph - the prior
      // length-only gate was silently hiding it on freshly indexed
      // LP-pair vaults that had < 10 positive TVL snapshots.
      const first = sorted[0].value;
      const last = sorted[sorted.length - 1].value;
      const peak = sorted.reduce(
        (best, p) => (p.value > best.value ? p : best),
        sorted[0],
      );
      const days = Math.max(
        0,
        Math.round(
          (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400,
        ),
      );
      if (sorted.length >= 10 && peak.value > 0 && last >= 0.8 * peak.value) {
        // Narrative A: growth-since-inception (no %, just endpoints).
        narratives.push(
          `Total value locked currently sits at ${formatTVL(last)}, up from ${formatTVL(first)} at the start of tracking. The vault has been live for ${days} days.`,
        );
      } else if (sorted.length >= 10 && peak.value > 0) {
        // Narrative B: peak-and-current. Peak date is derived from
        // the peak snapshot's timestamp, formatted Month YYYY. If
        // the timestamp is missing or unparseable, drop the date
        // clause as graceful degradation rather than rendering "on
        // Invalid Date".
        const pct = Math.round((last / peak.value) * 100);
        let peakDate: string | null = null;
        if (Number.isFinite(peak.timestamp) && peak.timestamp > 0) {
          const d = new Date(peak.timestamp * 1000);
          if (!Number.isNaN(d.getTime())) {
            peakDate = d.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            });
          }
        }
        narratives.push(
          peakDate
            ? `Total value locked currently sits at ${formatTVL(last)}, which is ${pct}% of its all-time peak of ${formatTVL(peak.value)} reached on ${peakDate}.`
            : `Total value locked currently sits at ${formatTVL(last)}, which is ${pct}% of its all-time peak of ${formatTVL(peak.value)}.`,
        );
      } else {
        // Fallback: minimal but always-present sentence for vaults
        // with < 10 positive TVL points or missing peak data.
        narratives.push(
          `Total value locked currently sits at ${formatTVL(last)}. The vault has been live for ${days} days.`,
        );
      }
    }
  }

  return (
    <section className="pp-section" id="history">
      <h2>Historical statistics</h2>
      {narratives.length > 0 && (
        <div className="about-prose" style={{ marginBottom: 16 }}>
          {narratives.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      )}
      <div className="hist-grid">
        {apyStats && (
          <div className="hist-block">
            <h3>APY</h3>
            <table className="hist-table">
              <tbody>
                {apyRows.slice(0, apyHalf).map((r) => (
                  <tr key={r.label}>
                    <th data-tooltip={tooltipFor(r.label, "apy")}>{r.label}</th>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {apyStats && splitApy && (
          <div className="hist-block">
            <h3>&nbsp;</h3>
            <table className="hist-table">
              <tbody>
                {apyRows.slice(apyHalf).map((r) => (
                  <tr key={r.label}>
                    <th data-tooltip={tooltipFor(r.label, "apy")}>{r.label}</th>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tvlStats && (
          <div className="hist-block">
            <h3>TVL</h3>
            <table className="hist-table">
              <tbody>
                {tvlRows.slice(0, tvlHalf).map((r) => (
                  <tr key={r.label}>
                    <th data-tooltip={tooltipFor(r.label, "tvl")}>{r.label}</th>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tvlStats && splitTvl && (
          <div className="hist-block">
            <h3>&nbsp;</h3>
            <table className="hist-table">
              <tbody>
                {tvlRows.slice(tvlHalf).map((r) => (
                  <tr key={r.label}>
                    <th data-tooltip={tooltipFor(r.label, "tvl")}>{r.label}</th>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
