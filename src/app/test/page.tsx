// Test page: 40 Acres product data rendered in a Uniswap-flavored
// visual language. Scoped to /test only; production pages untouched.
// All overrides live under .uni-shell in test.css.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLiveVaults,
  getVaultBySlug,
  getVaultHistory,
  getHoldersMap,
} from "@/lib/data";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { chainToSlug } from "@/lib/networks";
import { PerformanceHistory } from "@/components/performance-history";
import { HistoricalStats } from "@/components/historical-stats";
import { MarketBenchmark, EcosystemContext } from "@/components/market-sections";
import { CopyAddressButton } from "@/components/copy-address-button";
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

  const apyChartData = history.apyHistory.map((p) => ({ timestamp: p.timestamp, value: p.apy }));
  const tvlChartData = history.tvlHistory.map((p) => ({ timestamp: p.timestamp, value: p.value }));
  const sharePriceChartData = history.sharePriceHistory.map((p) => ({ timestamp: p.timestamp, value: p.sharePrice }));

  const latestSharePrice =
    history.sharePriceHistory.length > 0
      ? history.sharePriceHistory[history.sharePriceHistory.length - 1].sharePrice
      : null;

  const sharePriceGrowth = (() => {
    if (history.sharePriceHistory.length < 2) return null;
    const sorted = [...history.sharePriceHistory].sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0].sharePrice;
    if (first <= 0) return null;
    return ((sorted[sorted.length - 1].sharePrice - first) / first) * 100;
  })();

  const validApy = history.apyHistory.filter((p) => p.apy >= 0);
  let trackedDays = 0;
  if (validApy.length > 0) {
    const sortedApy = [...validApy].sort((a, b) => a.timestamp - b.timestamp);
    trackedDays = Math.round(
      (sortedApy[sortedApy.length - 1].timestamp - sortedApy[0].timestamp) / 86400,
    );
  }

  return (
    <div className="uni-shell">
      <div className="uni-bg" aria-hidden="true" />

      <div className="uni-banner">
        <span className="uni-banner-dot" />
        Test page · /test · Uniswap-flavored UI applied to {vault.productName}
      </div>

      {/* Hero */}
      <section className="uni-hero">
        <div className="uni-hero-eyebrow">
          <span className="uni-chip">{vault.chain}</span>
          <span className="uni-chip">{vault.vaultType}</span>
          <span className="uni-chip">{vault.asset}</span>
        </div>
        <h1 className="uni-hero-title">{vault.productName}</h1>
        <p className="uni-hero-sub">
          {stripChainSuffix(vault.category, vault.chain)} on{" "}
          <Link href={`/${chainToSlug(vault.chain)}`}>{vault.chain}</Link>
        </p>

        <div className="uni-hero-grid">
          <div className="uni-stat uni-stat-headline">
            <span className="uni-stat-label">Current APY (24h)</span>
            <span className="uni-stat-value uni-stat-value-xl">{formatAPY(vault.apy24h)}</span>
            <span className="uni-stat-meta">30-day avg {formatAPY(vault.apy30d)}</span>
          </div>
          <div className="uni-stat">
            <span className="uni-stat-label">Total deposits</span>
            <span className="uni-stat-value">{formatTVL(vault.tvl)}</span>
          </div>
          <div className="uni-stat">
            <span className="uni-stat-label">Holders</span>
            <span className="uni-stat-value">
              {holderCount !== null ? holderCount.toLocaleString("en-US") : "—"}
            </span>
          </div>
          <div className="uni-stat">
            <span className="uni-stat-label">Tracked for</span>
            <span className="uni-stat-value">
              {trackedDays > 0 ? `${trackedDays} days` : "—"}
            </span>
          </div>
        </div>
      </section>

      {/* Performance history */}
      {(history.apyHistory.length > 0 || history.tvlHistory.length > 0) && (
        <section className="uni-card uni-section">
          <header className="uni-section-head">
            <h2>Performance history</h2>
            <p>APY, TVL and share price across timeframes.</p>
          </header>
          <PerformanceHistory
            apyData={apyChartData}
            tvlData={tvlChartData}
            sharePriceData={sharePriceChartData}
            currentApy={vault.apy24h}
            currentTvl={vault.tvl}
            currentSharePrice={latestSharePrice}
            sharePriceGrowth={sharePriceGrowth}
          />
        </section>
      )}

      {/* Historical statistics */}
      <section className="uni-card uni-section">
        <header className="uni-section-head">
          <h2>Historical statistics</h2>
          <p>Long-term distribution of APY and TVL across the tracked window.</p>
        </header>
        <HistoricalStats history={history} asset={vault.asset} />
      </section>

      {/* Market benchmarking */}
      <section className="uni-card uni-section">
        <MarketBenchmark vault={vault} allVaults={allVaults} />
      </section>

      {/* Ecosystem context */}
      <section className="uni-card uni-section">
        <EcosystemContext vault={vault} allVaults={allVaults} />
      </section>

      {/* Strategy details */}
      <section className="uni-card uni-section" id="details">
        <header className="uni-section-head">
          <h2>Strategy details</h2>
          <p>Onchain identifiers and metadata.</p>
        </header>
        <div className="uni-details">
          <UniRow label="Strategy">
            {stripChainSuffix(vault.category, vault.chain)}
          </UniRow>
          <UniRow label="Network">
            <Link href={`/${chainToSlug(vault.chain)}`}>{vault.chain}</Link>
          </UniRow>
          <UniRow label="Type">{vault.vaultType}</UniRow>
          <UniRow label="Underlying">{vault.asset}</UniRow>
          <UniRow label="Operator">{vault.protocol.name}</UniRow>
          {trackedDays > 0 && <UniRow label="Tracked for">{trackedDays} days</UniRow>}
          {holderCount !== null && (
            <UniRow label="Holders">{holderCount.toLocaleString("en-US")}</UniRow>
          )}
          <UniRow label="Vault contract">
            <span className="uni-addr-row">
              <span className="uni-addr">{vault.contractAddress}</span>
              <CopyAddressButton address={vault.contractAddress} compact />
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="uni-explorer"
                >
                  ↗
                </a>
              )}
            </span>
          </UniRow>
        </div>
      </section>
    </div>
  );
}

function UniRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="uni-row">
      <span className="uni-row-label">{label}</span>
      <span className="uni-row-value">{children}</span>
    </div>
  );
}
