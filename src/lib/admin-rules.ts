/**
 * Editorial filter rules applied to every public ranking surface.
 *
 * These rules live in code (not in a runtime store) because the site
 * is a static export — flipping a switch here requires a commit and a
 * Vercel rebuild. The /admin/ranking-rules page renders this object
 * as a read-only documentation view so the operator can see at a
 * glance what's hidden from the index and why.
 */

export interface RankingRule {
  id: string;
  name: string;
  enabled: boolean;
  /** One-sentence explanation surfaced in the admin panel. */
  rationale: string;
  /** Where the filter is enforced in the code, for traceability. */
  source: string;
}

export const STALE_APY_DAYS = 14;
export const BROKEN_TVL_THRESHOLD = 10_000;
export const BROKEN_MIN_OBSERVATIONS = 14;
export const HIDE_AERODROME = false;

export const RANKING_RULES: RankingRule[] = [
  {
    id: "live-only",
    name: "Live only",
    enabled: true,
    rationale:
      "A vault must have a positive 24h APY and a positive TVL to appear in any ranking. Catches dead deployments, brand-new vaults with no observations, and API rows where data is missing.",
    source: "src/lib/data.ts → isLiveVault",
  },
  {
    id: "stale-apy",
    name: `Stale APY (${STALE_APY_DAYS}+ days unchanged)`,
    enabled: true,
    rationale: `If a vault's daily APY value hasn't moved for ${STALE_APY_DAYS}+ consecutive days the strategy is almost certainly paused, dead, or oracle-stuck. Filtered out of every list and re-included automatically the moment the APY moves.`,
    source: "src/lib/data.ts → isStaleApyHistory",
  },
  {
    id: "broken-low-tvl",
    name: `Broken low-TVL (sub $${(BROKEN_TVL_THRESHOLD / 1000).toFixed(0)}k, flat history)`,
    enabled: true,
    rationale: `Any vault with under $${BROKEN_TVL_THRESHOLD.toLocaleString()} TVL whose APY history shows ${BROKEN_MIN_OBSERVATIONS}+ identical daily observations in the last 30 days is treated as broken (paused harvest, oracle stuck, or never bootstrapped). Filtered from rankings, dropped from the sitemap, and emitted with robots noindex on the product page so crawlers stop wasting budget.`,
    source: "src/lib/data.ts → isBrokenLowTvlVault",
  },
  {
    id: "hide-aerodrome",
    name: "Hide Aerodrome strategies",
    enabled: HIDE_AERODROME,
    rationale:
      "Operator decision: Aerodrome-routed strategies are excluded from public rankings. Match is a case-insensitive substring on productName/category, so any future Aerodrome listing is hidden automatically until this rule is flipped off.",
    source: "src/lib/data.ts → isAerodromeVault",
  },
];

export function isAerodromeName(productName: string | undefined, category: string | undefined): boolean {
  const haystack = `${productName ?? ""} ${category ?? ""}`.toLowerCase();
  return haystack.includes("aerodrome");
}
