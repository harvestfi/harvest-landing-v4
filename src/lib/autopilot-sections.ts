// Builders for the Autopilot/Autocompounder "Yield trajectory" and
// "Performance Overview" sections. Both render as numbered lists
// per the editorial spec in AGENTS.md; this module produces the
// fixed sentences, ProductPageBody renders them. Variable
// substitution only - do not paraphrase.

import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./history-api";
import { formatAPY } from "./format";

// USD-pegged tickers. The Yield-trajectory spec collapses the
// underlying-balance lines to noise for these (sharePrice ratio is
// effectively the dollar return), so only the USD lines render.
const STABLE_TICKERS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "USDE",
  "SRUSD",
  "USDC.E",
  "USDCE",
  "USDBC",
  "USD+",
  "USDS",
  "CRVUSD",
  "GHO",
  "LUSD",
  "FRXUSD",
  "OUSD",
  "PYUSD",
  "USD1",
  "DOLA",
  "USDT0",
  "AXLUSDC",
]);

function isStable(ticker: string): boolean {
  return STABLE_TICKERS.has(ticker.toUpperCase());
}

// Pick the sample whose timestamp is closest to `target`. Returns
// undefined if the history doesn't straddle that point in time.
function closestPoint<T extends { timestamp: number }>(
  points: T[],
  target: number,
): T | undefined {
  if (!points || points.length === 0) return undefined;
  let best: T | undefined = undefined;
  let bestDiff = Infinity;
  for (const p of points) {
    const d = Math.abs(p.timestamp - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = p;
    }
  }
  return best;
}

function formatUsdInt(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
function formatUnderlying(value: number, decimals: number): string {
  return value.toFixed(decimals);
}
function gainLossPhrase(deltaUsd: number, basisUsd: number = 1000): string {
  // Within 0.1% of basis = "effectively unchanged".
  if (Math.abs(deltaUsd) / basisUsd < 0.001) {
    return "effectively unchanged, with a movement";
  }
  return deltaUsd >= 0 ? "a gain" : "a loss";
}

// ===== Yield trajectory =====================================================

export type YieldTrajectoryLine = string;

export interface YieldTrajectoryResult {
  lines: YieldTrajectoryLine[]; // numbered by the renderer; sentence only
}

export function buildYieldTrajectory(
  vault: YieldVault,
  history: FullVaultHistory,
): YieldTrajectoryResult {
  const lines: string[] = [];
  const sp = [...history.sharePriceHistory].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  if (sp.length < 2) return { lines };

  const ticker = vault.asset.toUpperCase();
  const stable = isStable(ticker);
  const decimals = stable ? 3 : 4;

  const spNow = sp[sp.length - 1].sharePrice;
  const inceptionTs = sp[0].timestamp;
  const nowTs = sp[sp.length - 1].timestamp;
  const ageDays = Math.max(0, Math.round((nowTs - inceptionTs) / 86400));

  // 30-day lines: only render when the vault has at least 30 days
  // of history (per the spec, skip when the window doesn't apply).
  if (ageDays >= 30) {
    const target30d = nowTs - 30 * 86400;
    const p30 = closestPoint(sp, target30d);
    if (p30) {
      const ratio30 = spNow / p30.sharePrice;
      const usdValue = 1000 * ratio30;
      const usdDelta = usdValue - 1000;
      const phrase = gainLossPhrase(usdDelta);
      lines.push(
        `$1,000 deposited 30 days ago would now be worth ~$${formatUsdInt(
          usdValue,
        )}, ${phrase} of ~$${formatUsdInt(Math.abs(usdDelta))} over that period.`,
      );
      if (!stable) {
        lines.push(
          `In underlying terms, 1 ${ticker} deposited 30 days ago would now be ~${formatUnderlying(
            ratio30,
            decimals,
          )} ${ticker}.`,
        );
      }
    }
  }

  // Inception lines: render whenever we have at least one earlier
  // share-price sample (which we do given length >= 2).
  const ratioInception = spNow; // sharePriceHistory is normalized to start at 1.0
  const usdInception = 1000 * ratioInception;
  const usdInceptionDelta = usdInception - 1000;
  const inceptionPhrase = gainLossPhrase(usdInceptionDelta);
  lines.push(
    `$1,000 deposited at launch (${ageDays} days ago) would now be worth ~$${formatUsdInt(
      usdInception,
    )}, ${inceptionPhrase} of ~$${formatUsdInt(Math.abs(usdInceptionDelta))}.`,
  );
  if (!stable) {
    lines.push(
      `In underlying terms, 1 ${ticker} deposited at launch would now be ~${formatUnderlying(
        ratioInception,
        decimals,
      )} ${ticker}.`,
    );
  }

  return { lines };
}

// ===== Performance Overview =================================================

export interface PerformanceOverviewResult {
  lines: string[];
}

export function buildPerformanceOverview(
  vault: YieldVault,
  history: FullVaultHistory,
  allVaults: YieldVault[],
): PerformanceOverviewResult {
  const lines: string[] = [];
  const ticker = vault.asset.toUpperCase();

  // Line 01: asset-cohort rank with conditional wording. Three
  // variants based on rank/total ratio:
  //   <= 0.25       -> top quarter
  //   0.25..0.75    -> "with N strategies currently delivering
  //                     higher APY"
  //   > 0.75        -> same wording as mid (per the spec, no
  //                     need to be more negative; the rank is
  //                     the data point).
  // Avoids "outperforming X%" / "ranking above X%" which read as
  // judgment when the vault sits below the cohort midpoint.
  const cohort = allVaults
    .filter((v) => v.asset === vault.asset && v.apy24h > 0)
    .sort((a, b) => b.apy24h - a.apy24h);
  const idx = cohort.findIndex((v) => v.contractAddress === vault.contractAddress);
  const total = cohort.length;
  if (idx >= 0 && total > 1 && vault.apy24h > 0) {
    const rank = idx + 1;
    const ratio = rank / total;
    const head = `This vault's ${formatAPY(vault.apy24h)} APY ranks #${rank} among the ${total} ${ticker} vaults we monitor`;
    if (ratio <= 0.25) {
      lines.push(`${head}, placing it in the top quarter of the cohort.`);
    } else {
      const above = rank - 1;
      const noun = above === 1 ? "strategy" : "strategies";
      lines.push(
        `${head}, with ${above} ${noun} currently delivering higher APY.`,
      );
    }
  }

  // Line 02: 30-day APY range + monthly earnings at high/low.
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 86400;
  const trailing = history.apyHistory
    .filter(
      (p) =>
        p.timestamp >= thirtyDaysAgo &&
        Number.isFinite(p.apy) &&
        p.apy >= 0,
    )
    .map((p) => p.apy);
  if (trailing.length >= 2) {
    const lo = Math.min(...trailing);
    const hi = Math.max(...trailing);
    const avg = trailing.reduce((s, v) => s + v, 0) / trailing.length;
    const earnHigh = (1000 * (hi / 100)) / 12;
    const earnLow = (1000 * (lo / 100)) / 12;
    const fmtEarn = (v: number) =>
      v >= 10 ? Math.round(v).toString() : v.toFixed(2);
    lines.push(
      `Over the past 30 days, APY has ranged from ${formatAPY(lo)} to ${formatAPY(hi)}, averaging ${formatAPY(
        avg,
      )}. At the ${formatAPY(hi)} high, $1,000 would earn ~$${fmtEarn(
        earnHigh,
      )} per month; at the ${formatAPY(lo)} low, ~$${fmtEarn(earnLow)}.`,
    );
  }

  // Line 03: current APY vs lifetime average. The percentile
  // framing it replaced (e.g. "Xth percentile of its lifetime") was
  // statistically correct but read as a financial report; comparing
  // to the lifetime average (same number shown in Historical
  // statistics) is something the user can hold in their head.
  // Threshold: ±0.5 percentage points = "roughly in line".
  const lifetime = history.apyHistory
    .filter((p) => Number.isFinite(p.apy) && p.apy >= 0)
    .map((p) => p.apy);
  if (lifetime.length >= 5 && vault.apy24h > 0) {
    const avg = lifetime.reduce((s, v) => s + v, 0) / lifetime.length;
    const delta = vault.apy24h - avg;
    const verb =
      delta < -0.5
        ? "is below"
        : delta > 0.5
          ? "is above"
          : "is roughly in line with";
    lines.push(
      `Current APY of ${formatAPY(vault.apy24h)} ${verb} this vault's lifetime average of ${formatAPY(avg)}.`,
    );
  }

  // Line 04: TVL 30d change. Suppress the percentage framing
  // when either endpoint is below $50K - small absolute moves on
  // low-TVL strategies produce percentages dominated by single-
  // deposit noise that read as a signal but aren't.
  const tvlSorted = [...history.tvlHistory].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  if (tvlSorted.length >= 2 && vault.tvl > 0) {
    const target = now - 30 * 86400;
    const past = closestPoint(tvlSorted, target);
    if (past && past.value > 0 && past.timestamp <= now - 7 * 86400) {
      const current = vault.tvl;
      const TVL_PCT_THRESHOLD = 50_000;
      const eligibleForPct =
        current >= TVL_PCT_THRESHOLD && past.value >= TVL_PCT_THRESHOLD;
      if (eligibleForPct) {
        const pct = ((current - past.value) / past.value) * 100;
        const direction = pct >= 0 ? "increased" : "decreased";
        lines.push(
          `TVL has ${direction} ${Math.abs(pct).toFixed(1)}% over the past 30 days, from ${formatTvlShort(
            past.value,
          )} to ${formatTvlShort(current)}.`,
        );
      } else {
        lines.push(
          `TVL stands at ${formatTvlShort(current)}, compared to ${formatTvlShort(past.value)} 30 days ago.`,
        );
      }
    }
  }

  return { lines };
}


// Short TVL formatter matching the spec ($86K, $36K, $2.0M etc).
// Distinct from formatTVL in lib/format because that one rounds
// differently for sub-$1M values (here we use $XXK with no decimals).
function formatTvlShort(v: number): string {
  if (!Number.isFinite(v) || v < 0) return "—";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v)}`;
}