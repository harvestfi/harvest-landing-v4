import Link from "next/link";
import { getLiveVaults, getAllSparklines, getTrackedDaysMap } from "@/lib/data";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";
import { VaultList } from "@/components/vault-list";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { TickerStrip } from "@/components/ticker-strip";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Best DeFi Yields: Compare Top APY Rankings | Harvest",
  description: "Track and compare yield sources across DeFi. Find the best APY for USDC, ETH, Bitcoin and USDT across the strategies we index on Ethereum, Base, Arbitrum and more. Updated daily.",
  openGraph: {
    title: "Best DeFi Yields: Compare Top APY Rankings | Harvest",
    description: "Track and compare yield sources across DeFi. Best APY for USDC, ETH, Bitcoin and USDT. Updated daily.",
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: Compare DeFi Yield Sources`,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
};

/* === Stat computation helpers === */

function computeStats(vaults: { apy24h: number; tvl: number; chain: string; asset: string; category: string }[]) {
  const totalTVL = vaults.reduce((sum, v) => sum + v.tvl, 0);
  const avgAPY =
    vaults.length > 0
      ? vaults.reduce((sum, v) => sum + v.apy24h, 0) / vaults.length
      : 0;
  const vaultCount = vaults.length;
  const chainCount = new Set(vaults.map((v) => v.chain)).size;

  return { totalTVL, avgAPY, vaultCount, chainCount };
}

function platformFromCategory(category: string): string {
  if (!category) return "Other";
  return category.split(" - ")[0].trim() || "Other";
}

function computePlatforms(vaults: { category: string; apy24h: number; tvl: number }[]) {
  const map = new Map<string, { count: number; totalApy: number; totalTvl: number }>();
  for (const v of vaults) {
    const platform = platformFromCategory(v.category);
    const entry = map.get(platform) || { count: 0, totalApy: 0, totalTvl: 0 };
    entry.count++;
    entry.totalApy += v.apy24h;
    entry.totalTvl += v.tvl;
    map.set(platform, entry);
  }
  return Array.from(map.entries())
    .map(([name, { count, totalApy, totalTvl }]) => ({
      name,
      count,
      avgApy: count > 0 ? totalApy / count : 0,
      totalTvl,
    }))
    .sort((a, b) => b.totalTvl - a.totalTvl)
    .slice(0, 12);
}

function computeFeaturedAssets(vaults: { asset: string; apy24h: number; tvl: number }[]) {
  const map = new Map<string, { bestApy: number; totalTvl: number; count: number }>();
  for (const v of vaults) {
    const entry = map.get(v.asset) || { bestApy: 0, totalTvl: 0, count: 0 };
    if (v.apy24h > entry.bestApy) entry.bestApy = v.apy24h;
    entry.totalTvl += v.tvl;
    entry.count++;
    map.set(v.asset, entry);
  }
  return Array.from(map.entries())
    .map(([asset, data]) => ({
      asset,
      bestApy: data.bestApy,
      totalTvl: data.totalTvl,
      poolCount: data.count,
    }))
    .sort((a, b) => b.totalTvl - a.totalTvl)
    .slice(0, 4);
}

import { AssetIcon } from "@/components/token-icons";

const ASSET_PAGES: Record<string, string> = {
  USDC: "/usdc",
  USDT: "/usdt",
  ETH: "/eth",
  BTC: "/btc",
};

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqStats {
  vaultCount: number;
  chainCount: number;
  totalTvl: number;
  avgApy: number;
  bestApy: number;
  bestApyVault: string;
  bestApyProtocol: string;
  protocolCount: number;
  topChainsLabel: string;
  longestTrackedDays: number;
  longestTrackedName: string;
  assetBreakdown: string;
  yearsOperating: number;
}

// Build a 7-question FAQ that targets broad search intent ("what is the
// best DeFi yield", "how is APY calculated", "how often is data updated",
// etc.). Answers cite live counts from the indexed dataset so the visible
// text on the page always matches the FAQPage schema we emit, which is a
// hard requirement for Google rich-result eligibility.
function buildHomepageFaq(s: FaqStats): FaqItem[] {
  return [
    {
      question: "What is Harvest Finance?",
      answer: `Harvest is an onchain yield index that currently tracks ${s.vaultCount} DeFi yield strategies across ${s.chainCount} networks, representing ${formatTVL(s.totalTvl)} in tracked TVL. The strategies in the index are spread across ${s.protocolCount} distinct underlying protocols. Harvest has been operating onchain since 2020, ${s.yearsOperating}+ years of continuous on-chain activity.`,
    },
    {
      question: "What is the best DeFi yield right now?",
      answer: `The highest 24-hour APY in our index right now is ${s.bestApy.toFixed(2)}%, currently held by ${s.bestApyVault} on ${s.bestApyProtocol}. The average 24-hour APY across all ${s.vaultCount} strategies we follow sits at ${s.avgApy.toFixed(2)}%. The ranking changes as on-chain conditions shift; the table on this page is sorted by 24-hour APY by default and updates with every daily build.`,
    },
    {
      question: "How is APY calculated?",
      answer: `24-hour APY is the mean of APY records observed in the last 24 hours from our hosted indexer. 30-day APY is the simple arithmetic mean of daily APY observations over the last 30 days, filtering out negative values. APY is not time-weighted and does not account for compounding within the window. Reward tokens contribute at the rates published by the underlying protocol; we do not perform our own USD conversion of reward streams. The longest continuously-tracked strategy in our current index is ${s.longestTrackedName} at ${s.longestTrackedDays}+ days of APY history. Full methodology details are on the methodology page.`,
    },
    {
      question: "How often is the data updated?",
      answer: `Strategy data is refetched hourly from the underlying APIs and the site is rebuilt as a static export, so the version a visitor sees can lag the latest fetch by up to one hour. The current build reflects ${s.vaultCount} live strategies across ${s.chainCount} networks. Real-time on-page values are not currently provided; the freshness line in the footer reflects this.`,
    },
    {
      question: "Are these yields safe?",
      answer: `No DeFi yield strategy is risk-free. Smart-contract risk, oracle risk, liquidity risk, depeg risk and governance risk all apply, and risk profiles vary between protocols and between deployments of the same protocol on different networks. Across the ${s.vaultCount} strategies in our index today, all are operated by Harvest Finance, which we disclose openly. Per-strategy risk levels shown on the site are editorial classifications and are not yet derived from a quantitative model; the risk framework page covers the categories in more detail.`,
    },
    {
      question: "What chains and assets does Harvest cover?",
      answer: `We currently index strategies on ${s.chainCount} networks, with the largest coverage on ${s.topChainsLabel}. The asset breakdown across the strategies we follow is ${s.assetBreakdown}. ETH coverage includes WETH and major staking derivatives; BTC coverage includes WBTC, cbBTC and tBTC. Coverage expands as new strategies are added to the index.`,
    },
    {
      question: "Is Harvest a DeFi protocol or an aggregator?",
      answer: `Harvest is both. Every one of the ${s.vaultCount} strategies listed on this site today is operated by Harvest Finance, which we disclose openly on the methodology page. Listing and ranking are not influenced by operator status because, at present, all listed strategies share the same operator. Future expansion to third-party operators will preserve neutral ranking.`,
    },
  ];
}

function humanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export default async function Home() {
  const vaults = await getLiveVaults();
  const sparklines = await getAllSparklines();
  const stats = computeStats(vaults);
  const platforms = computePlatforms(vaults);
  const featuredAssets = computeFeaturedAssets(vaults);

  // Live stats woven into every FAQ answer so the schema and visible body
  // always match against the same indexed snapshot.
  const trackedDaysMap = await getTrackedDaysMap();

  const sortedByApy = [...vaults].sort((a, b) => b.apy24h - a.apy24h);
  const top = sortedByApy[0];
  const bestApy = top?.apy24h ?? 0;
  const bestApyVault = top?.productName ?? "";
  const bestApyProtocol = top
    ? stripChainSuffix(top.category, top.chain)
    : "";

  const protocolCount = new Set(
    vaults.map((v) => stripChainSuffix(v.category, v.chain)),
  ).size;

  // Top 3 chains by indexed TVL on this network in our cohort
  const tvlByChain = new Map<string, number>();
  for (const v of vaults) {
    tvlByChain.set(v.chain, (tvlByChain.get(v.chain) ?? 0) + v.tvl);
  }
  const topChainsLabel = humanList(
    [...tvlByChain.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c),
  );

  // Asset breakdown by strategy count, ordered desc; only assets with
  // non-zero coverage are surfaced (no "DAI: 0" filler).
  const assetCounts = new Map<string, number>();
  for (const v of vaults) {
    assetCounts.set(v.asset, (assetCounts.get(v.asset) ?? 0) + 1);
  }
  const assetBreakdown =
    [...assetCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([a, c]) => `${a} (${c})`)
      .join(", ") || "populating";

  // Longest continuously-tracked strategy from cached APY history
  let longestTrackedDays = 0;
  let longestTrackedName = "";
  for (const v of vaults) {
    const days = trackedDaysMap[v.contractAddress] ?? 0;
    if (days > longestTrackedDays) {
      longestTrackedDays = days;
      longestTrackedName = v.productName;
    }
  }

  const yearsOperating = new Date().getUTCFullYear() - 2020;

  const faqItems = buildHomepageFaq({
    vaultCount: stats.vaultCount,
    chainCount: stats.chainCount,
    totalTvl: stats.totalTVL,
    avgApy: stats.avgAPY,
    bestApy,
    bestApyVault,
    bestApyProtocol,
    protocolCount,
    topChainsLabel,
    longestTrackedDays,
    longestTrackedName,
    assetBreakdown,
    yearsOperating,
  });

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
    />
    <div className="dot-bg-home" aria-hidden="true" />
    <TickerStrip vaults={vaults} sparklines={sparklines} />
    <main className="page">
      {/* === Hero v2 === */}
      <section className="home-hero" aria-label="Hero">
        <div className="h2-mesh" aria-hidden="true">
          <div className="h2-blob h2-blob-1" />
          <div className="h2-blob h2-blob-2" />
          <div className="h2-blob h2-blob-3" />
          <div className="h2-grain" />
        </div>
        <div className="h2-vignette" aria-hidden="true" />

        <div className="home-hero-left">
          <div className="crumbs">
            <span className="crumbs-dot" />
            Onchain Yield Index
          </div>
          <h1>
            Best DeFi Yields.
            <br />
            <span className="dim">
              Compare {stats.vaultCount} strategies ranked by APY across USDC, USDT, ETH and Bitcoin.
            </span>
          </h1>
          <div className="home-hero-actions">
            <a href="#yields" className="home-hero-btn">Browse top yields →</a>
            <a
              href="https://app.harvest.finance"
              target="_blank"
              rel="noopener noreferrer"
              className="home-hero-btn-ghost"
            >
              Open App
            </a>
            <span className="home-hero-meta">
              <span className="dot pulse" />
              Live · {stats.vaultCount} vaults · {stats.chainCount} chains
            </span>
          </div>
        </div>

        <div className="home-hero-right" role="group" aria-label="Top yields by asset">
          {(["USDC", "ETH", "BTC"] as const).map((sym) => {
            const tile = featuredAssets.find((a) => a.asset === sym);
            if (!tile) return null;
            const href = ASSET_PAGES[sym] ?? `/${sym.toLowerCase()}`;
            const label =
              sym === "USDC"
                ? "Stablecoin"
                : sym === "ETH"
                  ? "LSTs & restaking"
                  : "Wrapped & LRTs";
            const display = sym === "BTC" ? "Bitcoin" : sym;
            return (
              <Link key={sym} href={href} className="asset-tile">
                <div className={`at-icon at-${sym.toLowerCase()}`} aria-hidden="true">
                  <AssetIcon asset={sym} size={30} />
                </div>
                <div className="at-body">
                  <span className="at-label">{display}</span>
                  <span className="at-headline">
                    Up to <strong>{formatAPY(tile.bestApy)}</strong>
                  </span>
                  <span className="at-meta">
                    {label} · {tile.poolCount} products tracked
                  </span>
                </div>
                <span className="at-arrow" aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* === Ranking table === */}
      <div className="section-title-bar" id="yields">
        <h2>Top yields by APY</h2>
        <span className="mono dim">
          Live &middot; ranked across {stats.chainCount} chain
          {stats.chainCount !== 1 ? "s" : ""}
        </span>
      </div>

        <VaultList vaults={vaults} sparklines={sparklines} />

      {/* === Featured assets === */}
      <div className="section-title-bar">
        <h2>Featured assets</h2>
        <span className="mono dim">Supply the majors</span>
      </div>
      <div className="card section">
        <div className="feat-grid">
          {featuredAssets.map((a) => {
            const inner = (
              <>
                <div className="feat-head">
                  <AssetIcon asset={a.asset} size={28} />
                  <div>
                    <div className="feat-name">{a.asset}</div>
                    <div className="feat-sub mono dim">{a.poolCount} pool{a.poolCount !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div className="feat-body">
                  <div>
                    <div className="feat-label mono dim">Best APY</div>
                    <div className="feat-val mono">{formatAPY(a.bestApy)}</div>
                  </div>
                  <div>
                    <div className="feat-label mono dim">Total TVL</div>
                    <div className="feat-val mono">{formatTVL(a.totalTvl)}</div>
                  </div>
                </div>
              </>
            );
            const href = ASSET_PAGES[a.asset];
            return href ? (
              <Link key={a.asset} href={href} className="feat feat-link">
                {inner}
              </Link>
            ) : (
              <div key={a.asset} className="feat">{inner}</div>
            );
          })}
        </div>
      </div>

      {/* === Platform grid === */}
      <div className="section-title-bar">
        <h2>Browse by Platform</h2>
        <span className="mono dim">{platforms.length} platforms</span>
      </div>
      <div className="card section">
        <div className="cat-grid">
          {platforms.map((p) => (
            <div key={p.name} className="cat-tile">
              <div className="cat-top">
                <span className="cat-name">{p.name}</span>
                <span className="cat-count mono dim">{p.count}</span>
              </div>
              <div className="cat-apy mono">{formatAPY(p.avgApy)}</div>
              <div className="cat-foot dim mono">avg APY &middot; {formatTVL(p.totalTvl)} TVL</div>
            </div>
          ))}
        </div>
      </div>

      {/* === FAQ === */}
      <div className="section-title-bar" id="faq">
        <h2>Frequently Asked Questions</h2>
        <span className="mono dim">
          About yield, risk, and our methodology
        </span>
      </div>
      <div className="card section">
        <div className="faq">
          {faqItems.map((item, i) => (
            <details key={i} open={i === 0}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </main>
    </>
  );
}
