import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { AssetIcon } from "@/components/token-icons";
import { HomeHeroPreview } from "@/components/home-hero-preview";
import { DiscoverButton } from "@/components/report/discover-button";
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
}
interface XrpYieldData {
  generatedAt: string;
  stats: {
    venues: number;
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

const CHAIN_LABEL: Record<string, string> = { "XRPL EVM": "XRPL EVM" };
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

function baseSource(p: XrpPool): string {
  const c = (p.category || "").toLowerCase();
  if (c.includes("dex")) return "trading fees paid by people swapping through the pool";
  if (c.includes("lending")) return "interest paid by people borrowing the asset";
  if (c.includes("liquid staking") || c.includes("staking")) return "staking rewards passed through to holders";
  if (c.includes("yield")) return "an automated strategy compounding the underlying market yield";
  return "activity fees the protocol shares with suppliers";
}

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
  const title = "XRP Yield Ranking: Live Rates Across DeFi";
  const desc = `Where XRP earns onchain yield, ranked by real 30-day rate history. ${n} XRP-denominated venues - single-exposure vaults and dual-asset pools across DeFi - covering XRP, FXRP, stXRP and other wrapped forms. Live data, refreshed hourly.`;
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
  const singles = pools.filter((p) => !isDual(p));
  const duals = pools.filter((p) => isDual(p));

  // Hero hook: the best-paying single-exposure venue.
  const featured = singles[0];

  const updated = new Date(data.generatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const rates = pools.map(histRate).filter((v): v is number => v != null);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);

  // Venues that anchor the article, pulled live.
  const topSingle = singles[0];
  const deepestSingle = [...singles].sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
  const topPair = duals[0];

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
    <div className="uni-home-test">
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
          <h1 className="uni-home-h1">XRP Yield Ranking</h1>
          <p className="uni-home-sub">
            We&rsquo;ve analysed {pools.length}+ XRP-denominated yield sources
            across DeFi, from single-exposure vaults to dual-asset pools.
            Here&rsquo;s what we found out about where XRP actually earns, and
            what really pays each rate.
          </p>
          <a href="#rankings" className="uni-home-cta-primary">
            Explore the ranking
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <main className="uni-home-shell">
        <section className="uni-home-content" aria-labelledby="overview-title">
          <h2 id="overview-title">Overview</h2>
          <div className="rp-article">
            <p>
              XRP doesn&rsquo;t stake natively, so there&rsquo;s no protocol
              rate to simply claim. Every number on this page is earned by
              putting XRP, or a wrapped version of it, to work in a live market:
              lending it out, or supplying it to a trading pool. As of {updated}
              , we track <strong>{stats.venues} venues</strong> holding at least
              $25k each, spread across{" "}
              <strong>
                {stats.chains.length} networks ({stats.chains.map(chainLabel).join(", ")})
              </strong>
              . Rates run from <strong>{pct(lo)}</strong> to{" "}
              <strong>{pct(hi)}</strong>, with a median of{" "}
              <strong>{pct(stats.medianApy)}</strong> across every venue we list.
              The one caveat worth knowing up front:{" "}
              <strong>
                {stats.incentivized} of the {stats.venues}
              </strong>{" "}
              lean on incentive emissions for most of their headline rate, which
              tends to fade once the rewards program winds down. Everything here
              is an external protocol we track for research, not a {SITE_NAME}{" "}
              product.
            </p>
          </div>
        </section>

        <section className="uni-home-section" id="rankings">
          <header className="uni-home-section-head">
            <div>
              <h2 className="uni-home-section-title">Single-exposure XRP yield</h2>
              <p className="uni-home-section-sub">
                One-sided positions on XRP or a wrapped version of it. There is
                no second asset to drift against, which means no impermanent
                loss to manage. These are the closest thing to a plain
                &ldquo;earn on your XRP&rdquo; rate, ranked by their 30-day
                average.
              </p>
            </div>
          </header>
          <RankTable rows={singles} />
        </section>

        <section className="uni-home-section">
          <header className="uni-home-section-head">
            <div>
              <h2 className="uni-home-section-title">Dual-exposure XRP pools</h2>
              <p className="uni-home-section-sub">
                Two-asset liquidity pools that pair an XRP token with something
                else and earn from swap fees, usually topped up with incentive
                rewards. The headline rates are higher, but supplying to a
                two-asset pool means taking on impermanent loss if the two
                prices move apart.
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
          <h2 id="where-title">Where XRP yield comes from</h2>
          <div className="rp-article">
            <p>
              A yield number on its own tells you almost nothing. Two venues can
              both advertise &ldquo;8% on XRP&rdquo; while one pays it from real
              borrowing demand that has held for a year, and the other from a
              token-emissions campaign that ends next month. So it helps to know
              what is actually behind each rate. For XRP, it splits into two
              clear shapes.
            </p>

            {topSingle && (
              <>
                <h3>Single-sided XRP: wrapped and staked</h3>
                <p>
                  The cleanest way to earn on XRP is to hold a wrapped or staked
                  form of it and let a single protocol pay you. There is no pair
                  to manage and no impermanent loss, so the rate is simply
                  whatever that one venue generates. The best-paying single-sided
                  venue right now is{" "}
                  <strong>
                    {nice(topSingle.symbol)} on {topSingle.platform}
                  </strong>{" "}
                  ({chainLabel(topSingle.chain)}) at {pct(histRate(topSingle))},
                  where the rate comes from {baseSource(topSingle)}.
                </p>
                <p>
                  Depth matters as much as the headline number. The single-sided
                  venue holding the most XRP is{" "}
                  {deepestSingle ? (
                    <>
                      <strong>
                        {nice(deepestSingle.symbol)} on {deepestSingle.platform}
                      </strong>{" "}
                      with {usd(deepestSingle.tvlUsd)} at{" "}
                      {pct(histRate(deepestSingle))}
                    </>
                  ) : (
                    "still small"
                  )}
                  , which is the trade-off you see across this whole category:
                  the venues that pay the most tend to be the smallest and
                  newest, while the deepest, most-battle-tested ones pay
                  noticeably less. A modest rate on a large, long-running pool is
                  often the more durable choice than a big rate on a thin one.
                </p>
              </>
            )}

            {topPair && (
              <>
                <h3>XRP liquidity pairs pay more, and swing more</h3>
                <p>
                  Every double-digit rate on this page comes from a two-asset
                  liquidity pool, and there is a reason. You are being paid to
                  provide liquidity that traders swap against, plus, in most
                  cases, a layer of incentive tokens on top. Right now{" "}
                  <strong>
                    {nice(topPair.symbol)} on {topPair.platform}
                  </strong>{" "}
                  leads at {pct(histRate(topPair))}
                  {topPair.range90d
                    ? `, but over the last 90 days that same pool has paid anywhere between ${pct(topPair.range90d.min)} and ${pct(topPair.range90d.max)}`
                    : ""}
                  {topPair.incentivized
                    ? ", and most of today's number is emissions rather than trading fees, so treat it as temporary rather than a rate you can count on"
                    : ""}
                  .
                </p>
                <p>
                  The higher number is real, but it comes with two strings. The
                  first is impermanent loss: if the two tokens in the pair move
                  apart in price, your position can end up worth less than if you
                  had simply held them. The second is that emissions-driven rates
                  are, by design, temporary. Liquidity pools can be a good way to
                  earn on XRP, but they reward attention, not set-and-forget.
                </p>
              </>
            )}

            <h3>How to read the ranking</h3>
            <p>
              We rank by the 30-day average rate rather than today&rsquo;s spot
              number, so a single big day of emissions can&rsquo;t flatter a pool
              to the top. Each row also shows today&rsquo;s rate and, where we
              have the history, the range that pool has paid over the last 90
              days, which is the quickest tell for how stable a rate really is: a
              tight band is steady, organic yield, and a wide one usually means
              emissions or volume-sensitive fees.
            </p>

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
              Every pool DeFiLlama tracks whose symbol contains an
              XRP-denominated token (XRP, or a wrapped variant such as FXRP,
              stXRP, cbXRP or wXRP), holding at least $25k TVL. RLUSD, Ripple&rsquo;s
              dollar stablecoin, is excluded because it is not XRP-denominated,
              and pools paying nothing are dropped.
            </dd>
            <dt>Ranking</dt>
            <dd>
              By 30-day average rate, so short-lived emission spikes don&rsquo;t
              decide the order. Today&rsquo;s spot rate and the 90-day range are
              shown alongside.
            </dd>
            <dt>Freshness</dt>
            <dd>Refreshed hourly from the free DeFiLlama API; this page reflects the {updated} snapshot.</dd>
            <dt>What this is not</dt>
            <dd>
              Not an endorsement and not financial advice. {SITE_NAME} indexes
              DeFi yield data; the venues above are external. Our own coverage is{" "}
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

const RANK_COLS = "40px minmax(150px,1.7fr) minmax(96px,1fr) 92px 1fr 0.8fr 104px";

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
                <TokenIcons symbol={p.symbol} />
                <span className="hub-vault-name" style={{ display: "block" }}>
                  {nice(p.symbol)}
                  {p.poolMeta && <span className="rp-vault-sub">{p.poolMeta}</span>}
                </span>
              </span>
              <span className="hub-cell hub-strategy">{p.platform}</span>
              <span className="hub-cell hub-strategy" style={{ textAlign: "center" }}>
                {chainLabel(p.chain)}
              </span>
              <span className="hub-cell hub-num hub-apy">
                {pct(histRate(p))}
                <span className="rp-rate-sub">
                  today {pct(p.apy)}
                  {p.range90d ? ` · 90d ${pct(p.range90d.min)}-${pct(p.range90d.max)}` : ""}
                </span>
              </span>
              <span className="hub-cell hub-num">{usd(p.tvlUsd)}</span>
              <span className="hub-cell" style={{ textAlign: "right" }}>
                <DiscoverButton href={p.platformUrl ?? p.llamaUrl} platform={p.platform} />
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
