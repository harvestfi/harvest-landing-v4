// Single source of truth for "how many days have we tracked this vault".
//
// The product page renders the vault's age in several independent spots -
// the "Tracked for" stat, the "live for N days" / "Lifetime avg (Nd)" lines,
// the Yield-trajectory "deposited at launch (N days ago)", and the
// share-price CAGR window. Each used to compute its own span (mostly off the
// APY-history series), so a sparse vault whose APY series is a single point
// (span 0d) but whose TVL / share-price series span several days rendered
// "live for 9 days" beside "Lifetime avg (0d)" - a self-contradiction the
// page-consistency gate hard-fails as a YMYL longevity fault.
//
// Take the longest span across all three indexed series so every spot agrees
// on one honest number. The three series are co-indexed for normal vaults,
// so this equals their (shared) span there and only diverges - toward the
// most complete picture - for the sparse vaults that tripped the gate.

interface TimestampedPoint {
  timestamp: number;
}

interface HistoryLike {
  apyHistory?: TimestampedPoint[];
  tvlHistory?: TimestampedPoint[];
  sharePriceHistory?: TimestampedPoint[];
}

export function spanDays(stamps: number[]): number {
  const valid = stamps.filter((t) => Number.isFinite(t) && t > 0);
  if (valid.length < 2) return 0;
  return Math.round((Math.max(...valid) - Math.min(...valid)) / 86400);
}

export function trackedDays(history: HistoryLike): number {
  return Math.max(
    spanDays((history.apyHistory ?? []).map((p) => p.timestamp)),
    spanDays((history.tvlHistory ?? []).map((p) => p.timestamp)),
    spanDays((history.sharePriceHistory ?? []).map((p) => p.timestamp)),
  );
}
