import { formatTVL } from "@/lib/format";
import { depositRef, apyToMonthly, fmtEarnings } from "@/lib/contextualize";
import type { FullVaultHistory } from "@/lib/history-api";

interface Props {
  history: FullVaultHistory;
  asset: string;
}

// Drawdown percentages have a misleading rounding edge case: a vault
// that fell from $746K to $169 has a 99.977% drawdown, which rounds
// to 100% and reads as "TVL went to zero" even though $169 remained.
// Cap at 99 whenever trough is non-zero; reserve 100 for true zero.
function formatDrawdownPct(pct: number, troughValue: number): string {
  if (troughValue <= 0) return "100";
  if (pct >= 95) return "99";
  return Math.round(pct).toString();
}

// Total span of indexed history in days, across the longest of the
// three series. Used by the top-level age gate so the section doesn't
// render for vaults with under a month of data (peak/trough,
// annualised CAGR, best/worst month are all uninformative there).
function computeTrackedDays(history: FullVaultHistory): number {
  const spans = [
    history.tvlHistory,
    history.sharePriceHistory,
    history.apyHistory,
  ].map((series) => {
    if (!series || series.length < 2) return 0;
    const sorted = [...series].sort((a, b) => a.timestamp - b.timestamp);
    return (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400;
  });
  return Math.max(0, ...spans);
}

export function HistoricalNarrative({ history, asset }: Props) {
  // Fresh-vault gate: skip the whole section for vaults with under
  // 30 days of tracking. Annualised CAGR, best/worst month, and
  // peak/trough framing all need more history than that to be
  // informative; rendering them on a 5-day-old vault produces
  // misleading bullets.
  if (computeTrackedDays(history) < 30) return null;

  const ref = depositRef(asset);

  const items: Array<{
    text: string;
    trajectory: "up" | "down" | "sideways";
  }> = [];

  // Share-price CAGR (#1)
  if (history.sharePriceHistory.length >= 2) {
    const sorted = [...history.sharePriceHistory].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    const first = sorted[0].sharePrice;
    const last = sorted[sorted.length - 1].sharePrice;
    const daySpan =
      (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400;
    if (first > 0 && daySpan >= 30) {
      const totalReturn = (last - first) / first;
      const cagr = (Math.pow(1 + totalReturn, 365 / daySpan) - 1) * 100;

      let text = `Share price has compounded at an annualized rate of ${cagr.toFixed(2)}% over ${Math.round(daySpan)} days, growing from ${first.toFixed(4)} to ${last.toFixed(4)}.`;

      // Contextualization: omit if tracked < 90 days. Per-underlying-
      // unit accounting (gain measured in the same ticker as the
      // deposit) is unit-correct regardless of whether the asset is
      // USD-denominated, so the previous "$X in returns" / "minimal
      // returns" branches collapse into a single quantitative gain
      // sentence. The literal "minimal returns" placeholder is gone.
      if (daySpan >= 90) {
        const ticker = asset.toUpperCase();
        if (last < 1.0) {
          const lossInUnderlying = 1 - last;
          const lossDecimals =
            asset === "USDC" || asset === "USDT" || asset === "DAI" ? 3 : 4;
          text += ` This represents a loss of ~${lossInUnderlying.toFixed(lossDecimals)} ${ticker} per 1 ${ticker} supplied at launch.`;
        } else {
          const gainInUnderlying = last - first;
          const gainDecimals =
            asset === "USDC" || asset === "USDT" || asset === "DAI" ? 3 : 4;
          text += ` This represents a gain of ~${gainInUnderlying.toFixed(gainDecimals)} ${ticker} per 1 ${ticker} supplied at launch.`;
        }
      }

      items.push({ text, trajectory: cagr >= 0 ? "up" : "down" });
    }
  }

  // TVL drawdown story (#12)
  if (history.tvlHistory.length >= 10) {
    const sorted = [...history.tvlHistory].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    let peakVal = 0;
    let peakTs = 0;
    let troughVal = Infinity;
    let troughTs = 0;
    let maxDrawdownPct = 0;

    for (const p of sorted) {
      if (p.value > peakVal) {
        peakVal = p.value;
        peakTs = p.timestamp;
        troughVal = p.value;
        troughTs = p.timestamp;
      }
      if (peakVal > 0 && p.value < troughVal) {
        troughVal = p.value;
        troughTs = p.timestamp;
        const dd = ((peakVal - troughVal) / peakVal) * 100;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      }
    }

    if (maxDrawdownPct >= 15 && peakVal > 0) {
      const daysDown = Math.round((troughTs - peakTs) / 86400);
      const currentTvl = sorted[sorted.length - 1].value;
      const atPeak = currentTvl >= peakVal * 0.9;
      const currentVsPeakPct = peakVal > 0
        ? Math.round((currentTvl / peakVal) * 100)
        : 0;

      let text: string;
      let trajectory: "up" | "down" | "sideways";

      if (atPeak) {
        // At or near peak: state current value (not stale peak value)
        // and how long the vault has held this scale. Days-at-peak is
        // measured from the first upward crossing of 0.8 * peak so the
        // sentence acknowledges scale-stability without claiming the
        // exact peak number has been pinned for that whole window.
        const peakThreshold = peakVal * 0.8;
        let firstCrossingTs: number | null = null;
        for (const p of sorted) {
          if (p.value >= peakThreshold) {
            firstCrossingTs = p.timestamp;
            break;
          }
        }
        const daysAtPeak = firstCrossingTs
          ? Math.round(
              (sorted[sorted.length - 1].timestamp - firstCrossingTs) / 86400,
            )
          : null;
        text =
          daysAtPeak && daysAtPeak >= 1
            ? `TVL currently sits at ${formatTVL(currentTvl)}, at or near its historical peak. The vault has held this scale for the past ${daysAtPeak} days.`
            : `TVL currently sits at ${formatTVL(currentTvl)}, at or near its historical peak.`;
        trajectory = "sideways";
      } else {
        // Past peak. Two-sentence framing only - state drawdown,
        // trough, and current side by side. No "recovered X%"
        // wording, no trailing "had bottomed by" date (which was
        // grammatically awkward past-perfect for a one-time event
        // and redundant with daysDown already shown above).
        text = `TVL experienced a ${formatDrawdownPct(maxDrawdownPct, troughVal)}% drawdown from its ${formatTVL(peakVal)} peak, bottoming at ${formatTVL(troughVal)} over ${daysDown} days. It currently stands at ${formatTVL(currentTvl)}, ${currentVsPeakPct}% of the peak value.`;
        trajectory = "down";
      }

      items.push({ text, trajectory });
    }
  }

  // Best / worst month (#13)
  if (history.apyHistory.length >= 60) {
    const validApy = history.apyHistory.filter((p) => p.apy >= 0);
    const monthMap = new Map<string, number[]>();
    for (const p of validApy) {
      const d = new Date(p.timestamp * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const arr = monthMap.get(key) || [];
      arr.push(p.apy);
      monthMap.set(key, arr);
    }
    const months = [...monthMap.entries()]
      .filter(([, vals]) => vals.length >= 5)
      .map(([key, vals]) => ({
        key,
        avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      }));

    if (months.length >= 3) {
      const best = months.reduce((a, b) => (b.avg > a.avg ? b : a));
      const worst = months.reduce((a, b) => (b.avg < a.avg ? b : a));
      const fmtMonth = (k: string) => {
        const [y, m] = k.split("-");
        return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
      };

      // Estimate total days tracked from sorted apy data
      const sortedApy = [...validApy].sort((a, b) => a.timestamp - b.timestamp);
      const totalDays = sortedApy.length >= 2
        ? (sortedApy[sortedApy.length - 1].timestamp - sortedApy[0].timestamp) / 86400
        : 0;

      if (best.key !== worst.key) {
        let text = `Best performing month was ${fmtMonth(best.key)} at ${best.avg.toFixed(2)}% average APY; weakest was ${fmtMonth(worst.key)} at ${worst.avg.toFixed(2)}%.`;

        // Contextualization: omit if <90 days tracked or spread <5pp
        if (totalDays >= 90 && best.avg - worst.avg >= 5) {
          const spreadMonthly = apyToMonthly(best.avg - worst.avg, ref.amount);
          text += ` The spread between best and worst months represents ${fmtEarnings(spreadMonthly, asset)} per ${ref.label} per month.`;
        }

        items.push({
          text,
          trajectory: best.avg >= worst.avg ? "up" : "sideways",
        });
      }
    }
  }

  if (items.length === 0) return null;

  const trajectoryIcon: Record<"up" | "down" | "sideways", string> = {
    up: "↗",
    down: "↘",
    sideways: "→",
  };

  return (
    <section className="pp-section" id="long-term">
      <h2>Long-term performance</h2>
      <ul className="about-prose about-prose-list">
        {items.map((item, i) => (
          <li key={i} className="about-prose-item">
            <span
              className={`about-prose-icon about-prose-icon--${item.trajectory}`}
              aria-hidden="true"
            >
              {trajectoryIcon[item.trajectory]}
            </span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
