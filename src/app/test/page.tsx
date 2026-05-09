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
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { CopyAddressButton } from "@/components/copy-address-button";
import { HistoricalStats } from "@/components/historical-stats";
import { HistoricalNarrative } from "@/components/historical-narrative";
import { MarketBenchmark, EcosystemContext } from "@/components/market-sections";
import { VaultCommentary } from "@/components/vault-commentary";
import { VaultHistoryTable } from "@/components/vault-history-table";
import { VaultFaq } from "@/components/vault-faq";
import { YieldTrajectory } from "@/components/yield-trajectory";
import { TestChart, type ChartSeries } from "@/components/test-chart";
import { TestJumpNav } from "@/components/test-jumpnav";
import { TestStabilityCard } from "@/components/test-stability-card";
import { TestStickyHeader } from "@/components/test-sticky-header";
import { TestSimilar } from "@/components/test-similar";
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

  // FAQ: short, conversational questions without the product name
  // jammed into every line. Long substitution names made the
  // production list read awkwardly ("What is the current APY for
  // USDC 40 Acres?"); these are plain questions that the answers
  // contextualize.
  const faqItems = [
    {
      question: "What's the current APY?",
      answer:
        vault.apy24h > 0
          ? `${vault.productName} is showing a 24-hour APY of ${formatAPY(vault.apy24h)} with a 30-day average of ${formatAPY(vault.apy30d)}. Rates are variable and move with market conditions, liquidity, and the underlying protocol's incentives.`
          : "APY data is currently unavailable for this strategy.",
    },
    {
      question: "How does this vault work?",
      answer: `It's a ${vault.vaultType.toLowerCase()} on ${vault.chain} operated by ${vault.protocol.name}. You deposit ${vault.asset}, and the vault routes capital through the ${protocolName} strategy on your behalf - harvesting rewards, swapping them back to ${vault.asset}, and redepositing without manual steps.`,
    },
    {
      question: "Where does the yield come from?",
      answer:
        vault.apyBreakdown.length > 0
          ? `Yield is composed of: ${vault.apyBreakdown.filter((s) => s.apy > 0).map((s) => `${s.apy.toFixed(2)}% from ${s.source}`).join(", ")}. Sources can include base lending rates, protocol token rewards and liquidity incentives.`
          : "Yield comes from the underlying protocol's lending and reward streams. DeFi yields depend on supply, demand and protocol incentives.",
    },
    {
      question: "How stable has the APY been?",
      answer:
        vault.apy24h > 0 && vault.apy30d > 0
          ? `${formatAPY(vault.apy24h)} over the last 24 hours vs ${formatAPY(vault.apy30d)} over 30 days. ${Math.abs(vault.apy24h - vault.apy30d) < 1 ? "Spread is small, suggesting the rate has been steady." : "Notable drift between the short and longer window, common in DeFi."}`
          : "APY history is too short to call stability one way or the other.",
    },
    {
      question: "How much is currently deposited?",
      answer:
        vault.tvl > 0
          ? `Total value locked sits at ${formatTVL(vault.tvl)} right now. TVL changes as users deposit and withdraw; we update the figure every hour from the chain.`
          : "TVL data is currently unavailable.",
    },
    {
      question: "Is this safe?",
      answer: "No DeFi yield strategy is risk-free. Smart-contract risk, oracle risk, liquidity risk and depeg risk all apply. This vault is operated by Harvest Finance; per-strategy risk levels we display are editorial classifications, not a quantitative model.",
    },
  ];

  return (
    <div className="uni-shell">
      {/* Mobile-only sticky sub-header that appears once user scrolls
          past the jump nav. */}
      <TestStickyHeader productName={vault.productName} asset={vault.asset} />

      {/* Breadcrumb: Home › {Asset} Yield Ranking › {Product} */}
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

      {/* Title row: icon + title on the left; right cluster stacks
          contract address + copy on top, byline (vault type · chain ·
          operator) directly underneath. Keeps the title as the focal
          point and lets the metadata read as a single right-aligned
          spec sheet. */}
      <header className="uni-title-row">
        <span className="uni-title-icon" aria-hidden="true">
          <AssetIcon asset={vault.asset} size={54} />
        </span>
        <h1 className="uni-title">{vault.productName}</h1>
        <div className="uni-title-meta">
          <div className="uni-title-sub">
            <span className="uni-addr-text">{shortAddress(vault.contractAddress)}</span>
            <CopyAddressButton address={vault.contractAddress} compact />
          </div>
          <p className="uni-title-byline">
            <span>{vault.vaultType}</span>
            <span className="uni-byline-sep" aria-hidden="true">·</span>
            <span className="uni-byline-chain">
              <ChainIcon chain={vault.chain} size={14} />
              {vault.chain}
            </span>
            <span className="uni-byline-sep" aria-hidden="true">·</span>
            <span className="uni-byline-brand">
              Harvest
              <span className="uni-byline-brand-dot" aria-hidden="true" />
            </span>
          </p>
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
              <div
                className="uni-side-label"
                data-tooltip="The latest 24-hour annualized yield reported by our hosted indexer for this strategy."
              >
                24h APY
              </div>
              <div className="uni-side-headline">{formatAPY(vault.apy24h)}</div>
            </div>

            <div className="uni-side-card-divider" aria-hidden="true" />

            <div className="uni-side-stat">
              <div
                className="uni-side-label"
                data-tooltip="Number of distinct on-chain addresses currently holding this vault token, sourced from the chain explorer."
              >
                Holders
              </div>
              <div className="uni-side-value">
                {holderCount !== null ? holderCount.toLocaleString("en-US") : "—"}
              </div>
            </div>

            <div className="uni-side-stat">
              <div
                className="uni-side-label"
                data-tooltip="Total value locked: USD value of all deposits currently held by the vault contract."
              >
                TVL
              </div>
              <div className="uni-side-value">{formatTVL(vault.tvl)}</div>
            </div>

            <div className="uni-side-stat">
              <div
                className="uni-side-label"
                data-tooltip="Mean 24-hour APY across the last 30 days of indexed observations."
              >
                30d avg APY
              </div>
              <div className="uni-side-value">{formatAPY(vault.apy30d)}</div>
            </div>

            <div className="uni-side-stat">
              <div
                className="uni-side-label"
                data-tooltip="Number of days of continuous indexed APY history we have for this strategy."
              >
                Tracked for
              </div>
              <div className="uni-side-value">
                {trackedDays > 0 ? `${trackedDays} days` : "—"}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Jump-to menu between hero and the rest. Anchors point to the
          ids that the embedded sections render (#history, #benchmark,
          #ecosystem); #hero is set on the chart bignum. */}
      <TestJumpNav />

      {/* Below the fold: every production section, in the same
          reading order as the slug page. Components render their own
          .pp-section h2 and pick up the .uni-shell theme overrides. */}
      <div className="uni-below">
        {/* About */}
        <section className="pp-section" id="about">
          <h2>About {vault.productName}</h2>
          <div className="about-prose">
            <p>
              <strong>{vault.productName}</strong> is a{" "}
              {vault.vaultType.toLowerCase()} vault on{" "}
              <strong>{vault.chain}</strong> that accepts {vault.asset} deposits
              and routes them into the {protocolName} strategy.{" "}
              {vault.vaultType === "Autocompounder"
                ? `The vault automatically harvests rewards, swaps them back into ${vault.asset} and redeposits, compounding returns over time.`
                : `It allocates ${vault.asset} deposits across optimized yield strategies.`}
            </p>
            {vault.tvl > 0 && vault.apy24h > 0 && (
              <p>
                The vault currently holds <strong>{formatTVL(vault.tvl)}</strong>{" "}
                in deposits and is generating{" "}
                <strong>{formatAPY(vault.apy24h)} APY</strong> over the last 24
                hours. The 30-day average APY sits at{" "}
                <strong>{formatAPY(vault.apy30d)}</strong>.
              </p>
            )}
          </div>
        </section>

        <VaultCommentary
          vault={vault}
          allVaults={allVaults}
          history={history}
          numbered
        />

        <MarketBenchmark vault={vault} allVaults={allVaults} />

        <EcosystemContext vault={vault} allVaults={allVaults} />

        <YieldTrajectory
          history={history}
          productName={vault.productName}
          apy24h={vault.apy24h}
          asset={vault.asset}
        />

        {/* Combined stability + sources card. ConsistencyScore +
            YieldBreakdown each looked sparse on their own (most
            products have one source, leaving a lonely bar); the
            stability card collapses both into a single horizontal
            block: score gauge, key stats rail, source chips. */}
        <TestStabilityCard
          history={history}
          asset={vault.asset}
          apyBreakdown={vault.apyBreakdown}
          boostedApy={vault.boostedApy}
        />

        <HistoricalNarrative history={history} asset={vault.asset} />

        <HistoricalStats history={history} asset={vault.asset} />

        <VaultHistoryTable history={history} />

        {/* Strategy details: full production set including rewards,
            strategy contract and underlying token. */}
        <section className="pp-section" id="details">
          <h2>Strategy details</h2>
          <div className="contract-details-grid">
            <div className="cd-row">
              <span className="cd-label">Strategy</span>
              <span className="cd-val">{protocolName}</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Network</span>
              <span className="cd-val cd-network">
                <ChainIcon chain={vault.chain} size={16} />
                {vault.chain}
              </span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Type</span>
              <span className="cd-val">{vault.vaultType}</span>
            </div>
            <div className="cd-row">
              <span className="cd-label">Underlying</span>
              <span className="cd-val">{vault.asset}</span>
            </div>
            {vault.rewardTokens && vault.rewardTokens.length > 0 && (
              <div className="cd-row">
                <span className="cd-label">Rewards</span>
                <span className="cd-val">
                  {vault.rewardTokens.map((r) => r.symbol).join(", ")}
                </span>
              </div>
            )}
            <div className="cd-row">
              <span className="cd-label">Operator</span>
              <span className="cd-val">{vault.protocol.name}</span>
            </div>
            {trackedDays > 0 && (
              <div className="cd-row">
                <span className="cd-label">Tracked for</span>
                <span className="cd-val">{trackedDays} days</span>
              </div>
            )}
            {holderCount !== null && (
              <div className="cd-row">
                <span className="cd-label">Holders</span>
                <span className="cd-val">
                  {holderCount.toLocaleString("en-US")}
                </span>
              </div>
            )}
            <div className="cd-row cd-row-full">
              <span className="cd-label">Vault contract</span>
              <div className="cd-addr-wrap">
                <span className="cd-addr mono">{vault.contractAddress}</span>
                <CopyAddressButton address={vault.contractAddress} compact />
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cd-explorer"
                    aria-label="View on explorer"
                    title="View on block explorer"
                  >
                    ↗
                  </a>
                )}
              </div>
            </div>
            {vault.strategyAddress && (
              <div className="cd-row cd-row-full">
                <span className="cd-label">Strategy contract</span>
                <div className="cd-addr-wrap">
                  <span className="cd-addr mono">{vault.strategyAddress}</span>
                  <CopyAddressButton address={vault.strategyAddress} compact />
                  {CHAIN_EXPLORERS[vault.chain] && (
                    <a
                      href={`${CHAIN_EXPLORERS[vault.chain]}${vault.strategyAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cd-explorer"
                      aria-label="View strategy on explorer"
                      title="View on block explorer"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
            )}
            {vault.tokenAddress && (
              <div className="cd-row cd-row-full">
                <span className="cd-label">Underlying token</span>
                <div className="cd-addr-wrap">
                  <span className="cd-addr mono">{vault.tokenAddress}</span>
                  <CopyAddressButton address={vault.tokenAddress} compact />
                  {CHAIN_EXPLORERS[vault.chain] && (
                    <a
                      href={`${CHAIN_EXPLORERS[vault.chain]}${vault.tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cd-explorer"
                      aria-label="View token on explorer"
                      title="View on block explorer"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <VaultFaq
          productName={vault.productName}
          protocolName={vault.protocol.name}
          asset={vault.asset}
          chain={vault.chain}
          vaultType={vault.vaultType}
          apy24h={formatAPY(vault.apy24h)}
          tvl={formatTVL(vault.tvl)}
          riskLevel={vault.riskLevel}
          description={vault.description}
          faqItems={faqItems}
        />

        <TestSimilar vault={vault} allVaults={allVaults} />
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
