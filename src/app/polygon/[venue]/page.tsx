import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { formatAPY, formatTVL } from "@/lib/format";
import { breadcrumbSchema, reportWebPageSchema, reportDatasetSchema } from "@/lib/jsonld";
import { AssetIcon } from "@/components/token-icons";
import { HomeCrumb } from "@/components/home-crumb";
import { DiscoverButton } from "@/components/report/discover-button";
import { getPolygonVenues, type PolygonVenue } from "@/lib/polygon-yield";
import "../../_styles/asset-hub.css";
import "../../_styles/report.css";
import "../../_styles/polygon-hub.css";

// This route intentionally does NOT go through src/app/[slug]/page.tsx: that
// route encodes "this is a Harvest product" in several places (provider/brand
// on financialProductSchema, a hardcoded operatorBrand default, harvestAppUrl()
// CTAs) that would be false statements on a page about BlackRock BUIDL or Aave.
// See methodology.tsx#disclosure and #inclusion for the operator distinction
// this route exists to keep honest.

function findVenue(slug: string): PolygonVenue | null {
  return getPolygonVenues().find((v) => v.venueSlug === slug) ?? null;
}

export async function generateStaticParams() {
  return getPolygonVenues().map((v) => ({ venue: v.venueSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ venue: string }>;
}): Promise<Metadata> {
  const { venue: slug } = await params;
  const v = findVenue(slug);
  if (!v) return {};
  const title = `${v.asset} on ${v.platform} (Polygon): Rate & TVL | ${SITE_NAME}`;
  const description = `${v.platform}'s ${v.asset} ${(v.productType ?? "venue").toLowerCase()} on Polygon: current rate, tracked deposits, and how we source the number. Third-party venue, not operated by Harvest.`;
  const url = `${SITE_URL}/polygon/${v.venueSlug}`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: url },
  };
}

export default async function PolygonVenuePage({
  params,
}: {
  params: Promise<{ venue: string }>;
}) {
  const { venue: slug } = await params;
  const v = findVenue(slug);
  if (!v) notFound();

  const url = `${SITE_URL}/polygon/${v.venueSlug}`;
  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Polygon Ranking", url: `${SITE_URL}/polygon` },
    { name: `${v.asset} · ${v.platform}` },
  ];

  const sourceLabel =
    v.source === "onchain"
      ? `Read directly from ${v.platform}'s own contract on Polygon (Pool.getReserveData), the same class of read Harvest's own strategies use.`
      : `Sourced from the Portals API, used here because ${v.platform} has no simple public rate-reading contract. Disclosed, not presented as an on-chain read.`;

  return (
    <div className="uni-hub-test poly-hub poly-venue-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportWebPageSchema({
              name: `${v.asset} on ${v.platform} (Polygon)`,
              url,
              description: `Current rate and tracked deposits for ${v.platform}'s ${v.asset} ${(v.productType ?? "venue").toLowerCase()} on Polygon.`,
              dateModified: new Date().toISOString(),
            }),
          ),
        }}
      />
      {/* No financialProductSchema here: Harvest is not the provider of this
          venue and must not appear as one in structured data. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportDatasetSchema({
              name: `${v.asset} on ${v.platform} (Polygon) rate history`,
              description: `Rate and TVL for ${v.platform}'s ${v.asset} venue on Polygon.`,
              url,
              dateModified: new Date().toISOString(),
              numberOfItems: 1,
              keywords: [v.asset, v.platform, "Polygon", "DeFi", "yield", "APY"],
              sources: [v.platformUrl],
            }),
          ),
        }}
      />

      <nav className="uni-hub-crumbs" aria-label="Breadcrumb">
        <HomeCrumb />
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <Link href="/polygon">Polygon Ranking</Link>
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <span className="uni-hub-crumbs-current">
          {v.asset} · {v.platform}
        </span>
      </nav>

      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <span className="uni-hub-hero-icon" aria-hidden="true">
            <AssetIcon asset={v.symbol} size={54} priority />
          </span>
          <div>
            <h1 className="uni-hub-h1">
              {v.asset} on {v.platform}
            </h1>
            <p className="uni-hub-sub">
              {v.productType ?? "Venue"} on Polygon ·{" "}
              <span className="poly-badge-external">Third-party, not a Harvest product</span>
            </p>
          </div>
        </div>
        <div className="uni-hub-stats" role="group" aria-label={`${v.asset} on ${v.platform} stats`}>
          <div className="uni-hub-stat">
            <div className="uni-hub-stat-label" data-tooltip={sourceLabel}>
              Current rate
            </div>
            <div className="uni-hub-stat-value">{v.rateNa ? "n/a" : formatAPY(v.apy ?? 0)}</div>
          </div>
          <div className="uni-hub-stat">
            <div className="uni-hub-stat-label" data-tooltip="Deposits tracked in this venue as of the last refresh.">
              Tracked TVL
            </div>
            <div className="uni-hub-stat-value">{v.tvlUsd > 0 ? formatTVL(v.tvlUsd) : "n/a"}</div>
          </div>
        </div>
      </header>

      <section className="uni-hub-section" aria-labelledby="venue-open">
        <header className="uni-hub-section-head">
          <h2 id="venue-open" className="uni-hub-section-title">
            Open {v.platform}
          </h2>
        </header>
        <p className="poly-operator-note">
          {v.entity ?? "Third-party operator"}. Harvest does not operate, control, or
          take custody through this venue; opening it leaves harvest.finance through a
          confirmation step.
          {v.accessNote ? ` ${v.accessNote}` : ""}
        </p>
        <DiscoverButton
          href={v.platformUrl}
          platform={v.platform}
          label={`Open ${v.platform}`}
          source={`polygon-venue:${v.venueSlug}`}
          product={v.asset}
          chain="Polygon"
          icon={<AssetIcon asset={v.symbol} size={20} />}
        />
      </section>

      <section className="uni-hub-content" aria-labelledby="venue-about">
        <header className="uni-hub-content-head">
          <h2 id="venue-about">About this rate</h2>
        </header>
        <div className="uni-hub-content-grid">
          <article>
            <h3>Where this number comes from</h3>
            <p>{sourceLabel}</p>
          </article>
          <article>
            <h3>Why it&apos;s here</h3>
            <p>
              {v.platform} meets the third-party inclusion criteria documented on the{" "}
              <Link href="/methodology#inclusion">methodology page</Link>: a verifiable
              rate, at least $500,000 tracked, a permissionless contract or a named,
              regulated issuer, no payment for placement, and clear third-party
              labelling.
            </p>
          </article>
          {v.editorialNote && (
            <article>
              <h3>Worth noting</h3>
              <p>{v.editorialNote}</p>
            </article>
          )}
          <article>
            <h3>Risk</h3>
            <p>
              Smart-contract, oracle, and (for tokenized funds) issuer/custody risk sit
              with {v.platform}, not Harvest. See the{" "}
              <Link href="/risk-framework">risk framework</Link> for the general
              categories; this page does not carry a risk rating or financial advice.
            </p>
          </article>
        </div>
      </section>

      <p className="poly-operator-note">
        Back to the full <Link href="/polygon">Polygon ranking</Link>.
      </p>
    </div>
  );
}
