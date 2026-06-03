import { YieldVault } from "@/lib/types";
import { formatAPY, formatTVL } from "@/lib/format";
import { depositRef, apyToMonthly, fmtEarnings } from "@/lib/contextualize";
import type { FullVaultHistory } from "@/lib/history-api";

interface VaultCommentaryProps {
  vault: YieldVault;
  allVaults: YieldVault[];
  history: FullVaultHistory;
  numbered?: boolean;
  // When true (hidden product) the cohort-rank paragraph is dropped; the
  // history-derived commentary still renders.
  hideRank?: boolean;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const sqDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / values.length);
}

function getStabilityLabel(sd: number): string {
  if (sd < 0.5) return "very stable";
  if (sd < 1.5) return "stable";
  if (sd < 3) return "moderately volatile";
  return "volatile";
}

export function VaultCommentary({
  vault,
  allVaults,
  history,
  numbered,
  hideRank = false,
}: VaultCommentaryProps) {
  // Self-include if excluded from allVaults (getLiveVaults drops
  // Aerodrome / LP-pair / stale / broken vaults), so the rank sentence
  // renders with a real rank instead of being silently dropped on those
  // pages. Dedup by id.
  const cohortBase =
    !allVaults.some((v) => v.id === vault.id) ? [...allVaults, vault] : allVaults;
  const sameAssetVaults = cohortBase.filter((v) => v.asset === vault.asset);

  const paragraphs: string[] = [];

  // Anchor the 30-day windows to the latest indexed reading per series
  // (not wall-clock now), matching the stability card / hero KPIs so
  // the numbers agree with the rest of the page on stale vaults.
  const apyLatestTs = history.apyHistory.reduce(
    (m, p) => (Number.isFinite(p.timestamp) ? Math.max(m, p.timestamp) : m),
    0,
  );
  const tvlLatestTs = history.tvlHistory.reduce(
    (m, p) => (Number.isFinite(p.timestamp) ? Math.max(m, p.timestamp) : m),
    0,
  );
  const apyThirtyDaysAgo = apyLatestTs - 30 * 86400;
  const tvlThirtyDaysAgo = tvlLatestTs - 30 * 86400;

  // Dead vault = effectively zero TVL: suppress rank superlatives and
  // per-deposit earnings projections (misleading on a pool with no
  // capital). Headline numbers still render.
  const deadVault = !(vault.tvl > 1);

  // 1. APY Ranking: is this competitive? (dropped for hidden products)
  if (vault.apy24h > 0 && sameAssetVaults.length > 1 && !deadVault && !hideRank) {
    const sorted = [...sameAssetVaults]
      .filter((v) => v.apy24h > 0)
      .sort((a, b) => b.apy24h - a.apy24h);
    const rank = sorted.findIndex((v) => v.id === vault.id) + 1;
    if (rank > 0) {
      // Neutral rank framing per the editorial spec - no "outperforming
      // X%" (a banned phrasing, and an overstatement when the vault sits
      // mid-cohort). Mirrors buildPerformanceOverview.
      const head = `This vault's ${formatAPY(vault.apy24h)} APY ranks #${rank} among the ${sorted.length} ${vault.asset} vaults we monitor`;
      if (rank / sorted.length <= 0.25) {
        paragraphs.push(`${head}, placing it in the top quarter of the cohort.`);
      } else {
        const above = rank - 1;
        const noun = above === 1 ? "strategy" : "strategies";
        paragraphs.push(
          `${head}, with ${above} ${noun} currently delivering higher APY.`,
        );
      }
    }
  }

  // 2. APY Stability: is this APY reliable? (#3 contextualization)
  if (history.apyHistory.length >= 5) {
    const validApy = history.apyHistory.filter((p) => p.apy >= 0);
    const recent30d = validApy.filter((p) => p.timestamp >= apyThirtyDaysAgo);

    // max >= 0.005 (rounds to >= 0.01%): an all-dust window (max ~5e-14)
    // is technically positive but renders "averaging 0.00% with a range
    // of 0.00% to 0.00%", which reads as broken. Skip it then.
    if (recent30d.length >= 5 && Math.max(...recent30d.map((p) => p.apy)) >= 0.005) {
      const apyValues = recent30d.map((p) => p.apy);
      const avg = apyValues.reduce((s, v) => s + v, 0) / apyValues.length;
      const sd = stdDev(apyValues);
      const min = Math.min(...apyValues);
      const max = Math.max(...apyValues);
      const label = getStabilityLabel(sd);

      let sentence = `Over the past 30 days, APY has been ${label}, averaging ${avg.toFixed(2)}% with a range of ${min.toFixed(2)}% to ${max.toFixed(2)}%.`;

      // Contextualization: requires >= 14 data points, and skipped on
      // dead vaults (a per-deposit earnings figure on a pool with no
      // capital is misleading).
      if (recent30d.length >= 14 && !deadVault) {
        const ref = depositRef(vault.asset);
        const lowMonthly = apyToMonthly(min, ref.amount);
        const highMonthly = apyToMonthly(max, ref.amount);
        const rangePct = max - min;
        if (rangePct < 2) {
          sentence += ` Earnings on ${ref.label} would have varied between ${fmtEarnings(lowMonthly, vault.asset)} and ${fmtEarnings(highMonthly, vault.asset)} per month over this period.`;
        } else {
          const useJust = (vault.asset !== "ETH" && vault.asset !== "BTC") && lowMonthly < 2;
          sentence += ` At the ${max.toFixed(2)}% high, ${ref.label} would earn ${fmtEarnings(highMonthly, vault.asset)} per month; at the ${min.toFixed(2)}% low, ${useJust ? "just " : ""}${fmtEarnings(lowMonthly, vault.asset)}.`;
        }
      }

      paragraphs.push(sentence);
    }
  }

  // 3. APY history range: where recent realized yield has sat. We
  // describe the realized-history distribution on its own terms and do
  // NOT compare it to vault.apy24h: that headline number is a spot
  // estimate from the listing feed (what the app shows as "Live APY"),
  // while apyHistory is realized return from the indexer. Mixing the
  // two produced false verdicts like "1.48% sits at the 2nd percentile,
  // below the vault's typical range" whenever the spot and realized
  // series diverged. The two are different measures, not a good/bad
  // signal, so we keep this purely descriptive.
  if (history.apyHistory.length >= 30) {
    const allValid = history.apyHistory
      .filter((p) => p.apy >= 0)
      .map((p) => p.apy);
    if (allValid.length >= 30 && Math.max(...allValid) >= 0.005) {
      const avg = allValid.reduce((s, v) => s + v, 0) / allValid.length;
      const lo = Math.min(...allValid);
      const hi = Math.max(...allValid);
      const pct = (v: number) => `${v.toFixed(2)}%`;
      const timeframe =
        allValid.length > 180 ? "its lifetime" : `its ${allValid.length}-day history`;
      paragraphs.push(
        `Across ${timeframe}, realized APY has averaged ${pct(avg)}, ranging from ${pct(lo)} to ${pct(hi)}.`,
      );
    }
  }

  // 4. TVL Trend: is money flowing in or out?
  if (history.tvlHistory.length >= 2) {
    const recent = [...history.tvlHistory]
      .filter((p) => p.timestamp >= tvlThirtyDaysAgo && p.value > 0)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (recent.length >= 2) {
      const oldest = recent[0].value;
      const newest = recent[recent.length - 1].value;
      if (oldest > 0) {
        const changePct = ((newest - oldest) / oldest) * 100;
        const direction = changePct >= 0 ? "increased" : "decreased";
        paragraphs.push(
          `TVL has ${direction} ${Math.abs(changePct).toFixed(1)}% over the past 30 days, from ${formatTVL(oldest)} to ${formatTVL(newest)}.`,
        );
      }
    }
  }

  if (paragraphs.length === 0) return null;

  return (
    <div className="pp-section" id="overview">
      <h2>Performance Overview</h2>
      {numbered ? (
        <div className="pp-numbered-list">
          {paragraphs.map((text, i) => (
            <div key={i} className="pp-numbered-item">
              <span className="pp-num-badge">{String(i + 1).padStart(2, "0")}</span>
              <span className="pp-num-text">{text}</span>
            </div>
          ))}
        </div>
      ) : (
        paragraphs.map((text, i) => <p key={i}>{text}</p>)
      )}
    </div>
  );
}
