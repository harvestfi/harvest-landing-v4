import { formatAPY, formatTVL } from "@/lib/format";
import {
  depositRef,
  apyToMonthly,
  fmtEarnings,
  isErraticTvl,
} from "@/lib/contextualize";
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
  // Young vaults render the window prefix as the real span ("13D Low")
  // instead of "30D Low"; normalise back to the "30D" map key so the
  // tooltip still resolves.
  const key = label.replace(/^\d+D /, "30D ");
  return kind === "apy" ? APY_LABEL_TOOLTIPS[key] : TVL_LABEL_TOOLTIPS[key];
}

export function HistoricalStats({ history, asset, currentTvl }: { history: FullVaultHistory; asset: string; currentTvl?: number }) {
  // "Current TVL" must be the listing value (vault.tvl, what the headline
  // and the app show), not the subgraph history tail - otherwise the
  // same metric reads $1.1M up top and $1.2M here. Time-series stats
  // (low/high/avg/peak) still come from history.
  const liveTvl = typeof currentTvl === "number" && currentTvl > 0 ? currentTvl : null;
  // Anchor the 30-day window to the latest indexed reading per series,
  // not wall-clock now. The stability card, hero KPIs and yield
  // trajectory all anchor this way; anchoring here to build-time now
  // made this section's "30D Average / High" disagree with those for
  // any vault whose newest reading is a few days stale (the 15.59% vs
  // 16.58% / 17.33% vs 25.53% split that read as conflicting facts).
  const allApy = history.apyHistory.filter((p) => p.apy >= 0);
  const apyLatestTs = allApy.reduce((m, p) => Math.max(m, p.timestamp), 0);
  const tvlLatestTs = history.tvlHistory.reduce(
    (m, p) => Math.max(m, p.timestamp),
    0,
  );
  const apy30d = allApy.filter((p) => p.timestamp >= apyLatestTs - 30 * 86400);
  // Anchor the TVL window to the freshest reading across BOTH series, not
  // the TVL tail alone. On tiny vaults TVL is indexed only on rebalances
  // and can lag the APY series by months; anchoring to the TVL tail made
  // a "30D" window dated ~2 months ago (best/worst day on Apr 11 when
  // today is Jun). Using the freshest reading drops those stale points.
  const freshestTs = Math.max(apyLatestTs, tvlLatestTs);
  const tvl30dRaw = history.tvlHistory.filter(
    (p) => p.timestamp >= freshestTs - 30 * 86400,
  );
  // Fold the live listing TVL (vault.tvl) in as the most-recent point so
  // the 30-day low / high / worst / best / current all include it and
  // stay self-consistent with the headline. Dated at the freshest
  // reading - it's the current value, not an Apr-dated one. Without this,
  // a live value just outside the indexed range (and on the far side of
  // a $ rounding boundary) produced "Current $1.1M" below "30D Low $1.2M".
  const tvl30d =
    liveTvl !== null
      ? [...tvl30dRaw, { value: liveTvl, timestamp: freshestTs }]
      : tvl30dRaw;

  if (allApy.length < 3 && tvl30d.length < 3) return null;

  // Lifetime tracked-day SPANS (latest minus earliest reading) per
  // series. These drive the "(Nd)" suffix on the Lifetime-avg rows and
  // the "over N days" APY narrative below. They are distinct from the
  // reading COUNT (shown as "Data points" in the history table):
  // labelling the count as days was the source of the "138d" vs
  // "371 days" contradiction.
  const trackedDaysOf = (stamps: number[]): number => {
    if (stamps.length < 2) return 0;
    return Math.round((Math.max(...stamps) - Math.min(...stamps)) / 86400);
  };
  const apyTrackedDays = trackedDaysOf(allApy.map((p) => p.timestamp));

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

  // ≥2 REAL indexed TVL points in the freshest 30-day window. When false
  // (sparse / stale TVL, common on tiny vaults whose TVL is only indexed
  // on rebalances), the window-specific rows (30D Low/High/Best/Worst)
  // would be either a single degenerate value or dated months ago, so we
  // drop them and show only Current TVL + Lifetime avg, which stay honest.
  const hasWindowTvl = tvl30dRaw.length >= 2;
  const windowTvlVals = tvlValues.length > 0 ? tvlValues : null;
  const tvlStats =
    windowTvlVals || allTvlValues.length > 0
      ? {
          low: windowTvlVals ? Math.min(...windowTvlVals) : 0,
          high: windowTvlVals ? Math.max(...windowTvlVals) : 0,
          avg: windowTvlVals
            ? windowTvlVals.reduce((s, v) => s + v, 0) / windowTvlVals.length
            : 0,
          lifetimeAvg:
            allTvlValues.length > 0
              ? allTvlValues.reduce((s, v) => s + v, 0) / allTvlValues.length
              : 0,
          med: windowTvlVals ? median(windowTvlVals) : 0,
          current:
            liveTvl ??
            (tvl30d[tvl30d.length - 1]?.value ||
              allTvl[allTvl.length - 1]?.value ||
              0),
          largestChange: tvlLargestChange,
          bestDay:
            tvl30d.length > 0
              ? tvl30d
                  .filter((p) => p.value > 0)
                  .reduce((best, p) => (p.value > best.value ? p : best), tvl30d[0])
              : null,
          worstDay:
            tvl30d.length > 0
              ? tvl30d
                  .filter((p) => p.value > 0)
                  .reduce((worst, p) => (p.value < worst.value ? p : worst), tvl30d[0])
              : null,
          dataPoints: allTvl.length,
        }
      : null;

  // Window prefix for the range rows. On vaults with under a month of
  // history "30D" overstates the window, so we show the real span
  // ("13D Low") - never a 30-day claim the data can't back.
  // One canonical day count for BOTH grids (the APY-history span, which
  // is the "Tracked for N days" age in the header). The two grids must
  // never disagree on the window or lifetime span - e.g. "256d" vs
  // "248d" side by side reads as a data-integrity fault to YMYL crawlers.
  const win = apyTrackedDays > 0 && apyTrackedDays < 30 ? `${apyTrackedDays}D` : "30D";

  // These rows are real measured observations, so a genuine 0% low must
  // read "0.00%", not the "-" that formatAPY emits for 0 (its 0 = "no
  // data" placeholder makes sense in ranking cells, not here). Without
  // this, "30D Low -" rendered and the dash even glued to the next
  // label ("30D Low-30D High").
  const apyPct = (v: number) => (Number.isFinite(v) ? `${v.toFixed(2)}%` : "-");

  const apyRows = apyStats
    ? [
        { label: `${win} Low`, value: apyPct(apyStats.low) },
        { label: `${win} High`, value: apyPct(apyStats.high) },
        { label: `${win} Average`, value: apyPct(apyStats.avg) },
        { label: `Lifetime avg (${apyTrackedDays}d)`, value: apyPct(apyStats.lifetimeAvg) },
        { label: "Median APY", value: apyPct(apyStats.med) },
        { label: "Best day", value: `${apyPct(apyStats.bestDay.apy)} · ${formatDate(apyStats.bestDay.timestamp)}` },
        { label: "Worst day", value: `${apyPct(apyStats.worstDay.apy)} · ${formatDate(apyStats.worstDay.timestamp)}` },
        { label: "Volatility", value: `${apyStats.vol.toFixed(2)} ${apyStats.vol > 5 ? "High" : apyStats.vol > 2 ? "Medium" : "Low"}` },
        { label: "APY range", value: `${apyStats.range.toFixed(2)}pp` },
      ]
    : [];

  const tvlRows = !tvlStats
    ? []
    : hasWindowTvl && tvlStats.bestDay && tvlStats.worstDay
      ? [
          { label: `${win} Low`, value: formatTVL(tvlStats.low) },
          { label: `${win} High`, value: formatTVL(tvlStats.high) },
          { label: `${win} Average`, value: formatTVL(tvlStats.avg) },
          { label: `Lifetime avg (${apyTrackedDays}d)`, value: formatTVL(tvlStats.lifetimeAvg) },
          { label: "Median TVL", value: formatTVL(tvlStats.med) },
          { label: "Best day", value: `${formatTVL(tvlStats.bestDay.value)} · ${formatDate(tvlStats.bestDay.timestamp)}` },
          { label: "Worst day", value: `${formatTVL(tvlStats.worstDay.value)} · ${formatDate(tvlStats.worstDay.timestamp)}` },
          { label: "Current TVL", value: formatTVL(tvlStats.current) },
          { label: "Largest daily change", value: formatTVL(tvlStats.largestChange) },
        ]
      : // Sparse / stale TVL: no meaningful 30-day window, so only the
        // unambiguous current + lifetime figures (no stale-dated rows).
        [
          { label: "Current TVL", value: formatTVL(tvlStats.current) },
          { label: `Lifetime avg (${apyTrackedDays}d)`, value: formatTVL(tvlStats.lifetimeAvg) },
        ];

  // Split a single block into two columns when the other block is absent
  // so the section fills the full width.
  const splitApy = apyStats && !tvlStats && apyRows.length >= 4;
  const splitTvl = tvlStats && !apyStats && tvlRows.length >= 4;
  const apyHalf = splitApy ? Math.ceil(apyRows.length / 2) : apyRows.length;
  const tvlHalf = splitTvl ? Math.ceil(tvlRows.length / 2) : tvlRows.length;

  // Narrative intro paragraph: trend direction over lifetime
  const narratives: string[] = [];

  // APY narrative mode is chosen from apyTrackedDays (computed above):
  // < 7 days  -> minimal "still accumulating" notice
  // 7..59     -> no APY narrative (table renders alone)
  // >= 60 readings -> full lifetime-change paragraph
  if (apyStats && apyTrackedDays < 7) {
    narratives.push(
      `Tracked for ${apyTrackedDays} day${apyTrackedDays === 1 ? "" : "s"}. APY data is still accumulating; the first meaningful summary requires at least a week of readings.`,
    );
  } else if (apyStats && apyStats.dataPoints >= 60) {
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
      // "early average" / "recent average" (not bare endpoints): these
      // are first-quarter and last-quarter means, so the closing figure
      // is deliberately not the single latest reading shown in the hero.
      // Labelling them as averages stops the recent value reading as a
      // stale contradiction of the headline 24h APY.
      let text = `Over the past ${apyTrackedDays} days, this vault's APY has moved from an early average of ${earlyAvg.toFixed(2)}% to a recent average of ${lateAvg.toFixed(2)}%, a ${Math.abs(changePct).toFixed(1)}% ${direction}.`;

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

  // TVL narrative gate is independent of the 30-day stats block:
  // it only needs lifetime data (first / last / peak / current). The
  // previous `if (tvlStats)` gate accidentally suppressed the
  // paragraph on vaults whose latest TVL snapshot was more than 30
  // days stale - e.g. ETH/VVV Aerodrome with only 1 point in the
  // trailing 30 days made tvlStats null, hiding a 389-day TVL
  // narrative that's perfectly computable from lifetime data.
  {
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
      // "Current" TVL is the listing value (matches the headline / app);
      // peak / first / dates stay from the indexed history.
      const cur = liveTvl ?? sorted[sorted.length - 1].value;
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
      // When the TVL series is erratic (transient index spikes), the
      // "peak" is noise. Fall through to the minimal fallback so we
      // never cite a $932K all-time peak that the vault never really
      // held - which also avoids the "$95 is 0% of peak" rounding.
      const erratic = isErraticTvl(history.tvlHistory);
      if (
        sorted.length >= 10 &&
        peak.value > 0 &&
        cur >= 0.8 * peak.value &&
        !erratic
      ) {
        // Narrative A: growth-since-inception (no %, just endpoints).
        narratives.push(
          `Total value locked currently sits at ${formatTVL(cur)}, up from ${formatTVL(first)} at the start of tracking. The vault has been live for ${days} days.`,
        );
      } else if (sorted.length >= 10 && peak.value > 0 && !erratic) {
        // Narrative B: peak-and-current. Peak date is derived from
        // the peak snapshot's timestamp, formatted Month YYYY. If
        // the timestamp is missing or unparseable, drop the date
        // clause as graceful degradation rather than rendering "on
        // Invalid Date".
        const pctRaw = Math.round((cur / peak.value) * 100);
        const pct = pctRaw < 1 && cur > 0 ? "<1" : `${pctRaw}`;
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
            ? `Total value locked currently sits at ${formatTVL(cur)}, which is ${pct}% of its all-time peak of ${formatTVL(peak.value)} reached on ${peakDate}.`
            : `Total value locked currently sits at ${formatTVL(cur)}, which is ${pct}% of its all-time peak of ${formatTVL(peak.value)}.`,
        );
      } else {
        // Fallback: minimal but always-present sentence for vaults
        // with < 10 positive TVL points or missing peak data.
        narratives.push(
          `Total value locked currently sits at ${formatTVL(cur)}. The vault has been live for ${days} days.`,
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
