// Shared body for asset hub pages (/btc, /usdc, /usdt, /eth). Renders
// the Sunflower Gold hub layout (boxed page, hero with asset icon +
// h1 + sub + 2 stats, HubTable ranking, SEO content section, network
// shortcuts) parameterised by asset.

import Link from "next/link";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { SITE_URL } from "@/lib/constants";
import {
  assetHubH1,
  assetHubCrumbs,
} from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/jsonld";
import { getSubAsset } from "@/lib/sub-asset";
import { HubTable } from "@/components/hub-table";

interface AssetCopy {
  // Short label used in breadcrumb (e.g. "Bitcoin", "USDC", "USDT", "ETH")
  crumbLabel: string;
  // Asset-name used in section/about copy ("Bitcoin", "USDC", "USDT", "Ethereum")
  longName: string;
  // Single-line lede shown in About {asset} yield
  lede: string;
  // Sub-articles for SEO body. Use {N}, {NETWORKS}, {WRAPPERS}, {TOP_PROTOS},
  // {TOTAL_TVL}, {MIN_APY}, {MEDIAN_APY}, {MEAN_APY}, {MAX_APY} placeholders
  // in the prose to interpolate live cohort numbers.
  about: { h3: string; body: string }[];
  faq: { q: string; a: string }[];
  // Optional override for the hero subline. {N} = vault count, {C} = chains.
  heroSub?: string;
}

const COPY: Record<string, AssetCopy> = {
  BTC: {
    crumbLabel: "Bitcoin",
    longName: "Bitcoin",
    lede:
      "Bitcoin is a non-yielding asset out of the box. To put BTC to work, holders move into wrapped or liquid Bitcoin tokens and route them through lending markets, autocompounding vaults, or basis trades against perpetuals. Every strategy on this page follows that pattern: a wrapped BTC token, on a specific chain, running through a specific underlying protocol.",
    heroSub:
      "Compare {N} Bitcoin yield strategies we currently track across {WRAPPERS}, ranked by APY across {C} {C_WORD}.",
    about: [
      {
        h3: "What \"Bitcoin yield\" actually means",
        body: "Native BTC sitting in a self-custody wallet earns nothing. Yield enters the picture once the asset is represented on a smart-contract chain where it can be lent, supplied as collateral, or routed through an automated strategy. On Ethereum that representation is usually WBTC; on Coinbase chains it is cbBTC; on networks integrating Threshold Network it is tBTC. The numbers on this ranking are the live APYs those wrapped representations are earning, and the population is limited to the strategies we currently index.",
      },
      {
        h3: "The cohort, in numbers",
        body: "Right now this page tracks {N} wrapped-BTC strategies across {C} {C_WORD}, holding {TOTAL_TVL} of deposits in aggregate. Inside that set, 24-hour APYs span from {MIN_APY} at the low end to {MAX_APY} at the top, with a median reading near {MEDIAN_APY} and a simple mean of {MEAN_APY}. These are not market-wide statistics, only what we currently follow.",
      },
      {
        h3: "Wrappers we currently follow",
        body: "Across the strategies we monitor, the wrappers in circulation are {WRAPPER_BLOCK}. WBTC is custodied by BitGo and minted against held BTC; cbBTC is issued by Coinbase, redeemable 1:1 against their reserves; tBTC is issued by the Threshold Network's decentralised signer set. Each wrapper carries a different combination of custody, oracle, and bridge risk, and that risk follows the token into every strategy it touches.",
      },
      {
        h3: "Where the yield lives, by network",
        body: "Coverage in our index breaks down as {NETWORK_BLOCK}. Ethereum mainnet and the EVM rollups with meaningful wrapped-BTC liquidity dominate that mix; we add networks as deployments ship and remove them as they retire upstream. Use the network shortcuts at the bottom of this page to scope the ranking to a single chain.",
      },
      {
        h3: "Protocol families on the leaderboard",
        body: "The strategies we follow run on a handful of underlying protocol families. The most common right now are {PROTO_BLOCK}. Each one has its own composition: some are single-asset money markets, some are autocompounding vaults wrapping those markets, and a small minority are structured strategies on top.",
      },
      {
        h3: "Lending, autocompounding, basis",
        body: "The simplest BTC yield is a single-side supply on a money market like Aave or Morpho: deposit wrapped Bitcoin, earn the supply APY borrowers pay. An autocompounder layers on top of that, harvesting and re-investing reward emissions on a schedule. Basis strategies, less common in the cohort we monitor, hold spot wrapped BTC against a short perp leg to capture funding. Each profile trades a different mix of complexity, gas overhead, and reward composition.",
      },
      {
        h3: "Reading the APY columns",
        body: "The 24-hour APY is the latest annualised return our hosted indexer pulled from the underlying protocol, refreshed on a regular cadence. The 30-day APY is the simple mean of daily readings across the last month for that strategy. The 30-day trend sparkline visualises the same series so a stable strategy reads flat and a volatile one reads as spikes. Past APY is not a guarantee of future returns, and outliers compound for a reason.",
      },
      {
        h3: "Reading the TVL column",
        body: "TVL is the dollar value of wrapped BTC currently deposited in the strategy. The {N} vaults we follow add up to roughly {TOTAL_TVL} in tracked deposits. A higher TVL usually means a strategy has been live longer and has absorbed more capital without breaking; a low TVL might be a new launch, a niche pair, or a strategy whose APY no longer compensates for its risk.",
      },
      {
        h3: "Risk surfaces on every wrapped-BTC strategy",
        body: "Smart-contract risk on the vault and the underlying protocol; oracle risk on the price feeds those contracts depend on; bridge or wrapping risk on the BTC representation; governance risk on parameters operators can change. The full framework, including how each strategy is scored and what we deliberately leave out, lives on the {RISK_LINK}.",
      },
      {
        h3: "What this page is, and what it is not",
        body: "This is a curated index, not an exhaustive map of Bitcoin yield in DeFi. Coverage today is limited to the {N} wrapped-BTC strategies we actively monitor, and the universe of BTC yield far exceeds that set. We add strategies as we vet and integrate them; we remove them when upstream products are retired or fall outside our risk framework. Treat every comparison on this page as comparison within our cohort, not against the wider market.",
      },
    ],
    faq: [
      { q: "Is wrapping BTC reversible?", a: "For the major wrappers, yes: each maintains a redemption path back to native BTC, subject to their own minting and burning rules. Bridging or cross-chain swaps add an extra step on top." },
      { q: "Why do APYs differ across networks for the same wrapper?", a: "Lending utilisation, reward emissions, and the size of the local market all vary by chain. The same wrapped BTC token can earn very different yields on two networks at the same moment." },
      { q: "Do these numbers include rewards?", a: "The 24-hour APY reflects whatever the underlying protocol reports as its current rate, which usually includes active reward emissions. The strategy detail page on each vault shows the breakdown where it is published upstream." },
      { q: "Are there BTC yield strategies not listed here?", a: "Plenty. The set on this page is what we have indexed and verified against our risk framework. New strategies join as we add them; the list is not meant to mirror every wrapped-BTC vault that exists on chain today." },
    ],
  },

  USDC: {
    crumbLabel: "USDC",
    longName: "USDC",
    lede:
      "USDC is a fully collateralised US dollar stablecoin issued by Circle. To earn yield on USDC in DeFi, holders supply it to lending markets, deposit it in autocompounding vaults, or route it through delta-neutral strategies. Every strategy on this page accepts USDC, runs on a specific chain, and is wrapped through a specific underlying protocol that we currently index.",
    heroSub:
      "Compare {N} USDC yield strategies we currently track, ranked by APY across {C} {C_WORD}.",
    about: [
      { h3: "Why USDC yield is the workhorse of DeFi", body: "USDC is the stablecoin most lending markets and yield products are built around. The strategies on this ranking represent the supply side of that economy: deposit USDC, earn what borrowers and liquidity programs pay to use it. Yield rises and falls with utilisation, reward emissions, and onchain demand, and the data on this page is limited to the strategies we currently track." },
      { h3: "The cohort, in numbers", body: "Right now this page tracks {N} USDC strategies across {C} {C_WORD}, holding {TOTAL_TVL} of deposits in aggregate. Inside that set, 24-hour APYs span from {MIN_APY} at the low end to {MAX_APY} at the top, with a median reading near {MEDIAN_APY} and a simple mean of {MEAN_APY}. These are not market-wide statistics, only what we currently follow." },
      { h3: "Where the yield lives, by network", body: "Coverage in our index breaks down as {NETWORK_BLOCK}. USDC liquidity is deepest on Ethereum mainnet, Base, and the major EVM rollups; we add networks as USDC strategies ship and remove them as they retire upstream. Use the network shortcuts at the bottom of this page to scope the ranking to a single chain." },
      { h3: "Protocol families on the leaderboard", body: "The strategies we follow run on a handful of underlying protocol families. The most common right now are {PROTO_BLOCK}. Each one has its own composition: some are single-asset money markets like Aave and Compound, some are autocompounding vaults wrapping those markets, and a smaller minority are real-world-asset or structured-credit strategies." },
      { h3: "Lending vs. autocompounding vs. delta-neutral", body: "The simplest USDC yield is a single-side supply on a money market: lend USDC, earn the supply APY borrowers pay. Autocompounders layer on top, harvesting and re-investing reward emissions on a schedule. Delta-neutral strategies, less common in the cohort we monitor, pair USDC with a short leg to capture funding or basis. Each profile trades a different mix of complexity, reward composition, and recoverable principal." },
      { h3: "Reading the APY columns", body: "The 24-hour APY is the latest annualised return our hosted indexer pulled from the underlying protocol. The 30-day APY is the simple mean of daily readings across the last month for that strategy. Stablecoin APYs tend to be more stable than wrapped-asset yields but still move with utilisation cycles, reward gauges, and incentive programs. Past APY is not a guarantee of future returns." },
      { h3: "Reading the TVL column", body: "TVL is the dollar value of USDC currently deposited in the strategy. The {N} vaults we follow add up to roughly {TOTAL_TVL} in tracked deposits. A higher TVL usually means a strategy has been live longer and has absorbed more capital without breaking; a low TVL might be a new launch or a niche pair." },
      { h3: "Risk surfaces on every USDC strategy", body: "Smart-contract risk on the vault and the underlying protocol; oracle risk on the price feeds those contracts depend on; depeg risk on USDC itself in extreme tail scenarios; governance risk on parameters operators can change. The full framework, including how each strategy is scored, lives on the {RISK_LINK}." },
      { h3: "What this page is, and what it is not", body: "This is a curated index, not an exhaustive map of USDC yield in DeFi. Coverage today is limited to the {N} strategies we actively monitor, and the USDC yield universe far exceeds that set. Treat every comparison on this page as comparison within our cohort, not against the wider market." },
    ],
    faq: [
      { q: "Why is USDC yield variable?", a: "Lending APYs depend on borrower demand and liquidity utilisation; reward APYs depend on protocol incentives that can be turned on or off. Both move daily." },
      { q: "Do these numbers include rewards?", a: "The 24-hour APY reflects whatever the underlying protocol reports as its current rate, which usually includes active reward emissions. The strategy detail page on each vault shows the breakdown where it is published upstream." },
      { q: "Are there USDC yield strategies not listed here?", a: "Many. The set on this page is what we have indexed and verified against our risk framework. New strategies join as we add them; the list is not meant to mirror every USDC vault that exists on chain today." },
    ],
  },

  USDT: {
    crumbLabel: "USDT",
    longName: "USDT",
    lede:
      "USDT is the most-used dollar stablecoin in DeFi. To earn yield on USDT, holders supply it to lending markets, deposit it in autocompounding vaults, or route it through structured strategies. Every strategy on this page accepts USDT, runs on a specific chain, and is wrapped through a specific underlying protocol that we currently index.",
    heroSub:
      "Compare {N} USDT yield strategies we currently track, ranked by APY across {C} {C_WORD}.",
    about: [
      { h3: "Why USDT shows up in every DeFi yield stack", body: "USDT carries the largest stablecoin float in crypto and tends to be the dominant unit of account on lending markets across multiple chains. The data on this page is the supply side of that picture, scoped to the strategies we currently track." },
      { h3: "The cohort, in numbers", body: "Right now this page tracks {N} USDT strategies across {C} {C_WORD}, holding {TOTAL_TVL} of deposits in aggregate. 24-hour APYs span from {MIN_APY} to {MAX_APY}, with a median reading near {MEDIAN_APY} and a simple mean of {MEAN_APY}. Population is limited to what we currently follow." },
      { h3: "Where the yield lives, by network", body: "Coverage in our index breaks down as {NETWORK_BLOCK}. USDT liquidity is concentrated on Ethereum mainnet, Tron-bridge endpoints, and the major EVM rollups. Use the network shortcuts at the bottom of this page to scope the ranking to a single chain." },
      { h3: "Protocol families on the leaderboard", body: "The strategies we follow run on a handful of underlying protocol families. The most common right now are {PROTO_BLOCK}. Most are single-asset money markets or autocompounders wrapped on top of them." },
      { h3: "Lending vs. autocompounding", body: "The simplest USDT yield is a single-side supply on a money market: deposit USDT, earn the supply rate. Autocompounders harvest and re-invest reward emissions on a schedule, smoothing the curve at the cost of additional smart-contract surface area." },
      { h3: "Reading the APY and TVL columns", body: "The 24-hour APY is the latest annualised return reported upstream; the 30-day APY is the simple mean of daily readings. TVL is the dollar value of USDT currently deposited. The {N} vaults we follow add up to roughly {TOTAL_TVL} in tracked deposits across the cohort." },
      { h3: "Risk surfaces on every USDT strategy", body: "Smart-contract risk on the vault and underlying protocol; oracle risk; issuer or attestation risk on USDT itself; governance risk on parameters operators can change. The full framework lives on the {RISK_LINK}." },
      { h3: "What this page is, and what it is not", body: "This is a curated index. Coverage today is limited to the {N} USDT strategies we actively monitor; the wider USDT yield universe far exceeds that set. Treat every comparison on this page as comparison within our cohort, not against the wider market." },
    ],
    faq: [
      { q: "Is USDT yield more variable than USDC yield?", a: "In aggregate the curves track each other closely, but on any single chain the two can drift apart based on which stablecoin lenders prefer. Watch utilisation rates, not just APY." },
      { q: "Do these numbers include rewards?", a: "The 24-hour APY reflects what the underlying protocol reports, which usually includes active reward emissions. Each vault detail page shows the breakdown where it is published upstream." },
      { q: "Are there USDT strategies not listed here?", a: "Many. The set on this page is what we have indexed and verified against our risk framework, not an exhaustive market census." },
    ],
  },

  ETH: {
    crumbLabel: "ETH",
    longName: "Ethereum",
    lede:
      "Ether is the native asset of the Ethereum network and the gas token across the EVM rollups. To earn yield on ETH, holders stake it (directly or through an LST), supply it to lending markets, deposit it in autocompounding vaults, or restake it through EigenLayer-aware products. Every strategy on this page accepts ETH or an ETH-pegged token, runs on a specific chain, and is wrapped through a specific underlying protocol that we currently index.",
    heroSub:
      "Compare {N} ETH yield strategies we currently track, ranked by APY across {C} {C_WORD}.",
    about: [
      { h3: "What ETH yield actually means", body: "ETH yield comes from three rough categories: validator rewards (paid to Ethereum stakers), DeFi rewards (lending markets, AMMs, autocompounders that accept ETH or ETH-pegged tokens), and restaking rewards (paying validators to also secure additional networks). Most strategies on this page combine elements of more than one." },
      { h3: "The cohort, in numbers", body: "Right now this page tracks {N} ETH strategies across {C} {C_WORD}, holding {TOTAL_TVL} of deposits in aggregate. 24-hour APYs span from {MIN_APY} to {MAX_APY}, with a median reading near {MEDIAN_APY} and a simple mean of {MEAN_APY}. The numbers are scoped to our index, not the wider market." },
      { h3: "Where the yield lives, by network", body: "Coverage breaks down as {NETWORK_BLOCK}. ETH yield concentrates on Ethereum mainnet plus the rollups with deep LST liquidity; we add networks as ETH strategies ship and retire networks as products are deprecated." },
      { h3: "LSTs, LRTs, and lending: the strategy mix", body: "The most common ETH yield primitives we follow are {PROTO_BLOCK}. LSTs (liquid staking tokens) tokenise validator rewards; LRTs (liquid restaking tokens) layer EigenLayer points and AVS rewards on top; lending markets earn the borrow-side APY paid by leveraged ETH demand." },
      { h3: "Reading the APY columns", body: "The 24-hour APY is the latest annualised return reported upstream. The 30-day APY is the simple mean across the last month. ETH-denominated strategies often look smaller than stablecoin yields because the principal itself moves; the displayed rate is the rate on the ETH balance, before any price action." },
      { h3: "Reading the TVL column", body: "TVL is the dollar value of ETH currently deposited in the strategy. The {N} vaults we follow add up to roughly {TOTAL_TVL} in tracked deposits. ETH TVL moves with both deposits and price." },
      { h3: "Risk surfaces on every ETH strategy", body: "Smart-contract risk on the vault and the underlying protocol; slashing risk on validator-backed strategies; oracle risk on price feeds; depeg risk on LSTs and LRTs; governance risk on parameters. The full framework lives on the {RISK_LINK}." },
      { h3: "What this page is, and what it is not", body: "This is a curated index. Coverage today is limited to the {N} ETH strategies we actively monitor; the wider ETH yield universe (including direct solo staking) is much larger. Treat every comparison on this page as comparison within our cohort, not against the wider market." },
    ],
    faq: [
      { q: "Is the APY here paid in ETH or in dollars?", a: "Strategies on this page report rates in their native unit, which for these vaults is the deposit asset. ETH-denominated yield does not include the price action of ETH itself." },
      { q: "Do LRTs really earn extra on top of staking?", a: "They earn whatever AVSs they secure pay, plus EigenLayer points where applicable. The exact composition varies and is not always reflected in a single APY number; check the individual vault detail page." },
      { q: "Are there ETH yield strategies not listed here?", a: "Many. The set on this page is what we have indexed and verified against our risk framework. Solo validators and many institutional venues are out of scope by design." },
    ],
  },
};

interface Props {
  asset: keyof typeof COPY;
}

function buildBlock<T>(
  items: T[],
  render: (item: T, last: boolean) => string,
): string {
  return items
    .map((item, i) => {
      const last = i === items.length - 1;
      const sep = i === 0 ? "" : last ? ", and " : ", ";
      return sep + render(item, last);
    })
    .join("");
}

export async function AssetHubBody({ asset }: Props) {
  const allVaults = await getLiveVaults();
  const sparklines = await getAllSparklines();
  const vaults = allVaults
    .filter((v) => v.asset === asset)
    .sort((a, b) => b.apy24h - a.apy24h);

  const copy = COPY[asset];
  const bestApy = vaults.reduce((b, v) => (v.apy24h > b ? v.apy24h : b), 0);
  const avgApy =
    vaults.length > 0
      ? vaults.reduce((s, v) => s + v.apy24h, 0) / vaults.length
      : 0;
  const chainCount = new Set(vaults.map((v) => v.chain)).size;
  const chainWord = chainCount !== 1 ? "networks" : "network";
  const subAssets = [...new Set(vaults.map((v) => getSubAsset(v)))].sort();

  // Cohort statistics for SEO body
  const sortedApys = [...vaults].map((v) => v.apy24h).sort((a, b) => a - b);
  const medianApy =
    sortedApys.length > 0
      ? sortedApys[Math.floor(sortedApys.length / 2)]
      : 0;
  const minApy = sortedApys.length > 0 ? sortedApys[0] : 0;
  const totalTvl = vaults.reduce((s, v) => s + v.tvl, 0);

  const wrapperStats = Object.values(
    vaults.reduce<Record<string, { wrapper: string; count: number; tvl: number }>>(
      (acc, v) => {
        const w = getSubAsset(v);
        const cur = acc[w] ?? { wrapper: w, count: 0, tvl: 0 };
        cur.count += 1;
        cur.tvl += v.tvl;
        acc[w] = cur;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.count - a.count);

  const networkStats = Object.values(
    vaults.reduce<Record<string, { chain: string; count: number; bestApy: number }>>(
      (acc, v) => {
        const cur = acc[v.chain] ?? { chain: v.chain, count: 0, bestApy: 0 };
        cur.count += 1;
        if (v.apy24h > cur.bestApy) cur.bestApy = v.apy24h;
        acc[v.chain] = cur;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.count - a.count);

  const protocolStats = Object.values(
    vaults.reduce<Record<string, { protocol: string; count: number }>>((acc, v) => {
      const p = stripChainSuffix(v.category, v.chain);
      const cur = acc[p] ?? { protocol: p, count: 0 };
      cur.count += 1;
      acc[p] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);
  const topProtocols = protocolStats.slice(0, 5);

  const wrapperBlockText = buildBlock(wrapperStats, (w) =>
    `${w.wrapper} (${w.count} ${w.count === 1 ? "vault" : "vaults"}, ${formatTVL(w.tvl)} tracked)`,
  );
  const networkBlockText = buildBlock(networkStats, (n) =>
    `${n.chain} (${n.count} ${n.count === 1 ? "vault" : "vaults"}, top APY ${formatAPY(n.bestApy)})`,
  );
  const protoBlockText = buildBlock(topProtocols, (p) => `${p.protocol} (${p.count})`);

  function interpolate(text: string): string {
    return text
      .replace(/\{N\}/g, String(vaults.length))
      .replace(/\{C_WORD\}/g, chainWord)
      .replace(/\{C\}/g, String(chainCount))
      .replace(
        /\{WRAPPERS\}/g,
        subAssets.length === 0
          ? "wrapped variants"
          : subAssets.length <= 2
          ? subAssets.join(" and ")
          : subAssets.slice(0, -1).join(", ") + ", and " + subAssets[subAssets.length - 1],
      )
      .replace(/\{TOTAL_TVL\}/g, formatTVL(totalTvl))
      .replace(/\{MIN_APY\}/g, formatAPY(minApy))
      .replace(/\{MAX_APY\}/g, formatAPY(bestApy))
      .replace(/\{MEDIAN_APY\}/g, formatAPY(medianApy))
      .replace(/\{MEAN_APY\}/g, formatAPY(avgApy))
      .replace(/\{WRAPPER_BLOCK\}/g, wrapperBlockText)
      .replace(/\{NETWORK_BLOCK\}/g, networkBlockText)
      .replace(/\{PROTO_BLOCK\}/g, protoBlockText);
  }

  function renderArticleBody(text: string) {
    // Special-case the {RISK_LINK} so it renders as an actual <Link>.
    if (text.includes("{RISK_LINK}")) {
      const [before, after] = text.split("{RISK_LINK}");
      return (
        <p>
          {interpolate(before)}
          <Link href="/risk-framework">risk framework page</Link>
          {interpolate(after)}
        </p>
      );
    }
    return <p>{interpolate(text)}</p>;
  }

  const crumbs = assetHubCrumbs(asset);
  const hubUrl = `${SITE_URL}/${asset.toLowerCase()}`;
  const visibleChains = [...new Set(allVaults.map((v) => v.chain))].sort();

  return (
    <div className="uni-hub-test">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema(vaults, hubUrl)) }}
      />

      {/* Breadcrumb */}
      <nav className="uni-hub-crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <span className="uni-hub-crumbs-current">{copy.crumbLabel} Yield Ranking</span>
      </nav>

      {/* Hero */}
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <span className="uni-hub-hero-icon" aria-hidden="true">
            <AssetIcon asset={asset} size={54} />
          </span>
          <div>
            <h1 className="uni-hub-h1">{assetHubH1(asset)}</h1>
            <p className="uni-hub-sub">
              {vaults.length > 0
                ? interpolate(copy.heroSub ?? "")
                : `${copy.longName} yield strategies are populating, check back shortly.`}
            </p>
          </div>
        </div>

        <div className="uni-hub-stats" role="group" aria-label={`${copy.longName} index headline stats`}>
          <div className="uni-hub-stat">
            <div
              className="uni-hub-stat-label"
              data-tooltip={`Highest 24-hour APY among the indexed ${copy.longName} strategies right now.`}
            >
              Best APY
            </div>
            <div className="uni-hub-stat-value">
              {bestApy > 0 ? formatAPY(bestApy) : "-"}
            </div>
          </div>
          <div className="uni-hub-stat">
            <div
              className="uni-hub-stat-label"
              data-tooltip={`Mean 24-hour APY across the indexed ${copy.longName} strategies.`}
            >
              Avg APY
            </div>
            <div className="uni-hub-stat-value">
              {avgApy > 0 ? formatAPY(avgApy) : "-"}
            </div>
          </div>
        </div>
      </header>

      {/* Ranking table */}
      <section className="uni-hub-section" aria-labelledby="ranking-title">
        <header className="uni-hub-section-head">
          <h2 id="ranking-title" className="uni-hub-section-title">
            Top {copy.longName} yields by APY
          </h2>
          <span className="uni-hub-section-meta">
            Tracking {vaults.length} {vaults.length !== 1 ? "vaults" : "vault"}
            {chainCount > 0 ? `, ${chainCount} ${chainWord}` : ""}
          </span>
        </header>

        {vaults.length === 0 ? (
          <div className="uni-hub-empty">No {copy.longName} strategies indexed yet.</div>
        ) : (
          <HubTable
            vaults={vaults}
            sparklines={sparklines}
            scopeLabel={`${copy.longName} strategies`}
          />
        )}
      </section>

      {/* SEO content section */}
      <section className="uni-hub-content" aria-labelledby="about-asset">
        <header className="uni-hub-content-head">
          <h2 id="about-asset">About {copy.longName} yield</h2>
          <p className="uni-hub-content-lede">{copy.lede}</p>
        </header>

        <div className="uni-hub-content-grid">
          {copy.about.map((a) => (
            <article key={a.h3}>
              <h3>{a.h3}</h3>
              {renderArticleBody(a.body)}
            </article>
          ))}

          <article>
            <h3>Frequently asked questions</h3>
            <dl className="uni-hub-faq">
              {copy.faq.map((f) => (
                <div key={f.q}>
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
      </section>

      {/* Bottom rail: bridge to per-network filtered views */}
      <section className="uni-hub-cta-row">
        <p className="uni-hub-cta-meta">
          Looking for a specific chain? Network ranking pages cut the same
          data by network.
        </p>
        <div className="uni-hub-cta-links">
          {visibleChains.slice(0, 6).map((chain) => (
            <Link key={chain} href={`/${chain.toLowerCase()}`} className="uni-hub-cta-pill">
              <ChainIcon chain={chain} size={14} />
              {chain}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
