import type { FullVaultHistory } from "./history-api";

const DAY = 86400;

// A vault's APY (and often share-price) feed can cut off while its TVL
// feed keeps updating, or vice-versa. When the APY history's latest
// reading lags the freshest reading across all series by more than this,
// the indexed APY history - and every "last 30 days" stat derived from
// it (stability score, 30-day range, best/worst day, 30d average) - is
// no longer recent and must not be presented as current.
const APY_STALE_DAYS = 21;

export interface Freshness {
  apyTs: number;
  tvlTs: number;
  // Newest reading across all series; the honest "as of" reference and
  // the anchor every per-series 30-day window should use.
  freshestTs: number;
  // True when the APY feed has effectively stopped relative to the rest.
  apyStale: boolean;
}

export function freshness(history: FullVaultHistory): Freshness {
  const latest = (arr: { timestamp: number }[]) =>
    arr.reduce(
      (m, p) => (Number.isFinite(p.timestamp) ? Math.max(m, p.timestamp) : m),
      0,
    );
  const apyTs = latest(history.apyHistory.filter((p) => p.apy >= 0));
  const tvlTs = latest(history.tvlHistory);
  const spTs = latest(history.sharePriceHistory);
  const freshestTs = Math.max(apyTs, tvlTs, spTs);
  return {
    apyTs,
    tvlTs,
    freshestTs,
    apyStale: apyTs > 0 && freshestTs - apyTs > APY_STALE_DAYS * DAY,
  };
}
