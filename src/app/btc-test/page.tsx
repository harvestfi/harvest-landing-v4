// Bitcoin yield ranking — rebuilt hub page using the /test visual
// language end-to-end. Borrows the Uniswap pools-list pattern: clean
// breadcrumb, soft hero with stat tiles, full-width ranking table
// with right-aligned numerics, gold APY indicator and a 1D sparkline
// per row.

import Link from "next/link";
import type { Metadata } from "next";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { AssetIcon } from "@/components/token-icons";
import { formatAPY, formatTVL } from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  assetHubTitle,
  assetHubH1,
  assetHubDescription,
  assetHubCrumbs,
} from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/jsonld";
import { getSubAsset } from "@/lib/sub-asset";
import { TestHubRow } from "@/components/test-hub-row";
import "./btc-test.css";

const ASSET = "BTC" as const;

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const assetVaults = vaults.filter((v) => v.asset === ASSET);
  const subAssets = [...new Set(assetVaults.map((v) => getSubAsset(v)))].sort();
  const title = `${assetHubTitle(ASSET)} (Test)`;
  const description = assetHubDescription(ASSET, assetVaults.length, subAssets);
  const url = `${SITE_URL}/btc-test`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: url },
    robots: { index: false, follow: false },
  };
}

export default async function BtcTestPage() {
  const allVaults = await getLiveVaults();
  const sparklines = await getAllSparklines();
  const vaults = allVaults
    .filter((v) => v.asset === ASSET)
    .sort((a, b) => b.apy24h - a.apy24h);

  const totalTvl = vaults.reduce((s, v) => s + v.tvl, 0);
  const bestApy = vaults.reduce((b, v) => (v.apy24h > b ? v.apy24h : b), 0);
  const avgApy =
    vaults.length > 0
      ? vaults.reduce((s, v) => s + v.apy24h, 0) / vaults.length
      : 0;
  const chainCount = new Set(vaults.map((v) => v.chain)).size;
  const subAssets = [...new Set(vaults.map((v) => getSubAsset(v)))].sort();

  const crumbs = assetHubCrumbs(ASSET);
  const hubUrl = `${SITE_URL}/btc-test`;

  return (
    <div className="uni-hub-test">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(crumbs)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListSchema(vaults, hubUrl)),
        }}
      />

      {/* Breadcrumb */}
      <nav className="uni-hub-crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <span className="uni-hub-crumbs-current">Bitcoin Yield Ranking</span>
      </nav>

      {/* Hero */}
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <span className="uni-hub-hero-icon" aria-hidden="true">
            <AssetIcon asset={ASSET} size={54} />
          </span>
          <div>
            <h1 className="uni-hub-h1">{assetHubH1(ASSET)}</h1>
            <p className="uni-hub-sub">
              {vaults.length > 0
                ? `Compare ${vaults.length} Bitcoin yield strategies tracked across ${subAssets.join(", ")}, ranked by APY across ${chainCount} ${chainCount !== 1 ? "networks" : "network"}.`
                : "Bitcoin yield strategies are populating, check back shortly."}
            </p>
          </div>
        </div>

        <div className="uni-hub-stats" role="group" aria-label="Bitcoin index headline stats">
          <div className="uni-hub-stat">
            <div
              className="uni-hub-stat-label"
              data-tooltip="Total value locked across every Bitcoin strategy in the index. Sum of each vault's current USD-denominated balance."
            >
              Total TVL
            </div>
            <div className="uni-hub-stat-value">{formatTVL(totalTvl)}</div>
          </div>
          <div className="uni-hub-stat">
            <div
              className="uni-hub-stat-label"
              data-tooltip="Highest 24-hour APY among the indexed Bitcoin strategies right now."
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
              data-tooltip="Mean 24-hour APY across the indexed Bitcoin strategies."
            >
              Avg APY
            </div>
            <div className="uni-hub-stat-value">
              {avgApy > 0 ? formatAPY(avgApy) : "-"}
            </div>
          </div>
          <div className="uni-hub-stat">
            <div
              className="uni-hub-stat-label"
              data-tooltip="Number of distinct networks Bitcoin strategies are deployed on inside the index."
            >
              Networks
            </div>
            <div className="uni-hub-stat-value">{chainCount}</div>
          </div>
        </div>
      </header>

      {/* Ranking table */}
      <section className="uni-hub-section" aria-labelledby="ranking-title">
        <header className="uni-hub-section-head">
          <h2 id="ranking-title" className="uni-hub-section-title">
            Top Bitcoin yields by APY
          </h2>
          <span className="uni-hub-section-meta">
            Live · {vaults.length} {vaults.length !== 1 ? "vaults" : "vault"}
            {chainCount > 0 ? ` · ${chainCount} ${chainCount !== 1 ? "networks" : "network"}` : ""}
          </span>
        </header>

        {vaults.length === 0 ? (
          <div className="uni-hub-empty">No Bitcoin strategies indexed yet.</div>
        ) : (
          <div className="uni-hub-table" role="table" aria-label="Bitcoin strategies ranked by APY">
            <div className="uni-hub-thead" role="row">
              <span className="uni-hub-th uni-hub-rank">#</span>
              <span className="uni-hub-th">Vault</span>
              <span className="uni-hub-th">Network</span>
              <span className="uni-hub-th">Strategy</span>
              <span className="uni-hub-th uni-hub-th-num">TVL</span>
              <span className="uni-hub-th uni-hub-th-num">24h APY</span>
              <span className="uni-hub-th uni-hub-th-num">30d APY</span>
              <span className="uni-hub-th uni-hub-th-num">30d trend</span>
            </div>
            <div className="uni-hub-tbody" role="rowgroup">
              {vaults.map((v, i) => (
                <TestHubRow
                  key={v.id}
                  rank={i + 1}
                  vault={v}
                  sparkline={sparklines[v.contractAddress.toLowerCase()] ?? sparklines[v.contractAddress]}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Bottom rail: bridge to per-network filtered views */}
      <section className="uni-hub-cta-row">
        <p className="uni-hub-cta-meta">
          Looking for a specific chain? Network ranking pages cut the same
          data by network.
        </p>
        <div className="uni-hub-cta-links">
          {[...new Set(vaults.map((v) => v.chain))].slice(0, 6).map((chain) => (
            <Link key={chain} href={`/${chain.toLowerCase()}`} className="uni-hub-cta-pill">
              {chain}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
