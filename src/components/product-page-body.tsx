// Shared body for product pages (single-vault detail). Renders the
// Sunflower Gold + Onyx + Graphite layout used across /[slug].
// Heavy lifting (metadata, JSON-LD schemas, FAQ structured data) lives
// in the route file. This component is purely the visible body.

import Link from "next/link";
import {
  getLiveVaults,
  getVaultHistory,
  getHoldersMap,
} from "@/lib/data";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import type { FullVaultHistory } from "@/lib/history-api";
import { productPageCrumbs } from "@/lib/seo";
import { SITE_URL } from "@/lib/constants";
import { harvestAppUrl } from "@/lib/harvest-app";
import { TrackedAppLink } from "@/components/tracked-app-link";
import { buildAutopilotAbout } from "@/lib/autopilot-about";
import { buildAutocompounderAbout } from "@/lib/autocompounder-about";
import { buildLpPairAbout } from "@/lib/lp-pair-about";
import {
  buildYieldTrajectory,
  buildPerformanceOverview,
} from "@/lib/autopilot-sections";
import { buildAutopilotFaqItems } from "@/lib/autopilot-faq";
import { buildAutocompounderFaqItems } from "@/lib/autocompounder-faq";
import { buildLpPairFaqItems } from "@/lib/lp-pair-faq";
import { isLpPairVault, getCanonicalDisplayName } from "@/lib/lp-pair";
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
import { HomeCrumb } from "@/components/home-crumb";
import type { YieldVault } from "@/lib/types";

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

export async function ProductPageBody({ vault }: { vault: YieldVault }) {
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

  // Build chart series from indexed history. Append a "live" point at
  // the current second using vault.tvl / vault.apy24h so the chart's
  // headline number matches the side card. Without this the chart
  // shows the last bucketed value (often a few hours stale) while the
  // side card reads the live feed, producing a visible mismatch.
  // When upstream history is empty entirely we synthesize a 2-point
  // flat series so the chart renders a snapshot instead of "no data".
  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 86400;
  function snapshotSeries(value: number): { t: number; v: number }[] {
    if (!isFinite(value) || value <= 0) return [];
    return [
      { t: dayAgo, v: value },
      { t: now, v: value },
    ];
  }
  function appendLive(
    points: { t: number; v: number }[],
    liveValue: number,
  ): { t: number; v: number }[] {
    if (!isFinite(liveValue) || liveValue <= 0) return points;
    if (points.length === 0) return points;
    const last = points[points.length - 1];
    if (last.t >= now - 60) return points;
    return [...points, { t: now, v: liveValue }];
  }

  const apyPoints = history.apyHistory
    .filter((p) => p.apy >= 0)
    .map((p) => ({ t: p.timestamp, v: p.apy }));
  const tvlPoints = history.tvlHistory.map((p) => ({ t: p.timestamp, v: p.value }));
  const sharePricePoints = history.sharePriceHistory.map((p) => ({
    t: p.timestamp,
    v: p.sharePrice,
  }));

  const chartSeries: ChartSeries = {
    tvl:
      tvlPoints.length > 1
        ? appendLive(tvlPoints, vault.tvl)
        : snapshotSeries(vault.tvl),
    apy:
      apyPoints.length > 1
        ? appendLive(apyPoints, vault.apy24h)
        : snapshotSeries(vault.apy24h),
    sharePrice:
      sharePricePoints.length > 1 ? sharePricePoints : snapshotSeries(1),
  };

  const protocolName = stripChainSuffix(vault.category, vault.chain);
  const crumbs = productPageCrumbs(vault);
  // Canonical name on the product page itself: LP-pair vaults expand
  // the bare database "ETH Aerodrome" into "ETH/VVV Aerodrome" so the
  // breadcrumb, H1, sticky header, About heading, and About intro all
  // identify the specific pair. Single-asset vaults return their raw
  // productName unchanged. Ranking views deliberately keep the bare
  // productName + [LP] badge instead - canonical names are page-only.
  const displayName = getCanonicalDisplayName(vault);
  // Operator brand for user-facing prose / structured fields. The
  // upstream `protocol.name` is the legal entity ("Harvest Finance");
  // every prose surface and the Strategy-details Operator row use
  // the trimmed product brand ("Harvest") for consistency with the
  // byline trim already applied at the top of the page.
  const operatorBrand =
    vault.protocol.name.replace(/\s*Finance\s*$/i, "").trim() || "Harvest";

  // Autopilot + Autocompounder products get the curated 7-question
  // FAQ list per vault type. Autopilots and Autocompounders each
  // get a curated 7-question list (Q2, Q4, Q7 differ between the
  // two types per the editorial spec). Other vault types fall
  // through to the generic list below.
  // LP-pair Autocompounders (Aerodrome/Quickswap/Uniswap/etc.)
  // get their own FAQ because Q2/Q4/Q7 wording differs from
  // single-asset Autocompounders (LP-add flow, fees + emissions
  // dual-source, impermanent loss). Detected via the
  // underlyingLogos.length > 1 discriminator.
  const isLpPair = isLpPairVault(vault);
  const typedFaqItems = isLpPair
    ? buildLpPairFaqItems(vault, history, holderCount)
    : vault.vaultType === "Autopilot"
      ? buildAutopilotFaqItems(vault, history, holderCount, allVaults)
      : vault.vaultType === "Autocompounder"
        ? buildAutocompounderFaqItems(vault, history, holderCount, allVaults)
        : null;

  const faqItems = typedFaqItems ?? [
    {
      question: "What's the current APY?",
      answer:
        vault.apy24h > 0
          ? `${vault.productName} is showing a 24-hour APY of ${formatAPY(vault.apy24h)} with a 30-day average of ${formatAPY(vault.apy30d)}. Rates are variable and move with market conditions, liquidity, and the underlying protocol's incentives.`
          : "APY data is currently unavailable for this strategy.",
    },
    {
      question: "How does this vault work?",
      answer: `It's a ${vault.vaultType.toLowerCase()} on ${vault.chain} operated by ${operatorBrand}. You supply ${vault.asset}, and the vault routes the holdings through the ${protocolName} strategy on your behalf - harvesting rewards, swapping them back to ${vault.asset}, and adding them to the position without manual steps.`,
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
      question: "How much is currently in the vault?",
      answer:
        vault.tvl > 0
          ? `Total value locked sits at ${formatTVL(vault.tvl)} right now. TVL changes as users supply and withdraw; we update the figure every hour from the chain.`
          : "TVL data is currently unavailable.",
    },
    {
      question: "What are the strategy risks?",
      answer: (
        <>
          No DeFi yield strategy is risk-free. The main vectors that apply to{" "}
          {vault.productName} are <strong>smart-contract risk</strong> (a bug
          or upgrade in the vault or the underlying {protocolName} protocol
          could cause loss of funds), <strong>oracle risk</strong> (mis-priced
          price feeds can drain a strategy in a single block),{" "}
          <strong>liquidity risk</strong> (large withdrawals at the wrong
          moment can clip the share-price), <strong>depeg risk</strong> (the
          underlying {vault.asset} de-pegging from its target value), and{" "}
          <strong>governance risk</strong> (admin keys, parameter changes, fee
          switches). Risk levels we display on the site are editorial
          classifications, not a quantitative model. The full framework,
          including what each tier means, how we score, and the open questions
          we leave on the table, lives on the{" "}
          <Link href="/risk-framework">risk framework page</Link>.
        </>
      ),
    },
  ];

  return (
    <div className="uni-shell">
      <TestStickyHeader
        productName={displayName}
        asset={vault.asset}
        apyLabel={formatAPY(vault.apy24h)}
        tvlLabel={formatTVL(vault.tvl)}
        ctaHref={harvestAppUrl(vault.chain, vault.contractAddress)}
        vaultSlug={vault.slug}
        vaultAddress={vault.contractAddress}
      />

      {/* Breadcrumb: home icon -> {Ticker} Ranking -> {product name} */}
      <div className="uni-crumbs">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          const isFirst = i === 0;
          const href = c.url ? c.url.replace(SITE_URL, "") || "/" : null;
          return (
            <span key={i} className="uni-crumbs-item">
              {isFirst ? (
                <HomeCrumb />
              ) : !isLast && href ? (
                <Link href={href}>{c.name}</Link>
              ) : (
                <span className="uni-crumbs-current">{c.name}</span>
              )}
              {!isLast && <span className="uni-crumbs-sep">›</span>}
            </span>
          );
        })}
      </div>

      {/* Title row */}
      <header className="uni-title-row">
        <span className="uni-title-icon" aria-hidden="true">
          <AssetIcon asset={vault.asset} size={54} priority />
        </span>
        <h1 className="uni-title">{displayName}</h1>
        <div className="uni-title-meta">
          <div className="uni-title-sub">
            <span className="uni-addr-text">{shortAddress(vault.contractAddress)}</span>
            <CopyAddressButton address={vault.contractAddress} compact />
          </div>
          {(() => {
            const operatorName = vault.protocol.name
              .replace(/\s*Finance\s*$/i, "")
              .trim() || "Harvest";
            const isAutocompounder = vault.vaultType === "Autocompounder";
            const operatorTooltip = isAutocompounder
              ? `${operatorName}, the autocompounding platform that auto-claims native yield and reward emissions and routes them back into the underlying strategy.`
              : `${operatorName}, the platform running this vault on top of the underlying protocol.`;
            const typeTooltip = isAutocompounder
              ? "Autocompounder: converts earned yield and reward emissions into more units of the underlying strategy token, simplifying the claim flow on behalf of the user and socialising the gas cost across holders."
              : `Type: ${vault.vaultType.toLowerCase()}. How the vault converts supplied funds into yield.`;
            const showOperator =
              !!operatorName &&
              operatorName.toLowerCase() !== protocolName.toLowerCase();
            return (
              <p className="uni-title-byline">
                <Link
                  href={networkHrefFor(vault.chain)}
                  className="uni-byline-chip uni-byline-chain"
                  data-tooltip="Network: the blockchain this vault is deployed on."
                >
                  <ChainIcon chain={vault.chain} size={14} />
                  {vault.chain}
                </Link>
                {showOperator && (
                  <>
                    <span className="uni-byline-sep" aria-hidden="true">·</span>
                    <span
                      className="uni-byline-chip uni-byline-brand"
                      data-tooltip={operatorTooltip}
                    >
                      {operatorName}
                    </span>
                  </>
                )}
                {/* Skip the platform chip in two cases:
                    (a) Autopilot: protocolName collapses to
                    "Autopilot" and sits right next to the Type chip
                    which already says "Autopilot".
                    (b) LP-pair products: the canonical product name
                    already states the platform ("ETH/VVV Aerodrome"
                    spells "Aerodrome"), so the chip is redundant.
                    Single-asset Autocompounders keep the chip because
                    the product name doesn't always make the platform
                    self-evident ("USDC Clearstar Core V2" → Morpho). */}
                {vault.vaultType !== "Autopilot" && !isLpPair && (
                  <>
                    <span className="uni-byline-sep" aria-hidden="true">·</span>
                    <span
                      className="uni-byline-chip"
                      data-tooltip="Platform: the underlying protocol the strategy supplies into."
                    >
                      {protocolName}
                    </span>
                  </>
                )}
                <span className="uni-byline-sep" aria-hidden="true">·</span>
                <span
                  className="uni-byline-chip"
                  data-tooltip={typeTooltip}
                  data-tooltip-align="end"
                >
                  {vault.vaultType}
                </span>
              </p>
            );
          })()}
        </div>
      </header>

      <div className="uni-divider" aria-hidden="true" />

      {/* Main grid: chart + sidebar stats */}
      <div className="uni-detail-grid">
        <div className="uni-detail-main">
          <TestChart series={chartSeries} />
        </div>

        <aside className="uni-detail-side">
          <TrackedAppLink
            href={harvestAppUrl(vault.chain, vault.contractAddress)}
            cta="sidebar-view-strategy"
            vaultSlug={vault.slug}
            vaultAddress={vault.contractAddress}
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
          </TrackedAppLink>

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
                {holderCount !== null ? holderCount.toLocaleString("en-US") : "-"}
              </div>
            </div>

            <div className="uni-side-stat">
              <div
                className="uni-side-label"
                data-tooltip="Total value locked: USD value of all funds currently held by the vault contract."
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
                {trackedDays > 0 ? `${trackedDays} days` : "-"}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <TestJumpNav />

      <div className="uni-below">
        {/* About */}
        <section className="pp-section" id="about">
          <h2>About {displayName}</h2>
          <div className="about-prose">
            {/* Three branches:
                  1. LP-pair Autocompounder (Aerodrome/Quickswap/etc.)
                     detected by underlyingLogos.length > 1 - takes
                     precedence over the vaultType branches because
                     LP-pair wording differs even though vaultType is
                     still "Autocompounder".
                  2. vaultType "Autopilot" - IPOR Labs engine copy.
                  3. vaultType "Autocompounder" (single-asset).
                Each block emits the curated 3-paragraph template
                reserved for its type. */}
            {isLpPair ? (
              <LpPairAboutBlock
                vault={vault}
                history={history}
                holderCount={holderCount}
              />
            ) : vault.vaultType === "Autopilot" ? (
              <AutopilotAboutBlock
                vault={vault}
                history={history}
                holderCount={holderCount}
              />
            ) : (
              <AutocompounderAboutBlock
                vault={vault}
                history={history}
                holderCount={holderCount}
              />
            )}
          </div>
        </section>

        {vault.vaultType === "Autopilot" || vault.vaultType === "Autocompounder" ? (
          // Performance Overview (numbered) leads. Market
          // benchmarking + Ecosystem context follow as prose-with-
          // charts, then Yield trajectory closes (also numbered)
          // so the two numbered-list blocks don't sit adjacent.
          <AutopilotPerformanceOverviewBlock
            vault={vault}
            history={history}
            allVaults={allVaults}
          />
        ) : (
          <VaultCommentary
            vault={vault}
            allVaults={allVaults}
            history={history}
            numbered
          />
        )}

        <MarketBenchmark vault={vault} allVaults={allVaults} />

        <EcosystemContext vault={vault} allVaults={allVaults} />

        {vault.vaultType === "Autopilot" || vault.vaultType === "Autocompounder" ? (
          <AutopilotYieldTrajectoryBlock vault={vault} history={history} />
        ) : (
          <YieldTrajectory
            history={history}
            productName={vault.productName}
            apy24h={vault.apy24h}
            asset={vault.asset}
          />
        )}

        <TestStabilityCard history={history} asset={vault.asset} />

        <HistoricalNarrative history={history} asset={vault.asset} />

        <HistoricalStats history={history} asset={vault.asset} />

        <VaultHistoryTable history={history} />

        {/* Strategy details */}
        <section className="pp-section" id="details">
          <h2>Strategy details</h2>
          <div className="contract-details-grid">
            {/* For Autopilot products, the protocolName derived
                from category equals the vault type ("Autopilot"),
                producing duplicate "Strategy: Autopilot / Type:
                Autopilot" rows. The underlying protocol list is
                already named in About paragraph 1 + FAQ Q4, so the
                Strategy row adds nothing here. Skip it. */}
            {vault.vaultType !== "Autopilot" && (
              <div className="cd-row">
                <span className="cd-label">Strategy</span>
                <span className="cd-val">{protocolName}</span>
              </div>
            )}
            <div className="cd-row">
              <span className="cd-label">Network</span>
              <Link href={networkHrefFor(vault.chain)} className="cd-val cd-network">
                <ChainIcon chain={vault.chain} size={16} />
                {vault.chain}
              </Link>
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
              <span className="cd-val">{operatorBrand}</span>
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
          protocolName={operatorBrand}
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

      {/* Bottom links */}
      <section className="uni-bottom-links">
        <h2 className="uni-bottom-links-title">Links</h2>
        <div className="uni-bottom-links-row">
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
          <TrackedAppLink
            href={harvestAppUrl(vault.chain, vault.contractAddress)}
            cta="bottom-open-in-app"
            vaultSlug={vault.slug}
            vaultAddress={vault.contractAddress}
            className="uni-side-link"
          >
            <span className="uni-side-link-dot" />
            Open in Harvest app
            <span className="uni-side-link-arrow">↗</span>
          </TrackedAppLink>
        </div>
      </section>

      <ProductPageFootnote history={history} />
    </div>
  );
}

// Three-paragraph "About" block reserved for vaultType="Autopilot".
// Copy is generated by lib/autopilot-about.ts so the wording stays
// fixed (variable substitution only) per the editorial template.
function AutopilotAboutBlock({
  vault,
  history,
  holderCount,
}: {
  vault: YieldVault;
  history: FullVaultHistory;
  holderCount: number | null;
}) {
  const { intro, engine, liveline } = buildAutopilotAbout(
    vault,
    history,
    holderCount,
  );
  const [first, ...rest] = intro.split(" is a ");
  return (
    <>
      <p>
        <strong>{first}</strong> is a {rest.join(" is a ")}
      </p>
      <p>{engine}</p>
      {liveline ? <p>{liveline}</p> : null}
    </>
  );
}

// Three-paragraph "About" block reserved for vaultType="Autocompounder".
// Differs from the Autopilot template: single underlying venue
// (no IPOR Labs / rebalancing language), reward token explicit in
// paragraph 2, curator stays attributed to the underlying venue
// inside the {UNDERLYING_VENUE} phrase, never to the
// Autocompounder itself.
function AutocompounderAboutBlock({
  vault,
  history,
  holderCount,
}: {
  vault: YieldVault;
  history: FullVaultHistory;
  holderCount: number | null;
}) {
  const { intro, rewards, liveline } = buildAutocompounderAbout(
    vault,
    history,
    holderCount,
  );
  const [first, ...rest] = intro.split(" is an ");
  return (
    <>
      <p>
        <strong>{first}</strong> is an {rest.join(" is an ")}
      </p>
      <p>{rewards}</p>
      {liveline ? <p>{liveline}</p> : null}
    </>
  );
}

// Three-paragraph "About" block for LP-pair Autocompounders
// (vault.underlyingLogos.length > 1). Signals dual-asset
// exposure in paragraph 1 ("paired with X") but defers the
// impermanent-loss explanation to FAQ Q7. Falls back to
// rendering nothing if getLpPair() returns null - which
// shouldn't happen if the caller checked isLpPair, but the
// builder is defensive anyway.
function LpPairAboutBlock({
  vault,
  history,
  holderCount,
}: {
  vault: YieldVault;
  history: FullVaultHistory;
  holderCount: number | null;
}) {
  const result = buildLpPairAbout(vault, history, holderCount);
  if (!result) return null;
  const { intro, rewards, liveline } = result;
  const [first, ...rest] = intro.split(" is an ");
  return (
    <>
      <p>
        <strong>{first}</strong> is an {rest.join(" is an ")}
      </p>
      <p>{rewards}</p>
      {liveline ? <p>{liveline}</p> : null}
    </>
  );
}

// Numbered-list "Yield trajectory" block reserved for Autopilot +
// Autocompounder vault types. Sentences are produced by the
// builder; the renderer just numbers them per the spec.
function AutopilotYieldTrajectoryBlock({
  vault,
  history,
}: {
  vault: YieldVault;
  history: FullVaultHistory;
}) {
  const { lines } = buildYieldTrajectory(vault, history);
  if (lines.length === 0) return null;
  return (
    <section className="pp-section" id="yield-trajectory">
      <h2>Yield trajectory</h2>
      <NumberedFactList items={lines} />
    </section>
  );
}

// Numbered-list "Performance Overview" block reserved for Autopilot
// + Autocompounder vault types. Each line is one fact; the renderer
// guarantees the visual rhythm spec asks for (one block per item).
function AutopilotPerformanceOverviewBlock({
  vault,
  history,
  allVaults,
}: {
  vault: YieldVault;
  history: FullVaultHistory;
  allVaults: YieldVault[];
}) {
  const { lines } = buildPerformanceOverview(vault, history, allVaults);
  if (lines.length === 0) return null;
  return (
    <section className="pp-section" id="performance-overview">
      <h2>Performance Overview</h2>
      <NumberedFactList items={lines} />
    </section>
  );
}

// Shared numbered renderer for both Autopilot sections. Reuses the
// .pp-numbered-* styling already used by VaultCommentary so the
// visual rhythm matches the page's existing numbered lists (gold
// rank tile + sentence text in two columns, blank-line gap
// between items).
function NumberedFactList({ items }: { items: string[] }) {
  return (
    <div className="pp-numbered-list">
      {items.map((text, i) => (
        <div key={i} className="pp-numbered-item">
          <span className="pp-num-badge">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="pp-num-text">{text}</span>
        </div>
      ))}
    </div>
  );
}

// Network display name -> filter-page slug. The network badge in
// the product header links here so users can pivot from a single
// vault to "all vaults on this chain". Slugs match the static
// route folders under src/app/.
const NETWORK_SLUGS: Record<string, string> = {
  Ethereum: "ethereum",
  Base: "base",
  Arbitrum: "arbitrum",
  Polygon: "polygon",
  zkSync: "zksync",
  HyperEVM: "hyperevm",
};
function networkHrefFor(chain: string): string {
  return `/${NETWORK_SLUGS[chain] ?? chain.toLowerCase()}`;
}

// Most recent snapshot timestamp across all three history series.
// Drives the "Last updated N minutes/hours/days ago" line at the
// page bottom and the article:modified_time meta tag.
function latestHistoryTimestamp(h: FullVaultHistory): number {
  const stamps = [
    ...h.tvlHistory.map((p) => p.timestamp),
    ...h.sharePriceHistory.map((p) => p.timestamp),
    ...h.apyHistory.map((p) => p.timestamp),
  ].filter((t) => Number.isFinite(t) && t > 0);
  if (stamps.length === 0) return 0;
  return Math.max(...stamps);
}

function formatRelativeUpdated(ts: number, now: number = Date.now()): string {
  if (!ts) return "Last updated recently";
  const diffSec = Math.max(0, Math.floor((now - ts * 1000) / 1000));
  const min = Math.floor(diffSec / 60);
  const hour = Math.floor(diffSec / 3600);
  const day = Math.floor(diffSec / 86400);
  if (diffSec < 60) return "Last updated just now";
  if (hour < 1) return `Last updated ${min} minute${min === 1 ? "" : "s"} ago`;
  if (day < 1) return `Last updated ${hour} hour${hour === 1 ? "" : "s"} ago`;
  if (day <= 7) return `Last updated ${day} day${day === 1 ? "" : "s"} ago`;
  const d = new Date(ts * 1000);
  return `Last updated on ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
}

// Bottom-of-page stack: a per-product "last updated" relative
// timestamp and the universal discrete risk acknowledgement line.
// Both sit between the LINKS row and the global footer; the line
// styling is intentionally muted (single line, regular weight, no
// icons or boxes) to keep this reading as a data-page footnote
// rather than a compliance banner.
function ProductPageFootnote({ history }: { history: FullVaultHistory }) {
  const ts = latestHistoryTimestamp(history);
  const updated = formatRelativeUpdated(ts);
  return (
    <section className="pp-footnote" aria-label="Page metadata and disclosures">
      <p className="pp-footnote-updated">{updated}</p>
      <p className="pp-footnote-disclosure">
        Harvest is an independent onchain yield index. Performance
        data reflects historical onchain activity and is not a
        forecast. See the{" "}
        <Link href="/methodology">methodology</Link>,{" "}
        <Link href="/risk-framework">risk framework</Link>,{" "}
        <Link href="/terms">terms</Link>, and{" "}
        <Link href="/disclosures">disclosures</Link> for details on
        how data is calculated and the risks associated with onchain
        yield strategies.
      </p>
    </section>
  );
}
