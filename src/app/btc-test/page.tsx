// Bitcoin yield ranking — rebuilt hub page using the /test visual
// language end-to-end. Borrows the Uniswap pools-list pattern: clean
// breadcrumb, soft hero with stat tiles, full-width ranking table
// with right-aligned numerics, gold APY indicator and a 1D sparkline
// per row.

import Link from "next/link";
import type { Metadata } from "next";
import { getLiveVaults, getAllSparklines } from "@/lib/data";
import { AssetIcon } from "@/components/token-icons";
import { formatAPY } from "@/lib/format";
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
        </div>
      </header>

      {/* Ranking table */}
      <section className="uni-hub-section" aria-labelledby="ranking-title">
        <header className="uni-hub-section-head">
          <h2 id="ranking-title" className="uni-hub-section-title">
            Top Bitcoin yields by APY
          </h2>
          <span className="uni-hub-section-meta">
            Tracking {vaults.length} {vaults.length !== 1 ? "vaults" : "vault"}
            {chainCount > 0 ? `, ${chainCount} ${chainCount !== 1 ? "networks" : "network"}` : ""}
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

      {/* SEO content section: long-form, full-width inside the page box */}
      <section className="uni-hub-content" aria-labelledby="about-bitcoin">
        <header className="uni-hub-content-head">
          <h2 id="about-bitcoin">About Bitcoin yield</h2>
          <p className="uni-hub-content-lede">
            Bitcoin is a non-yielding asset out of the box. To put BTC
            to work, holders move into wrapped or liquid Bitcoin
            tokens and route them through lending markets,
            autocompounding vaults, or basis trades against
            perpetuals. Every strategy on this page follows that
            pattern: a wrapped BTC token, on a specific chain,
            running through a specific underlying protocol that we
            currently index.
          </p>
        </header>

        <div className="uni-hub-content-grid">
          <article>
            <h3>What does "Bitcoin yield" actually mean?</h3>
            <p>
              Native BTC sitting in a self-custody wallet earns
              nothing. Yield enters the picture once the asset is
              represented on a smart-contract chain, where it can be
              lent, supplied as collateral, or routed through an
              automated strategy. On Ethereum that representation is
              usually WBTC; on Coinbase chains it is cbBTC; on
              networks integrating Threshold Network it is tBTC. The
              numbers on this ranking are the live APYs those
              wrapped representations are earning across the
              strategies we monitor.
            </p>
          </article>

          <article>
            <h3>WBTC, cbBTC, tBTC: how the wrappers differ</h3>
            <p>
              WBTC is custodied by BitGo and minted against held
              BTC. cbBTC is issued by Coinbase, redeemable 1:1
              against custodied BTC inside their reserves. tBTC is
              issued by the Threshold Network's decentralised signer
              set. Each wrapper carries a different combination of
              custody, oracle, and bridge risk, and that risk
              follows the token into every strategy it touches.
              Treat the wrapper choice as part of the position, not
              a wrapper detail.
            </p>
          </article>

          <article>
            <h3>Lending vs. autocompounding vs. basis</h3>
            <p>
              The simplest BTC yield is a single-side supply on a
              money market like Aave or Morpho: deposit wrapped
              Bitcoin, earn the supply APY borrowers pay. An
              autocompounder layers on top of that, harvesting and
              re-investing reward emissions on a schedule. Basis
              strategies, less common in our index, hold spot
              wrapped BTC against a short perp leg to capture
              funding. Each profile trades a different mix of
              complexity, gas, and reward composition.
            </p>
          </article>

          <article>
            <h3>How to read the APY columns</h3>
            <p>
              The 24-hour APY is the latest annualised return our
              hosted indexer pulled from the underlying protocol,
              refreshed on a regular cadence. The 30-day APY is the
              simple mean of daily readings across the last month
              for that strategy. The 30-day trend sparkline visualises
              the same series so a stable strategy reads flat and a
              volatile one reads as spikes. Past APY is not a
              guarantee of future returns, and outliers compound
              for a reason.
            </p>
          </article>

          <article>
            <h3>What about TVL?</h3>
            <p>
              TVL is the dollar value of wrapped BTC currently
              deposited in the strategy. A higher TVL usually means
              the strategy has been live longer and has absorbed
              more capital without breaking; a low TVL might be a
              new launch, a niche pair, or a strategy whose APY no
              longer compensates for its risk. TVL alone is not a
              quality signal, but it is useful context next to
              APY when comparing two strategies on the same wrapper.
            </p>
          </article>

          <article>
            <h3>Risk surfaces on every wrapped-BTC strategy</h3>
            <p>
              Smart-contract risk on the vault and the underlying
              protocol; oracle risk on the price feeds those
              contracts depend on; bridge or wrapping risk on the
              BTC representation; governance risk on parameters
              operators can change. The full framework, including
              how each strategy is scored and what we deliberately
              leave out, lives on the{" "}
              <Link href="/risk-framework">risk framework page</Link>.
            </p>
          </article>

          <article>
            <h3>Which networks host Bitcoin yield in our index?</h3>
            <p>
              Coverage spans Ethereum mainnet plus the rollups and
              chains where wrapped BTC has meaningful liquidity and
              an established lending or vault footprint. Use the
              network shortcuts at the bottom of this page to scope
              the ranking to a single chain, or open a vault to see
              its specific protocol, asset, and chain context.
              Networks come and go from this list as deployments
              ship or get retired upstream.
            </p>
          </article>

          <article>
            <h3>Frequently asked questions</h3>
            <dl className="uni-hub-faq">
              <dt>Is wrapping BTC reversible?</dt>
              <dd>
                For the major wrappers, yes: each maintains a
                redemption path back to native BTC, subject to
                their own minting and burning rules. Bridging or
                cross-chain swaps add an extra step on top.
              </dd>
              <dt>Why do APYs differ across networks for the same wrapper?</dt>
              <dd>
                Lending utilisation, reward emissions, and the size
                of the local market all vary by chain. The same
                wrapped BTC token can earn very different yields on
                two networks at the same moment.
              </dd>
              <dt>Do these numbers include rewards?</dt>
              <dd>
                The 24-hour APY reflects whatever the underlying
                protocol reports as its current rate, which usually
                includes active reward emissions. The strategy
                detail page on each vault shows the breakdown
                where it is published upstream.
              </dd>
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
