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

// Returns the FULL title including "| Harvest" (or without if over 58 chars).
// Uses { absolute: ... } in generateMetadata to bypass the layout template.
export function productPageTitle(vault: YieldVault): string {
  const subAsset = getSubAsset(vault);
  const protocol = getProtocolLabel(vault); // e.g. "Aerodrome", "Morpho", "Aave V3"
  const afterToken = vault.productName.slice(subAsset.length).trim();
  const isRedundant =
    !afterToken || afterToken.toLowerCase() === protocol.toLowerCase();

  const core = isRedundant
    ? `${subAsset} on ${protocol}: Yield, APY & TVL`
    : `${subAsset} on ${protocol}: ${afterToken} Yield, APY & TVL`;

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
    return `${vault.productName} on ${protocol} (${network}) - ${subAsset} yield averaging ${vault.apy30d.toFixed(1)}% APY over 30 days. Track TVL, performance and risk benchmarks.`;
  }

  const since = vault.launchDate
    ? new Date(vault.launchDate).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "recently";

  return `${vault.productName} on ${protocol} (${network}) - new ${subAsset} yield strategy live since ${since}. Track APY, TVL and performance history.`;
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
