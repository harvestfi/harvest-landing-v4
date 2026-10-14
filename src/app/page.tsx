// Harvest homepage. Boxed Sunflower Gold hero, then a centered shell
// with the top-yields ranking, featured asset tiles, data & tools links,
// network shortcuts, and an SEO content section.

import Link from "next/link";
import type { Metadata } from "next";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/constants";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { HubTable } from "@/components/hub-table";
import { HomeHeroPreview } from "@/components/home-hero-preview";
import { RankingDataNote } from "@/components/ranking-data-note";
import { TrackedAppLink } from "@/components/tracked-app-link";
import "./_styles/home.css";

export const metadata: Metadata = {
  title: "Best DeFi Yields: Compare Top APY Rankings | Harvest",
  description:
    "Track and compare yield sources across DeFi. Find the best APY for USDC, ETH, Bitcoin and USDT across the strategies we index on Ethereum, Base, Arbitrum and more. Updated hourly.",
  openGraph: {
    title: "Best DeFi Yields: Compare Top APY Rankings | Harvest",
    description:
      "Track and compare yield sources across DeFi. Best APY for USDC, ETH, Bitcoin and USDT. Updated hourly.",
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

// Body links to the standalone data pages. The homepage carries about 4,000
// referring domains, but until this block it reached these pages only through
// the footer, which search engines weigh as boilerplate. /xrp-rich-list ranks
// #3 for "xrp rich list" (6,100 US searches/mo) on 10 referring domains, so
// an in-content link from the strongest page on the site is the cheapest lift
// available. Each label is the phrase the target page ranks for, so the
// anchor tells a crawler what the page is about. The sub-lines restate each
// page's own description and carry no live figures, so nothing here can
// drift from the page it links to between refreshes.
const DATA_TOOLS = [
  {
    href: "/xrp-rich-list",
    icon: "XRP",
    label: "XRP Rich List",
    sub: "Holder distribution",
    desc: "Top 1%, 5%, 10% and 25% thresholds read from the XRP Ledger, with a calculator for where a balance ranks.",
    cta: "See the rich list",
  },
  {
    href: "/report/xrp-yield-ranking",
    icon: "XRP",
    label: "XRP Staking & Yield",
    sub: "10+ yield sources",
    desc: "XRP has no native staking. Vaults, lending venues, pools and fixed-term markets that pay a rate on XRP assets.",
    cta: "Compare XRP yields",
  },
  {
    href: "/report/stablecoin-yield-ranking",
    icon: "USDC",
    label: "Best Stablecoin Yields",
    sub: "USDC, USDT, DAI & USDS",
    desc: "Stablecoin rates measured from onchain share-price history, split into the highest paying and the steadiest.",
    cta: "Compare stablecoin rates",
  },
] as const;

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
              Browse <span className="uni-home-cta-extra">top </span>yields
              <span aria-hidden="true">↓</span>
            </a>
            <TrackedAppLink
              href="https://app.harvest.finance"
              cta="hero-open-app"
              className="uni-home-cta-secondary"
            >
              Open the App
              <span aria-hidden="true">↗</span>
            </TrackedAppLink>
          </div>
        </div>
      </section>

      <main className="uni-home-shell">
        {/* Top yields ranking */}
        {/* data-nosnippet: this live ranking table is the homepage's most
            prominent block, so Google was lifting it verbatim into the SERP
            snippet (mashed cell text, plus the "#" rank header and bare "%"),
            overriding our crafted meta description. nosnippet keeps the table
            fully crawled and indexed - no ranking impact - but bars it from
            the snippet, so the meta description wins. Reversible: remove the
            attribute to restore. */}
        <section
          className="uni-home-section"
          id="yields"
          aria-labelledby="yields-title"
          data-nosnippet=""
        >
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

        {/* Data & tools */}
        <section className="uni-home-section" aria-labelledby="tools-title">
          <header className="uni-home-section-head">
            <div>
              <h2 id="tools-title" className="uni-home-section-title">
                Data &amp; tools
              </h2>
              <p className="uni-home-section-sub">
                Standalone reports and calculators built on the same onchain data.
              </p>
            </div>
          </header>
          <div className="uni-home-asset-grid uni-home-tool-grid">
            {DATA_TOOLS.map((tool) => (
              <Link key={tool.href} href={tool.href} className="uni-home-asset-card">
                <div className="uni-home-asset-card-head">
                  <AssetIcon asset={tool.icon} size={36} decorative />
                  <div className="uni-home-asset-card-id">
                    <div className="uni-home-asset-card-label">{tool.label}</div>
                    <div className="uni-home-asset-card-sub">{tool.sub}</div>
                  </div>
                </div>
                <p className="uni-home-tool-card-desc">{tool.desc}</p>
                <div className="uni-home-asset-card-foot">
                  <span>{tool.cta}</span>
                  <span aria-hidden="true" className="uni-home-asset-card-arrow">→</span>
                </div>
              </Link>
            ))}
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

        <RankingDataNote />
      </main>
    </div>
  );
}
