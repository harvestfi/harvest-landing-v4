import { getVaults } from "@/lib/data";
import { getCanonicalSlugs } from "@/lib/canonical-vaults";
import { formatAPY, formatTVL } from "@/lib/format";
import {
  productPageTitle,
  productPageDescription,
  comboKey,
  assetHubTitle,
  assetHubDescription,
  networkHubTitle,
  networkHubDescription,
} from "@/lib/seo";
import { getSubAsset } from "@/lib/sub-asset";
import { NETWORKS } from "@/lib/networks";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { SeoTable } from "@/components/seo-table";
import { existsSync, statSync } from "fs";
import { join } from "path";

// SEO admin overview. Renders titles + descriptions in the same
// visual order users navigate the site: homepage first, then asset
// hubs, then network hubs, then every single-product page. Each row
// is the string the page actually emits in production (the helpers
// below are the same ones generateMetadata calls), so what's
// rendered here is what Google indexes.

const ASSET_HUBS = [
  { asset: "USDC", path: "/usdc" },
  { asset: "USDT", path: "/usdt" },
  { asset: "ETH", path: "/eth" },
  { asset: "BTC", path: "/btc" },
] as const;

export default async function AdminPage() {
  const vaults = await getVaults();
  const canonical = await getCanonicalSlugs();

  const now = Date.now();

  // --- Homepage row -------------------------------------------------
  const homeRow = {
    type: "Home" as const,
    slug: "/",
    title: "Best DeFi Yields: Compare Top APY Rankings | Harvest",
    description:
      "Track and compare yield sources across DeFi. Find the best APY for USDC, ETH, Bitcoin and USDT across the strategies we index on Ethereum, Base, Arbitrum and more. Updated daily.",
    chain: "—",
    apy: "—",
    tvl: formatTVL(vaults.reduce((s, v) => s + v.tvl, 0)),
    indexed: true,
  };

  // --- Asset hub rows ----------------------------------------------
  const assetRows = ASSET_HUBS.map((hub) => {
    const cohort = vaults.filter((v) => v.asset === hub.asset);
    const subAssets = [...new Set(cohort.map(getSubAsset))].sort();
    const tvl = cohort.reduce((s, v) => s + v.tvl, 0);
    return {
      type: "Asset hub" as const,
      slug: hub.path,
      title: `${assetHubTitle(hub.asset)} | ${SITE_NAME}`,
      description: assetHubDescription(hub.asset, cohort.length, subAssets),
      chain: "—",
      apy: "—",
      tvl: tvl > 0 ? formatTVL(tvl) : "—",
      indexed: cohort.length > 0,
    };
  });

  // --- Network hub rows --------------------------------------------
  const networkRows = NETWORKS.map((n) => {
    const cohort = vaults.filter((v) => v.chain === n.chain);
    const tvl = cohort.reduce((s, v) => s + v.tvl, 0);
    return {
      type: "Network hub" as const,
      slug: `/${n.slug}`,
      title: `${networkHubTitle(n.display)} | ${SITE_NAME}`,
      description: networkHubDescription(n.display, cohort.length),
      chain: n.display,
      apy: "—",
      tvl: tvl > 0 ? formatTVL(tvl) : "—",
      indexed: cohort.length > 0,
    };
  });

  // --- Product rows -------------------------------------------------
  // asset+protocol+chain combo tally so the title generator decides
  // when to drop the disambiguator slot.
  const comboTally = new Map<string, number>();
  for (const v of vaults) {
    const k = comboKey(v);
    comboTally.set(k, (comboTally.get(k) ?? 0) + 1);
  }
  const productRows = vaults.map((vault) => {
    const trackedDays = vault.launchDate
      ? Math.max(
          0,
          Math.floor((now - new Date(vault.launchDate).getTime()) / 86_400_000),
        )
      : 0;
    const isUniqueCombo = (comboTally.get(comboKey(vault)) ?? 0) === 1;
    return {
      type: "Product" as const,
      slug: `/${vault.slug}`,
      title: productPageTitle(vault, isUniqueCombo),
      description: productPageDescription(vault, trackedDays),
      chain: vault.chain,
      apy: formatAPY(vault.apy24h),
      tvl: formatTVL(vault.tvl),
      indexed: canonical.has(vault.slug),
    };
  });

  const rows = [homeRow, ...assetRows, ...networkRows, ...productRows];

  let lastUpdated = new Date().toISOString();
  const vaultsFile = join(process.cwd(), "data", "vaults.json");
  if (existsSync(vaultsFile)) {
    const stat = statSync(vaultsFile);
    lastUpdated = stat.mtime.toISOString();
  }

  return (
    <main className="adm-page">
      <SeoTable
        rows={rows}
        vaultCount={vaults.length}
        siteOrigin={SITE_URL}
        lastUpdated={new Date(lastUpdated).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      />
    </main>
  );
}
