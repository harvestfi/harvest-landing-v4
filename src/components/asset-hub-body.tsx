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
      "Native BTC earns nothing on its own. To put it to work, you wrap it (WBTC, cbBTC, tBTC) and route the wrapped token through a lending market, an autocompounder, or a basis trade. Every row below is one of those routes, picked from the strategies we currently track.",
    heroSub:
      "Live ranking of {N} wrapped-BTC strategies on {C} {C_WORD}.",
    about: [
      {
        h3: "What \"Bitcoin yield\" actually means",
        body: "BTC sitting in your wallet pays no interest. Yield exists once the asset reaches a smart-contract chain as a wrapped token. WBTC dominates Ethereum. cbBTC dominates Coinbase chains. tBTC sits on networks that integrate Threshold Network. Every APY on this page is what one of those wrapped tokens is currently earning inside a strategy in our index.",
      },
      {
        h3: "The cohort, in numbers",
        body: "Right now we track {N} wrapped-BTC strategies across {C} {C_WORD}, holding {TOTAL_TVL} in deposits. 24-hour APYs run from {MIN_APY} at the floor to {MAX_APY} at the top. Median {MEDIAN_APY}, mean {MEAN_APY}. None of this represents the wider market, only what we follow.",
      },
      {
        h3: "Wrappers we currently follow",
        body: "{WRAPPER_BLOCK}. WBTC is custodied by BitGo. cbBTC is issued by Coinbase against their reserves. tBTC is minted by the Threshold Network's signer set. The wrapper choice is part of the position, not a footnote: each carries a different mix of custody, oracle, and bridge risk that flows through to every strategy built on top.",
      },
      {
        h3: "Where the yield lives, by network",
        body: "{NETWORK_BLOCK}. Ethereum and the EVM rollups with deep wrapped-BTC liquidity carry most of the volume. The list shifts as deployments ship and retire. Tap any pill at the bottom of the page to scope the ranking to one chain.",
      },
      {
        h3: "Protocol families on the leaderboard",
        body: "Top families in the cohort: {PROTO_BLOCK}. Some are bare lending markets. Some are autocompounders wrapping those markets. A small minority are structured strategies layered above. Open any vault to see exactly which contracts the deposit touches.",
      },
      {
        h3: "Lending, autocompounding, basis",
        body: "Three patterns cover almost everything on the list. Lending: deposit wrapped BTC, earn the supply rate borrowers pay. Autocompounding: same plus a contract that harvests and re-invests reward emissions on a schedule. Basis: hold spot wrapped BTC against a short perp leg, capture funding. Each adds smart-contract surface in exchange for more or smoother yield.",
      },
      {
        h3: "Reading the APY columns",
        body: "24-hour APY: today's rate, annualised. 30-day APY: trailing mean of daily readings. The sparkline draws the same series at small scale. A flat line reads as a stable strategy; spikes mean a volatile one. Past APY does not promise future APY.",
      },
      {
        h3: "Reading the TVL column",
        body: "TVL is the dollar value of wrapped BTC sitting in the vault contract. The {N} vaults on this page hold {TOTAL_TVL} between them. Higher TVL usually means the strategy has been live longer and absorbed more capital without breaking. Lower TVL is either young, niche, or a sign the APY no longer compensates for the risk.",
      },
      {
        h3: "Risk surfaces on every wrapped-BTC strategy",
        body: "Smart-contract risk on the vault and the protocol underneath. Oracle risk on the price feeds those contracts trust. Bridge or wrapping risk on the BTC token itself. Governance risk on every parameter operators can change. Tiers and what we leave out, on the {RISK_LINK}.",
      },
      {
        h3: "What this page is, and what it is not",
        body: "A curated index. Not a market census. We add strategies as we vet and integrate them; we drop them when the upstream product retires or fails our risk framework. Every comparison here is within our set. Plenty of wrapped-BTC yield exists outside it.",
      },
    ],
    faq: [
      { q: "Is wrapping BTC reversible?", a: "Yes for the major wrappers. Each maintains a redemption path back to native BTC under its own minting and burning rules. Bridges and cross-chain swaps add steps, not a one-way gate." },
      { q: "Why do APYs differ across networks for the same wrapper?", a: "Lending utilisation, reward emissions, and local market depth are all per-chain. The same WBTC can pay 1% on one network and 8% on another at the same minute." },
      { q: "Do these numbers include rewards?", a: "Yes, when the underlying protocol bakes them into the rate it reports. The vault detail page splits the figure into base and rewards where the upstream publishes that breakdown." },
      { q: "Are there BTC yield strategies not listed here?", a: "Many. The page is the set we have indexed and verified against our framework. Adding more is an ongoing job." },
    ],
  },

  USDC: {
    crumbLabel: "USDC",
    longName: "USDC",
    lede:
      "USDC is Circle's fully reserved dollar stablecoin. The yield on this page comes from the supply side of DeFi: lending markets where borrowers pay you, autocompounders that harvest reward emissions, and a small set of delta-neutral strategies. Every row is one of those, picked from the strategies we currently index.",
    heroSub:
      "Live ranking of {N} USDC strategies on {C} {C_WORD}.",
    about: [
      { h3: "Why USDC sits at the centre of DeFi yield", body: "Most onchain lending markets and yield products denominate in USDC. The strategies on this ranking are the supply side of that economy: deposit USDC, earn whatever borrowers and incentive programs are paying for it. Yield moves with utilisation, reward gauges, and onchain demand. Scope is the strategies we currently track." },
      { h3: "The cohort, in numbers", body: "Right now we track {N} USDC strategies across {C} {C_WORD}, holding {TOTAL_TVL} in deposits. 24-hour APYs run from {MIN_APY} to {MAX_APY}. Median {MEDIAN_APY}, mean {MEAN_APY}. None of this represents the wider USDC market, only what we follow." },
      { h3: "Where the yield lives, by network", body: "{NETWORK_BLOCK}. USDC liquidity concentrates on Ethereum, Base, and the major EVM rollups. We add networks as new strategies ship and remove them when products retire." },
      { h3: "Protocol families on the leaderboard", body: "Top families: {PROTO_BLOCK}. Most rows are either a single-asset money market like Aave or Morpho, or an autocompounder wrapping one. A smaller slice is real-world-asset credit and structured strategies." },
      { h3: "Lending vs. autocompounding vs. delta-neutral", body: "Three flavours cover almost everything on the list. Lending: deposit USDC, earn the supply rate. Autocompounding: same plus a contract that re-invests reward emissions for you. Delta-neutral: pair USDC with a short leg to capture funding or basis spread. Each trades complexity for smoother or higher yield." },
      { h3: "Reading the APY columns", body: "24-hour APY: today's annualised rate. 30-day APY: trailing mean across the last month. Stablecoin yields move less than wrapped-asset yields, but they still move every day with utilisation cycles and reward gauges. Past APY does not promise future APY." },
      { h3: "Reading the TVL column", body: "TVL is the USD value of USDC sitting in the vault contract. The {N} vaults on this page hold {TOTAL_TVL} between them. Higher TVL usually means the strategy has been live longer and absorbed more capital without breaking. Lower TVL is either young, niche, or compensating poorly for its risk." },
      { h3: "Risk surfaces on every USDC strategy", body: "Smart-contract risk on the vault and the protocol underneath. Oracle risk on the price feeds. Depeg risk on USDC itself in tail scenarios. Governance risk on every parameter operators can change. Tiers and what we leave out, on the {RISK_LINK}." },
      { h3: "What this page is, and what it is not", body: "A curated USDC index. Not the entire USDC yield market. We add strategies as we vet and integrate them; we drop them when products retire or fail our framework. Every comparison here is within our set." },
    ],
    faq: [
      { q: "Why is USDC yield variable?", a: "Lending APY follows borrower demand and utilisation. Reward APY follows incentive programs that turn on and off. Both move daily." },
      { q: "Do these numbers include rewards?", a: "Yes, when the underlying protocol bakes them into the rate it reports. The vault detail page splits the figure into base and rewards where the upstream publishes that breakdown." },
      { q: "Are there USDC yield strategies not listed here?", a: "Many. The page is the set we have indexed and verified against our framework, not an exhaustive list." },
    ],
  },

  USDT: {
    crumbLabel: "USDT",
    longName: "USDT",
    lede:
      "USDT is the largest dollar stablecoin in crypto. The yield on this page comes from the supply side: lending markets, autocompounders, and a few structured strategies. Every row is one of those, picked from the strategies we currently index.",
    heroSub:
      "Live ranking of {N} USDT strategies on {C} {C_WORD}.",
    about: [
      { h3: "Why USDT shows up in every yield stack", body: "USDT carries the biggest stablecoin float in the market and is often the default unit of account on lending venues. The data on this page is the supply side of that picture, scoped to the strategies we currently track." },
      { h3: "The cohort, in numbers", body: "Right now we track {N} USDT strategies across {C} {C_WORD}, holding {TOTAL_TVL} in deposits. 24-hour APYs run from {MIN_APY} to {MAX_APY}. Median {MEDIAN_APY}, mean {MEAN_APY}. Population is limited to what we follow." },
      { h3: "Where the yield lives, by network", body: "{NETWORK_BLOCK}. USDT liquidity sits on Ethereum, Tron-bridged endpoints, and the major EVM rollups. The list shifts as deployments come and go." },
      { h3: "Protocol families on the leaderboard", body: "Top families: {PROTO_BLOCK}. Almost every row is a money market or an autocompounder wrapping one." },
      { h3: "Lending vs. autocompounding", body: "Lending: deposit USDT, earn the supply rate. Autocompounding: same plus a contract that re-invests reward emissions on a schedule. The autocompounder smooths the yield curve in exchange for additional smart-contract surface." },
      { h3: "Reading the APY and TVL columns", body: "24-hour APY: today's annualised rate. 30-day APY: trailing mean of daily readings. TVL: the USD value of USDT in the vault contract. The {N} vaults on this page add up to {TOTAL_TVL}." },
      { h3: "Risk surfaces on every USDT strategy", body: "Smart-contract risk on the vault and protocol. Oracle risk. Issuer and attestation risk on USDT itself. Governance risk on every parameter operators can change. Tiers and what we leave out, on the {RISK_LINK}." },
      { h3: "What this page is, and what it is not", body: "A curated USDT index. Not the entire USDT yield market. Treat every comparison here as within our cohort." },
    ],
    faq: [
      { q: "Is USDT yield more variable than USDC yield?", a: "In aggregate the two curves track. On a given chain they drift based on which stablecoin lenders prefer at that moment. Watch utilisation rates, not just APY." },
      { q: "Do these numbers include rewards?", a: "Yes, when the upstream protocol rolls them into its rate. Per-vault breakdowns appear on the detail page where the protocol publishes them." },
      { q: "Are there USDT strategies not listed here?", a: "Many. The page is what we have indexed, not a market census." },
    ],
  },

  ETH: {
    crumbLabel: "ETH",
    longName: "Ethereum",
    lede:
      "Ether is the gas token of Ethereum and most of the EVM rollups. ETH yield comes from three places: validator rewards (staking and LSTs), lending markets, and restaking via EigenLayer-aware products. Every row on this page is one of those, picked from the strategies we currently index.",
    heroSub:
      "Live ranking of {N} ETH strategies on {C} {C_WORD}.",
    about: [
      { h3: "What \"ETH yield\" actually means", body: "Three buckets cover almost everything in our index. Staking and LSTs tokenise validator rewards. Lending markets pay the supply rate that leveraged ETH demand drives. Restaking pays validators to also secure additional networks via EigenLayer. Many strategies on the page combine more than one." },
      { h3: "The cohort, in numbers", body: "Right now we track {N} ETH strategies across {C} {C_WORD}, holding {TOTAL_TVL} in deposits. 24-hour APYs run from {MIN_APY} to {MAX_APY}. Median {MEDIAN_APY}, mean {MEAN_APY}. Numbers are scoped to our set, not the wider market." },
      { h3: "Where the yield lives, by network", body: "{NETWORK_BLOCK}. ETH yield concentrates on Ethereum mainnet plus the rollups with deep LST liquidity. We add networks as ETH strategies ship and remove them when products retire." },
      { h3: "LSTs, LRTs, and lending: the strategy mix", body: "Top primitives in the cohort: {PROTO_BLOCK}. LSTs (liquid staking tokens) tokenise validator rewards. LRTs (liquid restaking tokens) layer EigenLayer points and AVS rewards on top. Lending markets earn the supply rate paid by leveraged ETH demand. Open any vault to see how it fits together." },
      { h3: "Reading the APY columns", body: "24-hour APY: today's annualised rate. 30-day APY: trailing mean across the last month. ETH-denominated yield is the rate on the ETH balance, before any price move on ETH itself. Headline numbers look smaller than stablecoin yields for that reason." },
      { h3: "Reading the TVL column", body: "TVL is the USD value of ETH sitting in the vault contract. The {N} vaults on this page add up to {TOTAL_TVL}. ETH TVL moves with both deposits and ETH price; TVL alone is not a quality signal." },
      { h3: "Risk surfaces on every ETH strategy", body: "Smart-contract risk on the vault and protocol. Slashing risk on validator-backed strategies. Oracle risk. Depeg risk on LSTs and LRTs. Governance risk on every parameter operators can change. Tiers and what we leave out, on the {RISK_LINK}." },
      { h3: "What this page is, and what it is not", body: "A curated index. Not a complete map of ETH yield. Solo validators and many institutional venues are out of scope by design. Treat every comparison here as within our set." },
    ],
    faq: [
      { q: "Is the APY here paid in ETH or in dollars?", a: "ETH. The rate is on your ETH balance, not on a dollar position. The price action of ETH itself is separate." },
      { q: "Do LRTs really earn extra on top of staking?", a: "They earn whatever AVSs they secure pay, plus EigenLayer points where applicable. The composition is rarely captured in a single APY number; check the vault detail page." },
      { q: "Are there ETH yield strategies not listed here?", a: "Many. Solo validators and many institutional venues are intentionally out of scope. The list is what we have indexed and verified." },
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
            <AssetIcon asset={asset} size={54} priority />
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
            Top {copy.longName} yields
          </h2>
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
