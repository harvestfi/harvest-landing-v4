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
  // One-paragraph editorial lede for the SEO content block.
  blurb: string;
}

export const PLATFORMS: Platform[] = [
  {
    slug: "aave",
    display: "Aave",
    aliases: ["Aave"],
    blurb:
      "Aave is one of DeFi's largest lending markets. Harvest wraps Aave deposits in autocompounding vaults that continuously reinvest the interest back into the position, so the balance grows without manual claiming or restaking.",
  },
  {
    slug: "morpho",
    display: "Morpho",
    aliases: ["Morpho", "Morpho Market"],
    blurb:
      "Morpho is a lending layer that routes deposits into curated, isolated markets. Harvest wraps Morpho positions in autocompounding vaults so interest and rewards reinvest automatically.",
  },
];

// Platform slugs that have a live route under src/app/<slug>/page.tsx. Keep
// in sync when you add a route — drives the sitemap and the cross-platform
// bottom rail so we never link a hub that 404s.
export const LIVE_PLATFORM_SLUGS = ["aave"];

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
