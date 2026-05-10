// Shared body for network hub pages (/ethereum, /base, /arbitrum,
// /polygon, /zksync, /hyperevm). Same boxed Sunflower Gold layout as
// the asset hubs, parameterised by chain instead of asset.

import Link from "next/link";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { ChainIcon } from "@/components/token-icons";
import { formatAPY, formatTVL, stripChainSuffix } from "@/lib/format";
import { SITE_URL } from "@/lib/constants";
import { networkHubH1, networkHubCrumbs } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/jsonld";
import { NETWORK_BLURBS, NETWORKS } from "@/lib/networks";
import { HubTable } from "@/components/hub-table";

interface Props {
  networkSlug: string;
  networkDisplay: string;
  chain: string;
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

export async function NetworkHubBody({
  networkSlug,
  networkDisplay,
  chain,
}: Props) {
  const allVaults = await getLiveVaults();
  const sparklines = await getAllSparklines();
  const vaults = allVaults
    .filter((v) => v.chain === chain)
    .sort((a, b) => b.apy24h - a.apy24h);

  const bestApy = vaults.reduce((b, v) => (v.apy24h > b ? v.apy24h : b), 0);
  const avgApy =
    vaults.length > 0
      ? vaults.reduce((s, v) => s + v.apy24h, 0) / vaults.length
      : 0;

  // Cohort statistics
  const sortedApys = [...vaults].map((v) => v.apy24h).sort((a, b) => a - b);
  const medianApy =
    sortedApys.length > 0
      ? sortedApys[Math.floor(sortedApys.length / 2)]
      : 0;
  const minApy = sortedApys.length > 0 ? sortedApys[0] : 0;
  const totalTvl = vaults.reduce((s, v) => s + v.tvl, 0);

  // Asset breakdown for this network
  const assetStats = Object.values(
    vaults.reduce<Record<string, { asset: string; count: number; tvl: number; bestApy: number }>>(
      (acc, v) => {
        const cur = acc[v.asset] ?? { asset: v.asset, count: 0, tvl: 0, bestApy: 0 };
        cur.count += 1;
        cur.tvl += v.tvl;
        if (v.apy24h > cur.bestApy) cur.bestApy = v.apy24h;
        acc[v.asset] = cur;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.count - a.count);

  // Top protocol families
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

  const assetBlockText = buildBlock(assetStats, (a) =>
    `${a.asset} (${a.count} ${a.count === 1 ? "vault" : "vaults"}, top APY ${formatAPY(a.bestApy)})`,
  );
  const protoBlockText = buildBlock(topProtocols, (p) =>
    `${p.protocol} (${p.count})`,
  );

  // Other networks present in the index, by TVL, excluding self
  const networkTvls = new Map<string, number>();
  for (const v of allVaults) {
    networkTvls.set(v.chain, (networkTvls.get(v.chain) ?? 0) + v.tvl);
  }
  const relatedNetworks = NETWORKS.filter(
    (n) => n.slug !== networkSlug && (networkTvls.get(n.chain) ?? 0) > 0,
  )
    .sort(
      (a, b) => (networkTvls.get(b.chain) ?? 0) - (networkTvls.get(a.chain) ?? 0),
    )
    .slice(0, 6);

  const blurb = NETWORK_BLURBS[networkDisplay] ?? "";
  const crumbs = networkHubCrumbs(networkDisplay);
  const hubUrl = `${SITE_URL}/${networkSlug}`;

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
        <span className="uni-hub-crumbs-current">{networkDisplay} Yields</span>
      </nav>

      {/* Hero */}
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <span className="uni-hub-hero-icon" aria-hidden="true">
            <ChainIcon chain={chain} size={54} priority />
          </span>
          <div>
            <h1 className="uni-hub-h1">{networkHubH1(networkDisplay)}</h1>
            <p className="uni-hub-sub">
              {vaults.length > 0
                ? `Live ranking of ${vaults.length} yield strategies on ${networkDisplay}, spanning ${assetStats.length} ${assetStats.length === 1 ? "asset" : "assets"}.`
                : `${networkDisplay} yield strategies are populating, check back shortly.`}
            </p>
          </div>
        </div>

        <div className="uni-hub-stats" role="group" aria-label={`${networkDisplay} index headline stats`}>
          <div className="uni-hub-stat">
            <div
              className="uni-hub-stat-label"
              data-tooltip={`Highest 24-hour APY across the ${networkDisplay} strategies in our index.`}
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
              data-tooltip={`Mean 24-hour APY across the ${networkDisplay} strategies in our index.`}
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
            Top {networkDisplay} yields
          </h2>
          <span className="uni-hub-section-meta">
            Tracking {vaults.length} {vaults.length !== 1 ? "vaults" : "vault"}
            {assetStats.length > 0 ? `, ${assetStats.length} ${assetStats.length !== 1 ? "assets" : "asset"}` : ""}
          </span>
        </header>

        {vaults.length === 0 ? (
          <div className="uni-hub-empty">No {networkDisplay} strategies indexed yet.</div>
        ) : (
          <HubTable
            vaults={vaults}
            sparklines={sparklines}
            showAssetFilter
            scopeLabel={`${networkDisplay} strategies`}
          />
        )}
      </section>

      {/* SEO content section */}
      {vaults.length > 0 && (
        <section className="uni-hub-content" aria-labelledby="about-network">
          <header className="uni-hub-content-head">
            <h2 id="about-network">About yield on {networkDisplay}</h2>
            <p className="uni-hub-content-lede">
              {blurb} Every row below is one of the strategies we
              currently track on {networkDisplay}, with APY and TVL
              read straight off the source contracts.
            </p>
          </header>

          <div className="uni-hub-content-grid">
            <article>
              <h3>The cohort, in numbers</h3>
              <p>
                Right now we track {vaults.length} {networkDisplay}
                {" "}{vaults.length !== 1 ? "strategies" : "strategy"},
                holding {formatTVL(totalTvl)} in deposits. 24-hour
                APYs run from {formatAPY(minApy)} to {formatAPY(bestApy)}.
                Median {formatAPY(medianApy)}, mean{" "}
                {formatAPY(avgApy)}. Numbers are scoped to our index,
                not the wider {networkDisplay} market.
              </p>
            </article>

            <article>
              <h3>Assets we cover on {networkDisplay}</h3>
              <p>
                {assetBlockText}. Stablecoins dominate the count on
                most chains; ETH-pegged tokens and wrapped BTC fill in
                the rest. Open any vault to see the exact deposit
                token and reward stream.
              </p>
            </article>

            <article>
              <h3>Protocol families on the leaderboard</h3>
              <p>
                Top families: {protoBlockText}. Most rows are either a
                single-asset money market or an autocompounder
                wrapping one. Each protocol publishes the same APY
                upstream that we surface in the table; per-vault
                breakdowns live on the product detail page.
              </p>
            </article>

            <article>
              <h3>Reading the APY columns</h3>
              <p>
                24-hour APY: today&apos;s annualised rate. 30-day APY:
                trailing mean across the last month. The sparkline
                draws the same series at small scale so a flat line
                reads as stable and spikes mean volatile. Past APY
                does not promise future APY.
              </p>
            </article>

            <article>
              <h3>Reading the TVL column</h3>
              <p>
                TVL is the dollar value of deposits sitting in the
                vault contract. The {vaults.length} vaults on this
                page hold {formatTVL(totalTvl)} between them. Higher
                TVL usually means the strategy has been live longer
                and absorbed more capital without breaking. Lower TVL
                is either young, niche, or a sign the APY no longer
                compensates for the risk.
              </p>
            </article>

            <article>
              <h3>Risk surfaces on every {networkDisplay} strategy</h3>
              <p>
                Smart-contract risk on the vault and the protocol
                underneath. Oracle risk on the price feeds those
                contracts trust. Bridge or depeg risk on the deposit
                token. Governance risk on every parameter operators
                can change. The same protocol can carry different
                risks on different chains. Tiers and what we leave out,
                on the{" "}
                <Link href="/risk-framework">risk framework page</Link>.
              </p>
            </article>

            <article>
              <h3>What this page is, and what it is not</h3>
              <p>
                A curated {networkDisplay} index. Not a survey of every
                yield source on the chain. We add strategies as we vet
                and integrate them; we drop them when products retire
                or fall outside our framework. Inclusion criteria and
                ranking logic are documented on the{" "}
                <Link href="/methodology">methodology page</Link>.
              </p>
            </article>

            <article>
              <h3>Frequently asked questions</h3>
              <dl className="uni-hub-faq">
                <dt>What is the best yield on {networkDisplay} right now?</dt>
                <dd>
                  Across the {vaults.length}{" "}
                  {vaults.length !== 1 ? "strategies" : "strategy"}{" "}
                  we currently index on {networkDisplay},{" "}
                  {bestApy > 0 ? formatAPY(bestApy) : "the headline rate"}{" "}
                  is the highest 24-hour APY. The table above is sorted
                  by APY by default and reflects the most recent build.
                </dd>
                <dt>How is yield generated on {networkDisplay}?</dt>
                <dd>
                  Same mechanisms as elsewhere in DeFi: lending
                  markets, autocompounders, liquidity provision, and
                  reward emissions. Each strategy in our index
                  documents its source on its product page.
                </dd>
                <dt>What assets can I earn yield on via {networkDisplay}?</dt>
                <dd>
                  {assetStats.length > 0
                    ? `Strategies in our ${networkDisplay} cohort accept ${assetStats.map((a) => a.asset).join(", ")}.`
                    : `${networkDisplay} coverage is populating.`}{" "}
                  Each product page lists the underlying asset and any
                  reward tokens.
                </dd>
                <dt>How does {networkDisplay} compare to other networks?</dt>
                <dd>
                  Comparisons across networks are most meaningful when
                  controlled for asset (USDC on {networkDisplay} versus
                  USDC on Ethereum, for example), because asset-specific
                  markets dominate the rate. The asset hub pages cut
                  the same data the other way.
                </dd>
              </dl>
            </article>
          </div>
        </section>
      )}

      {/* Bottom rail: bridge to other networks */}
      {relatedNetworks.length > 0 && (
        <section className="uni-hub-cta-row">
          <p className="uni-hub-cta-meta">
            Looking for yield on a different chain? These are the next
            networks by tracked TVL.
          </p>
          <div className="uni-hub-cta-links">
            {relatedNetworks.map((n) => (
              <Link key={n.slug} href={`/${n.slug}`} className="uni-hub-cta-pill">
                <ChainIcon chain={n.chain} size={14} />
                {n.display}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
