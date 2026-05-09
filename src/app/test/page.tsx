// Test page: 40 Acres rendered in Uniswap interface visual language.
// Layout cloned from app.uniswap.org Pool detail (left = title +
// big number + bar chart + time pills; right sticky stack = Total
// APY card, Stats card, Links card). Scoped under .uni-shell so the
// rest of the site is unaffected.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLiveVaults,
  getVaultBySlug,
  getVaultHistory,
  getHoldersMap,
} from "@/lib/data";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { productPageCrumbs } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";
import { harvestAppUrl } from "@/lib/harvest-app";
import { AssetIcon } from "@/components/token-icons";
import { CopyAddressButton } from "@/components/copy-address-button";
import { HistoricalStats } from "@/components/historical-stats";
import { MarketBenchmark, EcosystemContext } from "@/components/market-sections";
import { TestChart, type ChartSeries } from "@/components/test-chart";
import "./test.css";

const TEST_SLUG = "usdc-40-acres-base";

const CHAIN_EXPLORERS: Record<string, string> = {
  Ethereum: "https://etherscan.io/address/",
  Polygon: "https://polygonscan.com/address/",
  Arbitrum: "https://arbiscan.io/address/",
  Base: "https://basescan.org/address/",
  zkSync: "https://explorer.zksync.io/address/",
  HyperEVM: "https://hyperscan.xyz/address/",
};

function shortAddress(a: string): string {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export default async function TestPage() {
  const vault = await getVaultBySlug(TEST_SLUG);
  if (!vault) notFound();

  const [history, allVaults, holdersMap] = await Promise.all([
    getVaultHistory(vault.contractAddress),
    getLiveVaults(),
    getHoldersMap(),
  ]);

  const holderCount = holdersMap[vault.contractAddress.toLowerCase()] ?? null;
  const explorerUrl = CHAIN_EXPLORERS[vault.chain]
    ? `${CHAIN_EXPLORERS[vault.chain]}${vault.contractAddress}`
    : null;

  const validApy = history.apyHistory.filter((p) => p.apy >= 0);
  let trackedDays = 0;
  if (validApy.length > 0) {
    const sortedApy = [...validApy].sort((a, b) => a.timestamp - b.timestamp);
    trackedDays = Math.round(
      (sortedApy[sortedApy.length - 1].timestamp - sortedApy[0].timestamp) / 86400,
    );
  }

  // Full per-metric series. Filtering by time range happens client-side
  // inside <TestChart /> so the time pills can drive a live re-render.
  const chartSeries: ChartSeries = {
    tvl: history.tvlHistory.map((p) => ({ t: p.timestamp, v: p.value })),
    apy: history.apyHistory
      .filter((p) => p.apy >= 0)
      .map((p) => ({ t: p.timestamp, v: p.apy })),
    sharePrice: history.sharePriceHistory.map((p) => ({ t: p.timestamp, v: p.sharePrice })),
  };

  const protocolName = stripChainSuffix(vault.category, vault.chain);
  const crumbs = productPageCrumbs(vault);

  return (
    <div className="uni-shell">
      {/* Breadcrumb: Home › {Asset} Yield › {Product} */}
      <div className="uni-crumbs">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          const href = c.url ? c.url.replace(SITE_URL, "") || "/" : null;
          return (
            <span key={i} className="uni-crumbs-item">
              {!isLast && href ? (
                <Link href={href}>{c.name}</Link>
              ) : (
                <span className="uni-crumbs-current">{c.name}</span>
              )}
              {!isLast && <span className="uni-crumbs-sep">›</span>}
            </span>
          );
        })}
      </div>

      {/* Title row: title alone on the left as the focal point; pills
          + address cluster on the right as supporting metadata. */}
      <header className="uni-title-row">
        <span className="uni-title-icon" aria-hidden="true">
          <AssetIcon asset={vault.asset} size={48} />
        </span>
        <h1 className="uni-title">{vault.productName}</h1>
        <div className="uni-title-meta">
          <div className="uni-title-pills">
            <span className="uni-pill uni-pill-version">{protocolName}</span>
            <span className="uni-pill uni-pill-fee">{vault.chain}</span>
          </div>
          <div className="uni-title-sub">
            <span className="uni-addr-text">{shortAddress(vault.contractAddress)}</span>
            <CopyAddressButton address={vault.contractAddress} compact />
          </div>
        </div>
      </header>

      <div className="uni-divider" aria-hidden="true" />

      {/* Main grid: chart + sidebar stats */}
      <div className="uni-detail-grid">
        <div className="uni-detail-main">
          <TestChart series={chartSeries} />
        </div>

        <aside className="uni-detail-side">
          <a
            href={harvestAppUrl(vault.chain, vault.contractAddress)}
            target="_blank"
            rel="noopener noreferrer"
            className="uni-cta"
          >
            View Strategy
            <svg
              className="uni-cta-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17 17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>

          <div className="uni-side-card">
            <div className="uni-side-headline-block">
              <div className="uni-side-label">Total APY</div>
              <div className="uni-side-headline">{formatAPY(vault.apy24h)}</div>
            </div>

            <div className="uni-side-card-divider" aria-hidden="true" />

            <div className="uni-side-stat">
              <div className="uni-side-label">Holders</div>
              <div className="uni-side-value">
                {holderCount !== null ? holderCount.toLocaleString("en-US") : "—"}
              </div>
            </div>

            <div className="uni-side-stat">
              <div className="uni-side-label">TVL</div>
              <div className="uni-side-value">{formatTVL(vault.tvl)}</div>
            </div>

            <div className="uni-side-stat">
              <div className="uni-side-label">30d avg APY</div>
              <div className="uni-side-value">{formatAPY(vault.apy30d)}</div>
            </div>

            <div className="uni-side-stat">
              <div className="uni-side-label">Tracked for</div>
              <div className="uni-side-value">
                {trackedDays > 0 ? `${trackedDays} days` : "—"}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Below the fold: text + tables on plain white. Tables and key
          stats inside each section keep the gray hero-card surface so
          they read as datasets, while the surrounding narrative reads
          as editorial copy. */}
      <div className="uni-below">
        <section className="uni-section-plain">
          <HistoricalStats history={history} asset={vault.asset} />
        </section>

        <section className="uni-section-plain">
          <MarketBenchmark vault={vault} allVaults={allVaults} />
        </section>

        <section className="uni-section-plain">
          <EcosystemContext vault={vault} allVaults={allVaults} />
        </section>
      </div>

      {/* Links pinned to the very bottom of the page. */}
      <section className="uni-bottom-links">
        <h2 className="uni-bottom-links-title">Links</h2>
        <div className="uni-bottom-links-row">
          <Link href={`/${vault.slug}`} className="uni-side-link">
            <span className="uni-side-link-dot" />
            Production page
            <span className="uni-side-link-arrow">↗</span>
          </Link>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="uni-side-link"
            >
              <span className="uni-side-link-dot" />
              Block explorer
              <span className="uni-side-link-arrow">↗</span>
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
