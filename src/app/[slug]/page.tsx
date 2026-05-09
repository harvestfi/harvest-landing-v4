import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getLiveVaults, getVaultBySlug, getAllSlugs, getVaultHistory, getHoldersMap, isBrokenLowTvlVault } from "@/lib/data";
import { isCanonicalSlug } from "@/lib/canonical-vaults";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { AssetBadge } from "@/components/asset-badge";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { productPageTitle, productPageDescription, productPageCrumbs } from "@/lib/seo";
import { financialProductSchema, breadcrumbSchema, datasetSchema } from "@/lib/jsonld";
import { isUmbrellaAsset, getSubAssetFamilyName, assetHubPath } from "@/lib/sub-asset";
import { chainToSlug } from "@/lib/networks";
import { YieldVault } from "@/lib/types";
import type { FullVaultHistory } from "@/lib/history-api";
import { PerformanceHistory } from "@/components/performance-history";
import { VaultCommentary } from "@/components/vault-commentary";
import { VaultFaq } from "@/components/vault-faq";
import { YieldBreakdown } from "@/components/yield-breakdown";
import { ConsistencyScore } from "@/components/consistency-score";
import { VaultHistoryTable } from "@/components/vault-history-table";
import { DepositCard } from "@/components/deposit-card";
import { CopyAddressButton } from "@/components/copy-address-button";
import { VaultHero } from "@/components/vault-hero";
import { MarketBenchmark, EcosystemContext } from "@/components/market-sections";
import { HistoricalStats } from "@/components/historical-stats";
import { HistoricalNarrative } from "@/components/historical-narrative";
import { VaultRisks } from "@/components/vault-risks";
import { YieldTrajectory } from "@/components/yield-trajectory";

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vault = await getVaultBySlug(slug);
  if (!vault) return {};

  const history = await getVaultHistory(vault.contractAddress);
  const validApy = history.apyHistory.filter((p) => p.apy >= 0);
  let trackedDays = 0;
  if (validApy.length > 0) {
    const sorted = [...validApy].sort((a, b) => a.timestamp - b.timestamp);
    trackedDays = Math.round(
      (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 86400,
    );
  }

  const title = productPageTitle(vault);
  const description = productPageDescription(vault, trackedDays);

  const canonical = await isCanonicalSlug(slug);
  const broken = isBrokenLowTvlVault(vault);
  const indexable = canonical && !broken;

  return {
    title: { absolute: title },
    description,
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${vault.slug}`,
      siteName: SITE_NAME,
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `${SITE_URL}/${vault.slug}`,
    },
  };
}

function ProductSchemas({
  vault,
  history,
}: {
  vault: YieldVault;
  history: FullVaultHistory;
}) {
  const crumbs = productPageCrumbs(vault);
  const dataset = datasetSchema(vault, history);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(financialProductSchema(vault)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(crumbs)),
        }}
      />
      {dataset && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
        />
      )}
    </>
  );
}

interface FaqItem {
  question: string;
  answer: string;
}

function FaqSchema({ items }: { items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function generateFaqItems(vault: YieldVault): FaqItem[] {
  const items: FaqItem[] = [];

  items.push({
    question: `What is the current APY for ${vault.productName}?`,
    answer:
      vault.apy24h > 0
        ? `${vault.productName} currently offers a 24-hour APY of ${formatAPY(vault.apy24h)} and a 30-day average APY of ${formatAPY(vault.apy30d)}. APY rates are variable and change based on market conditions.`
        : `${vault.productName} APY data is currently unavailable. APY rates are variable and change based on market conditions.`,
  });

  items.push({
    question: `What chain is ${vault.productName} on?`,
    answer: `${vault.productName} is deployed on ${vault.chain}. It is operated by ${vault.protocol.name} and accepts ${vault.asset} deposits.`,
  });

  items.push({
    question: `How does ${vault.productName} work?`,
    answer: `${vault.productName} is a yield strategy on ${vault.chain} operated by ${vault.protocol.name}. It accepts ${vault.asset} deposits and automatically manages them to generate yield. ${vault.description}`,
  });

  items.push({
    question: `What is the TVL of ${vault.productName}?`,
    answer:
      vault.tvl > 0
        ? `${vault.productName} currently has a total value locked (TVL) of ${formatTVL(vault.tvl)}. TVL represents the total amount of ${vault.asset} deposited in this vault.`
        : `${vault.productName} TVL data is currently unavailable. TVL represents the total amount of ${vault.asset} deposited in this vault.`,
  });

  items.push({
    question: `Is the yield from ${vault.productName} sustainable?`,
    answer: `Yield from ${vault.productName} comes from ${vault.apyBreakdown.length > 0 ? vault.apyBreakdown.map((s) => s.source).join(", ") : "the underlying protocol"}. DeFi yields are variable and depend on market conditions, liquidity, and protocol incentives. Past APY is not a guarantee of future returns.`,
  });

  items.push({
    question: `How stable is the APY for ${vault.productName}?`,
    answer:
      vault.apy24h > 0 && vault.apy30d > 0
        ? `${vault.productName} currently shows a 24-hour APY of ${formatAPY(vault.apy24h)} compared to a 30-day average of ${formatAPY(vault.apy30d)}. ${Math.abs(vault.apy24h - vault.apy30d) < 1 ? "The APY has been relatively consistent over this period." : "There is notable variation between the short-term and longer-term rate, which is common in DeFi yield sources."}`
        : `APY stability data for ${vault.productName} is currently limited. DeFi yields are variable and fluctuate based on supply, demand, and protocol incentives.`,
  });

  if (vault.apyBreakdown.length > 0) {
    const sources = vault.apyBreakdown.filter((s) => s.apy > 0);
    if (sources.length > 0) {
      const breakdown = sources
        .map((s) => `${s.apy.toFixed(2)}% from ${s.source}`)
        .join(", ");
      items.push({
        question: `Where does the yield come from for ${vault.productName}?`,
        answer: `The yield for ${vault.productName} is composed of: ${breakdown}. Yield sources may include base lending rates, protocol token rewards, and liquidity incentives.`,
      });
    }
  }

  return items;
}

const CHAIN_EXPLORERS: Record<string, string> = {
  Ethereum: "https://etherscan.io/address/",
  Polygon: "https://polygonscan.com/address/",
  Arbitrum: "https://arbiscan.io/address/",
  Base: "https://basescan.org/address/",
  zkSync: "https://explorer.zksync.io/address/",
  HyperEVM: "https://hyperscan.xyz/address/",
};

function getExplorerUrl(chain: string, address: string): string | null {
  const base = CHAIN_EXPLORERS[chain];
  if (!base) return null;
  return `${base}${address}`;
}

function truncateAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function computeApyDelta(vault: YieldVault): { value: number; direction: "up" | "down" | "neutral" } {
  if (vault.apy24h <= 0 || vault.apy30d <= 0) return { value: 0, direction: "neutral" };
  const diff = vault.apy24h - vault.apy30d;
  if (Math.abs(diff) < 0.01) return { value: 0, direction: "neutral" };
  return { value: Math.abs(diff), direction: diff > 0 ? "up" : "down" };
}

function computeApyStdDev(history: FullVaultHistory): { stdDev: number; label: string } | null {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = nowSeconds - 30 * 24 * 60 * 60;
  const recent = history.apyHistory.filter((p) => p.timestamp >= thirtyDaysAgo && p.apy >= 0);
  if (recent.length < 2) return null;
  const values = recent.map((p) => p.apy);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  let label = "volatile";
  if (sd < 0.5) label = "very stable";
  else if (sd < 1.5) label = "stable";
  else if (sd < 3) label = "moderately volatile";
  return { stdDev: sd, label };
}

function computePeakTvl(history: FullVaultHistory): number {
  if (history.tvlHistory.length === 0) return 0;
  return Math.max(...history.tvlHistory.map((p) => p.value));
}

function computeSharePriceGrowth(history: FullVaultHistory): number | null {
  if (history.sharePriceHistory.length < 2) return null;
  const sorted = [...history.sharePriceHistory].sort((a, b) => a.timestamp - b.timestamp);
  const first = sorted[0].sharePrice;
  const last = sorted[sorted.length - 1].sharePrice;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vault = await getVaultBySlug(slug);
  if (!vault) notFound();

  const history = await getVaultHistory(vault.contractAddress);

  const tvlChartData = history.tvlHistory.map((p) => ({
    timestamp: p.timestamp,
    value: p.value,
  }));
  const apyChartData = history.apyHistory.map((p) => ({
    timestamp: p.timestamp,
    value: p.apy,
  }));
  const sharePriceChartData = history.sharePriceHistory.map((p) => ({
    timestamp: p.timestamp,
    value: p.sharePrice,
  }));

  const hasCharts =
    tvlChartData.length >= 2 ||
    apyChartData.length >= 2 ||
    sharePriceChartData.length >= 2;

  const allVaults = await getLiveVaults();
  const relatedVaults = allVaults
    .filter((v) => v.asset === vault.asset && v.id !== vault.id)
    .slice(0, 6);

  // "More yield sources on {Network}": same chain, different asset OR
  // different protocol from the current strategy (avoiding overlap with the
  // same-asset block above). Sorted by 30D APY desc, capped at 4.
  const currentProtocol = stripChainSuffix(vault.category, vault.chain);
  const sameNetworkRelated = allVaults
    .filter(
      (v) =>
        v.chain === vault.chain &&
        v.id !== vault.id &&
        (v.asset !== vault.asset ||
          stripChainSuffix(v.category, v.chain) !== currentProtocol),
    )
    .sort((a, b) => b.apy30d - a.apy30d)
    .slice(0, 4);

  const faqItems = generateFaqItems(vault);

  const apyDelta = computeApyDelta(vault);
  const apyStdDev = computeApyStdDev(history);
  const peakTvl = computePeakTvl(history);
  const sharePriceGrowth = computeSharePriceGrowth(history);
  const explorerUrl = getExplorerUrl(vault.chain, vault.contractAddress);
  const holdersMap = await getHoldersMap();
  const holderCount = holdersMap[vault.contractAddress.toLowerCase()] ?? null;

  const validApyForTracked = history.apyHistory.filter((p) => p.apy >= 0);
  let trackedDays = 0;
  if (validApyForTracked.length > 0) {
    const sortedApy = [...validApyForTracked].sort((a, b) => a.timestamp - b.timestamp);
    trackedDays = Math.round(
      (sortedApy[sortedApy.length - 1].timestamp - sortedApy[0].timestamp) / 86400,
    );
  }

  return (
    <>
      <ProductSchemas vault={vault} history={history} />
      <FaqSchema items={faqItems} />

      <VaultHero vault={vault} history={history} allVaults={allVaults} />

      <main className="pp-page pp-page-after-hero">
        <div className="pp-grid">
          <div className="pp-main">
            {/* About */}
            <section className="pp-section" id="about">
              <h2>About {vault.productName}</h2>
              <div className="about-prose">
                <p>
                  <strong>{vault.productName}</strong> is a {vault.vaultType.toLowerCase()} vault on{" "}
                  <strong>{vault.chain}</strong> that accepts {vault.asset} deposits and routes them
                  into the {stripChainSuffix(vault.category, vault.chain)} strategy.{" "}
                  {vault.vaultType === "Autocompounder"
                    ? `The vault automatically harvests rewards, swaps them back into ${vault.asset} and redeposits, compounding returns over time without manual harvesting or restaking.`
                    : `It automatically allocates ${vault.asset} deposits across optimized yield strategies, rebalancing to capture the best available rates.`}
                </p>
                {vault.tvl > 0 && vault.apy24h > 0 && (
                  <p>
                    The vault currently holds <strong>{formatTVL(vault.tvl)}</strong> in
                    deposits and is generating <strong>{formatAPY(vault.apy24h)} APY</strong> over
                    the last 24 hours. The 30-day average APY sits at{" "}
                    <strong>{formatAPY(vault.apy30d)}</strong>
                    {(() => {
                      if (history.sharePriceHistory.length >= 2) {
                        const sorted = [...history.sharePriceHistory].sort((a, b) => a.timestamp - b.timestamp);
                        const growth = sorted[0].sharePrice > 0
                          ? ((sorted[sorted.length - 1].sharePrice - sorted[0].sharePrice) / sorted[0].sharePrice) * 100
                          : 0;
                        if (growth > 0) return <>, and over its lifetime share price has grown <strong>{growth.toFixed(2)}%</strong> since inception</>;
                      }
                      return null;
                    })()}.
                  </p>
                )}
              </div>
            </section>

            {/* Unified Performance History (APY / TVL / Share Price tiles + chart) */}
            {hasCharts && (
              <section className="pp-section" id="performance">
                <h2>Performance history</h2>
                <p>
                  Toggle between APY, TVL and share price to inspect the vault&apos;s
                  behaviour across timeframes.
                </p>
                <PerformanceHistory
                  apyData={apyChartData}
                  tvlData={tvlChartData}
                  sharePriceData={sharePriceChartData}
                  currentApy={vault.apy24h}
                  currentTvl={vault.tvl}
                  currentSharePrice={
                    history.sharePriceHistory.length > 0
                      ? history.sharePriceHistory[history.sharePriceHistory.length - 1].sharePrice
                      : null
                  }
                  sharePriceGrowth={sharePriceGrowth}
                />
              </section>
            )}

            {/* Performance Commentary (numbered) */}
            <VaultCommentary
              vault={vault}
              allVaults={allVaults}
              history={history}
              numbered
            />

            {/* Market Benchmarking */}
            <MarketBenchmark vault={vault} allVaults={allVaults} />

            {/* Ecosystem Context */}
            <EcosystemContext vault={vault} allVaults={allVaults} />

            {/* Yield Trajectory: dense numerical narrative */}
            <YieldTrajectory
              history={history}
              productName={vault.productName}
              apy24h={vault.apy24h}
              asset={vault.asset}
            />

            {/* Consistency Score */}
            <ConsistencyScore history={history} spotAPY={vault.apy24h} asset={vault.asset} />

            {/* Yield Breakdown */}
            {vault.apyBreakdown.length > 0 && (
              <YieldBreakdown
                apyBreakdown={vault.apyBreakdown}
                boostedApy={vault.boostedApy}
              />
            )}

            {/* Long-term performance narrative: flowing prose for the
                CAGR / drawdown / best-month story. Lives before the
                Historical statistics tables. */}
            <HistoricalNarrative history={history} asset={vault.asset} />

            {/* Historical Stats */}
            <HistoricalStats history={history} asset={vault.asset} />

            {/* Daily History Table */}
            <VaultHistoryTable history={history} />

            {/* Strategy details */}
            <section className="pp-section" id="details">
              <h2>Strategy details</h2>
              <div className="contract-details-grid">
                <div className="cd-row">
                  <span className="cd-label">Strategy</span>
                  <span className="cd-val">{stripChainSuffix(vault.category, vault.chain)}</span>
                </div>
                <div className="cd-row">
                  <span className="cd-label">Network</span>
                  <span className="cd-val">
                    <Link href={`/${chainToSlug(vault.chain)}`}>{vault.chain}</Link>
                  </span>
                </div>
                <div className="cd-row">
                  <span className="cd-label">Type</span>
                  <span className="cd-val">{vault.vaultType}</span>
                </div>
                <div className="cd-row">
                  <span className="cd-label">Underlying</span>
                  <span className="cd-val cd-token-row">
                    <span>{vault.asset}</span>
                  </span>
                </div>
                {vault.rewardTokens && vault.rewardTokens.length > 0 && (
                  <div className="cd-row">
                    <span className="cd-label">Rewards</span>
                    <span className="cd-val cd-token-row">
                      <span>{vault.rewardTokens.map((r) => r.symbol).join(", ")}</span>
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
                    <span className="cd-val">{holderCount.toLocaleString("en-US")}</span>
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
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
                      {getExplorerUrl(vault.chain, vault.strategyAddress) && (
                        <a
                          href={getExplorerUrl(vault.chain, vault.strategyAddress)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cd-explorer"
                          aria-label="View strategy on explorer"
                          title="View on block explorer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
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
                      {getExplorerUrl(vault.chain, vault.tokenAddress) && (
                        <a
                          href={getExplorerUrl(vault.chain, vault.tokenAddress)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cd-explorer"
                          aria-label="View token on explorer"
                          title="View on block explorer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* FAQ */}
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

            {/* Index membership links */}
            <div className="pp-index-links">
              <span className="pp-index-label">Indexed in</span>
              <div className="pp-index-chips">
                <Link href={assetHubPath(vault.asset)} className="pp-index-chip">
                  {isUmbrellaAsset(vault.asset) ? getSubAssetFamilyName(vault.asset) : vault.asset} yield index
                </Link>
                <Link href={`/${chainToSlug(vault.chain)}`} className="pp-index-chip">
                  {vault.chain} yield index
                </Link>
              </div>
            </div>

            {/* Related Vaults */}
            {relatedVaults.length > 0 && (
              <div className="pp-section" id="more">
                <h2>More {vault.asset} yields</h2>
                <div className="more-vaults">
                  {relatedVaults.map((rv) => (
                    <Link key={rv.id} href={`/${rv.slug}`} className="mv-card">
                      <div className="mv-head">
                        <AssetBadge asset={rv.asset} iconOnly />
                        <div>
                          <div className="mv-name">{rv.productName}</div>
                          <div className="mv-by">{rv.protocol.name}</div>
                        </div>
                      </div>
                      <div className="mv-stats">
                        <div>
                          <div>APY</div>
                          <div className="mv-num up">{formatAPY(rv.apy24h)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div>TVL</div>
                          <div className="mv-num">{formatTVL(rv.tvl)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {sameNetworkRelated.length > 0 && (
              <div className="pp-section" id="more-on-network">
                <h2>More yield sources on {vault.chain}</h2>
                <div className="more-vaults">
                  {sameNetworkRelated.map((rv) => (
                    <Link key={rv.id} href={`/${rv.slug}`} className="mv-card">
                      <div className="mv-head">
                        <AssetBadge asset={rv.asset} iconOnly />
                        <div>
                          <div className="mv-name">{rv.productName}</div>
                          <div className="mv-by">{rv.protocol.name}</div>
                        </div>
                      </div>
                      <div className="mv-stats">
                        <div>
                          <div>APY</div>
                          <div className="mv-num up">{formatAPY(rv.apy24h)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div>TVL</div>
                          <div className="mv-num">{formatTVL(rv.tvl)}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="pp-sidebar">
            <DepositCard
              apy24h={vault.apy24h}
              apy30d={vault.apy30d}
              asset={vault.asset}
              chain={vault.chain}
              contractAddress={vault.contractAddress}
            />
          </div>
        </div>

        {/* Risks: full width, at the very bottom of the page */}
        <VaultRisks vault={vault} />
      </main>
    </>
  );
}
