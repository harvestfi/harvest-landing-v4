// Body for /polygon. Unlike the other five network hubs, this one does NOT
// share network-hub-body.tsx: /polygon is a mixed ranking (a small,
// criteria-gated set of third-party venues, methodology.tsx#inclusion,
// grouped by asset, plus Harvest's own Polygon strategies as a separate,
// clearly-labelled section) rather than a single-operator listing. See
// methodology.tsx#disclosure for why that distinction matters here.

import Link from "next/link";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { breadcrumbSchema, reportWebPageSchema, reportItemListSchema, reportDatasetSchema } from "@/lib/jsonld";
import { HubTable } from "@/components/hub-table";
import { HomeCrumb } from "@/components/home-crumb";
import { DiscoverButton } from "@/components/report/discover-button";
import { getPolygonVenues, groupPolygonVenuesByAsset, type PolygonVenue } from "@/lib/polygon-yield";

const HUB_URL = `${SITE_URL}/polygon`;

function pct(v: number | null): string {
  if (v == null) return "n/a";
  return formatAPY(v);
}

function VenueRow({ v, rank }: { v: PolygonVenue; rank: number }) {
  return (
    <div className="hub-row" role="row">
      <span className="hub-cell hub-rank">{rank}</span>
      <span className="hub-cell hub-vault">
        <AssetIcon asset={v.symbol} size={24} />
        <span className="rp-rank-nameblock">
          <span className="hub-vault-name">{v.asset}</span>
          {v.detail ? <span className="rp-rank-detail">{v.detail}</span> : null}
          <span className="rp-rank-sub">
            {v.platform} · <span className="poly-badge-external">Third-party</span>
          </span>
        </span>
      </span>
      <span
        className="hub-cell hub-num hub-apy"
        title={v.rateNa ? "No public rate feed" : v.rateBasis === "current" ? "Current on-chain rate" : v.rateBasis}
      >
        {v.rateNa ? "n/a" : pct(v.apy)}
      </span>
      <span className="hub-cell rp-cell-text">
        <span className="rp-type">{v.productType ?? "Venue"}</span>
      </span>
      <span className="hub-cell hub-num">{v.tvlUsd > 0 ? formatTVL(v.tvlUsd) : "n/a"}</span>
      <span className="hub-cell rp-cell-action">
        <DiscoverButton
          href={v.platformUrl}
          platform={v.platform}
          label="Open"
          source={`polygon:${v.venueSlug}`}
          product={v.asset}
          chain="Polygon"
          rank={rank}
          icon={<AssetIcon asset={v.symbol} size={20} />}
        />
      </span>
    </div>
  );
}

export async function PolygonHubBody() {
  const [allVaults, sparklines, externalVenues] = await Promise.all([
    getLiveVaults(),
    getAllSparklines(),
    Promise.resolve(getPolygonVenues()),
  ]);
  const harvestVaults = allVaults
    .filter((v) => v.chain === "Polygon")
    .sort((a, b) => b.apy24h - a.apy24h);

  const groups = groupPolygonVenuesByAsset(externalVenues);
  const bestExternalApy = externalVenues.reduce((m, v) => (v.apy != null && v.apy > m ? v.apy : m), 0);
  const bestHarvestApy = harvestVaults.reduce((m, v) => (v.apy24h > m ? v.apy24h : m), 0);
  const bestApy = Math.max(bestExternalApy, bestHarvestApy);
  const externalTvl = externalVenues.reduce((s, v) => s + (v.tvlUsd || 0), 0);
  const harvestTvl = harvestVaults.reduce((s, v) => s + v.tvl, 0);

  const crumbs = [{ name: "Home", url: SITE_URL }, { name: "Polygon Ranking" }];

  // Report-style JSON-LD (see jsonld.ts:134-136): plain name+url ListItems,
  // never FinancialProduct, for the venues that are not Harvest's own -- the
  // ranked third-party venues are external protocols, not our products.
  const itemListItems = [
    ...externalVenues.map((v) => ({ name: `${v.asset} · ${v.platform}`, url: `${HUB_URL}/${v.venueSlug}` })),
    ...harvestVaults.map((v) => ({ name: v.productName, url: `${SITE_URL}/${v.slug}` })),
  ];

  const sourceDomains = [
    "https://aave.com",
    "https://morpho.org",
    "https://securitize.io",
    "https://polygon.technology",
  ];

  return (
    <div className="uni-hub-test poly-hub">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportWebPageSchema({
              name: "Best Polygon Yields",
              url: HUB_URL,
              description: `A rate-ranked list of ${externalVenues.length} third-party Polygon venues plus ${harvestVaults.length} Harvest-operated strategies, each clearly labelled by operator.`,
              dateModified: new Date().toISOString(),
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reportItemListSchema(itemListItems, HUB_URL)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportDatasetSchema({
              name: "Polygon yield ranking dataset",
              description: `Rate and TVL for ${externalVenues.length} third-party Polygon lending and tokenized-fund venues, read directly from each venue's own contract state where possible, plus ${harvestVaults.length} Harvest-operated Polygon strategies.`,
              url: HUB_URL,
              dateModified: new Date().toISOString(),
              numberOfItems: externalVenues.length + harvestVaults.length,
              keywords: ["Polygon", "DeFi", "yield", "APY", "TVL", "Aave", "Morpho", "RWA"],
              sources: sourceDomains,
            }),
          ),
        }}
      />

      <nav className="uni-hub-crumbs" aria-label="Breadcrumb">
        <HomeCrumb />
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <span className="uni-hub-crumbs-current">Polygon Ranking</span>
      </nav>

      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <span className="uni-hub-hero-icon" aria-hidden="true">
            <ChainIcon chain="Polygon" size={54} priority />
          </span>
          <div>
            <h1 className="uni-hub-h1">Best Polygon Yields</h1>
            <p className="uni-hub-sub">
              {externalVenues.length} third-party Polygon venues ranked by rate, plus{" "}
              {harvestVaults.length} Harvest-operated {harvestVaults.length === 1 ? "strategy" : "strategies"}
              , each row labelled by operator.
            </p>
          </div>
        </div>
        <div className="uni-hub-stats" role="group" aria-label="Polygon index headline stats">
          <div className="uni-hub-stat">
            <div className="uni-hub-stat-label" data-tooltip="Highest current rate across every row on this page, either operator.">
              Best rate
            </div>
            <div className="uni-hub-stat-value">{bestApy > 0 ? formatAPY(bestApy) : "-"}</div>
          </div>
          <div className="uni-hub-stat">
            <div className="uni-hub-stat-label" data-tooltip="Combined deposits across third-party venues and Harvest's own Polygon vaults tracked on this page.">
              Tracked TVL
            </div>
            <div className="uni-hub-stat-value">{formatTVL(externalTvl + harvestTvl)}</div>
          </div>
        </div>
      </header>

      <section className="uni-hub-section" aria-labelledby="poly-operator-note">
        <p id="poly-operator-note" className="poly-operator-note">
          This page mixes two operator types. <b>Third-party</b> rows are permissionless
          protocols or regulated, named-issuer funds Harvest does not run, control, or
          take custody through; rated the same way as everything else on this site --
          onchain where a direct contract read exists, a labelled third-party API
          otherwise (never the other way around) -- and never presented as a Harvest
          product. <b>Harvest</b> rows are strategies Harvest operates directly. Both are
          sorted purely by rate; operator status does not affect ranking. Inclusion
          criteria for third-party venues are documented on the{" "}
          <Link href="/methodology#inclusion">methodology page</Link>.
        </p>
      </section>

      <section className="uni-hub-section" aria-labelledby="poly-external-title">
        <header className="uni-hub-section-head">
          <h2 id="poly-external-title" className="uni-hub-section-title">
            Third-party Polygon venues, by asset
          </h2>
        </header>

        {groups.length === 0 ? (
          <div className="hub-empty">No third-party venues tracked yet.</div>
        ) : (
          groups.map((g) => (
            <div key={g.assetGroup} className="poly-asset-group">
              <h3 className="poly-asset-group-title">
                {g.assetGroup}
                <span className="poly-asset-group-meta">
                  best {formatAPY(g.bestApy)} · {formatTVL(g.totalTvlUsd)} tracked
                </span>
              </h3>
              <div className="hub-table-wrap rp-rank" data-nosnippet="">
                <div className="hub-table" role="table" aria-label={`${g.assetGroup} venues on Polygon`}>
                  <div className="hub-thead" role="row">
                    <span className="hub-th hub-th-rank">#</span>
                    <span className="hub-th">Venue</span>
                    <span className="hub-th hub-th-num">Rate</span>
                    <span className="hub-th">Type</span>
                    <span className="hub-th hub-th-num">TVL</span>
                    <span className="hub-th hub-th-right" />
                  </div>
                  <div className="hub-tbody" role="rowgroup">
                    {g.venues.map((v, i) => (
                      <VenueRow key={v.venueSlug} v={v} rank={i + 1} />
                    ))}
                  </div>
                </div>
              </div>
              {g.venues.some((v) => v.accessNote) && (
                <p className="poly-access-note">
                  {g.venues.find((v) => v.accessNote)?.accessNote}
                </p>
              )}
              {g.venues.some((v) => v.editorialNote) && (
                <p className="poly-editorial-note">
                  {g.venues.find((v) => v.editorialNote)?.editorialNote}
                </p>
              )}
            </div>
          ))
        )}
      </section>

      <section className="uni-hub-section" aria-labelledby="poly-harvest-title">
        <header className="uni-hub-section-head">
          <h2 id="poly-harvest-title" className="uni-hub-section-title">
            Harvest&apos;s own Polygon strategies
          </h2>
        </header>
        {harvestVaults.length === 0 ? (
          <div className="uni-hub-empty">No Harvest-operated Polygon strategies indexed right now.</div>
        ) : (
          <HubTable
            vaults={harvestVaults}
            sparklines={sparklines}
            showAssetFilter
            scopeLabel="Harvest Polygon strategies"
          />
        )}
      </section>

      <section className="uni-hub-content" aria-labelledby="about-polygon">
        <header className="uni-hub-content-head">
          <h2 id="about-polygon">About this page</h2>
          <p className="uni-hub-content-lede">
            Polygon (PoS) is an EVM-compatible network bridged to Ethereum. This page
            combines the largest permissionless lending venues on Polygon, a small set
            of Securitize-tokenized real-world-asset funds, and Harvest&apos;s own
            Polygon vaults, so a Polygon-USDC (or ETH, or BTC) rate comparison does not
            require checking six different sites.
          </p>
        </header>
        <div className="uni-hub-content-grid">
          <article>
            <h3>Why third-party venues, and why now</h3>
            <p>
              Harvest currently operates {harvestVaults.length} Polygon{" "}
              {harvestVaults.length === 1 ? "strategy" : "strategies"}. The wider
              Polygon lending and tokenized-credit market is larger than that, and a
              reader comparing Polygon yield deserves the real comparison set, clearly
              split by who operates what. See the{" "}
              <Link href="/methodology#inclusion">inclusion criteria</Link> for exactly
              which venues qualify and why.
            </p>
          </article>
          <article>
            <h3>Where the RWA rate comes from</h3>
            <p>
              BlackRock BUIDL, Hamilton Lane SCOPE and Apollo Diversified Credit are
              Securitize-tokenized funds with no public on-chain rate feed, so their
              rate is sourced from Portals rather than a contract read, disclosed on
              each row and on the venue&apos;s own page. All three are
              accreditation-gated: available only to eligible or qualified purchasers
              through Securitize, not to the general public.
            </p>
          </article>
          <article>
            <h3>What &quot;Third-party&quot; means here</h3>
            <p>
              Harvest does not operate, control, or take custody through any row marked
              Third-party. Clicking Open leaves harvest.finance through a confirmation
              step; Harvest is not responsible for that venue&apos;s contracts, rates,
              or security. See the{" "}
              <Link href="/risk-framework">risk framework</Link> for what that means in
              practice.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
