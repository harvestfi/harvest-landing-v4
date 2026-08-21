export function formatTVL(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  // A positive amount never prints as "$0". Anything under 50 cents rounds to
  // zero, and on a drawdown line that reads as a total loss: "bottoming at $0
  // ... currently stands at $1" is the copy the consistency gate rejects, on a
  // vault holding real dust rather than nothing.
  if (value > 0 && value < 0.5) return "<$1";
  return `$${value.toFixed(0)}`;
}

export function formatAPY(value: number): string {
  if (value === 0) return "-";
  return `${value.toFixed(2)}%`;
}

/**
 * How to say a cohort's rate range in prose.
 *
 * A range whose floor rounds to 0.00% reads as an advertisement for the worst
 * row in the table. It is also the sentence a search engine tends to lift into
 * a snippet, because it is the first prose on the page carrying a figure, so
 * "APYs run from 0.00% to 2.55%" ends up being what a searcher sees before
 * they see anything else. Nothing is hidden by dropping it: the median and the
 * mean follow in the same sentence and every row is in the table below.
 *
 * A floor of exactly zero is a real reading, not a rounding artifact, and it
 * is treated the same way for the same reason.
 *
 * Returns the clause after "24-hour APYs", so callers read:
 *   `24-hour APYs {apyRangeClause(min, max)}.`
 *
 * `fmt` is there for callers that format percentages their own way, and
 * `past` for prose that reports a reading rather than a live state, so the
 * threshold stays in one place instead of being re-decided per page.
 */
export function apyRangeClause(
  min: number,
  max: number,
  { fmt = formatAPY, past = false }: { fmt?: (v: number) => string; past?: boolean } = {},
): string {
  const hasFloor = min >= 0.005;
  if (hasFloor) {
    return `${past ? "ran" : "run"} from ${fmt(min)} to ${fmt(max)}`;
  }
  return `${past ? "reached" : "reach"} up to ${fmt(max)}`;
}

const KNOWN_CHAINS = ["Ethereum", "Polygon", "Arbitrum", "Base", "zkSync", "HyperEVM"];

export function stripChainSuffix(category: string, chain?: string): string {
  if (!category) return category;
  const targets = chain ? [chain, ...KNOWN_CHAINS] : KNOWN_CHAINS;
  for (const c of targets) {
    const suffix = ` - ${c}`;
    if (category.endsWith(suffix)) return category.slice(0, -suffix.length);
  }
  return category;
}