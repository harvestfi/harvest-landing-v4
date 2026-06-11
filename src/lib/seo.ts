import { YieldVault } from "./types";
import { SITE_NAME, SITE_URL, TRACKED_STRATEGIES_LABEL } from "./constants";
import { getSubAsset, getSubAssetFamilyName, isUmbrellaAsset } from "./sub-asset";
import { stripChainSuffix } from "./format";
import { getCanonicalDisplayName } from "./lp-pair";

const MAX_TITLE_CHARS = 58;

// Returns the DeFi protocol name (e.g. "Morpho", "Aerodrome") from the category
// field, which is more meaningful than protocol.name ("Harvest Finance").
export function getProtocolLabel(vault: YieldVault): string {
  return stripChainSuffix(vault.category, vault.chain);
}

function clampTitle(full: string): string {
  if (full.length <= MAX_TITLE_CHARS) return full;
  return full.replace(/ \| Harvest$/, "");
}

// "ETH Aerodrome" style lead: ticker + product name, without doubling
// the asset when the product name already carries it (e.g. "USDC Aave"
// stays "USDC Aave", not "USDC USDC Aave").
function tickerProduct(vault: YieldVault): string {
  const subAsset = getSubAsset(vault);
  const name = vault.productName.trim();
  const lower = name.toLowerCase();
  if (
    lower.includes(subAsset.toLowerCase()) ||
    lower.includes(vault.asset.toLowerCase())
  ) {
    return name;
  }
  return `${subAsset} ${name}`;
}

// ─── Asset hub ────────────────────────────────────────────────────────────────

// Returns the bare descriptive title (no "| Harvest") — the root layout
// template "%s | Harvest" appends the brand suffix automatically.
export function assetHubTitle(asset: string): string {
  const label = isUmbrellaAsset(asset) ? getSubAssetFamilyName(asset) : asset;
  return `Best ${label} Yield: Top APY Ranking & Sources`;
}

export function assetHubH1(asset: string): string {
  const label = isUmbrellaAsset(asset) ? getSubAssetFamilyName(asset) : asset;
  return `Best ${label} Yield`;
}

export function assetHubDescription(
  asset: string,
  count: number,
  subAssets?: string[],
): string {
  // Target 140-160 chars so Google's snippet doesn't truncate. The
  // count + asset family carries the on-page promise; the second
  // sentence adds network reach so the description doesn't read as
  // identical across asset hubs.
  const familyName = isUmbrellaAsset(asset)
    ? getSubAssetFamilyName(asset)
    : asset;
  if (subAssets && subAssets.length > 1) {
    const listed =
      subAssets.length === 2
        ? subAssets.join(" and ")
        : subAssets.slice(0, -1).join(", ") +
          " and " +
          subAssets[subAssets.length - 1];
    return `Compare ${count}+ ${familyName} yield strategies across ${listed} on Ethereum, Base, Arbitrum and more. Live APY, TVL and 30-day history, updated hourly.`;
  }
  return `Compare ${count}+ ${asset} yield strategies across DeFi on Ethereum, Base, Arbitrum and other major networks. Live APY, TVL and 30-day history, updated hourly.`;
}

// ─── Network hub ──────────────────────────────────────────────────────────────

// Bare title without "| Harvest" — layout template appends brand.
export function networkHubTitle(networkDisplay: string): string {
  return `Best ${networkDisplay} Yields: APY & TVL Ranking`;
}

export function networkHubH1(networkDisplay: string): string {
  return `Best ${networkDisplay} Yields`;
}

export function networkHubDescription(
  networkDisplay: string,
  count: number,
): string {
  // 140-160 char floor. Reads as both a stat and an editorial promise
  // (apples-to-apples ranking) so the snippet stands on its own.
  return `Compare ${count}+ DeFi yield strategies on ${networkDisplay} side by side. Live APY, TVL and 30-day performance history for every product Harvest indexes, refreshed daily.`;
}

// ─── Product page ─────────────────────────────────────────────────────────────

// Pull the disambiguator slot ("vault name") from the productName,
// stripping any leading asset and protocol mentions so it never reads
// as "cbBTC Aave on Aave: cbBTC Aave Yield" (the redundant tokens
// problem). Returns the cleaned distinct portion of the name, or an
// empty string when no distinct portion remains after stripping.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function vaultDisambiguator(vault: YieldVault): string {
  const subAsset = getSubAsset(vault);
  const protocol = getProtocolLabel(vault);
  let name = vault.productName.trim();

  // Strip the asset symbol when it appears at the start (e.g.
  // "cbBTC Aave" -> "Aave"). Tolerates leading/trailing whitespace.
  name = name.replace(new RegExp(`^${escapeRegex(subAsset)}\\b\\s*`, "i"), "");

  // Strip every standalone occurrence of the protocol name so
  // "cbBTC Aave Plus" -> "Plus" rather than "Aave Plus" once the
  // title prefix already says "on Aave".
  name = name.replace(new RegExp(`\\b${escapeRegex(protocol)}\\b\\s*`, "gi"), "");

  // Drop common filler tokens that don't actually disambiguate.
  name = name.replace(/^v\d+\s*/i, "").trim();
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

// Build the asset|protocol|chain key used for product-title slot-3
// uniqueness. Lower-cased so casing differences in the source data
// don't fragment the count.
export function comboKey(vault: YieldVault): string {
  return `${vault.asset.toLowerCase()}|${getProtocolLabel(vault).toLowerCase()}|${vault.chain.toLowerCase()}`;
}

// Returns the FULL title including "| Harvest" (or without if over
// 58 chars). The disambiguator slot is dropped only when
// asset+protocol+network is already unique across the index — pass
// isUniqueCombo=true in that case. When the slot is dropped, the
// title appends "Stats" so two-word strategies still produce a
// distinct, descriptive title.
//
// The title carries no month/year (and no APY): every product title
// is intentionally STABLE across builds. A freshness stamp made half
// the index read "... TVL - June 2026" while longer titles dropped it
// for width, so two near-identical pages disagreed on format. A fixed
// title also keeps Google's cached SERP entry accurate between the
// hourly static rebuilds instead of pinning it to a month that turns
// stale the moment the calendar rolls over.
export function productPageTitle(
  vault: YieldVault,
  isUniqueCombo: boolean = false,
): string {
  const subAsset = getSubAsset(vault);
  const protocol = getProtocolLabel(vault);
  const disambig = vaultDisambiguator(vault);

  // Slot 3 stays unless: (a) combo is unique AND (b) there's no
  // distinct vault name to surface. If the disambiguator is empty,
  // we have no slot 3 to render anyway.
  const dropSlot3 = !disambig || isUniqueCombo;

  const core = dropSlot3
    ? `${subAsset} on ${protocol}: Yield, APY & TVL Stats`
    : `${subAsset} on ${protocol}: ${disambig} Yield, APY & TVL`;

  return clampTitle(`${core} | ${SITE_NAME}`);
}

export function productPageH1(vault: YieldVault): string {
  return vault.productName;
}

// Stable product-page description: no APY %, no month/year, no live
// count. Those all drift between the hourly static rebuilds, so a SERP
// snippet Google cached at the last crawl would misstate the live page
// (a YMYL liability). Instead the copy states only durable facts — the
// product, its protocol, its network, and that it sits inside the
// index we track — and closes by inviting a comparison against the
// platform-wide strategy floor (TRACKED_STRATEGIES_LABEL). "X Network"
// reads naturally for every chain ("Base Network", "Ethereum Network").
export function productPageDescription(vault: YieldVault): string {
  const protocol = getProtocolLabel(vault);
  const lead = tickerProduct(vault);
  return `Explore the performance of ${lead} on ${protocol}, which is among the strategies we track on ${vault.chain} Network, and compare it against ${TRACKED_STRATEGIES_LABEL} strategies tracked.`;
}

// ─── Breadcrumb data helpers ──────────────────────────────────────────────────

export interface Crumb {
  name: string;
  url?: string;
}

// Breadcrumb labels follow a single rule globally:
//   Home > {Ticker} Ranking > {Product name (only on product pages)}
// Where Ticker is the asset symbol (BTC / ETH / USDC / USDT) for
// asset hubs, and the network display name (Ethereum / Base / etc.)
// for network hubs. The visible breadcrumbs emit a home icon for the
// first crumb in the renderer; the schema keeps "Home" as the name
// so structured data stays accessible to crawlers.
export function productPageCrumbs(vault: YieldVault): Crumb[] {
  const ticker = isUmbrellaAsset(vault.asset)
    ? vault.asset.toUpperCase()
    : vault.asset;
  const hubPath = `${SITE_URL}/${vault.asset.toLowerCase()}`;
  return [
    { name: "Home", url: SITE_URL },
    { name: `${ticker} Ranking`, url: hubPath },
    { name: getCanonicalDisplayName(vault) },
  ];
}

export function assetHubCrumbs(asset: string): Crumb[] {
  const ticker = isUmbrellaAsset(asset) ? asset.toUpperCase() : asset;
  return [
    { name: "Home", url: SITE_URL },
    { name: `${ticker} Ranking` },
  ];
}

export function networkHubCrumbs(networkDisplay: string): Crumb[] {
  return [
    { name: "Home", url: SITE_URL },
    { name: `${networkDisplay} Ranking` },
  ];
}
