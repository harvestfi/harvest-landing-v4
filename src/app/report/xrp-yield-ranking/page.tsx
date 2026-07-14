import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import "../../_styles/home.css";
import "../../_styles/report.css";

// /report/xrp-yield-ranking - a continuously updated, externally-fed data
// report on where XRP-family assets (XRP, wrapped XRP variants, RLUSD) earn
// onchain yield. Every venue is EXTERNAL - none are Harvest products. The page
// is isolated from the product pipeline: it reads only data/xrp-yield.json,
// written by scripts/fetch-xrp-yield.mjs from the free DeFiLlama API in the
// hourly data workflow. No Supabase, no vaults.json.
//
// Layout mirrors the site: the homepage gold hero (with a featured single
// exposure venue as the hook), then two hub-table-styled rankings split by
// single- vs dual-exposure, then a human-readable article on where the rates
// come from.

const PAGE_URL = `${SITE_URL}/report/xrp-yield-ranking`;

interface XrpPool {
  id: string;
  chain: string;
  project: string;
  platform: string;
  platformUrl: string | null;
  category: string | null;
  symbol: string;
  poolMeta: string | null;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  apyMean30d: number | null;
  rewardShare: number;
  incentivized: boolean;
  ilRisk: string | null;
  exposure: string | null;
  stablecoin: boolean;
  observations: number | null;
  llamaUrl: string;
  inception: string | null;
  range90d: { min: number; max: number } | null;
}
interface XrpYieldData {
  generatedAt: string;
  pools: XrpPool[];
}

function loadData(): XrpYieldData | null {
  try {
    const f = join(process.cwd(), "data", "xrp-yield.json");
    if (!existsSync(f)) return null;
    const d = JSON.parse(readFileSync(f, "utf-8")) as XrpYieldData;
    return Array.isArray(d.pools) && d.pools.length > 0 ? d : null;
  } catch {
    return null;
  }
}

const CHAIN_LABEL: Record<string, string> = {
  XRPL: "XRP Ledger",
  "XRPL EVM": "XRPL EVM",
};
const chainLabel = (c: string) => CHAIN_LABEL[c] ?? c;

const pct = (v: number | null) => (v == null ? "-" : `${v.toFixed(2)}%`);
const usd = (n: number) =>
  n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : `$${Math.round(n / 1_000)}k`;
const monthYear = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};
const histRate = (p: XrpPool) => p.apyMean30d ?? p.apy;

// Two-asset (LP) exposure vs single-sided. DeFiLlama's `exposure` field is the
// signal; a dash in the symbol (XRP-USDC) is the fallback.
const isDual = (p: XrpPool) => p.exposure === "multi" || /[-/]/.test(p.symbol);
const isRlusdOnly = (p: XrpPool) => /^RLUSD$/i.test(p.symbol.trim());

function baseSource(p: XrpPool): string {
  const c = (p.category || "").toLowerCase();
  if (c.includes("dex")) return "trading fees paid by swappers";
  if (c.includes("lending")) return "interest paid by borrowers";
  if (c.includes("liquid staking") || c.includes("staking")) return "staking rewards passed through to holders";
  if (c.includes("restaking")) return "restaking rewards";
  if (c.includes("yield")) return "an automated strategy compounding market yield";
  if (c.includes("cdp")) return "stability and borrowing fees";
  if (c.includes("derivative") || c.includes("perp")) return "a share of trading fees and funding";
  return "activity fees the protocol distributes to suppliers";
}

export async function generateMetadata(): Promise<Metadata> {
  const data = loadData();
  const n = data?.pools.length ?? 20;
  const title = "XRP Yield Ranking: Live Rates Across DeFi";
  const desc = `${n}+ XRP-denominated yield sources ranked by real 30-day rate history - single-exposure vaults and dual-asset pools - from XRP, wrapped XRP and RLUSD across DeFi. Live data, refreshed hourly.`;
  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description: desc,
    alternates: { canonical: PAGE_URL },
    openGraph: { title, description: desc, url: PAGE_URL, siteName: SITE_NAME, type: "article" },
  };
}

export default function XrpYieldRankingPage() {
  const data = loadData();

  if (!data) {
    return (
      <div className="uni-home-test">
        <Crumbs />
        <section className="uni-home-hero">
          <div className="rp-hero-grid">
            <div className="rp-hero-copy">
              <h1 className="uni-home-h1">XRP Yield Ranking</h1>
              <p className="uni-home-sub">
                The first data snapshot is being generated. Check back shortly.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const { pools } = data;
  const singles = pools.filter((p) => !isDual(p));
  const duals = pools.filter((p) => isDual(p));

  // Hero hook: the top single-exposure venue on actual XRP (not the RLUSD
  // stablecoin), falling back to the best single-exposure venue.
  const featured =
    singles.find((p) => /XRP/i.test(p.symbol) && !isRlusdOnly(p)) ?? singles[0];

  const updated = new Date(data.generatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  // Venues that anchor the article, pulled live so the prose stays current.
  const rlusd = pools
    .filter((p) => /RLUSD/i.test(p.symbol))
    .sort((a, b) => b.tvlUsd - a.tvlUsd);
  const xrpSingles = singles.filter((p) => /XRP/i.test(p.symbol) && !isRlusdOnly(p));
  const topPair = duals[0];

  return (
    <div className="uni-home-test">
      <Crumbs />

      <section className="uni-home-hero">
        <div className="rp-hero-grid">
          <div className="rp-hero-copy">
            <h1 className="uni-home-h1">XRP Yield Ranking</h1>
            <p className="uni-home-sub">
              We&rsquo;ve analysed {pools.length}+ XRP-denominated yield sources
              across DeFi &mdash; from single-exposure vaults to dual-asset
              pools. Here&rsquo;s what we found out about where XRP actually
              earns, and what really pays each rate.
            </p>
            <a href="#rankings" className="uni-home-cta-primary">
              Explore the ranking
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          {featured && (
            <div className="rp-hero-card">
              <span className="rp-hero-card-label">Top single-exposure venue</span>
              <span className="rp-hero-card-rate">
                {pct(histRate(featured))} <small>30d avg</small>
              </span>
              <span className="rp-hero-card-name">{featured.symbol}</span>
              <span className="rp-hero-card-meta">
                {featured.platform} · {chainLabel(featured.chain)}
              </span>
              <span className="rp-hero-card-note">
                {featured.inception ? `tracked since ${monthYear(featured.inception)}` : "external venue"}
                {" · "}
                {usd(featured.tvlUsd)} TVL
              </span>
              <a
                className="rp-hero-card-cta"
                href={featured.platformUrl ?? featured.llamaUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Discover
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}
        </div>
      </section>

      <main className="uni-home-shell">
        <section className="uni-home-section" id="rankings">
          <header className="uni-home-section-head">
            <div>
              <h2 className="uni-home-section-title">Single-exposure XRP yield</h2>
              <p className="uni-home-section-sub">
                One-sided positions on XRP, wrapped XRP or RLUSD &mdash; no
                second asset, no impermanent loss. Ranked by 30-day average rate.
              </p>
            </div>
          </header>
          <RankTable rows={singles} />
        </section>

        <section className="uni-home-section">
          <header className="uni-home-section-head">
            <div>
              <h2 className="uni-home-section-title">Dual-exposure pools</h2>
              <p className="uni-home-section-sub">
                Two-asset liquidity pools pairing an XRP-family token with
                another asset. Higher headline rates, but they carry
                impermanent-loss exposure.
              </p>
            </div>
          </header>
          <RankTable rows={duals} />
          <p className="uni-home-section-sub" style={{ marginTop: 10 }}>
            Rates and TVL from DeFiLlama as of {updated}, refreshed hourly.
            &ldquo;Discover&rdquo; opens the platform&rsquo;s own site.
          </p>
        </section>

        <section className="uni-home-content" aria-labelledby="where-title">
          <h2 id="where-title">Where these rates come from</h2>
          <div className="rp-article">
            <p>
              XRP has no native staking, so every rate on this page comes from
              putting an XRP-family asset to work in a market. What pays it, and
              how durable it is, splits cleanly into three stories.
            </p>

            {rlusd.length > 0 && (
              <>
                <h3>RLUSD is where the real depth is</h3>
                <p>
                  The largest, steadiest pools aren&rsquo;t XRP at all &mdash;
                  they&rsquo;re Ripple&rsquo;s dollar stablecoin, RLUSD. The
                  biggest here is{" "}
                  <strong>
                    {rlusd[0].symbol} on {rlusd[0].platform}
                  </strong>{" "}
                  ({chainLabel(rlusd[0].chain)}), holding {usd(rlusd[0].tvlUsd)}{" "}
                  at {pct(histRate(rlusd[0]))}
                  {rlusd[1] ? (
                    <>
                      , with {rlusd[1].symbol} on {rlusd[1].platform} close
                      behind at {pct(histRate(rlusd[1]))}
                    </>
                  ) : null}
                  . These are dollar-denominated and mostly incentive-driven, so
                  read them as earning on <em>dollars inside the XRP ecosystem</em>{" "}
                  rather than yield on XRP itself.
                </p>
              </>
            )}

            {xrpSingles.length > 0 && (
              <>
                <h3>Single-sided XRP: wrapped and staked</h3>
                <p>
                  For exposure to XRP itself without taking on a second asset,
                  the options are wrapped or staked forms. The best-paying right
                  now is{" "}
                  <strong>
                    {xrpSingles[0].symbol} on {xrpSingles[0].platform}
                  </strong>{" "}
                  at {pct(histRate(xrpSingles[0]))}, where the rate is{" "}
                  {baseSource(xrpSingles[0])}. Rates here are modest next to the
                  liquidity pools, but the position is one-sided: no pair to
                  diverge, no impermanent loss.
                </p>
              </>
            )}

            {topPair && (
              <>
                <h3>Liquidity pairs pay more, and swing more</h3>
                <p>
                  The double-digit headline rates all come from two-asset pools.{" "}
                  <strong>
                    {topPair.symbol} on {topPair.platform}
                  </strong>{" "}
                  tops the list at {pct(histRate(topPair))}
                  {topPair.range90d
                    ? `, but over the last 90 days that rate ranged from ${pct(topPair.range90d.min)} to ${pct(topPair.range90d.max)}`
                    : ""}
                  {topPair.incentivized
                    ? " — most of it incentive emissions rather than organic fees, which fade when the program ends"
                    : ""}
                  . The higher number is real, but so is the impermanent-loss
                  exposure and the volatility: these rates reward active
                  management, not set-and-forget.
                </p>
              </>
            )}

            <div className="rp-callout">
              Every venue on this page is an external protocol tracked for
              research. None are {SITE_NAME} products, this page is informational
              only, and past rate history is no assurance of what a venue pays
              next.
            </div>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="method-title">
          <h2 id="method-title">Method &amp; scope</h2>
          <dl className="rp-method">
            <dt>Inclusion</dt>
            <dd>
              Every pool DeFiLlama tracks whose symbol contains an XRP-family
              asset (XRP, wrapped variants such as FXRP/WXRP/cbXRP, or RLUSD),
              holding at least $25k TVL. Flagged outliers are excluded.
            </dd>
            <dt>Ranking</dt>
            <dd>
              By 30-day average rate, so short-lived emission spikes don&rsquo;t
              decide the order. Today&rsquo;s spot rate is shown alongside. An
              <span className="rp-flag">incentives</span> tag marks venues where
              more than half the rate is emissions.
            </dd>
            <dt>Freshness</dt>
            <dd>Refreshed hourly from the free DeFiLlama API; this page reflects the {updated} snapshot.</dd>
            <dt>What this is not</dt>
            <dd>
              Not an endorsement and not financial advice. {SITE_NAME} indexes
              DeFi yield data; the venues above are external. Our own coverage
              is{" "}
              <Link href="/usdc">USDC</Link>, <Link href="/eth">ETH</Link> and{" "}
              <Link href="/btc">BTC</Link> strategies, indexed with the same
              methodology used on every product page (see{" "}
              <Link href="/methodology">Methodology</Link>).
            </dd>
          </dl>
        </section>
      </main>
    </div>
  );
}

const RANK_COLS = "44px minmax(120px,1.5fr) minmax(96px,1fr) 96px 1fr 0.8fr 100px";

function RankTable({ rows }: { rows: XrpPool[] }) {
  if (rows.length === 0) {
    return <div className="hub-empty">No venues in this category right now.</div>;
  }
  return (
    <div className="hub-table-wrap rp-rank" data-nosnippet="">
      <div className="hub-table" role="table" aria-label="XRP yield ranking">
        <div className="hub-thead" role="row" style={{ gridTemplateColumns: RANK_COLS }}>
          <span className="hub-th hub-th-rank">#</span>
          <span className="hub-th">Product</span>
          <span className="hub-th">Platform</span>
          <span className="hub-th hub-th-center">Network</span>
          <span className="hub-th hub-th-num">30d rate</span>
          <span className="hub-th hub-th-num">TVL</span>
          <span className="hub-th hub-th-right" />
        </div>
        <div className="hub-tbody" role="rowgroup">
          {rows.map((p, i) => (
            <div className="hub-row" role="row" key={p.id} style={{ gridTemplateColumns: RANK_COLS }}>
              <span className="hub-cell hub-rank">{i + 1}</span>
              <span className="hub-cell hub-vault">
                <span className="hub-vault-name" style={{ display: "block" }}>
                  {p.symbol}
                  {p.incentivized && (
                    <span className="rp-flag" title="Over half the rate is incentive emissions">
                      incentives
                    </span>
                  )}
                  {p.poolMeta && <span className="rp-vault-sub">{p.poolMeta}</span>}
                </span>
              </span>
              <span className="hub-cell hub-strategy">{p.platform}</span>
              <span className="hub-cell hub-strategy hub-th-center" style={{ textAlign: "center" }}>
                {chainLabel(p.chain)}
              </span>
              <span className="hub-cell hub-num hub-apy">
                {pct(histRate(p))}
                <span className="rp-rate-sub">
                  today {pct(p.apy)}
                  {p.range90d ? ` · 90d ${pct(p.range90d.min)}–${pct(p.range90d.max)}` : ""}
                </span>
              </span>
              <span className="hub-cell hub-num">{usd(p.tvlUsd)}</span>
              <span className="hub-cell" style={{ textAlign: "right" }}>
                <a
                  className="rp-discover"
                  href={p.platformUrl ?? p.llamaUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  Discover
                </a>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Crumbs() {
  return (
    <nav className="rp-crumbs" aria-label="Breadcrumb">
      <Link href="/">{SITE_NAME}</Link>
      <span className="sep">/</span>
      <span>Report</span>
      <span className="sep">/</span>
      <span>XRP Yield Ranking</span>
    </nav>
  );
}
