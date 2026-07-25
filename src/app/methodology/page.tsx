import type { Metadata } from "next";
import Link from "next/link";
import { HomeCrumb } from "@/components/home-crumb";
import { getLiveVaults, getVaults } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { stripChainSuffix } from "@/lib/format";
import { breadcrumbSchema, articleSchema } from "@/lib/jsonld";
import { METHODOLOGY_VERSION, METHODOLOGY_CHANGELOG, METHODOLOGY_URL } from "@/lib/methodology";
import { getPolygonVenueCount } from "@/lib/polygon-yield";

const TITLE = "Methodology: How Harvest Tracks DeFi Yields | Harvest";
const DESCRIPTION =
  "How Harvest tracks 150+ DeFi yield strategies across Ethereum, Base, Arbitrum and more. APY calculations, data sources, ranking rules, refresh cadence and the editorial guardrails behind the index.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: METHODOLOGY_URL,
    siteName: SITE_NAME,
    type: "article",
  },
  alternates: { canonical: METHODOLOGY_URL },
};

const SECTIONS = [
  { id: "scope", label: "What the index covers" },
  { id: "what-counts", label: "What counts as a yield source" },
  { id: "apy-calculation", label: "APY calculation" },
  { id: "tvl", label: "TVL measurement" },
  { id: "product-metrics", label: "Product page metrics" },
  { id: "data-freshness", label: "Data freshness" },
  { id: "ranking", label: "Ranking" },
  { id: "consistency", label: "Consistency scoring" },
  { id: "inclusion", label: "Inclusion criteria" },
  { id: "risk-framework", label: "Risk framework" },
  { id: "data-sources", label: "Data sources" },
  { id: "limitations", label: "Limitations" },
  { id: "versioning", label: "Versioning" },
  { id: "disclosure", label: "Disclosure" },
];

const RISK_ITEMS = [
  {
    name: "Smart-contract",
    desc: "A flaw in the vault contract or an integrated protocol contract leads to loss of deposited funds.",
  },
  {
    name: "Oracle",
    desc: "A manipulated or stale price feed leads to incorrect collateral valuation, triggering unintended liquidations or enabling an exploit.",
  },
  {
    name: "Liquidity",
    desc: "A user is unable to withdraw funds from a position at or near the expected value, due to illiquid markets or locked positions.",
  },
  {
    name: "Depeg",
    desc: "For stablecoin and wrapped-asset strategies: the underlying token loses its peg, permanently impairing the value of the deposit.",
  },
  {
    name: "Governance",
    desc: "A protocol's governance mechanism is exploited or manipulated to change contract parameters adversely for depositors.",
  },
];

const LIMITATIONS = [
  {
    title: "Hourly cadence, not real-time",
    desc: "APY and TVL figures reflect the state of the last hourly fetch. Intraday spikes or dips are not captured. Strategies with extremely volatile yields will not be accurately represented by our snapshot-based system.",
  },
  {
    title: "Reward token conversion is upstream",
    desc: "We do not perform our own USD valuation of reward tokens. If the Harvest API's pricing for a reward token is stale or inaccurate, the APY reported on this site reflects that inaccuracy.",
  },
  {
    title: "Risk levels are not quantitatively scored",
    desc: "This site does not publish per-strategy risk ratings or opinions. The risk dimensions listed in the Risk framework section describe the categories of risk present in DeFi vault strategies; they are informational only and do not constitute advice.",
  },
  {
    title: "Third-party coverage is limited to Polygon",
    desc: "As of v1.1 the index includes a small, curated set of third-party venues on Polygon under the criteria in the Inclusion section. Other networks remain Harvest-only, and most DeFi protocols and networks are not represented at all; this is a curated index, not a survey of DeFi.",
  },
  {
    title: "No lifetime APY figure",
    desc: "We do not publish a single annualized figure for the full tracked history of a strategy. Share-price growth since the indexer first observed the vault is shown instead, which is a more honest representation of compounded returns over time.",
  },
  {
    title: "Tracked-since date is not deployment date",
    desc: "The \"live since\" figure reflects when our indexer first observed data for a strategy, not when the vault was deployed on-chain. For strategies deployed before our indexer began tracking them, the figure understates the actual vault age.",
  },
];

function StructuredData({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function MethodologyPage() {
  const [allVaults, liveVaults] = await Promise.all([getVaults(), getLiveVaults()]);
  const polygonVenueCount = getPolygonVenueCount();

  const chains = new Set(liveVaults.map((v) => v.chain));
  const assets = new Set(liveVaults.map((v) => v.asset));
  const inactiveCount = allVaults.length - liveVaults.length;

  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Methodology" },
  ];

  const breadcrumb = breadcrumbSchema(crumbs);
  const article = articleSchema({
    title: TITLE,
    description: DESCRIPTION,
    url: METHODOLOGY_URL,
    datePublished: METHODOLOGY_VERSION.date,
    dateModified: METHODOLOGY_VERSION.date,
  });

  const versionDate = new Date(METHODOLOGY_VERSION.date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <StructuredData data={breadcrumb} />
      <StructuredData data={article} />

      <main className="methodology-page">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="meth-header">
          <nav className="meth-crumbs mono dim">
            <HomeCrumb />
            <span>›</span>
            <span>Methodology</span>
          </nav>

          <h1 className="meth-title">Methodology</h1>
          <p className="meth-subtitle">
            How we collect, calculate, and present DeFi yield data.
          </p>
          <p className="meth-version mono dim">
            v{METHODOLOGY_VERSION.version} · Updated {versionDate}
          </p>

          {/* Live coverage stats */}
          <div className="meth-stats" role="list">
            <div className="meth-stat" role="listitem">
              <span className="meth-stat-val">{liveVaults.length}</span>
              <span className="meth-stat-lbl">live strategies</span>
            </div>
            <div className="meth-stat meth-stat--dim" role="listitem">
              <span className="meth-stat-val">{inactiveCount}</span>
              <span className="meth-stat-lbl">inactive</span>
            </div>
            <div className="meth-stat" role="listitem">
              <span className="meth-stat-val">{chains.size}</span>
              <span className="meth-stat-lbl">networks</span>
            </div>
            <div className="meth-stat" role="listitem">
              <span className="meth-stat-val">{assets.size}</span>
              <span className="meth-stat-lbl">asset families</span>
            </div>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="meth-layout">
          {/* Sticky sidebar TOC */}
          <aside className="meth-toc" aria-label="Page sections">
            <p className="meth-toc-label mono">On this page</p>
            <ul className="meth-toc-list">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="meth-toc-link">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>

          <article className="meth-body">

            {/* ── 1. Scope ──────────────────────────────────── */}
            <section id="scope" className="meth-section">
              <h2 className="meth-h2">What the index covers</h2>

              <div className="meth-callout">
                {allVaults.length} strategies in this index are operated by Harvest.
                Since v1.1, the index also covers {polygonVenueCount} third-party
                venues on Polygon, listed separately and clearly labelled as
                third-party under the criteria in the{" "}
                <a href="#inclusion">Inclusion and exclusion criteria</a> section.
                This is not a neutral aggregator of all of DeFi - it is Harvest's
                own product catalog plus a small, curated set of external venues we
                do not operate. See the{" "}
                <a href="#disclosure">Disclosure</a> section for the full picture.
              </div>

              <p>
                Of the {allVaults.length} indexed strategies, {liveVaults.length} are
                live at the time of the last data refresh (positive APY and positive
                TVL), spread across {chains.size} networks and {assets.size} asset
                families ({Array.from(assets).join(", ")}). The remaining{" "}
                {inactiveCount} are inactive - their APY or TVL is zero at every
                fetch. Inactive strategies are removed from all ranked listings and
                hub pages. Their individual product pages remain accessible via
                direct URL but are not linked from any navigation. Historical data
                for inactive strategies is retained.
              </p>
            </section>

            {/* ── 2. What counts ────────────────────────────── */}
            <section id="what-counts" className="meth-section">
              <h2 className="meth-h2">What counts as a yield source</h2>
              <p>
                The index covers vault-based autocompounding strategies. A vault accepts
                a deposit of a single underlying token, deploys it into one or more
                yield-bearing positions, harvests rewards on an ongoing basis, swaps them
                back into the underlying token, and redeposits. The user holds a share
                token representing a pro-rata claim on the vault.
              </p>
              <p>
                Currently in scope: single-asset lending vaults (Aave, Morpho, Compound,
                and similar), liquidity-provider vaults for constant-function AMMs
                (Aerodrome, Uniswap v3, Curve), and hybrid vaults that layer lending with
                protocol incentives. All strategies denominate in one of the tracked asset
                families: USDC, USDT, ETH (and liquid-staked ETH variants), or BTC (and
                wrapped BTC variants).
              </p>
              <p>
                Not currently indexed: isolated lending markets where the supply token
                differs materially from the withdrawal token, strategies requiring active
                management by the depositor, native protocol staking without a vault
                wrapper, and any strategy without an audited smart contract or verifiable
                on-chain track record.
              </p>
            </section>

            {/* ── 3. APY calculation ────────────────────────── */}
            <section id="apy-calculation" className="meth-section">
              <h2 className="meth-h2">How APY is calculated</h2>
              <p>
                The 24H APY displayed on hub and product pages is the arithmetic mean of
                all <code>apyAutoCompound</code> records returned by Harvest's indexer
                subgraph for timestamps within the past 24 hours. The subgraph can emit
                multiple records per hour depending on vault activity; the number of data
                points in any 24-hour window varies by chain and protocol. If no records
                exist within the window, the system falls back to the most recent valid
                APY observation on record. APY is expressed as an annualized percentage.
              </p>
              <p>
                The 30-day APY is the arithmetic mean of all valid <code>apyAutoCompound</code>{" "}
                subgraph records from the last 30 days. It is not time-weighted and does
                not account for compounding within the window. Its purpose is to smooth
                out single-day spikes.
              </p>
              <p>
                APY values in the subgraph originate from Harvest's on-chain strategy
                contracts, which derive them from the estimated yield rate of the
                underlying protocol positions. For strategies where reward tokens
                contribute to yield (such as AERO or CRV emissions), those reward
                streams are included at the rate computed by Harvest's backend, which
                converts reward token quantities to USD using its own pricing
                infrastructure. We do not independently perform this conversion; see{" "}
                <a href="#data-sources">Data sources</a> for detail on upstream pricing.
                Reward token contributions are shown separately in the Yield Sources
                panel on each product page.
              </p>
              <p>
                There is no lifetime APY figure in the index. Annualizing returns over
                multi-year periods conflates compounding periods with different market
                conditions. Lifetime share-price growth is shown instead as a less
                misleading long-term signal.
              </p>

              <h3 className="meth-h3">Yield Sources panel</h3>
              <p>
                The Yield Sources panel on each product page breaks down the total APY
                into its contributing streams. Each row corresponds to one entry in
                the Harvest API's <code>estimatedApyBreakdown</code> array, labeled
                by the corresponding token symbol from <code>apyTokenSymbols</code>
                (e.g., "USDC" for the base lending rate, "AERO" for protocol incentives).
                A "Compounding boost" row appears when <code>boostedEstimatedAPY</code>{" "}
                is non-zero; it represents additional yield from the autocompounding
                mechanic itself. The sum of all rows equals the total reported APY
                for that strategy.
              </p>
            </section>

            {/* ── 4. TVL ────────────────────────────────────── */}
            <section id="tvl" className="meth-section">
              <h2 className="meth-h2">How TVL is measured</h2>
              <p>
                Total Value Locked (TVL) is the USD value of all assets deposited in a
                given vault. The figure is taken directly from the{" "}
                <code>totalValueLocked</code> field returned by the Harvest API; it is
                not independently recomputed from on-chain reads. The API derives TVL
                from the vault's <code>underlyingBalanceWithInvestment</code> multiplied
                by the underlying token's USD price at the time of the snapshot.
              </p>
              <p>
                TVL shown on hub pages is the sum of individual vault TVL figures within
                that hub's scope. It is not deduplicated. In practice, the strategies
                currently indexed are single-level, so double-counting is not a material
                concern.
              </p>
            </section>

            {/* ── 5. Product page metrics ───────────────────── */}
            <section id="product-metrics" className="meth-section">
              <h2 className="meth-h2">Product page metrics</h2>
              <p>
                The following metrics appear on individual product pages and are not
                covered elsewhere in this methodology.
              </p>

              <h3 className="meth-h3">Share price</h3>
              <p>
                Share price is the redemption rate of one vault share in terms of the
                underlying token. It is sourced from the Harvest API's{" "}
                <code>pricePerFullShare</code> field and normalized for the vault's
                token decimals. When a vault launches, share price is typically 1.0.
                It increases monotonically as the vault harvests rewards, swaps them
                back into the underlying token, and compounds. Share price does not
                decrease in normal operation; a falling share price would indicate
                a loss event.
              </p>
              <p>
                The "% since inception" figure shown below the share price is computed
                from the history record as{" "}
                <code>(latest - earliest) / earliest × 100</code>, where earliest and
                latest are the first and last <code>sharePriceHistory</code> entries
                returned by the subgraph for that vault. This reflects growth since
                our indexer first observed the strategy, not necessarily since the
                vault's on-chain deployment date.
              </p>

              <h3 className="meth-h3">Best day and worst day</h3>
              <p>
                The Historical statistics table on each product page shows "Best day"
                and "Worst day" for both APY and TVL. These refer to the single
                calendar day within the displayed 30-day window with the highest and
                lowest recorded value, respectively. They are single data points from
                the subgraph history, not aggregated daily averages. The date shown
                alongside each value is the timestamp of that subgraph record.
              </p>

              <h3 className="meth-h3">Market benchmarking rank</h3>
              <p>
                The market benchmarking section on each product page shows a rank such
                as "#3 of 28 tracked USDC strategies." The cohort for this ranking is
                all strategies in the index with the same underlying asset (USDC, ETH,
                BTC, or USDT) that have a positive 24H APY at the time of the last
                data refresh. The rank is determined by 24H APY in descending order.
                The cohort size changes when strategies become active or inactive
                between fetches.
              </p>
              <p>
                The "X% higher than the average" comparison is against the arithmetic
                mean of the same cohort. The cohort average is computed at fetch time
                and is not smoothed or time-weighted.
              </p>
            </section>

            {/* ── 6. Data freshness ─────────────────────────── */}
            <section id="data-freshness" className="meth-section">
              <h2 className="meth-h2">Data freshness and update cadence</h2>
              <p>
                Strategy data is refetched from the Harvest API once per hour via an
                automated process (cron: <code>0 * * * *</code>). Historical APY, TVL,
                and share-price data is updated each hour for all indexed strategies.
                After each fetch, the site's static HTML is rebuilt and redeployed. A
                visitor may therefore see data that is up to approximately one hour old.
              </p>
              <p>
                There is no real-time streaming of on-chain data. APY and TVL figures will
                not change between rebuilds, even if the underlying on-chain state changes.
              </p>
              <p>
                The "Tracked for X days" figure on each product page is derived from the
                earliest timestamp in the strategy's APY history record - the first time
                our indexer observed a data point for that vault. It is not the vault's
                deployment date.
              </p>
            </section>

            {/* ── 7. Ranking ────────────────────────────────── */}
            <section id="ranking" className="meth-section">
              <h2 className="meth-h2">Ranking methodology</h2>
              <p>
                Strategies are ranked by 24-hour APY in descending order on all hub pages
                (the homepage, asset hubs, and network hubs). This is the default and
                currently the only ranking mode applied when a page loads.
              </p>
              <p>
                There is no risk weighting, no minimum TVL threshold, and no age filter
                built into the default ranking. Users can sort by 30-day APY, TVL, or
                momentum (24-hour APY minus 30-day APY) using the sort controls on each
                hub page. Momentum signals whether a strategy is currently running above
                or below its recent average.
              </p>
              <p>
                Strategies with zero APY or zero TVL are excluded from ranked listings
                entirely, regardless of the API <code>inactive</code> flag.
              </p>
            </section>

            {/* ── 8. Consistency scoring ────────────────────── */}
            <section id="consistency" className="meth-section">
              <h2 className="meth-h2">Volatility and consistency scoring</h2>
              <p>
                Each product page shows an APY Consistency score from 0 to 100. It is
                derived from the coefficient of variation (CV) of the strategy's daily
                APY observations over the last 30 days. CV is the standard deviation
                divided by the mean - a dimensionless measure of relative variability.
                The window is anchored to the latest available data point, not the
                current date, so the score remains meaningful even when the subgraph
                has not emitted new rows recently.
              </p>

              <div className="meth-table-wrap">
                <table className="meth-table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>CV threshold</th>
                      <th>Score range</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Very Consistent</td><td className="mono">CV &lt; 0.10</td><td className="mono">90 - 100</td></tr>
                    <tr><td>Consistent</td><td className="mono">CV &lt; 0.20</td><td className="mono">70 - 89</td></tr>
                    <tr><td>Variable</td><td className="mono">CV &lt; 0.40</td><td className="mono">40 - 69</td></tr>
                    <tr><td>Highly Variable</td><td className="mono">CV &ge; 0.40</td><td className="mono">0 - 39</td></tr>
                  </tbody>
                </table>
              </div>

              <p>
                A minimum of 5 data points within the 30-day window is required to
                produce a score. Strategies below this threshold show a dash.
              </p>
              <p>
                A separate stability label (very consistent / consistent / moderate /
                volatile) appears in the 30-day APY sub-label on the hero panel. This
                uses raw standard deviation with fixed thresholds (0.5 / 1.5 / 3
                percentage points). The consistency score is the primary, more nuanced
                figure.
              </p>
            </section>

            {/* ── 9. Inclusion ──────────────────────────────── */}
            <section id="inclusion" className="meth-section">
              <h2 className="meth-h2">Inclusion and exclusion criteria</h2>
              <p>
                Inclusion is currently editorial and discretionary. The index covers
                strategies operated by Harvest that pass two automated conditions:
                the operator API must not flag the strategy as <code>inactive</code>,
                and the strategy must have a positive APY and a positive TVL at the time
                of the last fetch. There is no minimum TVL threshold and no minimum age
                requirement.
              </p>
              <p>
                Strategies are excluded when: (a) the operator flags them as inactive,
                (b) their reported APY or TVL is zero or negative at every fetch for an
                extended period, or (c) they do not match any of the tracked asset families.
                Exclusion is automated; no manual review step currently exists.
              </p>
              <p>
                As of v1.1, third-party (non-Harvest-operated) venues may be included
                on a per-network basis once a network has this section's criteria
                published for it. A venue must meet all of the following:
              </p>
              <ul className="meth-limit-list">
                <li>
                  <b>Rate verifiable on-chain.</b> Preferred inclusion is a venue whose
                  rate we read directly from its own public contract state (e.g. a
                  lending pool's <code>getReserveData</code>), the same standard applied
                  to Harvest's own strategies. A venue without a directly readable rate
                  may still be included with a rate sourced from a labelled third-party
                  API (currently Portals), disclosed per row as such and never presented
                  as an on-chain read.
                </li>
                <li>
                  <b>Minimum $500,000 in tracked deposits</b> at the time of inclusion,
                  read from the venue's own contract (or its issuer's reported figure for
                  tokenized funds without on-chain TVL).
                </li>
                <li>
                  <b>Permissionless or a regulated, named issuer.</b> Included venues are
                  either permissionless smart contracts (e.g. Aave, Morpho) or tokenized
                  funds with a named, regulated issuer (e.g. BlackRock, Hamilton Lane,
                  Apollo, via Securitize). Anonymous-team or unaudited farms are excluded
                  regardless of TVL or rate.
                </li>
                <li>
                  <b>No payment for inclusion or ranking.</b> Third-party venues do not
                  pay to be listed and cannot pay to rank higher; ranking is sorted
                  solely by rate, identically to Harvest's own strategies. See{" "}
                  <a href="#disclosure">Disclosure</a>.
                </li>
                <li>
                  <b>Clearly labelled as third-party.</b> Every third-party row and page
                  discloses its operator, is never described as a Harvest product, and
                  links out through an interstitial rather than embedding the venue's
                  flow.
                </li>
              </ul>
              <p>
                First applied to Polygon ({polygonVenueCount} venues at publication:
                Aave v3, Morpho, and the Securitize-tokenized BlackRock BUIDL, Hamilton
                Lane SCOPE and Apollo Diversified Credit funds). Extending these
                criteria to additional networks will itself be logged as a methodology
                version, per <a href="#versioning">Methodology versioning</a>.
              </p>
            </section>

            {/* ── 10. Risk framework ────────────────────────── */}
            <section id="risk-framework" className="meth-section">
              <h2 className="meth-h2">Risk framework</h2>
              <p>
                This site does not publish per-strategy risk ratings or opinions. The
                five dimensions below describe the categories of risk present in DeFi
                vault strategies generally. They are informational context only and do
                not constitute financial or investment advice. For any strategy's specific
                risk profile, consult the operator's own documentation, audit reports,
                and on-chain contract history.
              </p>

              <ul className="meth-risk-list">
                {RISK_ITEMS.map((r) => (
                  <li key={r.name} className="meth-risk-item">
                    <span className="meth-risk-name mono">{r.name}</span>
                    <span className="meth-risk-desc">{r.desc}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── 11. Data sources ──────────────────────────── */}
            <section id="data-sources" className="meth-section">
              <h2 className="meth-h2">Data sources</h2>
              <p>
                Strategy metadata - vault addresses, token names, platform names, estimated
                APY, TVL, APY breakdown by source, and reward token information - is sourced
                from the Harvest API at{" "}
                <a
                  href="https://api.harvest.finance/vaults"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="meth-link"
                >
                  api.harvest.finance/vaults
                </a>
                . This API is operated by Harvest and reflects the state of
                the protocols as read by their backend infrastructure.
              </p>
              <p>
                Reward token APY contributions (e.g., AERO, CRV) are converted to USD
                by the Harvest API using its own pricing infrastructure. The
                specific price sources used - whether DEX quotes, on-chain oracles, or
                third-party price feeds - are maintained by Harvest and are not
                separately documented in the API's public reference. If a price source
                is stale or inaccurate, the APY reported on this site will reflect that
                inaccuracy.
              </p>
              <p>
                Historical time-series data (daily APY, TVL, share price) is sourced
                from Harvest's hosted indexer subgraph, queried via GraphQL per vault
                address. Up to 500 records per 30-day window are returned per series.
                For the full history view on product pages, up to 1,000 records are
                requested per series. Records are not deduplicated to one per day
                server-side; multiple records per day are averaged or taken as-is
                depending on the metric.
              </p>
              <p>
                For Harvest-operated strategies, all data originates from Harvest's own
                API and subgraph; data accuracy on those pages is directly dependent on
                the accuracy of those upstream sources.
              </p>
              <p>
                Third-party venues (see <a href="#inclusion">Inclusion and exclusion
                criteria</a>) are priced differently, deliberately not through Harvest's
                API: rates are read directly from each venue's own public contract state
                over standard JSON-RPC, the same class of infrastructure the venues'
                own front ends use, with a labelled third-party API (Portals) used only
                as a fallback where no such contract read exists, and disclosed per row
                when it is. This is closer to the site's own on-chain-first practice
                elsewhere (see the XRP and Aerodrome reports) than to a DeFiLlama-style
                aggregation: no third-party yield-aggregator feed is used as the primary
                rate for any listing on this site.
              </p>
            </section>

            {/* ── 12. Limitations ───────────────────────────── */}
            <section id="limitations" className="meth-section">
              <h2 className="meth-h2">Limitations and known gaps</h2>

              <ul className="meth-limit-list">
                {LIMITATIONS.map((l, i) => (
                  <li key={i} className="meth-limit-item">
                    <span className="meth-limit-num mono">{String(i + 1).padStart(2, "0")}</span>
                    <span className="meth-limit-body">
                      <b className="meth-limit-title">{l.title}</b>
                      <span className="meth-limit-desc">{l.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── 13. Versioning ────────────────────────────── */}
            <section id="versioning" className="meth-section">
              <h2 className="meth-h2">Methodology versioning</h2>
              <p>
                This methodology is versioned. Each meaningful change to how data is
                collected, calculated, or presented will be logged here. Hourly data
                refreshes are not methodology changes and are not logged. Future version
                entries will note: (a) what changed, (b) why the change was made, and
                (c) how it affects historical comparisons or displayed figures.
              </p>

              <div className="meth-table-wrap">
                <table className="meth-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Date</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METHODOLOGY_CHANGELOG.map((entry) => (
                      <tr key={entry.version}>
                        <td className="mono">{entry.version}</td>
                        <td className="mono">{entry.date}</td>
                        <td>{entry.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── 14. Disclosure ────────────────────────────── */}
            <section id="disclosure" className="meth-section">
              <h2 className="meth-h2">Disclosure</h2>

              <div className="meth-disclosure">
                <p>
                  Harvest operates {allVaults.length} of the strategies listed in this
                  index. Since v1.1, {polygonVenueCount} additional listings on Polygon
                  are third-party venues Harvest does not operate, control, or take
                  custody through; those rows and their pages are labelled as
                  third-party and link out through an interstitial rather than any
                  Harvest product flow. This is still not a neutral aggregator of all of
                  DeFi - it is Harvest's own product catalog plus a small, named,
                  criteria-gated set of external venues, not a survey of the market.
                  Readers and journalists should interpret ranked listings accordingly.
                </p>
                <p>
                  Listing position and ranking are determined solely by rate (or the
                  sort order selected by the user); operator status does not influence
                  ranking, and the same rate-first ranking methodology applies equally to
                  Harvest and third-party rows on the same page.
                </p>
                <p>
                  This site does not accept payment for inclusion or for a higher
                  ranking, from Harvest or third-party venues alike. Outbound links to
                  third-party venues carry a <code>ref=harvest.finance</code> attribution
                  parameter so those platforms can attribute the traffic; this is not a
                  paid referral or affiliate arrangement. If a paid referral or affiliate
                  arrangement is introduced for any listing in the future, it will be
                  disclosed inline on the relevant page and in this section.
                </p>
              </div>
            </section>

          </article>
        </div>
      </main>
    </>
  );
}
