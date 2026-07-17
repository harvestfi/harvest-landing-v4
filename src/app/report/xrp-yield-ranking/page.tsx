import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { AssetIcon } from "@/components/token-icons";
import { HomeHeroPreview } from "@/components/home-hero-preview";
import { DiscoverButton } from "@/components/report/discover-button";
import { VENUE_GROUPS, WRAPPED_TOKENS, type VenueNote } from "./venue-notes";
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
  // Set by the curated-override layer (scripts/apply-xrp-overrides.mjs).
  curated?: boolean;
  productType?: string;
  venueSlug?: string;
  // Optional display label overriding `symbol` (e.g. Spectra PTs show the
  // maturity); the icon still keys off `symbol`.
  displayName?: string;
  // Daily max-fixed-APY series for Spectra Principal Tokens (chart source).
  history?: { d: string; apy: number }[];
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

  // Group the ranking by product type, the same shape as the source table
  // (Lending markets, Vaults, Fixed-term pools, Liquidity pools). Pools keep
  // their 30d-rate order within each group.
  const categories = RANK_CATEGORIES.map((c) => ({
    ...c,
    rows: pools.filter((p) => productTypeOf(p) === c.key),
  })).filter((c) => c.rows.length > 0);

  // Principal Tokens with a daily history feed the max-fixed-rate chart.
  const ptRows = pools.filter(
    (p) => productTypeOf(p) === "Fixed-rate" && (p.history?.length ?? 0) >= 2,
  );

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
              Earning on XRP has quietly grown into one of the more active
              corners of DeFi. Since XRP settles on its own ledger, the way to
              put it to work is to bring it onto a smart-contract chain as a
              wrapped token, then supply it to a lending market, a vault, or a
              trading pool that pays a rate. This page gathers those venues in
              one place and ranks them by the rate they have actually paid over
              the past 30 days.
            </p>
            <p>
              As of {updated} we track <strong>{stats.venues} venues</strong>{" "}
              holding at least $25k each, across{" "}
              <strong>
                {stats.chains.length} networks ({stats.chains.map(chainLabel).join(", ")})
              </strong>
              . Rates span <strong>{pct(lo)}</strong> to{" "}
              <strong>{pct(hi)}</strong>, with a median of{" "}
              <strong>{pct(stats.medianApy)}</strong>. One number worth keeping
              in mind: <strong>{stats.incentivized} of the {stats.venues}</strong>{" "}
              lean on reward-token incentives for most of their headline rate, so
              those tend to ease off once the rewards program winds down.
              Everything here is an external protocol we track for research, not
              a {SITE_NAME} product.
            </p>
          </div>
        </section>

        <section className="uni-home-content" id="rankings" aria-labelledby="rankings-title">
          <h2 id="rankings-title">The ranking</h2>
          <p className="rp-lead">
            Every XRP venue we track, ranked by its 30-day average rate and
            grouped by the kind of product it is, so you can compare like with
            like. Lending markets and vaults are single-sided; liquidity pools
            pair XRP with a second asset for a higher rate and a bit more to
            keep an eye on.
          </p>
          {categories.map((c) => (
            <div className="rp-rank-group" key={c.key}>
              <div className="rp-rank-head">
                <h3>
                  {c.label}
                  <span className="rp-rank-count">
                    {c.rows.length} {c.rows.length === 1 ? "venue" : "venues"}
                  </span>
                </h3>
                <p>{c.blurb}</p>
              </div>
              <RankTable rows={c.rows} />
            </div>
          ))}
          <p className="rp-source-note">
            Rates and TVL from DeFiLlama, as of {updated}, refreshed hourly.
            &ldquo;Discover&rdquo; opens the platform&rsquo;s own site.
          </p>
        </section>

        {ptRows.length > 0 && (
          <section className="uni-home-content" aria-labelledby="ptchart-title">
            <h2 id="ptchart-title">PT max fixed rate, daily</h2>
            <p className="rp-lead">
              How the locked-in fixed rate on each staked-XRP Principal Token has
              moved, day by day, straight from Spectra. This is the rate a buyer
              secures to maturity, not a floating yield, so the line is the whole
              story: buy when it is high, and that is what you keep.
            </p>
            <div className="rp-charts">
              {ptRows.map((p) => (
                <PtRateChart key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}

        <section className="uni-home-content" aria-labelledby="where-title">
          <h2 id="where-title">Where XRP yield comes from</h2>
          <div className="rp-article">
            <p>
              The rates on this page all trace back to one of a few simple
              places. Once you can see where a number is coming from, it gets
              much easier to tell a steady, organic rate from one that is mostly
              short-term rewards. Here is the friendly version.
            </p>

            <h3>Lending it out</h3>
            <p>
              Supply your wrapped XRP to a money market like Kinetic, Venus or
              Moonwell and borrowers pay you interest for the loan. It is
              single-sided, so there is no second asset to track, and on Flare
              the base rate is often topped up with rFLR reward tokens. This is
              about as close as XRP gets to a plain savings rate.
            </p>

            <h3>Handing it to a vault</h3>
            <p>
              Vaults and liquid-staking tokens do the work for you. A curated
              vault such as Spectra, Upshift, Mystic or Superform, or a staking
              token like Firelight&rsquo;s stXRP, takes your wrapped XRP, runs a
              strategy with it and compounds the results, so you hold a single
              token and let a manager handle the rest. The rate blends whatever
              the strategy earns with any reward incentives on top.
            </p>

            <h3>Providing liquidity</h3>
            <p>
              Pair your XRP with another token in a pool on SparkDEX, Aerodrome
              or Enosys and you earn a share of the swap fees, usually with extra
              reward tokens layered on. The headline rates are the highest on the
              page, with one trade-off: if the two tokens drift apart in price
              you can face impermanent loss, so these suit people who are happy
              to keep an eye on things.
            </p>

            <h3>Locking a rate with Principal Tokens</h3>
            <p>
              Spectra adds one more angle that is unique on this list: the
              Principal Token, or PT. When you buy the PT for staked XRP you pay
              a discount today and redeem it one-for-one for the underlying at a
              set maturity date. The gap between that discounted price and the
              full redemption value is a fixed rate you lock in up front, so
              unlike everything else here the number does not drift day to day.
              It is single-sided with no impermanent loss; the trade-off is that
              the position runs to maturity, and selling early means taking
              whatever the market will pay. Spectra publishes each PT&rsquo;s
              current max fixed rate, which is the figure we track.
            </p>

            <h3>How we rank</h3>
            <p>
              We sort by the 30-day average rate rather than today&rsquo;s spot
              number, so a single big day of rewards cannot flatter a venue to
              the top, and we group by product type so each table compares like
              with like.
            </p>

            <div className="rp-callout">
              Every venue on this page is an external protocol we track for
              research. None are {SITE_NAME} products, this page is informational
              only, and past rates are no promise of what a venue pays next.
            </div>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="tokens-title">
          <h2 id="tokens-title">The wrapped forms of XRP</h2>
          <div className="rp-article">
            <p>
              XRP can&rsquo;t earn on its own ledger, so every rate on this page
              starts by moving XRP onto a smart-contract chain in a wrapped form.
              Which wrapper you hold matters as much as the venue: some are
              trustless and collateral-backed, others rest on a single custodian.
              Here are the four you&rsquo;ll see most, plus the Solana form.
            </p>
            <div className="rp-glossary">
              {WRAPPED_TOKENS.map((t) => (
                <div className="rp-gloss" key={t.token}>
                  <div className="rp-gloss-head">
                    <AssetIcon asset={t.icon} size={22} />
                    <span className="rp-gloss-tok">{nice(t.token)}</span>
                    <span className="rp-gloss-chain">{t.chain}</span>
                  </div>
                  <p>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="venues-title">
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

        <section className="uni-home-content" aria-labelledby="method-title">
          <h2 id="method-title">Method &amp; scope</h2>
          <dl className="rp-method">
            <dt>Inclusion</dt>
            <dd>
              Every pool DeFiLlama tracks whose symbol contains an
              XRP-denominated token (XRP, or a wrapped variant such as FXRP,
              stXRP, cbXRP or wXRP), holding at least $25k TVL. RLUSD, Ripple&rsquo;s
              dollar stablecoin, is excluded because it is not XRP-denominated,
              and pools paying nothing are dropped. Fixed-rate Principal Tokens
              come from Spectra&rsquo;s own API, which supplies each PT&rsquo;s
              current max fixed rate and its history.
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

// Ranking columns: # | Product | Platform | Network | 30d rate | TVL | Discover.
const RANK_COLS = "34px minmax(150px,1.7fr) minmax(110px,1fr) minmax(84px,0.8fr) 92px 84px 104px";

// Product-type buckets, mirroring the source table's categories. Order is the
// display order; a bucket with no rows is skipped.
const RANK_CATEGORIES: { key: string; label: string; blurb: string }[] = [
  {
    key: "Lending market",
    label: "Lending markets",
    blurb:
      "Supply wrapped XRP and earn the interest borrowers pay. Single-sided, with no second asset to manage.",
  },
  {
    key: "Vault",
    label: "Vaults",
    blurb:
      "A curated strategy or aggregator puts your wrapped XRP to work and compounds it for you. You hold one token.",
  },
  {
    key: "Fixed-rate",
    label: "Fixed-rate (Principal Tokens)",
    blurb:
      "Buy a staked-XRP Principal Token at a discount and redeem it one-for-one at maturity, locking a fixed rate today. Single-sided, no impermanent loss, only found on Spectra.",
  },
  {
    key: "Fixed-term pool",
    label: "Fixed-term pools",
    blurb:
      "Provide liquidity to a staked-XRP yield market with a set maturity date, earning swap fees plus rewards.",
  },
  {
    key: "Liquidity pool",
    label: "Liquidity pools",
    blurb:
      "Pair XRP with a second token to earn swap fees plus rewards. Higher rates, with impermanent loss to keep an eye on.",
  },
];

// Resolve a pool to one of the RANK_CATEGORIES keys. Curated rows carry an
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
        <div className="hub-thead" role="row" style={{ gridTemplateColumns: RANK_COLS }}>
          <span className="hub-th hub-th-rank">#</span>
          <span className="hub-th">Product</span>
          <span className="hub-th">Platform</span>
          <span className="hub-th">Network</span>
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
                <span className="hub-vault-name">{nice(p.displayName ?? p.symbol)}</span>
              </span>
              <span className="hub-cell rp-cell-text">{p.platform}</span>
              <span className="hub-cell rp-cell-text">{chainLabel(p.chain)}</span>
              <span className="hub-cell hub-num hub-apy">{pct(histRate(p))}</span>
              <span className="hub-cell hub-num">{usd(p.tvlUsd)}</span>
              <span className="hub-cell rp-cell-action">
                <DiscoverButton
                  href={p.platformUrl ?? p.llamaUrl}
                  platform={p.platform}
                  source={`ranking:${p.venueSlug ?? p.project}`}
                  product={nice(p.symbol)}
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

// Static SVG line chart of a Principal Token's daily max fixed APY. Server
// rendered (no client JS): area fill + line + end dot, auto-scaled to the
// series with a little headroom, first/last dates below the plot.
function PtRateChart({ p }: { p: XrpPool }) {
  const h = p.history ?? [];
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
  const label = nice(p.displayName ?? p.symbol);
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className="rp-chart-card">
      <div className="rp-chart-head">
        <span className="rp-chart-title">{label}</span>
        <span className="rp-chart-now">
          {pct(last.apy)}
          <small>max fixed</small>
        </span>
      </div>
      <div className="rp-chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${label} daily max fixed rate, ${pct(h[0].apy)} to ${pct(last.apy)}`}
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
