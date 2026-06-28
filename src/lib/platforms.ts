// Platform (venue) hub registry. A platform hub (/aave, /morpho, ...) lists
// every strategy Harvest indexes that routes into one underlying venue,
// cutting the same data the asset and network hubs cut by token and chain.
//
// The venue is encoded in each vault's `category` as "Venue - Chain"
// (e.g. "Aave - Base", "Morpho Market - Base"); venueOf() reads the prefix.
// A platform can map several category prefixes (Morpho + Morpho Market).
//
// Only platforms that have a corresponding route under src/app/<slug>/ are
// linked + sitemapped. Add the route file, then the platform goes live.

import type { YieldVault } from "./types";

export interface Platform {
  slug: string;
  display: string;
  // Category venue prefixes that belong to this platform (case-insensitive).
  aliases: string[];
  // Editorial copy — written per-platform so no two hub pages share prose.
  // blurb: the lede. mechanism: how this specific venue produces yield and
  // how Harvest wraps it. distinct: what makes this venue different from the
  // others, so the page reads as genuinely about Aave / Morpho, not a
  // find-and-replace template.
  blurb: string;
  mechanism: string;
  distinct: string;
}

export const PLATFORMS: Platform[] = [
  {
    slug: "aave",
    display: "Aave",
    aliases: ["Aave"],
    blurb:
      "Aave is one of DeFi's largest and oldest lending markets, live since 2020 and battle-tested across multiple chains. Harvest wraps Aave deposits in autocompounding vaults that continuously reinvest the interest back into the position, so the balance grows without manual claiming or restaking.",
    mechanism:
      "Aave runs a single shared, overcollateralised pool per asset: suppliers deposit into one big market, borrowers post collateral and draw against it, and the supply APY floats with utilisation — the fuller the pool, the higher the rate. A Harvest Aave vault deposits the underlying into that market, holds the interest-bearing aToken, and periodically compounds the accrued interest (plus any incentive rewards) back into the position. Because every supplier shares the same pool, the rate you see is the market-wide rate, not a per-position quote.",
    distinct:
      "What sets Aave apart in this index is maturity and depth: a shared pool with deep liquidity means rates move smoothly and exits are rarely gated, but it also means yield is a pure function of borrow demand for that one asset — there are no isolated, curated sub-markets to pick between. That makes Aave the conservative, liquid end of the lending spectrum compared with curated-market venues like Morpho.",
  },
  {
    slug: "morpho",
    display: "Morpho",
    aliases: ["Morpho", "Morpho Market"],
    blurb:
      "Morpho is a modern lending layer built around isolated markets and curated vaults rather than one shared pool. Harvest wraps Morpho positions in autocompounding vaults so interest and any rewards reinvest automatically, without manual claiming.",
    mechanism:
      "Morpho is built from isolated markets, each defined by a single collateral asset, a loan asset, an oracle and a liquidation threshold. Third-party curators bundle those markets into vaults with a target risk profile, and depositors earn the blended rate of the underlying markets weighted by allocation. A Harvest Morpho vault deposits into the relevant market or curated vault and compounds the accrued yield back into the position. Rates reflect the utilisation of those specific isolated markets, not a single chain-wide pool.",
    distinct:
      "What sets Morpho apart in this index is isolation and curation: risk is scoped to each individual market instead of pooled across an entire asset, and a curator's allocation choices shape both the yield and the risk. That can mean higher, more differentiated rates than a shared pool, in exchange for trusting the market parameters and the curator — the opposite end of the spectrum from a single deep pool like Aave.",
  },
];

// Platform slugs that have a live route under src/app/<slug>/page.tsx. Keep
// in sync when you add a route — drives the sitemap and the cross-platform
// bottom rail so we never link a hub that 404s.
export const LIVE_PLATFORM_SLUGS = ["aave", "morpho"];

export function venueOf(category: string | undefined | null): string {
  return (category ?? "").split(" - ")[0].trim();
}

export function getPlatform(slug: string): Platform | undefined {
  return PLATFORMS.find((p) => p.slug === slug);
}

export function platformVaults(
  vaults: YieldVault[],
  platform: Platform,
): YieldVault[] {
  const set = new Set(platform.aliases.map((a) => a.toLowerCase()));
  return vaults.filter((v) => set.has(venueOf(v.category).toLowerCase()));
}
