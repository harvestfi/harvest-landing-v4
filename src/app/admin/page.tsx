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
import { SerpPreview } from "@/components/serp-preview";
import { existsSync, statSync } from "fs";
import { join } from "path";
import "../_styles/asset-hub.css";

// SEO admin overview. Sits inside the canonical .uni-hub-test shell
// (the same one /eth, /usdc, /admin/acquisition use) so every admin
// surface speaks one visual language. Renders, top to bottom:
//   1. Hero with title + meta + tally tiles
//   2. SERP preview card - desktop + mobile result blocks, with a
//      pickable list of every indexed page on the site
//   3. The full SEO inventory ranking table

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
  const indexedCount = rows.filter((r) => r.indexed).length;

  let lastUpdated = new Date().toISOString();
  const vaultsFile = join(process.cwd(), "data", "vaults.json");
  if (existsSync(vaultsFile)) {
    const stat = statSync(vaultsFile);
    lastUpdated = stat.mtime.toISOString();
  }
  const lastUpdatedLabel = new Date(lastUpdated).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const previewRows = rows.map((r) => ({
    slug: r.slug,
    type: r.type,
    title: r.title,
    description: r.description,
  }));

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">SEO Overview</h1>
            <p className="uni-hub-sub">
              Every meta title and description the site ships, in the order a
              visitor would crawl them: homepage, asset hubs, network hubs, and
              every single-product page. Preview how each result will look in
              Google search before shipping a copy change.
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="SEO summary"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          <Stat label="Pages" value={rows.length.toLocaleString("en-US")} />
          <Stat label="Indexed" value={indexedCount.toLocaleString("en-US")} />
          <Stat label="Vaults" value={vaults.length.toLocaleString("en-US")} />
          <Stat label="Updated" value={lastUpdatedLabel} mono={false} />
        </div>
      </header>

      <section className="uni-hub-section" style={{ marginTop: 0 }}>
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">SERP preview</h2>
          <span className="uni-hub-section-meta">
            desktop + mobile result blocks
          </span>
        </header>
        <SerpPreview rows={previewRows} siteOrigin={SITE_URL} />
      </section>

      <section className="uni-hub-section">
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">Inventory</h2>
          <span className="uni-hub-section-meta">
            {rows.length} pages indexed
          </span>
        </header>
        <SeoTable rows={rows} siteOrigin={SITE_URL} />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div
        className="uni-hub-stat-value"
        style={mono ? undefined : { fontSize: 15, fontWeight: 500 }}
      >
        {value}
      </div>
    </div>
  );
}
