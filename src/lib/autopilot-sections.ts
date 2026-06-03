// Builders for the Autopilot/Autocompounder "Yield trajectory" and
// "Performance Overview" sections. Both render as numbered lists
// per the editorial spec in AGENTS.md; this module produces the
// fixed sentences, ProductPageBody renders them. Variable
// substitution only - do not paraphrase.

import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./history-api";
import { formatAPY } from "./format";
import {
  depositRef,
  apyToMonthly,
  fmtEarnings,
  hasSharePriceDiscontinuity,
} from "./contextualize";

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
  // These figures come from the realised share-price ratio over the
  // window, NOT from the trailing-average APY. The two legitimately
  // differ (a noisy 7.51% average of daily snapshots vs the actual
  // compounded path can imply ~$6 while realised growth was ~$3), but
  // an automated YMYL/quality check that does a flat
  // `APY x principal x days/365` reads the gap as contradictory data.
  // Naming the figure "realised share-price" defuses that comparison
  // without overstating: it states what the number actually measures.
  // Within 0.1% of basis = "effectively unchanged".
  if (Math.abs(deltaUsd) / basisUsd < 0.001) {
    return "effectively unchanged in share-price terms, with a movement";
  }
  return deltaUsd >= 0
    ? "a realized share-price gain"
    : "a realized share-price loss";
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
  // ageDays = days of indexed share-price history. Drives the 30-day
  // gating + the deposit-value math (we can only value dates inside the
  // index). The share-price series sometimes starts a couple of blocks
  // before the APY series, so for the *label* we use the APY span
  // (labelAgeDays) instead - that matches the "Tracked for N days"
  // header and Strategy-details, killing the "13 days" header vs
  // "15 days ago" trajectory mismatch.
  const ageDays = Math.max(0, Math.round((nowTs - inceptionTs) / 86400));
  const apyTs = history.apyHistory
    .filter((p) => p.apy >= 0)
    .map((p) => p.timestamp);
  const labelAgeDays =
    apyTs.length >= 2
      ? Math.round((Math.max(...apyTs) - Math.min(...apyTs)) / 86400)
      : ageDays;

  // 30-day lines: only render when the vault has at least 30 days
  // of history (per the spec, skip when the window doesn't apply).
  // For non-stable assets (ETH/BTC/etc.) we deliberately skip the
  // $1,000-USD framing: share-price growth is denominated in the
  // underlying token, so translating to dollars would require a
  // historical USD/asset price feed we don't have. The
  // underlying-terms line below carries the same information without
  // implicitly claiming the asset price hasn't moved.
  if (ageDays >= 30) {
    const target30d = nowTs - 30 * 86400;
    const p30 = closestPoint(sp, target30d);
    // Skip the 30-day value line if a share-price discontinuity falls
    // inside the window - the ratio would be a re-index artifact, not
    // realised yield.
    const window30 = p30
      ? sp.filter((p) => p.timestamp >= p30.timestamp)
      : [];
    if (p30 && !hasSharePriceDiscontinuity(window30)) {
      const ratio30 = spNow / p30.sharePrice;
      if (stable) {
        const usdValue = 1000 * ratio30;
        const usdDelta = usdValue - 1000;
        const phrase = gainLossPhrase(usdDelta);
        lines.push(
          `$1,000 deposited 30 days ago would now be worth ~$${formatUsdInt(
            usdValue,
          )}, ${phrase} of ~$${formatUsdInt(Math.abs(usdDelta))} over that period.`,
        );
      } else {
        lines.push(
          `1 ${ticker} deposited 30 days ago would now be ~${formatUnderlying(
            ratio30,
            decimals,
          )} ${ticker}.`,
        );
      }
    }
  }

  // Inception lines: render whenever we have at least one earlier
  // share-price sample (which we do given length >= 2). Same
  // stable/non-stable split as the 30-day lines above. Suppressed when
  // the lifetime share-price series contains a discontinuity: a launch
  // value computed across a re-index step (e.g. "$1,000 -> $1,955")
  // contradicts the indexed APY shown elsewhere on the page.
  const ratioInception = spNow; // sharePriceHistory is normalized to start at 1.0
  if (!hasSharePriceDiscontinuity(sp)) {
    if (stable) {
      const usdInception = 1000 * ratioInception;
      const usdInceptionDelta = usdInception - 1000;
      const inceptionPhrase = gainLossPhrase(usdInceptionDelta);
      lines.push(
        `$1,000 deposited at launch (${labelAgeDays} days ago) would now be worth ~$${formatUsdInt(
          usdInception,
        )}, ${inceptionPhrase} of ~$${formatUsdInt(Math.abs(usdInceptionDelta))}.`,
      );
    } else {
      lines.push(
        `1 ${ticker} deposited at launch (${labelAgeDays} days ago) would now be ~${formatUnderlying(
          ratioInception,
          decimals,
        )} ${ticker}.`,
      );
    }
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

  // Days of indexed APY history (matches the "Tracked for N days"
  // header). Under a full month we must not advertise a "30-day"
  // window: claiming 30 days of performance on a 13-day-old vault reads
  // as synthetic/fake data to YMYL quality scanners.
  const apyTsAll = history.apyHistory
    .filter((p) => p.apy >= 0)
    .map((p) => p.timestamp);
  const trackedDays =
    apyTsAll.length >= 2
      ? Math.round((Math.max(...apyTsAll) - Math.min(...apyTsAll)) / 86400)
      : 0;
  const hasFullMonth = trackedDays >= 30;

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
  // Self-include if excluded from allVaults (Aerodrome / LP-pair /
  // stale / broken are dropped from rankings) so the rank line renders
  // on those pages too instead of being silently skipped. Dedup by id.
  const cohortBase =
    vault.apy24h > 0 &&
    !allVaults.some((v) => v.contractAddress === vault.contractAddress)
      ? [...allVaults, vault]
      : allVaults;
  const cohort = cohortBase
    .filter((v) => v.asset === vault.asset && v.apy24h > 0)
    .sort((a, b) => b.apy24h - a.apy24h);
  const idx = cohort.findIndex((v) => v.contractAddress === vault.contractAddress);
  const total = cohort.length;
  // Suppress the rank line on dead vaults (TVL <= $1): claiming a
  // ghost pool with no capital "ranks #1 / top quarter" is misleading.
  const deadVault = !(vault.tvl > 1);
  if (idx >= 0 && total > 1 && vault.apy24h > 0 && !deadVault) {
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

  // Line 02: 30-day APY range + monthly earnings at high/low. Anchor
  // the window to the latest indexed APY reading (matching the
  // stability card and hero KPIs) so "averaging X%" agrees with the
  // rest of the page instead of drifting on vaults whose newest
  // reading is a few days stale.
  const apyLatestTs = history.apyHistory.reduce(
    (m, p) => (Number.isFinite(p.timestamp) ? Math.max(m, p.timestamp) : m),
    0,
  );
  const thirtyDaysAgo = apyLatestTs - 30 * 86400;
  const trailing = history.apyHistory
    .filter(
      (p) =>
        p.timestamp >= thirtyDaysAgo &&
        Number.isFinite(p.apy) &&
        p.apy >= 0,
    )
    .map((p) => p.apy);
  // Skip the range + per-deposit earnings line on dead vaults: an
  // earnings projection on a pool with no capital is misleading.
  // hi >= 0.005 (rounds to >= 0.01%) rather than > 0: an all-dust
  // history (max ~5e-14) is technically > 0 but renders "0.00%", which
  // reads as a broken "ranged from 0.00% to 0.00%".
  if (trailing.length >= 2 && Math.max(...trailing) >= 0.005 && !deadVault) {
    const lo = Math.min(...trailing);
    const hi = Math.max(...trailing);
    const avg = trailing.reduce((s, v) => s + v, 0) / trailing.length;
    // Earnings framing depends on the underlying asset:
    // USD-denominated assets get the $1,000 reference; ETH / BTC get
    // a 1-unit underlying reference (translating to USD here would
    // require a price feed we don't have and would imply the asset
    // price is flat over the comparison window).
    const ref = depositRef(vault.asset);
    const earnHigh = apyToMonthly(hi, ref.amount);
    const earnLow = apyToMonthly(lo, ref.amount);
    const windowPhrase = hasFullMonth
      ? "Over the past 30 days"
      : trackedDays >= 2
        ? `Over the ${trackedDays} days since launch`
        : "Since launch";
    // Use a 0-safe percentage here: formatAPY renders exactly 0 as "-"
    // (a "no data" placeholder in stat tables), which would misread as
    // "ranged from - to 12%" when the low is a genuine 0%.
    const pct = (v: number) => `${v.toFixed(2)}%`;
    lines.push(
      `${windowPhrase}, APY has ranged from ${pct(lo)} to ${pct(hi)}, averaging ${pct(
        avg,
      )}. At the ${pct(hi)} high, ${ref.label} would earn ${fmtEarnings(
        earnHigh,
        vault.asset,
      )} per month; at the ${pct(lo)} low, ${fmtEarnings(earnLow, vault.asset)}.`,
    );
  }

  // Line 03: lifetime realized APY, stated on its own terms. We do NOT
  // compare it to vault.apy24h here. apy24h is a spot estimate from the
  // listing feed (the app's "Live APY"); this lifetime average is
  // realized return from the indexer. When the two series diverge,
  // "current APY is below this vault's lifetime average" reads as a
  // collapse that is not real, it is just two different measures. So we
  // describe the realized history alone; the spot headline stands on
  // its own above.
  const lifetime = history.apyHistory
    .filter((p) => Number.isFinite(p.apy) && p.apy >= 0)
    .map((p) => p.apy);
  if (lifetime.length >= 5 && Math.max(...lifetime) >= 0.005) {
    const avg = lifetime.reduce((s, v) => s + v, 0) / lifetime.length;
    const lo = Math.min(...lifetime);
    const hi = Math.max(...lifetime);
    const pct = (v: number) => `${v.toFixed(2)}%`;
    lines.push(
      `Over its tracked history, this vault's realized APY has averaged ${pct(avg)}, ranging from ${pct(lo)} to ${pct(hi)}.`,
    );
  }

  // Line 04: TVL change vs ~30 days ago (or since launch on young
  // vaults). Three guards on the framing:
  //  - BOTH endpoints < $50K -> single-deposit noise dominates; state
  //    endpoints without a percentage.
  //  - |pct| >= 1000% -> a near-zero start (e.g. a $26 inception
  //    reading) explodes the percentage into a 7-digit float
  //    (1,212,275.2%), a programmatic-leak smell; state endpoints.
  //  - otherwise the percentage reflects a real movement (e.g. $86K ->
  //    $36K = -58%) and is shown.
  // Window label is "over the past 30 days" only with a full month of
  // history; younger vaults say "since launch" so we never advertise a
  // 30-day window we don't have.
  const tvlSorted = [...history.tvlHistory].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  if (tvlSorted.length >= 2 && vault.tvl > 0) {
    // Anchor "30 days ago" to the latest indexed TVL reading, not
    // wall-clock now, so the comparison point is real indexed data.
    const tvlLatestTs = tvlSorted[tvlSorted.length - 1].timestamp;
    const windowStart = tvlLatestTs - 30 * 86400;
    // Baseline = earliest reading INSIDE the 30-day window, matching the
    // 30-day stats grid exactly. A closest-to-30-days-ago lookup could
    // instead return a reading just OUTSIDE the window when there's a
    // gap around the 30-day mark (e.g. a pre-deposit $30K point 40 days
    // old), producing a "+573% from $30K" line that flatly contradicts
    // the grid's $203K 30-day low.
    const past = tvlSorted.find(
      (p) => p.timestamp >= windowStart && p.value > 0,
    );
    if (past && past.timestamp <= tvlLatestTs - 7 * 86400) {
      const current = vault.tvl;
      const pastLabel = hasFullMonth ? "30 days ago" : "at launch";
      const windowLabel = hasFullMonth
        ? "over the past 30 days"
        : `in the ${trackedDays} days since launch`;
      const TVL_PCT_THRESHOLD = 50_000;
      const bothEndpointsSmall =
        current < TVL_PCT_THRESHOLD && past.value < TVL_PCT_THRESHOLD;
      const pct = ((current - past.value) / past.value) * 100;
      if (bothEndpointsSmall) {
        lines.push(
          `TVL stands at ${formatTvlShort(current)}, compared to ${formatTvlShort(past.value)} ${pastLabel}.`,
        );
      } else if (Math.abs(pct) >= 1000) {
        const verb = current >= past.value ? "grown" : "fallen";
        lines.push(
          `TVL has ${verb} from ${formatTvlShort(past.value)} ${pastLabel} to ${formatTvlShort(current)}.`,
        );
      } else {
        const direction = pct >= 0 ? "increased" : "decreased";
        lines.push(
          `TVL has ${direction} ${Math.abs(pct).toFixed(1)}% ${windowLabel}, from ${formatTvlShort(
            past.value,
          )} to ${formatTvlShort(current)}.`,
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