import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { formatAPY, formatTVL } from "@/lib/format";
import {
  breadcrumbSchema,
  reportWebPageSchema,
  reportDatasetSchema,
  faqPageSchema,
} from "@/lib/jsonld";
import { AssetIcon } from "@/components/token-icons";
import { HomeCrumb } from "@/components/home-crumb";
import { DiscoverButton } from "@/components/report/discover-button";
import { ReportChart } from "@/components/report/report-chart";
import {
  getExternalProductBySlug,
  getExternalProductHistory,
  getExternalProductSlugsFromRegistry,
  POLYGON_VENUE_OVERLAP,
} from "@/lib/external-products";
import "../../_styles/asset-hub.css";
import "../../_styles/report.css";
import "../../_styles/polygon-hub.css";

// Standalone page for a third-party product sourced from data/external-products.json
// + Supabase (see src/lib/external-products.ts). Deliberately does NOT go
// through src/app/[slug]/page.tsx (single-operator assumptions baked in six
// places -- see methodology.tsx#disclosure) and is a SEPARATE surface from
// /polygon/[venue]: that route is scoped to the /polygon hub's own ranking
// context, this one is not tied to any hub and is meant to scale to any
// platform/chain in the registry, not just Polygon.
//
// A handful of these slugs (the Aave v3 rows already in data/polygon-venues.json)
// describe the exact same venue as an existing /polygon/[venue] page. Until
// that overlap is deliberately resolved (either migrate /polygon onto this
// same Supabase-backed pipeline, or keep this route to platforms outside any
// hub), those specific pages set a canonical pointer back to /polygon/[venue]
// so the two URLs never compete as duplicate content -- see
// POLYGON_VENUE_OVERLAP in src/lib/external-products.ts, also consulted by
// sitemap.ts so an overlapping slug is never listed as its own indexable URL.

export async function generateStaticParams() {
  return getExternalProductSlugsFromRegistry().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getExternalProductBySlug(slug);
  if (!p) return {};
  const title = `${p.asset} on ${p.platform} (${p.chain}): Rate & TVL | ${SITE_NAME}`;
  const description = `${p.platform}'s ${p.asset} ${(p.productType ?? "venue").toLowerCase()} on ${p.chain}: current rate, tracked deposits, and how we source the number. Third-party venue, not operated by Harvest.`;
  const canonicalPath = POLYGON_VENUE_OVERLAP[slug];
  const url = `${SITE_URL}/product/${slug}`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: canonicalPath ? `${SITE_URL}${canonicalPath}` : url },
    ...(canonicalPath ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ExternalProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [p, history] = await Promise.all([
    getExternalProductBySlug(slug),
    getExternalProductHistory(slug),
  ]);
  if (!p) notFound();

  const url = `${SITE_URL}/product/${p.slug}`;
  const crumbs = [{ name: "Home", url: SITE_URL }, { name: `${p.asset} on ${p.platform}` }];

  const sourceLabel =
    p.sourceKind === "onchain"
      ? `Read directly from ${p.platform}'s own contract on ${p.chain} (Pool.getReserveData), the same class of read Harvest's own strategies use.`
      : `Sourced from the Portals API, used here because ${p.platform} has no simple public rate-reading contract wired up yet. Disclosed, not presented as an on-chain read.`;

  const faqs = [
    {
      q: `What is the current ${p.asset} rate on ${p.platform}?`,
      a: p.rateNa
        ? `Not available right now -- see "Where this number comes from" below for why.`
        : `${formatAPY(p.apy ?? 0)}, last refreshed ${p.updatedAt ? new Date(p.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "recently"}. ${sourceLabel}`,
    },
    {
      q: `Is ${p.platform} operated by Harvest?`,
      a: `No. ${p.platform} is a third-party protocol Harvest does not operate, control, or take custody through. This page tracks it for research; opening it leaves harvest.finance through a confirmation step.`,
    },
    {
      q: `How much TVL does this ${p.asset} market hold?`,
      a: p.tvlUsd > 0
        ? `${formatTVL(p.tvlUsd)} tracked as of the last refresh.`
        : `Not available right now.`,
    },
  ];

  return (
    <div className="uni-hub-test poly-hub poly-venue-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            ...reportWebPageSchema({
              name: `${p.asset} on ${p.platform}`,
              url,
              description: `Current rate and tracked deposits for ${p.platform}'s ${p.asset} ${(p.productType ?? "venue").toLowerCase()} on ${p.chain}.`,
              dateModified: p.updatedAt ?? new Date().toISOString(),
            }),
            speakable: {
              "@type": "SpeakableSpecification",
              cssSelector: [".uni-hub-h1", ".uni-hub-sub"],
            },
          }),
        }}
      />
      {/* No financialProductSchema: Harvest is not the provider of this
          venue and must not appear as one in structured data. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportDatasetSchema({
              name: `${p.asset} on ${p.platform} (${p.chain}) rate history`,
              description: `Rate and TVL history for ${p.platform}'s ${p.asset} venue on ${p.chain}.`,
              url,
              dateModified: p.updatedAt ?? new Date().toISOString(),
              numberOfItems: 1,
              keywords: [p.asset, p.platform, p.chain, "DeFi", "yield", "APY"],
              sources: [p.productUrl],
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />

      <nav className="uni-hub-crumbs" aria-label="Breadcrumb">
        <HomeCrumb />
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <span className="uni-hub-crumbs-current">
          {p.asset} · {p.platform}
        </span>
      </nav>

      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <span className="uni-hub-hero-icon" aria-hidden="true">
            <AssetIcon asset={p.asset} size={54} priority />
          </span>
          <div>
            <h1 className="uni-hub-h1">
              {p.asset} on {p.platform}
            </h1>
            <p className="uni-hub-sub">
              {p.productType ?? "Venue"} on {p.chain} ·{" "}
              <span className="poly-badge-external">Third-party, not a Harvest product</span>
            </p>
          </div>
        </div>
        <div className="uni-hub-stats" role="group" aria-label={`${p.asset} on ${p.platform} stats`}>
          <div className="uni-hub-stat">
            <div className="uni-hub-stat-label" data-tooltip={sourceLabel}>
              Current rate
            </div>
            <div className="uni-hub-stat-value">{p.rateNa ? "n/a" : formatAPY(p.apy ?? 0)}</div>
          </div>
          <div className="uni-hub-stat">
            <div className="uni-hub-stat-label" data-tooltip="Deposits tracked in this venue as of the last refresh.">
              Tracked TVL
            </div>
            <div className="uni-hub-stat-value">{p.tvlUsd > 0 ? formatTVL(p.tvlUsd) : "n/a"}</div>
          </div>
        </div>
      </header>

      {history.length >= 2 && (
        <section className="uni-hub-section" aria-labelledby="venue-history">
          <header className="uni-hub-section-head">
            <h2 id="venue-history" className="uni-hub-section-title">
              Rate history
            </h2>
          </header>
          <ReportChart
            history={history.map((h) => ({ d: h.d, apy: h.apy ?? 0 }))}
            title={`${p.asset} on ${p.platform}`}
            nowValue={p.apy}
            nowLabel="current"
          />
        </section>
      )}

      <section className="uni-hub-section" aria-labelledby="venue-open">
        <header className="uni-hub-section-head">
          <h2 id="venue-open" className="uni-hub-section-title">
            Open {p.platform}
          </h2>
        </header>
        <p className="poly-operator-note">
          Harvest does not operate, control, or take custody through this venue; opening it
          leaves harvest.finance through a confirmation step.
        </p>
        <DiscoverButton
          href={p.productUrl}
          platform={p.platform}
          label={`Open ${p.platform}`}
          source={`product:${p.slug}`}
          product={p.asset}
          chain={p.chain}
          icon={<AssetIcon asset={p.asset} size={20} />}
        />
      </section>

      <section className="uni-hub-content" aria-labelledby="venue-faq">
        <header className="uni-hub-content-head">
          <h2 id="venue-faq">Frequently asked questions</h2>
        </header>
        <dl className="uni-hub-faq">
          {faqs.map((f, i) => (
            <div key={i}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
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
            <h3>Risk</h3>
            <p>
              Smart-contract and oracle risk sit with {p.platform}, not Harvest. See the{" "}
              <Link href="/risk-framework">risk framework</Link> for the general categories;
              this page does not carry a risk rating or financial advice.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
