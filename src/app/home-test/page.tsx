// /home-test - rebuilt homepage matching the /test + /btc-test
// design system. Full-bleed Sunflower Gold hero, then a centered
// shell holding a top-yields ranking, featured-asset tiles, network
// shortcuts, and an SEO content section.

import Link from "next/link";
import type { Metadata } from "next";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/constants";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { TestHubRow } from "@/components/test-hub-row";
import "./home-test.css";

export const metadata: Metadata = {
  title: "Best DeFi Yields (Test) | Harvest",
  description: SITE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/home-test` },
  robots: { index: false, follow: false },
};

const FEATURED_ASSETS = ["USDC", "ETH", "BTC", "USDT"] as const;
const ASSET_HUB: Record<string, { href: string; label: string; sub: string }> = {
  USDC: { href: "/usdc", label: "USDC", sub: "Stablecoin" },
  USDT: { href: "/usdt", label: "USDT", sub: "Stablecoin" },
  ETH: { href: "/eth", label: "ETH", sub: "LSTs & restaking" },
  BTC: { href: "/btc", label: "Bitcoin", sub: "Wrapped & LRTs" },
};

export default async function HomeTestPage() {
  const vaults = await getLiveVaults();
  const sparklines = await getAllSparklines();

  const totalTvl = vaults.reduce((s, v) => s + v.tvl, 0);
  const avgApy =
    vaults.length > 0
      ? vaults.reduce((s, v) => s + v.apy24h, 0) / vaults.length
      : 0;
  const chainCount = new Set(vaults.map((v) => v.chain)).size;

  // Sorted by 24h APY for the headline ranking; top 10 is plenty
  // for a homepage teaser, with a "See all" link to the full hubs.
  const topByApy = [...vaults].sort((a, b) => b.apy24h - a.apy24h).slice(0, 10);

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
      {/* Full-bleed Sunflower Gold hero */}
      <section className="uni-home-hero">
        <div className="uni-home-hero-inner">
          <p className="uni-home-eyebrow">
            <span className="uni-home-eyebrow-dot" />
            Onchain yield index · live
          </p>
          <h1 className="uni-home-h1">
            Best DeFi yields,
            <br />
            ranked, indexed, and live.
          </h1>
          <p className="uni-home-sub">
            Compare {vaults.length} yield strategies we currently track across{" "}
            {chainCount} {chainCount !== 1 ? "networks" : "network"}, ranked
            by APY, with daily-resolution history and risk classifications
            on every product.
          </p>

          <div className="uni-home-hero-stats">
            <div className="uni-home-hero-stat">
              <span className="uni-home-hero-stat-label">Strategies</span>
              <span className="uni-home-hero-stat-value">{vaults.length}</span>
            </div>
            <div className="uni-home-hero-stat">
              <span className="uni-home-hero-stat-label">Tracked TVL</span>
              <span className="uni-home-hero-stat-value">{formatTVL(totalTvl)}</span>
            </div>
            <div className="uni-home-hero-stat">
              <span className="uni-home-hero-stat-label">Avg APY</span>
              <span className="uni-home-hero-stat-value">
                {avgApy > 0 ? formatAPY(avgApy) : "-"}
              </span>
            </div>
            <div className="uni-home-hero-stat">
              <span className="uni-home-hero-stat-label">Networks</span>
              <span className="uni-home-hero-stat-value">{chainCount}</span>
            </div>
          </div>

          <div className="uni-home-hero-actions">
            <a
              href="https://app.harvest.finance"
              target="_blank"
              rel="noopener noreferrer"
              className="uni-home-cta-primary"
            >
              Open the App
              <span aria-hidden="true">↗</span>
            </a>
            <a href="#yields" className="uni-home-cta-secondary">
              Browse top yields
              <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
      </section>

      {/* Centered shell */}
      <main className="uni-home-shell">
        {/* Top yields ranking */}
        <section className="uni-home-section" id="yields" aria-labelledby="yields-title">
          <header className="uni-home-section-head">
            <div>
              <h2 id="yields-title" className="uni-home-section-title">
                Top yields by APY
              </h2>
              <p className="uni-home-section-sub">
                Across every asset and every network we currently index.
              </p>
            </div>
            <Link href="/usdc" className="uni-home-section-link">
              Explore stablecoin yields
              <span aria-hidden="true">→</span>
            </Link>
          </header>

          <div className="uni-home-table" role="table" aria-label="Top yields ranked by APY">
            <div className="uni-home-thead" role="row">
              <span className="uni-home-th uni-home-rank-h">#</span>
              <span className="uni-home-th">Vault</span>
              <span className="uni-home-th">Network</span>
              <span className="uni-home-th">Strategy</span>
              <span className="uni-home-th uni-home-th-num">TVL</span>
              <span className="uni-home-th uni-home-th-num">24h APY</span>
              <span className="uni-home-th uni-home-th-num">30d APY</span>
              <span className="uni-home-th uni-home-th-num">30d trend</span>
            </div>
            <div className="uni-home-tbody" role="rowgroup">
              {topByApy.map((v, i) => (
                <TestHubRow
                  key={v.id}
                  rank={i + 1}
                  vault={v}
                  sparkline={sparklines[v.contractAddress.toLowerCase()] ?? sparklines[v.contractAddress]}
                />
              ))}
            </div>
          </div>
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

        {/* SEO content placeholder */}
        <section className="uni-home-content" aria-labelledby="about-title">
          <h2 id="about-title">About the Harvest yield index</h2>
          <p>
            Harvest is an onchain yield index. The site exists to make
            comparing live yield products in DeFi as quick as comparing
            tokens on a public price feed. Every product on this page is
            actively running on chain; we read its APY and TVL from a
            hosted indexer and surface them in a single ranking, with
            daily-resolution history attached to each strategy.
          </p>
          <p>
            APY is a moving target. The 24-hour figure is the latest
            annualised return reported upstream; the 30-day figure is
            the simple mean of daily readings across the cohort we
            monitor. Past APY is not a guarantee of future returns, and
            outliers compound for a reason. The history view on every
            product page makes that volatility visible up front.
          </p>
          <p>
            Risk surfaces on every yield strategy. Smart-contract risk on
            both the vault and the underlying protocol applies; oracle,
            bridge, liquidity and governance risks vary by product. The
            full framework, including how each strategy is tiered and
            what we deliberately leave out, lives on the{" "}
            <Link href="/risk-framework">risk framework page</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
