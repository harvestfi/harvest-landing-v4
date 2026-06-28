// Shared body for platform (venue) hub pages (/aave, /morpho, ...). Same
// boxed Sunflower Gold layout as the network and asset hubs, parameterised
// by venue instead of chain or token: it lists every Harvest-indexed
// strategy routing into one platform, across all assets and networks, in a
// single homepage-style ranking.

import Link from "next/link";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { ChainIcon } from "@/components/token-icons";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_URL } from "@/lib/constants";
import { platformHubH1, platformHubCrumbs } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/jsonld";
import { NETWORKS } from "@/lib/networks";
import { getPlatform, platformVaults, PLATFORMS } from "@/lib/platforms";
import { HubTable } from "@/components/hub-table";
import { RankingDataNote } from "@/components/ranking-data-note";
import { HomeCrumb } from "@/components/home-crumb";

interface Props {
  platformSlug: string;
  // Slugs of OTHER platform hubs that have a live route, for the bottom rail.
  livePlatformSlugs: string[];
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

export async function PlatformHubBody({ platformSlug, livePlatformSlugs }: Props) {
  const platform = getPlatform(platformSlug);
  if (!platform) {
    // Should never happen — routes are 1:1 with the registry — but render a
    // minimal shell rather than throwing during static export.
    return <div className="uni-hub-test" />;
  }

  const allVaults = await getLiveVaults();
  const sparklines = await getAllSparklines();
  const vaults = platformVaults(allVaults, platform).sort(
    (a, b) => b.apy24h - a.apy24h,
  );

  const bestApy = vaults.reduce((b, v) => (v.apy24h > b ? v.apy24h : b), 0);
  const avgApy =
    vaults.length > 0
      ? vaults.reduce((s, v) => s + v.apy24h, 0) / vaults.length
      : 0;
  const sortedApys = [...vaults].map((v) => v.apy24h).sort((a, b) => a - b);
  const medianApy =
    sortedApys.length > 0 ? sortedApys[Math.floor(sortedApys.length / 2)] : 0;
  const minApy = sortedApys.length > 0 ? sortedApys[0] : 0;
  const totalTvl = vaults.reduce((s, v) => s + v.tvl, 0);

  // Asset breakdown across this platform.
  const assetStats = Object.values(
    vaults.reduce<
      Record<string, { asset: string; count: number; tvl: number; bestApy: number }>
    >((acc, v) => {
      const cur = acc[v.asset] ?? { asset: v.asset, count: 0, tvl: 0, bestApy: 0 };
      cur.count += 1;
      cur.tvl += v.tvl;
      if (v.apy24h > cur.bestApy) cur.bestApy = v.apy24h;
      acc[v.asset] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  // Network breakdown (a platform spans chains — this is the axis the
  // network hubs cut the other way).
  const chainStats = Object.values(
    vaults.reduce<Record<string, { chain: string; count: number }>>((acc, v) => {
      const cur = acc[v.chain] ?? { chain: v.chain, count: 0 };
      cur.count += 1;
      acc[v.chain] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);

  const assetBlockText = buildBlock(
    assetStats,
    (a) =>
      `${a.asset} (${a.count} ${a.count === 1 ? "vault" : "vaults"}, top APY ${formatAPY(a.bestApy)})`,
  );
  const chainBlockText = buildBlock(
    chainStats,
    (c) => `${c.chain} (${c.count})`,
  );

  const crumbs = platformHubCrumbs(platform.display);
  const hubUrl = `${SITE_URL}/${platformSlug}`;

  // Bottom rail: other live platform hubs, then the network hubs present in
  // this cohort so the page is not a dead end.
  const otherPlatforms = PLATFORMS.filter(
    (p) => p.slug !== platformSlug && livePlatformSlugs.includes(p.slug),
  );
  const relatedNetworks = NETWORKS.filter((n) =>
    chainStats.some((c) => c.chain === n.chain),
  );

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
        <HomeCrumb />
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <span className="uni-hub-crumbs-current">{platform.display} Ranking</span>
      </nav>

      {/* Hero */}
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <span className="uni-hub-hero-icon" aria-hidden="true">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 54,
                height: 54,
                borderRadius: 14,
                background: "#f6c244",
                color: "#161616",
                fontFamily: "var(--sans)",
                fontWeight: 800,
                fontSize: 28,
                letterSpacing: "-0.02em",
              }}
            >
              {platform.display.charAt(0)}
            </span>
          </span>
          <div>
            <h1 className="uni-hub-h1">{platformHubH1(platform.display)}</h1>
            <p className="uni-hub-sub">
              {vaults.length > 0
                ? `Live ranking of all ${vaults.length} ${platform.display} strategies Harvest indexes, across ${assetStats.length} ${assetStats.length === 1 ? "asset" : "assets"} and ${chainStats.length} ${chainStats.length === 1 ? "network" : "networks"}.`
                : `${platform.display} strategies are populating, check back shortly.`}
            </p>
          </div>
        </div>

        <div className="uni-hub-stats" role="group" aria-label={`${platform.display} index headline stats`}>
          <div className="uni-hub-stat">
            <div
              className="uni-hub-stat-label"
              data-tooltip={`Highest 24-hour APY across the ${platform.display} strategies in our index.`}
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
              data-tooltip={`Mean 24-hour APY across the ${platform.display} strategies in our index.`}
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
            Top {platform.display} yields
          </h2>
        </header>

        {vaults.length === 0 ? (
          <div className="uni-hub-empty">No {platform.display} strategies indexed yet.</div>
        ) : (
          <HubTable
            vaults={vaults}
            sparklines={sparklines}
            showAssetFilter
            scopeLabel={`${platform.display} strategies`}
          />
        )}
      </section>

      {/* SEO content section */}
      {vaults.length > 0 && (
        <section className="uni-hub-content" aria-labelledby="about-platform">
          <header className="uni-hub-content-head">
            <h2 id="about-platform">About {platform.display} yield on Harvest</h2>
            <p className="uni-hub-content-lede">
              {platform.blurb} Every row below is a {platform.display}{" "}
              strategy we currently track, with APY and TVL read straight
              off the source contracts.
            </p>
          </header>

          <div className="uni-hub-content-grid">
            <article>
              <h3>The cohort, in numbers</h3>
              <p>
                Right now we track {vaults.length} {platform.display}{" "}
                {vaults.length !== 1 ? "strategies" : "strategy"}, holding{" "}
                {formatTVL(totalTvl)} in deposits. 24-hour APYs run from{" "}
                {formatAPY(minApy)} to {formatAPY(bestApy)}. Median{" "}
                {formatAPY(medianApy)}, mean {formatAPY(avgApy)}. Numbers are
                scoped to our index, not the wider {platform.display} market.
              </p>
            </article>

            <article>
              <h3>Assets you can earn on via {platform.display}</h3>
              <p>
                {assetBlockText}. Open any vault to see the exact deposit
                token and reward stream. The asset hub pages cut this same
                data by token across every venue.
              </p>
            </article>

            <article>
              <h3>Networks {platform.display} runs on</h3>
              <p>
                Across the index, {platform.display} strategies span{" "}
                {chainBlockText}. The same venue can carry a different rate
                on each chain, because each chain&apos;s market sets its own
                supply and demand. The network hub pages rank every venue on
                a single chain side by side.
              </p>
            </article>

            <article>
              <h3>How the {platform.display} strategy works</h3>
              <p>
                Each vault deposits into {platform.display} and
                autocompounds: interest (and any reward tokens) are
                periodically harvested and reinvested into the same
                position, so the balance grows without manual claiming or
                restaking. The headline APY already reflects that
                compounding. The exact mechanics live on each product page.
              </p>
            </article>

            <article>
              <h3>Reading the APY columns</h3>
              <p>
                24-hour APY: today&apos;s annualised rate. 30-day APY:
                trailing mean across the last month. The sparkline draws the
                same series at small scale, so a flat line reads as stable
                and spikes mean volatile. Past APY does not promise future
                APY.
              </p>
            </article>

            <article>
              <h3>Risk surfaces on every {platform.display} strategy</h3>
              <p>
                Smart-contract risk on the Harvest vault and on{" "}
                {platform.display} underneath. Oracle risk on the price feeds
                those contracts trust. Bridge or depeg risk on the deposit
                token. Governance risk on every parameter operators can
                change. The same venue can carry different risks on different
                chains. Tiers and what we leave out, on the{" "}
                <Link href="/risk-framework">risk framework page</Link>.
              </p>
            </article>

            <article>
              <h3>What this page is, and what it is not</h3>
              <p>
                A curated index of the {platform.display} strategies Harvest
                integrates. Not a survey of every market on {platform.display}.
                We add strategies as we vet and integrate them; we drop them
                when products retire or fall outside our framework. Inclusion
                criteria and ranking logic are on the{" "}
                <Link href="/methodology">methodology page</Link>.
              </p>
            </article>

            <article>
              <h3>Frequently asked questions</h3>
              <dl className="uni-hub-faq">
                <dt>What is the best {platform.display} yield right now?</dt>
                <dd>
                  Across the {vaults.length}{" "}
                  {vaults.length !== 1 ? "strategies" : "strategy"} we
                  currently index on {platform.display},{" "}
                  {bestApy > 0 ? formatAPY(bestApy) : "the headline rate"} is
                  the highest 24-hour APY. The table above is sorted by APY by
                  default and reflects the most recent build.
                </dd>
                <dt>How does Harvest&apos;s {platform.display} strategy work?</dt>
                <dd>
                  Each vault deposits into {platform.display} and continuously
                  reinvests the interest and rewards back into the position
                  (autocompounding), so you do not have to claim or restake
                  manually.
                </dd>
                <dt>
                  Which assets and networks can I earn {platform.display} yield
                  on?
                </dt>
                <dd>
                  {assetStats.length > 0
                    ? `Our ${platform.display} cohort accepts ${assetStats.map((a) => a.asset).join(", ")} across ${chainStats.map((c) => c.chain).join(", ")}.`
                    : `${platform.display} coverage is populating.`}{" "}
                  Each product page lists the underlying asset, network and
                  any reward tokens.
                </dd>
                <dt>Is {platform.display} yield safe?</dt>
                <dd>
                  No yield is risk-free. {platform.display} strategies carry
                  smart-contract, oracle, deposit-token and governance risk,
                  which can differ by chain. See the{" "}
                  <Link href="/risk-framework">risk framework</Link> for how
                  we think about each surface.
                </dd>
              </dl>
            </article>
          </div>
        </section>
      )}

      {/* Bottom rail: other platforms + the networks in this cohort */}
      {(otherPlatforms.length > 0 || relatedNetworks.length > 0) && (
        <section className="uni-hub-cta-row">
          <p className="uni-hub-cta-meta">
            Browse yield another way — by venue, or by the networks{" "}
            {platform.display} runs on.
          </p>
          <div className="uni-hub-cta-links">
            {otherPlatforms.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="uni-hub-cta-pill">
                {p.display}
              </Link>
            ))}
            {relatedNetworks.map((n) => (
              <Link key={n.slug} href={`/${n.slug}`} className="uni-hub-cta-pill">
                <ChainIcon chain={n.chain} size={14} />
                {n.display}
              </Link>
            ))}
          </div>
        </section>
      )}

      <RankingDataNote />
    </div>
  );
}
