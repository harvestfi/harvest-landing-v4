// Harvest homepage. Boxed Sunflower Gold hero, then a centered shell
// with the top-yields ranking, featured asset tiles, network shortcuts,
// and an SEO content section.

import Link from "next/link";
import type { Metadata } from "next";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/constants";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { HubTable } from "@/components/hub-table";
import { HomeHeroPreview } from "@/components/home-hero-preview";
import "./_styles/home.css";

export const metadata: Metadata = {
  title: "Best DeFi Yields: Compare Top APY Rankings | Harvest",
  description:
    "Track and compare yield sources across DeFi. Find the best APY for USDC, ETH, Bitcoin and USDT across the strategies we index on Ethereum, Base, Arbitrum and more. Updated daily.",
  openGraph: {
    title: "Best DeFi Yields: Compare Top APY Rankings | Harvest",
    description:
      "Track and compare yield sources across DeFi. Best APY for USDC, ETH, Bitcoin and USDT. Updated daily.",
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: Compare DeFi Yield Sources`,
    description: SITE_DESCRIPTION,
  },
  alternates: { canonical: SITE_URL },
};

const FEATURED_ASSETS = ["USDC", "ETH", "BTC", "USDT"] as const;
const ASSET_HUB: Record<string, { href: string; label: string; sub: string }> = {
  USDC: { href: "/usdc", label: "USDC", sub: "Stablecoin" },
  USDT: { href: "/usdt", label: "USDT", sub: "Stablecoin" },
  ETH: { href: "/eth", label: "ETH", sub: "LSTs & restaking" },
  BTC: { href: "/btc", label: "Bitcoin", sub: "Wrapped & LRTs" },
};

export default async function HomePage() {
  const vaults = await getLiveVaults();
  const sparklines = await getAllSparklines();

  const chainCount = new Set(vaults.map((v) => v.chain)).size;

  // Best per asset for the featured asset cards.
  const bestByAsset: Record<string, { apy: number; tvl: number; count: number }> = {};
  for (const v of vaults) {
    const cur = bestByAsset[v.asset] ?? { apy: 0, tvl: 0, count: 0 };
    if (v.apy24h > cur.apy) cur.apy = v.apy24h;
    cur.tvl += v.tvl;
    cur.count += 1;
    bestByAsset[v.asset] = cur;
  }

  const visibleChains = [...new Set(vaults.map((v) => v.chain))].sort();

  return (
    <div className="uni-home-test">
      <section className="uni-home-hero">
        <HomeHeroPreview />
        <div className="uni-home-hero-inner">
          <h1 className="uni-home-h1">
            Best USDC, USDT, ETH,
            <br />
            Bitcoin yields, and more.
          </h1>
          <p className="uni-home-sub">
            Discover and compare every yield strategy we currently
            track, across {chainCount}{" "}
            {chainCount !== 1 ? "networks" : "network"}, sorted by APY
            with daily-resolution history and risk classifications on
            every product.
          </p>

          <div className="uni-home-hero-actions">
            <a href="#yields" className="uni-home-cta-primary">
              Browse top yields
              <span aria-hidden="true">↓</span>
            </a>
            <a
              href="https://app.harvest.finance"
              target="_blank"
              rel="noopener noreferrer"
              className="uni-home-cta-secondary"
            >
              Open the App
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>

      <main className="uni-home-shell">
        {/* Top yields ranking */}
        <section className="uni-home-section" id="yields" aria-labelledby="yields-title">
          <header className="uni-home-section-head">
            <div>
              <h2 id="yields-title" className="uni-home-section-title">
                Top yields
              </h2>
              <p className="uni-home-section-sub">
                Live ranking across every asset and network we index.
              </p>
            </div>
            <Link href="/usdc" className="uni-home-section-link">
              Explore stablecoin yields
              <span aria-hidden="true">→</span>
            </Link>
          </header>

          <HubTable
            vaults={vaults}
            sparklines={sparklines}
            pageSize={50}
            showAssetFilter
            scopeLabel="strategies"
          />
        </section>

        {/* Featured asset tiles */}
        <section className="uni-home-section" aria-labelledby="featured-title">
          <header className="uni-home-section-head">
            <div>
              <h2 id="featured-title" className="uni-home-section-title">
                Featured assets
              </h2>
              <p className="uni-home-section-sub">
                Jump into the asset hub for a per-network ranking and history.
              </p>
            </div>
          </header>
          <div className="uni-home-asset-grid">
            {FEATURED_ASSETS.map((asset) => {
              const meta = ASSET_HUB[asset];
              const stats = bestByAsset[asset];
              if (!meta) return null;
              return (
                <Link key={asset} href={meta.href} className="uni-home-asset-card">
                  <div className="uni-home-asset-card-head">
                    <AssetIcon asset={asset} size={36} />
                    <div className="uni-home-asset-card-id">
                      <div className="uni-home-asset-card-label">{meta.label}</div>
                      <div className="uni-home-asset-card-sub">{meta.sub}</div>
                    </div>
                  </div>
                  <div className="uni-home-asset-card-stats">
                    <div className="uni-home-asset-stat">
                      <span className="uni-home-asset-stat-label">Best APY</span>
                      <span className="uni-home-asset-stat-value">
                        {stats?.apy ? formatAPY(stats.apy) : "-"}
                      </span>
                    </div>
                    <div className="uni-home-asset-stat">
                      <span className="uni-home-asset-stat-label">Tracked TVL</span>
                      <span className="uni-home-asset-stat-value">
                        {stats?.tvl ? formatTVL(stats.tvl) : "-"}
                      </span>
                    </div>
                  </div>
                  <div className="uni-home-asset-card-foot">
                    <span>{stats?.count ?? 0} strategies tracked</span>
                    <span aria-hidden="true" className="uni-home-asset-card-arrow">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Browse by network */}
        <section className="uni-home-section" aria-labelledby="networks-title">
          <header className="uni-home-section-head">
            <h2 id="networks-title" className="uni-home-section-title">
              Browse by network
            </h2>
          </header>
          <div className="uni-home-network-row">
            {visibleChains.map((chain) => (
              <Link
                key={chain}
                href={`/${chain.toLowerCase()}`}
                className="uni-home-network-pill"
              >
                <ChainIcon chain={chain} size={18} />
                {chain}
              </Link>
            ))}
          </div>
        </section>

        {/* SEO content */}
        <section className="uni-home-content" aria-labelledby="about-title">
          <h2 id="about-title">About the Harvest yield index</h2>
          <p>
            Harvest is a live yield index. Every product on this page
            is running on chain right now. We read APY and TVL straight
            off the source contracts, refresh hourly, and rank the lot
            in one table. Each row links to a daily-resolution history
            of how that strategy has performed.
          </p>
          <p>
            Two APY columns. 24-hour APY is the rate the strategy is
            paying right now, annualised. 30-day APY is the trailing
            mean across the last month of daily readings. Both move
            every day. The sparkline on each row shows the trajectory
            at a glance; the product page draws the full series.
          </p>
          <p>
            Yield is not free. Every strategy carries smart-contract
            risk on the vault and the protocol underneath. Add oracle,
            bridge, liquidity, depeg, and governance, depending on the
            product. The{" "}
            <Link href="/risk-framework">risk framework page</Link>{" "}
            explains how we tier each one and which categories we
            deliberately leave out.
          </p>
        </section>
      </main>
    </div>
  );
}
