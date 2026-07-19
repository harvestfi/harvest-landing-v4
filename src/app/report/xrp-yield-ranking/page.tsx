import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { AssetIcon } from "@/components/token-icons";
import { HomeHeroPreview } from "@/components/home-hero-preview";
import { DiscoverButton } from "@/components/report/discover-button";
import { VENUE_GROUPS, WRAPPED_TOKENS, type VenueNote } from "./venue-notes";
import {
  breadcrumbSchema,
  faqPageSchema,
  reportDatasetSchema,
  reportItemListSchema,
  reportWebPageSchema,
} from "@/lib/jsonld";
import "../../_styles/home.css";
import "../../_styles/report.css";

// /report/xrp-yield-ranking - a continuously updated, externally-fed report on
// where XRP-denominated assets (XRP and its wrapped forms - FXRP, stXRP, cbXRP,
// wXRP...) earn onchain yield. RLUSD (Ripple's stablecoin) is intentionally out
// of scope: it isn't XRP-denominated. Every venue is external - none are
// Harvest products. Isolated from the product pipeline: reads only
// data/xrp-yield.json (scripts/fetch-xrp-yield.mjs, free DeFiLlama API, hourly).
// No Supabase, no vaults.json.

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
  // Set by the allowlist hydrator (scripts/fetch-xrp-yield.mjs) from the
  // canonical registry (data/xrp-venues.json).
  curated?: boolean;
  productType?: string;
  venueSlug?: string;
  // Optional display label overriding `symbol` (e.g. Spectra PTs show the
  // maturity); the icon still keys off `symbol`.
  displayName?: string;
  // Ranking Product column: `asset` is the clean headline (e.g. "stXRP",
  // "cbXRP / WETH"), `detail` the smaller sub-line under it ("PT · Aug 2026").
  asset?: string;
  detail?: string | null;
  entity?: string | null;
  // "30d" (30-day mean / fixed rate), "current" (live spot APY), "na" (no feed).
  rateBasis?: string;
  rateNa?: boolean;
  // Daily rate series for the charts (Spectra PT history + DeFiLlama daily).
  history?: { d: string; apy: number }[];
}
interface XrpYieldData {
  generatedAt: string;
  stats: {
    venues: number;
    rated?: number;
    chains: string[];
    totalTvlUsd: number;
    medianApy: number;
    incentivized: number;
  };
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

const CHAIN_LABEL: Record<string, string> = { "XRPL EVM": "XRPL EVM", BSC: "BNB Chain" };
const chainLabel = (c: string) => CHAIN_LABEL[c] ?? c;

const pct = (v: number | null) => (v == null ? "-" : `${v.toFixed(2)}%`);
const usd = (n: number) =>
  n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : `$${Math.round(n / 1_000)}k`;
const histRate = (p: XrpPool) => p.apyMean30d ?? p.apy;
// Clean asset headline for the ranking Product column (falls back to the raw
// symbol for older snapshots that predate the `asset` field).
const assetHead = (p: XrpPool) => p.asset ?? nice(p.displayName ?? p.symbol);

// Nicer casing for display (icons still key off the raw token).
const nice = (s: string) =>
  s
    .replace(/STXRP/gi, "stXRP")
    .replace(/CBXRP/gi, "cbXRP")
    .replace(/\bWXRP\b/gi, "wXRP")
    .replace(/CSXRP/gi, "csXRP")
    .replace(/SXRP/gi, "sXRP");

const tokensOf = (symbol: string) =>
  symbol.split(/[-/]/).map((t) => t.trim()).filter(Boolean);
const isDual = (p: XrpPool) => p.exposure === "multi" || tokensOf(p.symbol).length > 1;

// Decorative spark for the hero card (the homepage card uses dummy data too).
function synthSpark(p: XrpPool): number[] {
  const r = histRate(p) ?? 1;
  if (p.range90d) {
    const { min, max } = p.range90d;
    return [min, (min + max) / 2, max * 0.8, min + (max - min) * 0.65, max, r];
  }
  return [r * 0.82, r, r * 0.94, r];
}

export async function generateMetadata(): Promise<Metadata> {
  const data = loadData();
  const n = data?.pools.length ?? 20;
  const chains = data?.stats.chains?.length ?? 5;
  const median = data?.stats.medianApy;
  const title = `XRP Yield Ranking: ${n} DeFi Products by Real Rate`;
  const desc = `Where to earn yield on XRP, ranked by real rates. ${n} curated XRP-denominated DeFi products across ${chains} networks${median ? `, median ${median.toFixed(2)}%` : ""}: lending, vaults, fixed-rate Principal Tokens and liquidity pools for XRP, FXRP, stXRP and cbXRP. XRP has no native staking, so these are the real onchain rates. Refreshed hourly from DeFiLlama, Spectra and Portals.`;
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
      <div className="uni-home-test rp-page">
        <Crumbs />
        <section className="uni-home-hero">
          <div className="uni-home-hero-inner">
            <h1 className="uni-home-h1">XRP Yield Ranking</h1>
            <p className="uni-home-sub">
              The first data snapshot is being generated. Check back shortly.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const { pools, stats } = data;

  // Hero hook: the best-paying single-sided venue (no impermanent loss to
  // explain in the card).
  const featured = pools.find((p) => !isDual(p)) ?? pools[0];

  // Split the ranking by exposure. Single-exposure = one-sided positions (no
  // impermanent loss); dual-exposure = two-asset liquidity pools. Pools arrive
  // sorted by 30d rate, so each list stays APY-sorted. The product type is
  // surfaced per row in the Type column.
  const singles = pools.filter((p) => !isDual(p));
  const duals = pools.filter((p) => isDual(p));

  // Principal Tokens with a daily history feed the max-fixed-rate chart.
  const ptRows = pools.filter(
    (p) => productTypeOf(p) === "Fixed-rate" && (p.history?.length ?? 0) >= 2,
  );
  // Selected venues with a daily DeFiLlama history feed the 30-day rate charts
  // (curated headline products, excluding the fixed-rate PTs which have their
  // own chart). Sorted by 30-day rate, capped so the grid stays scannable.
  const venueCharts = pools
    .filter(
      (p) =>
        p.curated &&
        productTypeOf(p) !== "Fixed-rate" &&
        (p.history?.length ?? 0) >= 2,
    )
    .sort((a, b) => (histRate(b) ?? 0) - (histRate(a) ?? 0))
    .slice(0, 6);
  // Trajectory + TVL blend for the PT commentary (derived, so it stays accurate
  // between snapshots).
  const ptTvl = ptRows.reduce((s, p) => s + p.tvlUsd, 0);
  const ptOpenHi = ptRows.length
    ? Math.max(...ptRows.map((p) => p.history?.[0]?.apy ?? 0))
    : 0;
  const ptNowHi = ptRows.length
    ? Math.max(...ptRows.map((p) => histRate(p) ?? 0))
    : 0;

  // Early-answer snippet inputs: the top rate among non-PT single-exposure
  // products, the top dual-exposure pool, and the top fixed-rate PT (kept
  // distinct so the three clauses don't repeat the same row). Lists arrive
  // sorted by rate; all derived, so the block never drifts from the tables.
  const topPt = ptRows.reduce<XrpPool | null>(
    (best, p) => (best && (histRate(best) ?? 0) >= (histRate(p) ?? 0) ? best : p),
    null,
  );
  const topSingle =
    singles.find((p) => !p.rateNa && productTypeOf(p) !== "Fixed-rate") ?? singles[0];
  const topDual = duals.find((p) => !p.rateNa) ?? duals[0];
  const ratedCount = stats.rated ?? pools.filter((p) => !p.rateNa).length;

  // Structured-data inputs (rendered as JSON-LD at the top of the page).
  const itemListItems = pools.map((p) => ({
    name: `${assetHead(p)} on ${p.platform}`,
    url: p.platformUrl ?? p.llamaUrl,
  }));
  const crumbs = [
    { name: SITE_NAME, url: SITE_URL },
    { name: "Report" },
    { name: "XRP Yield Ranking", url: PAGE_URL },
  ];

  const updated = new Date(data.generatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const rates = pools.map(histRate).filter((v): v is number => v != null);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);

  const heroVault = featured
    ? {
        productName: nice(featured.symbol),
        asset: featured.symbol,
        chain: featured.chain,
        protocol: featured.platform,
        vaultType: "Single-exposure",
        apy24h: featured.apy ?? 0,
        apy30d: featured.apyMean30d ?? 0,
        tvl: featured.tvlUsd,
        apySpark: synthSpark(featured),
        tvlSpark: [featured.tvlUsd * 0.7, featured.tvlUsd * 0.86, featured.tvlUsd],
      }
    : undefined;

  return (
    <div className="uni-home-test rp-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportWebPageSchema({
              name: "XRP Yield Ranking",
              url: PAGE_URL,
              description: `Where to earn yield on XRP, ranked by real 30-day rates across ${stats.venues} DeFi venues.`,
              dateModified: data.generatedAt,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(reportItemListSchema(itemListItems, PAGE_URL)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(FAQ)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportDatasetSchema({
              name: "XRP DeFi yield ranking dataset",
              description: `Rate, TVL and 90-day range for ${stats.venues} curated XRP-denominated DeFi products (lending, vaults, liquid staking, fixed-rate Principal Tokens and liquidity pools) across ${stats.chains.length} networks, refreshed hourly. Sourced from the DeFiLlama, Spectra and Portals APIs; informational research, not financial advice.`,
              url: PAGE_URL,
              dateModified: data.generatedAt,
              numberOfItems: stats.venues,
              keywords: [
                "XRP",
                "FXRP",
                "stXRP",
                "cbXRP",
                "DeFi",
                "yield",
                "APY",
                "TVL",
                "Principal Token",
              ],
              sources: ["https://defillama.com", "https://spectra.finance"],
            }),
          ),
        }}
      />
      <Crumbs />

      <section className="uni-home-hero rp-hero">
        {heroVault && (
          <HomeHeroPreview
            vault={heroVault}
            headlineValueOverride={pct(histRate(featured))}
            headlineLabelOverride="30-day average rate"
            apyTabLabel="Rate"
          />
        )}
        <div className="uni-home-hero-inner">
          <h1 className="uni-home-h1">XRP Yield Ranking: Where XRP Actually Earns</h1>
          <p className="uni-home-sub">
            The clearest way to earn yield on XRP, ranked by real rates. This
            report follows {pools.length} curated XRP products, from lending and
            vaults to fixed-rate Principal Tokens and liquidity pools, ranked by
            rate and split by exposure.
          </p>
          <p className="rp-updated">
            Last updated {updated} · refreshed hourly from DeFiLlama, Spectra and
            Portals
          </p>
          <a href="#rankings" className="uni-home-cta-primary">
            Explore the ranking
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <main className="uni-home-shell">
        <section className="uni-home-content" aria-labelledby="overview-title">
          <p className="rp-eyebrow">Report</p>
          <h2 id="overview-title">Overview</h2>
          <div className="rp-article">
            <p>
              Earning yield on XRP has quietly grown into one of the more active
              corners of DeFi. XRP is not a proof-of-stake asset, so there is no
              native staking rate to claim. The XRP Ledger&rsquo;s native AMM
              already pays trading fees on-ledger, and on-ledger lending is
              starting to arrive, while the deeper and more varied rates live on
              smart-contract chains. There, XRP is held as a wrapped token
              (FXRP, cbXRP, or a staked form such as stXRP) and supplied to a
              lending market, a vault, a fixed-rate Principal Token, or a
              liquidity pool. This page follows a curated set of these products
              and ranks them by rate.
            </p>
            <p>
              As of {updated} this report tracks{" "}
              <strong>{stats.venues} XRP products</strong> across{" "}
              <strong>
                {stats.chains.length} networks ({stats.chains.map(chainLabel).join(", ")})
              </strong>
              . Rates span <strong>{pct(lo)}</strong> to{" "}
              <strong>{pct(hi)}</strong>, with a median of{" "}
              <strong>{pct(stats.medianApy)}</strong> across the {ratedCount} with
              a live rate. <strong>{stats.incentivized} of the {stats.venues}</strong>{" "}
              lean on reward-token incentives for the bulk of their rate, so those
              tend to ease off once a rewards program winds down. Every product
              here is an external protocol tracked for research, not a{" "}
              {SITE_NAME} product.
            </p>
          </div>
          <nav className="rp-toc" aria-label="On this page">
            <span className="rp-toc-label">On this page</span>
            <a href="#rankings">The ranking</a>
            <a href="#ratehist-title">30-day rate history</a>
            <a href="#where-title">Where yield comes from</a>
            <a href="#tokens-title">Wrapped forms of XRP</a>
            <a href="#staking">Can you stake XRP?</a>
            <a href="#cefi">CeFi vs DeFi</a>
            <a href="#risks">Risks</a>
            <a href="#venues-title">Venues in depth</a>
            <a href="#faq">FAQ</a>
            <a href="#method-title">Method</a>
          </nav>
        </section>

        <section className="uni-home-content" id="rankings" aria-labelledby="rankings-title">
          <p className="rp-eyebrow">Live rates</p>
          <h2 id="rankings-title">The ranking</h2>
          <p className="rp-lead">
            The curated XRP products, ranked by rate and split by exposure.
            Single-exposure positions sit on one side of the market;
            dual-exposure positions pair an XRP token with a second asset. The
            Type column names each product; a few rows show a current APY where a
            30-day history is not published.
          </p>
          <div className="rp-rank-group">
            <div className="rp-rank-head">
              <h3>
                Single-exposure XRP yield
                <span className="rp-rank-count">{singles.length} venues</span>
              </h3>
              <p>
                One-sided positions with no second asset: lending markets,
                curated vaults, liquid staking, fixed-rate Principal Tokens and
                stXRP pools. Sorted by rate.
              </p>
            </div>
            <RankTable rows={singles} />
          </div>
          <div className="rp-rank-group">
            <div className="rp-rank-head">
              <h3>
                Dual-exposure XRP pools
                <span className="rp-rank-count">{duals.length} venues</span>
              </h3>
              <p>
                Two-asset liquidity pools that pair an XRP token with something
                else and earn swap fees plus rewards. Higher headline rates, with
                impermanent loss to manage. Sorted by rate.
              </p>
            </div>
            <RankTable rows={duals} />
          </div>
          <p className="rp-source-note">
            Rates and TVL from DeFiLlama, Spectra and Portals, as of {updated},
            refreshed hourly. A few rows show a current APY where a 30-day
            history is not published; one row has no public rate feed yet.
            &ldquo;Discover&rdquo; opens the platform&rsquo;s own site.
          </p>
        </section>

        <section className="uni-home-content" aria-labelledby="snapshot-title">
          <p className="rp-eyebrow">Summary</p>
          <h2 id="snapshot-title">XRP yield right now</h2>
          <div className="rp-snapshot">
            <p>
              As of {updated}, the top vault or lending rate is{" "}
              <strong>{pct(histRate(topSingle))}</strong> on {assetHead(topSingle)}{" "}
              ({topSingle.platform})
              {topDual ? (
                <>
                  , while dual-exposure liquidity pools reach{" "}
                  <strong>{pct(histRate(topDual))}</strong> on {assetHead(topDual)}{" "}
                  ({topDual.platform})
                </>
              ) : null}
              {topPt ? (
                <>
                  . Fixed-rate Principal Tokens sit near{" "}
                  <strong>{pct(histRate(topPt))}</strong>, locked to maturity
                </>
              ) : null}
              . The median across the {ratedCount} rated products is{" "}
              <strong>{pct(stats.medianApy)}</strong>.
            </p>
            <p className="rp-snapshot-note">
              Headline dual-exposure and pool rates often include reward-token
              incentives and carry impermanent loss, so they tend to ease once a
              rewards program tapers. {stats.incentivized} of the {stats.venues}{" "}
              products here rely on incentives for the bulk of their rate. The
              30-day average, used where a history is available, is the steadier
              guide.
            </p>
          </div>
        </section>

        {venueCharts.length > 0 && (
          <section className="uni-home-content" aria-labelledby="ratehist-title">
            <p className="rp-eyebrow">Charts</p>
            <h2 id="ratehist-title">30-day rate history</h2>
            <p className="rp-lead">
              How the rate has moved over the last 30 days for a selection of
              the larger venues, from DeFiLlama&rsquo;s daily record. Useful for
              telling a steady rate apart from one riding a short-lived incentive
              spike.
            </p>
            <div className="rp-charts">
              {venueCharts.map((p) => (
                <RateChart
                  key={p.id}
                  history={(p.history ?? []).slice(-30)}
                  title={assetHead(p)}
                  subtitle={p.platform}
                  tvlUsd={p.tvlUsd}
                  nowValue={histRate(p)}
                  nowLabel="30d APY"
                  ariaKind="30-day APY"
                />
              ))}
            </div>
            <p className="rp-source-note">
              Daily APY from DeFiLlama, last 30 days, as of {updated}.
            </p>
          </section>
        )}

        {ptRows.length > 0 && (
          <section className="uni-home-content" aria-labelledby="ptchart-title">
            <p className="rp-eyebrow">Fixed rate</p>
            <h2 id="ptchart-title">PT max fixed rate, daily</h2>
            <p className="rp-lead">
              The locked-in fixed rate on each staked-XRP Principal Token, tracked
              day by day since the market opened, straight from Spectra. A PT
              secures this rate to maturity, so the line is the full record of
              what each maturity has offered.
            </p>
            <div className="rp-charts">
              {ptRows.map((p) => (
                <RateChart
                  key={p.id}
                  history={p.history ?? []}
                  title={nice(p.displayName ?? p.symbol)}
                  tvlUsd={p.tvlUsd}
                  nowValue={p.history?.[p.history.length - 1]?.apy ?? histRate(p)}
                  nowLabel="max fixed"
                  ariaKind="daily max fixed rate"
                />
              ))}
            </div>
            <p className="rp-source-note">
              Both maturities opened near {pct(ptOpenHi)} and have eased into the
              low single digits since, a gentle downtrend as early demand settled.
              The top fixed rate now sits around {pct(ptNowHi)}, still competitive
              with the single-sided field, and the two Spectra pools together hold{" "}
              {usd(ptTvl)} in liquidity.
            </p>
          </section>
        )}

        <section className="uni-home-content" aria-labelledby="where-title">
          <p className="rp-eyebrow">Guide</p>
          <h2 id="where-title">Where XRP yield comes from</h2>
          <div className="rp-article">
            <p>
              The rates on this page all trace back to one of a few simple
              sources. Knowing which source is behind a number makes it much
              easier to tell a steady, organic rate from one that is mostly
              short-term rewards.
            </p>

            <h3>Lending</h3>
            <p>
              Wrapped XRP supplied to a money market such as Kinetic on Flare or
              Moonwell on Base earns the interest borrowers pay on their loans. It is
              single-sided, so there is no second asset to track, and on Flare the
              base rate is often topped up with rFLR reward tokens. This is the
              closest thing XRP has to a plain savings rate.
            </p>

            <h3>Vaults and liquid staking</h3>
            <p>
              Vaults and liquid-staking tokens do the work automatically. A
              curated vault such as Spectra, Upshift, Mystic or Superform, or a
              staking token like Firelight&rsquo;s stXRP, takes the wrapped XRP,
              runs a strategy with it and compounds the results into a single
              token managed by a curator. The rate blends whatever the strategy
              earns with any reward incentives on top.
            </p>

            <h3>Liquidity provision</h3>
            <p>
              Pairing an XRP token with another asset in a pool on SparkDEX,
              Aerodrome or Enosys earns a share of the swap fees, usually with
              extra reward tokens layered on. The headline rates are the highest
              on the page, with one trade-off: if the two tokens drift apart in
              price the position can suffer impermanent loss, so these pools
              reward active management.
            </p>

            <h3>Fixed-rate Principal Tokens</h3>
            <p>
              Spectra adds one more mechanism that is unique on this list: the
              Principal Token, or PT. A PT for staked XRP trades at a discount
              today and redeems one-for-one for the underlying at a set maturity
              date. The gap between that discounted price and the full redemption
              value is a fixed rate locked in up front, so unlike everything else
              here the number does not drift day to day. It is single-sided with
              no impermanent loss; the trade-off is that the position runs to
              maturity, and an early exit takes whatever the market will pay.
              Spectra publishes each PT&rsquo;s current max fixed rate, which is
              the figure this report tracks.
            </p>

            <h3>How the ranking is sorted</h3>
            <p>
              Venues are sorted by the 30-day average rate rather than
              today&rsquo;s spot number, so a single big day of rewards cannot
              flatter a venue to the top. The tables are split by exposure, and a
              Type column names each product so like compares with like.
            </p>

            <div className="rp-callout">
              Every venue on this page is an external protocol tracked for
              research. None are {SITE_NAME} products. This page is informational
              only, and past rates are no promise of what a venue pays next.
            </div>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="tokens-title">
          <p className="rp-eyebrow">Tokens</p>
          <h2 id="tokens-title">The wrapped forms of XRP</h2>
          <div className="rp-article">
            <p>
              Beyond the XRP Ledger&rsquo;s own native AMM, every rate on this
              page starts with XRP moved onto a smart-contract chain in a wrapped
              form. The wrapper matters as much as the venue: some are trustless
              and collateral-backed, others rest on a single custodian. These are
              the four forms that appear most across the venues here.
            </p>
            <div className="rp-gloss-list">
              {WRAPPED_TOKENS.map((t) => (
                <div className="rp-gloss-row" key={t.token}>
                  <div className="rp-gloss-id">
                    <AssetIcon asset={t.icon} size={24} />
                    <span className="rp-gloss-tok">{nice(t.token)}</span>
                    <span className="rp-gloss-chain">{t.chain}</span>
                  </div>
                  <p className="rp-gloss-desc">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="uni-home-content" id="staking" aria-labelledby="staking-title">
          <p className="rp-eyebrow">Explainer</p>
          <h2 id="staking-title">Can you stake XRP?</h2>
          <div className="rp-article">
            <p>
              Short answer: no. XRP is not a proof-of-stake asset, and the XRP
              Ledger has no validator staking and no native staking rewards, so
              an advertised &ldquo;XRP staking&rdquo; rate is really describing
              something else. Every rate on this page comes from putting XRP to
              work in a market.
            </p>
            <p>
              The label usually covers one of three mechanisms: lending XRP and
              earning the interest borrowers pay; supplying it to a liquidity
              pool and earning swap fees; or holding a liquid staking token such
              as stXRP, where a protocol stakes the wrapped XRP behind the scenes
              and passes a rate through. The XRP Ledger&rsquo;s native AMM also
              pays trading fees on-ledger. None are native staking, and each
              carries its own risk, which is why every venue here is labelled by
              what it actually does.
            </p>
          </div>
        </section>

        <section className="uni-home-content" id="cefi" aria-labelledby="cefi-title">
          <p className="rp-eyebrow">Compare</p>
          <h2 id="cefi-title">CeFi vs DeFi XRP yield</h2>
          <div className="rp-article">
            <p>
              XRP can also earn through centralized &ldquo;Earn&rdquo; programs
              on exchanges and lenders. They are worth understanding, because they
              compete for the same searches and make a different trade-off.
            </p>
            <p>
              Centralized programs are simple: XRP is held on the platform, which
              pays a rate, sometimes higher than DeFi thanks to promotional or
              token incentives. The trade-off is custody. The XRP sits with the
              provider, which introduces solvency and counterparty risk, and the
              rate can change or be pulled at will. This report focuses on DeFi
              instead, because the positions are onchain and verifiable: the
              contract, the collateral and the real rate are all visible, and
              self-custody is usually retained. There the trade-off is
              smart-contract and bridge risk rather than counterparty risk.
              Neither is strictly safer; they fail in different ways.
            </p>
          </div>
        </section>

        <section className="uni-home-content" id="risks" aria-labelledby="risks-title">
          <p className="rp-eyebrow">Risk</p>
          <h2 id="risks-title">Key risks</h2>
          <div className="rp-article">
            <p>
              Every rate on this page carries risk. These are the main ones that
              sit behind the numbers.
            </p>
            <dl className="rp-method">
              <dt>Bridge and wrapper risk</dt>
              <dd>
                Every wrapped XRP depends on whatever issues it. FXRP relies on
                Flare&rsquo;s FAssets agents and collateral, cbXRP on Coinbase
                custody, wXRP on Hex Trust and LayerZero. If a bridge or issuer
                fails or de-pegs, the wrapped token can trade below the XRP it
                represents.
              </dd>
              <dt>Impermanent loss</dt>
              <dd>
                Liquidity pools pair XRP with a second asset. If the two prices
                move apart, the position can be worth less than simply holding,
                which can outweigh the fees and rewards it earned.
              </dd>
              <dt>Incentive dependency</dt>
              <dd>
                {stats.incentivized} of the {stats.venues} venues here lean on
                reward-token emissions (mostly rFLR on Flare) for the bulk of
                their rate. Emissions are temporary by design, so those headline
                numbers tend to fall once a program tapers.
              </dd>
              <dt>Curator and manager risk</dt>
              <dd>
                Vaults are actively run by curators such as Clearstar, Gami Labs,
                Byzantine Labs and Monarq. Depositors rely on their allocation
                choices and controls on top of the underlying contracts.
              </dd>
              <dt>Smart-contract and oracle risk</dt>
              <dd>
                All of this is code. A bug, an exploit, or a bad price feed can
                cause loss even when the strategy itself is sound. Audits reduce
                this risk but never remove it.
              </dd>
            </dl>
            <div className="rp-callout">
              This page is informational only. It does not constitute financial
              advice. Past rates are no promise of future ones, and no DeFi yield
              is risk-free.
            </div>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="venues-title">
          <p className="rp-eyebrow">Reference</p>
          <h2 id="venues-title">XRP yield venues, explained</h2>
          <div className="rp-article">
            <p>
              A rate is only as good as what pays it. We looked into each venue
              in the ranking: what it actually is, where the yield comes from,
              who curates or manages it, and what points, incentives and backing
              sit behind it. Grouped by network, starting with Flare, where most
              XRP yield now lives.
            </p>
            {VENUE_GROUPS.map((g) => (
              <div className="rp-chain-group" key={g.chain}>
                <div className="rp-chain-head">
                  <h3>{g.chain}</h3>
                </div>
                {g.intro && <p className="rp-chain-intro">{g.intro}</p>}
                <div className="rp-venues">
                  {g.venues.map((v) => (
                    <VenueCard key={v.slug} v={v} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="uni-home-content" id="faq" aria-labelledby="faq-title">
          <p className="rp-eyebrow">FAQ</p>
          <h2 id="faq-title">XRP yield, answered</h2>
          <div className="rp-faq">
            {FAQ.map((f, i) => (
              <details className="rp-faq-item" key={i} open={i === 0}>
                <summary className="rp-faq-q">
                  <span>{f.q}</span>
                  <span className="rp-faq-mark" aria-hidden="true" />
                </summary>
                <p className="rp-faq-a">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="method-title">
          <p className="rp-eyebrow">Method</p>
          <h2 id="method-title">Method &amp; scope</h2>
          <dl className="rp-method">
            <dt>Inclusion</dt>
            <dd>
              A hand-curated set of {stats.venues} XRP-denominated products
              (XRP, or a wrapped variant such as FXRP, stXRP or cbXRP) across
              lending, vaults, liquid staking, fixed-rate Principal Tokens and
              liquidity pools. RLUSD, Ripple&rsquo;s dollar stablecoin, is out of
              scope because it is not XRP-denominated. Each product&rsquo;s rate
              and TVL are pulled live from its own source: DeFiLlama where a pool
              is tracked, the Spectra API for Principal Tokens, pools and
              MetaVaults, and the Portals API for products the others do not
              cover.
            </dd>
            <dt>Ranking</dt>
            <dd>
              By 30-day average rate where a history is available, so short-lived
              emission spikes don&rsquo;t decide the order; the 90-day range is
              shown for those. A few products show a current APY where no 30-day
              history is published, and one has no public rate feed yet.
            </dd>
            <dt>Freshness</dt>
            <dd>Refreshed hourly from the DeFiLlama, Spectra and Portals APIs; this page reflects the {updated} snapshot.</dd>
            <dt>What this is not</dt>
            <dd>
              The figures are informational only and are not an endorsement or
              financial advice. {SITE_NAME} indexes DeFi yield data; the venues
              above are external. Our own coverage is{" "}
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

// FAQ: visible Q&A + FAQPage schema, both from this one list. Answers are
// evergreen (no live figures) so the structured data stays valid between
// snapshots. Kept factual and non-advisory for YMYL.
const FAQ: { q: string; a: string }[] = [
  {
    q: "Can you stake XRP?",
    a: "No. XRP is not a proof-of-stake asset and has no native staking or validator rewards. The rates people call XRP staking actually come from lending XRP, providing liquidity, or holding a liquid staking token such as stXRP that stakes wrapped XRP on the holder's behalf.",
  },
  {
    q: "What is the best XRP yield right now?",
    a: "It depends on the level of risk. Single-sided options (lending and vaults) are the closest to a plain rate; liquidity pools show higher headline numbers but add impermanent loss and usually rely on incentives. The ranking above sorts every venue by its real 30-day average, so like compares with like.",
  },
  {
    q: "What are FXRP, stXRP and cbXRP?",
    a: "They are wrapped forms of XRP. FXRP is XRP bridged trustlessly onto Flare through the FAssets system; cbXRP is Coinbase-custodied wrapped XRP on Base; stXRP is Firelight's liquid staking token for FXRP. The choice of wrapper changes the trust model and the risk.",
  },
  {
    q: "Is earning yield on XRP safe?",
    a: "No DeFi yield is risk-free. On top of ordinary market risk, XRP yield adds bridge or custody risk on the wrapper, smart-contract and oracle risk on each venue, impermanent loss in pools, and reliance on incentive tokens that can fade. This page is informational research only.",
  },
  {
    q: "What is impermanent loss in an XRP liquidity pool?",
    a: "It is the gap between simply holding two tokens and supplying them to a pool. When the two prices drift apart, the pool rebalances against the position, so it can end up worth less than holding, even after the fees and rewards it earned.",
  },
  {
    q: "CeFi vs DeFi XRP yield, which is better?",
    a: "Neither is strictly better. Centralized Earn programs are simpler and sometimes pay more, but custody is given up and counterparty risk is taken on. DeFi keeps positions onchain and verifiable with self-custody, but adds smart-contract and bridge risk. This report tracks the DeFi side.",
  },
  {
    q: "What is the highest APY for XRP?",
    a: "The highest numbers here are almost always two-asset liquidity pools boosted by reward emissions, which is why they also carry impermanent loss and tend to fade. A steadier single-sided rate on a deep, long-running venue is often the more durable choice. The 30-day figure is the better guide than the spot number.",
  },
];

// Short display labels for the Type column, derived from productTypeOf.
function typeLabel(p: XrpPool): string {
  const k = productTypeOf(p);
  if (k === "Lending market") return "Lending";
  if (k === "Fixed-rate") return "Fixed-Rate PT";
  if (k === "Fixed-term pool") return "Fixed-Term";
  if (k === "Vault") return "Vault";
  return "Pool";
}

// Resolve a pool to one of the product-type keys. Curated rows carry an
// explicit productType; everything else is inferred from the DeFiLlama
// category / project / exposure.
function productTypeOf(p: XrpPool): string {
  const t = (p.productType || "").toLowerCase();
  // Principal Tokens first: their productType/category is "Fixed-Rate", which
  // also contains "fixed", so it must be caught before the fixed-term rule.
  if (t.includes("fixed-rate") || t.includes("principal")) return "Fixed-rate";
  if (t.includes("lending")) return "Lending market";
  if (t.includes("fixed")) return "Fixed-term pool";
  if (t.includes("vault")) return "Vault"; // covers MetaVault
  if (t.includes("pool")) return "Liquidity pool";
  const c = (p.category || "").toLowerCase();
  const proj = (p.project || "").toLowerCase();
  if (c.includes("fixed-rate") || c.includes("principal")) return "Fixed-rate";
  if (c.includes("lending")) return "Lending market";
  if (proj.startsWith("spectra-v2") || (c === "yield" && p.exposure === "single"))
    return "Fixed-term pool";
  if (
    c.includes("aggregator") ||
    c.includes("allocator") ||
    c.includes("curator") ||
    c.includes("metavault") ||
    c === "yield"
  )
    return "Vault";
  if (c.includes("dex")) return "Liquidity pool";
  return p.exposure === "single" ? "Vault" : "Liquidity pool";
}

function TokenIcons({ symbol }: { symbol: string }) {
  const toks = tokensOf(symbol).slice(0, 2);
  return (
    <span className="rp-toks">
      {toks.map((t, i) => (
        <span
          key={i}
          className="rp-tok"
          style={{ marginLeft: i ? -9 : 0, zIndex: toks.length - i }}
        >
          <AssetIcon asset={t} size={24} />
        </span>
      ))}
    </span>
  );
}

function RankTable({ rows }: { rows: XrpPool[] }) {
  if (rows.length === 0) {
    return <div className="hub-empty">No venues in this category right now.</div>;
  }
  return (
    <div className="hub-table-wrap rp-rank" data-nosnippet="">
      <div className="hub-table" role="table" aria-label="XRP yield ranking">
        <div className="hub-thead" role="row">
          <span className="hub-th hub-th-rank">#</span>
          <span className="hub-th">Product</span>
          <span className="hub-th hub-th-num">30d APY</span>
          <span className="hub-th">Type</span>
          <span className="hub-th">Platform</span>
          <span className="hub-th">Network</span>
          <span className="hub-th hub-th-num">TVL</span>
          <span className="hub-th hub-th-right" />
        </div>
        <div className="hub-tbody" role="rowgroup">
          {rows.map((p, i) => (
            <div className="hub-row" role="row" key={p.id}>
              <span className="hub-cell hub-rank">{i + 1}</span>
              <span className="hub-cell hub-vault">
                <TokenIcons symbol={p.symbol} />
                <span className="rp-rank-nameblock">
                  {/* Clean asset headline, product detail underneath. */}
                  <span className="hub-vault-name">{assetHead(p)}</span>
                  {p.detail ? (
                    <span className="rp-rank-detail">{p.detail}</span>
                  ) : null}
                  {/* Mobile-only: the Platform + Network columns are hidden on
                      phones, so surface them under the detail line. */}
                  <span className="rp-rank-sub">
                    {chainLabel(p.chain)} · {p.platform}
                  </span>
                </span>
              </span>
              <span
                className="hub-cell hub-num hub-apy"
                title={
                  p.rateNa
                    ? "No public rate feed yet"
                    : p.rateBasis === "current"
                      ? "Current APY (30-day history not published)"
                      : undefined
                }
              >
                {p.rateNa ? "—" : pct(histRate(p))}
              </span>
              <span className="hub-cell rp-cell-text">
                <span className="rp-type">{typeLabel(p)}</span>
              </span>
              <span className="hub-cell rp-cell-text">{p.platform}</span>
              <span className="hub-cell rp-cell-text">{chainLabel(p.chain)}</span>
              <span className="hub-cell hub-num">
                {p.tvlUsd > 0 ? usd(p.tvlUsd) : "—"}
              </span>
              <span className="hub-cell rp-cell-action">
                <DiscoverButton
                  href={p.platformUrl ?? p.llamaUrl}
                  platform={p.platform}
                  source={`ranking:${p.venueSlug ?? p.project}`}
                  product={assetHead(p)}
                  chain={p.chain}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VenueCard({ v }: { v: VenueNote }) {
  // Type + Network lead the facts as plain key/value pairs (clearer to read
  // and to parse than the old header badges), then the researched facts.
  const facts = [
    { label: "Type", value: v.type },
    { label: "Network", value: chainLabel(v.chain) },
    ...v.facts,
  ];
  return (
    <article className="rp-venue">
      <div className="rp-venue-head">
        <TokenIcons symbol={v.assets.join("-")} />
        <span className="rp-venue-title">
          <span className="rp-venue-name">{nice(v.product)}</span>
          <span className="rp-venue-plat">{v.platform}</span>
        </span>
        <span className="rp-visit-wrap">
          <DiscoverButton
            href={v.url}
            platform={v.platform}
            label="Visit"
            source={`venue:${v.slug}`}
            product={nice(v.product)}
            chain={v.chain}
          />
        </span>
      </div>
      <div className="rp-venue-body">
        <div className="rp-venue-prose">
          {v.blurb.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="rp-facts">
          {facts.map((f, i) => (
            <div className="rp-fact" key={i}>
              <span className="rp-fact-k">{f.label}</span>
              <span className="rp-fact-v">{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

// Static SVG line chart of a daily rate series. Server rendered (no client JS):
// area fill + line + end dot, auto-scaled to the series with a little headroom,
// first/last dates below the plot. Shared by the PT fixed-rate charts and the
// selected-venue 30-day APY charts (only the header labels differ).
function RateChart({
  history,
  title,
  subtitle,
  tvlUsd,
  nowValue,
  nowLabel,
  ariaKind,
}: {
  history: { d: string; apy: number }[];
  title: string;
  subtitle?: string;
  tvlUsd: number;
  nowValue: number | null;
  nowLabel: string;
  ariaKind: string;
}) {
  const h = history ?? [];
  if (h.length < 2) return null;

  const W = 680;
  const H = 190;
  const padX = 6;
  const padT = 12;
  const padB = 6;
  const apys = h.map((r) => r.apy);
  let lo = Math.min(...apys);
  let hi = Math.max(...apys);
  const room = Math.max((hi - lo) * 0.15, 0.2);
  lo -= room;
  hi += room;
  const innerW = W - padX * 2;
  const innerH = H - padT - padB;
  const xAt = (i: number) => padX + (i / (h.length - 1)) * innerW;
  const yAt = (v: number) => padT + (1 - (v - lo) / (hi - lo || 1)) * innerH;

  const line = h
    .map((r, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(r.apy).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${xAt(h.length - 1).toFixed(1)},${(H - padB).toFixed(1)} L${xAt(0).toFixed(1)},${(H - padB).toFixed(1)} Z`;
  const last = h[h.length - 1];
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="rp-chart-card">
      <div className="rp-chart-head">
        <span className="rp-chart-title">
          {title}
          {subtitle ? <span className="rp-chart-sub">{subtitle}</span> : null}
          <span className="rp-chart-tvl">{usd(tvlUsd)} TVL</span>
        </span>
        <span className="rp-chart-now">
          {pct(nowValue)}
          <small>{nowLabel}</small>
        </span>
      </div>
      <div className="rp-chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title} ${ariaKind}, ${pct(h[0].apy)} to ${pct(last.apy)}`}
        >
          <path d={area} className="rp-chart-area" />
          <path d={line} className="rp-chart-line" fill="none" vectorEffect="non-scaling-stroke" />
          <circle cx={xAt(h.length - 1)} cy={yAt(last.apy)} r="3.5" className="rp-chart-dot" />
        </svg>
      </div>
      <div className="rp-chart-axis">
        <span>{fmt(h[0].d)}</span>
        <span>{fmt(last.d)}</span>
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
