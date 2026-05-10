import { YieldVault } from "./types";
import { SITE_NAME, SITE_URL } from "./constants";
import { getSubAsset, getSubAssetFamilyName, isUmbrellaAsset } from "./sub-asset";
import { stripChainSuffix } from "./format";

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
    return `Track ${count}+ ${familyName} yield sources across ${listed}. Compare APY, TVL and performance history. Updated daily.`;
  }
  return `Track ${count}+ ${asset} yield sources across DeFi. Compare APY, TVL and performance history. Updated daily.`;
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
  return `Track ${count}+ yield sources on ${networkDisplay}. Compare APY, TVL and performance history across DeFi protocols. Updated daily.`;
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

export function productPageDescription(
  vault: YieldVault,
  trackedDays: number,
): string {
  const subAsset = getSubAsset(vault);
  const protocol = getProtocolLabel(vault);
  const network = vault.chain;

  if (trackedDays >= 30 && vault.apy30d > 0) {
    return `${vault.productName} on ${protocol} (${network}). ${subAsset} yield averaging ${vault.apy30d.toFixed(1)}% APY over 30 days. Track TVL, performance and risk benchmarks.`;
  }

  // Resolve "live since {month year}" only when the vault has a
  // valid launchDate. Anything else falls back to a generic "in our
  // index" line that doesn't promise a date the data can't back up.
  let since: string | null = null;
  if (vault.launchDate) {
    const d = new Date(vault.launchDate);
    if (!Number.isNaN(d.getTime())) {
      since = d.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
  }

  if (since) {
    return `${vault.productName} on ${protocol} (${network}). New ${subAsset} yield strategy live since ${since}. Track APY, TVL and performance history.`;
  }

  return `${vault.productName} on ${protocol} (${network}). ${subAsset} yield strategy indexed by Harvest. Track APY, TVL and performance history.`;
}

// ─── Breadcrumb data helpers ──────────────────────────────────────────────────

export interface Crumb {
  name: string;
  url?: string;
}

export function productPageCrumbs(vault: YieldVault): Crumb[] {
  const isUmbrella = isUmbrellaAsset(vault.asset);
  const familyLabel = isUmbrella
    ? `${getSubAssetFamilyName(vault.asset)} Yield Ranking`
    : `${vault.asset} Yield Ranking`;
  const hubPath = `${SITE_URL}/${vault.asset.toLowerCase()}`;

  return [
    { name: "Home", url: SITE_URL },
    { name: familyLabel, url: hubPath },
    { name: vault.productName },
  ];
}

export function assetHubCrumbs(asset: string): Crumb[] {
  const isUmbrella = isUmbrellaAsset(asset);
  const label = isUmbrella
    ? `${getSubAssetFamilyName(asset)} Yield Ranking`
    : `${asset} Yield Ranking`;
  return [{ name: "Home", url: SITE_URL }, { name: label }];
}

export function networkHubCrumbs(networkDisplay: string): Crumb[] {
  return [
    { name: "Home", url: SITE_URL },
    { name: `${networkDisplay} Yields` },
  ];
}
