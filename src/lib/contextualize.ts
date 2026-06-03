// Helpers for human-readable contextualizations on product pages.
// Reference deposit: $1,000 for USD-denominated assets (USDC/USDT/EURC),
// 1 ETH for ETH, 1 BTC for BTC.

export function depositRef(asset: string): { amount: number; label: string } {
  if (asset === "ETH") return { amount: 1, label: "1 ETH" };
  if (asset === "BTC") return { amount: 1, label: "1 BTC" };
  return { amount: 1000, label: "$1,000" };
}

// Annual APY (%) → monthly earnings on given deposit amount
export function apyToMonthly(apy: number, depositAmount: number): number {
  return (apy / 100) * depositAmount / 12;
}

// Format an earnings value with "~" prefix and appropriate rounding.
// USD: <$10 → 2dp; $10-100 → $1; >$100 → $5 increments.
// ETH/BTC: 4 significant figures.
export function fmtEarnings(val: number, asset: string): string {
  if (asset === "ETH" || asset === "BTC") {
    // Below ~1e-4 the value is dust; toPrecision would emit scientific
    // notation ("4.261e-17 ETH"), which reads as broken. Show "~0".
    if (Math.abs(val) < 1e-4) return `~0 ${asset}`;
    return `~${parseFloat(val.toPrecision(4))} ${asset}`;
  }
  if (val < 10) return `~$${val.toFixed(2)}`;
  if (val <= 100) return `~$${Math.round(val)}`;
  return `~$${Math.round(val / 5) * 5}`;
}

// Signed format for deltas (WoW etc.) — sign is always explicit.
export function fmtEarningsSigned(val: number, asset: string): string {
  const sign = val >= 0 ? "+" : "-";
  const abs = fmtEarnings(Math.abs(val), asset);
  // Insert sign: "~$2.74" → "+~$2.74" or "-~$2.74"
  return `${sign}${abs}`;
}

// TVL percentile label from rank (1 = largest) and total count.
export function tvlPercentileLabel(tvlRank: number, total: number): string {
  const frac = tvlRank / total;
  if (tvlRank <= 5 || frac <= 0.1) return "top 10%";
  if (frac <= 0.25) return "top quarter";
  if (frac <= 0.75) return "middle";
  if (frac <= 0.9) return "bottom quarter";
  return "bottom 10%";
}

// Qualify relative APY position vs a benchmark.
// delta = (vaultApy - benchmark) / benchmark * 100
export function benchmarkQualifier(deltaPct: number): string {
  if (deltaPct < -30) return "well below";
  if (deltaPct < -10) return "below";
  if (deltaPct <= 10) return "near";
  if (deltaPct <= 30) return "above";
  return "well above";
}

// ===== Data-quality guards ==================================================
// The hosted indexer occasionally records re-index / migration /
// decimals artifacts: a one-step jump in share price, or a TVL series
// that bounces orders of magnitude between adjacent daily readings.
// These poison any derived lifetime claim (CAGR, drawdown, all-time
// peak). The helpers below let the narrative layer detect the
// corruption and suppress the affected sentence rather than render a
// figure that contradicts the APY shown elsewhere on the page.

// True when the share-price series contains a single step whose
// implied per-day growth is impossibly large for realised yield. Even
// a 100%-APY vault grows well under 1% per day, so a step implying
// more than 5%/day is an artifact, not yield. Time-normalising by the
// gap between readings keeps legitimate growth across sparse,
// far-apart snapshots from tripping the check.
export function hasSharePriceDiscontinuity(
  points: { sharePrice: number; timestamp: number }[],
): boolean {
  if (points.length < 3) return false;
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].sharePrice;
    const cur = sorted[i].sharePrice;
    if (prev <= 0 || cur <= 0) continue;
    const gapDays = Math.max(
      1,
      (sorted[i].timestamp - sorted[i - 1].timestamp) / 86400,
    );
    const dailyRate = Math.pow(cur / prev, 1 / gapDays) - 1;
    if (Math.abs(dailyRate) > 0.05) return true;
  }
  return false;
}

// True when the TVL series is dominated by transient spikes: real TVL
// trends, it does not repeatedly read tens of thousands of dollars one
// day and under a hundred the next. A max more than 50x the median of
// the positive readings means peak / drawdown framing would be built
// on noise, so the caller should drop the peak-citing narrative.
export function isErraticTvl(
  points: { value: number; timestamp: number }[],
): boolean {
  const positive = points.map((p) => p.value).filter((v) => v > 0);
  if (positive.length < 8) return false;
  const sorted = [...positive].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (median <= 0) return false;
  const max = sorted[sorted.length - 1];
  return max / median > 50;
}

// Strip transient single-reading TVL spikes: an interior point whose
// value deviates from BOTH of its time-neighbours by >= 50x, in either
// direction (a near-zero dip that bounces straight back, or a one-
// reading jump and back). At the indexer's ~1-2 day cadence such round
// trips are not real flows - they are dust / zero reads (e.g. a vault
// logging exactly $20 between $30K readings, or $178K between two $100
// readings). Left in, they poison every derived TVL figure: 30D
// low/high, "largest daily change", the all-time peak, the drawdown
// story, and the "$X 30 days ago" comparison. First and last points are
// never dropped, so the tracked-day span is preserved. Threshold mirrors
// the 50x factor isErraticTvl already uses for series-level detection.
export function sanitizeTvlSeries<T extends { value: number; timestamp: number }>(
  points: T[],
): T[] {
  if (!points || points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const keep = new Array<boolean>(sorted.length).fill(true);
  for (let i = 1; i < sorted.length - 1; i++) {
    const prev = sorted[i - 1].value;
    const cur = sorted[i].value;
    const next = sorted[i + 1].value;
    if (cur <= 0) continue;
    const dip = prev >= cur * 50 && next >= cur * 50;
    const jump = prev > 0 && next > 0 && cur >= prev * 50 && cur >= next * 50;
    if (dip || jump) keep[i] = false;
  }
  return sorted.filter((_, i) => keep[i]);
}
