import type { Metadata } from "next";
import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import "../../_styles/report.css";

// /report/xrp-yield-ranking - a continuously updated data report on where
// XRP-family assets (XRP, wrapped XRP variants, RLUSD) actually earn onchain
// yield. Every venue listed is EXTERNAL: none are Harvest products, and the
// page is deliberately isolated from the product pipeline - it reads only
// data/xrp-yield.json, written by scripts/fetch-xrp-yield.mjs from the free
// DeFiLlama API in the hourly data workflow. No Supabase reads, no vaults.json.
//
// Shape: TL;DR intro (live numbers), the ranking table (network / platform /
// product / historical rate / discover), then per-venue detail cards covering
// where each rate comes from and how long the venue has been operating.

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
  source: string;
  minTvlUsd: number;
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

const RANK_ROWS = 20;

// DeFiLlama chain ids -> display names where they differ.
const CHAIN_LABEL: Record<string, string> = {
  XRPL: "XRP Ledger",
  Xrpl: "XRP Ledger",
  Ripple: "XRP Ledger",
};
const chainLabel = (c: string) => CHAIN_LABEL[c] ?? c;

const pct = (v: number | null) =>
  v == null ? "-" : `${v.toFixed(2)}%`;
const usd = (n: number) =>
  n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(2)}M`
      : `$${Math.round(n / 1_000)}k`;
const monthYear = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};
const histRate = (p: XrpPool) => p.apyMean30d ?? p.apy;

// Where the base (non-incentive) part of the rate comes from, by protocol
// category. Falls back to a neutral phrasing for categories we don't map.
function baseSource(p: XrpPool): string {
  const c = (p.category || "").toLowerCase();
  if (c.includes("dex")) return "trading fees paid by swappers in the pool";
  if (c.includes("lending")) return "interest paid by borrowers of the supplied asset";
  if (c.includes("liquid staking") || c.includes("staking"))
    return "staking rewards passed through to holders";
  if (c.includes("restaking")) return "restaking rewards passed through to holders";
  if (c.includes("yield")) return "an automated strategy compounding underlying market yield";
  if (c.includes("cdp")) return "stability and borrowing fees paid by vault users";
  if (c.includes("derivative") || c.includes("perp"))
    return "a share of trading fees and funding from the venue's markets";
  if (c.includes("farm")) return "protocol token emissions";
  return "activity fees distributed by the protocol to suppliers";
}

export async function generateMetadata(): Promise<Metadata> {
  const data = loadData();
  const desc = data
    ? `${data.stats.venues} venues where XRP, wrapped XRP and RLUSD earn onchain yield, ranked by 30-day average rate across ${data.stats.chains.length} networks. Live data, refreshed hourly from DeFiLlama.`
    : "Where XRP, wrapped XRP and RLUSD earn onchain yield, ranked by 30-day average rate. Live data from DeFiLlama.";
  const title = "XRP Yield Ranking: Live Rates Across Networks";
  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description: desc,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title,
      description: desc,
      url: PAGE_URL,
      siteName: SITE_NAME,
      type: "article",
    },
  };
}

export default function XrpYieldRankingPage() {
  const data = loadData();

  if (!data) {
    return (
      <main className="methodology-page">
        <div className="meth-header">
          <Crumbs />
          <h1 className="meth-title">XRP Yield Ranking</h1>
          <p className="meth-subtitle">
            The first data snapshot for this report is still being generated.
            Check back shortly.
          </p>
        </div>
      </main>
    );
  }

  const { stats, pools } = data;
  const ranked = pools.slice(0, RANK_ROWS);
  const detailed = pools.filter((p) => p.inception || p.range90d);
  const rates = ranked.map(histRate).filter((v): v is number => v != null);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);
  const updated = new Date(data.generatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const incShare = Math.round((stats.incentivized / stats.venues) * 100);

  return (
    <main className="methodology-page">
      <div className="meth-header">
        <Crumbs />
        <h1 className="meth-title">XRP Yield Ranking</h1>
        <p className="meth-subtitle">
          Where XRP-family assets actually earn onchain, ranked by real rate
          history rather than headline promises. External venues, tracked and
          contextualised by {SITE_NAME}.
        </p>
        <p className="meth-version mono dim">
          Updated {updated} · source: DeFiLlama · refreshed hourly
        </p>

        <div className="meth-stats" role="list">
          <div className="meth-stat" role="listitem">
            <span className="meth-stat-val">{stats.venues}</span>
            <span className="meth-stat-lbl">venues tracked</span>
          </div>
          <div className="meth-stat" role="listitem">
            <span className="meth-stat-val">{stats.chains.length}</span>
            <span className="meth-stat-lbl">networks</span>
          </div>
          <div className="meth-stat" role="listitem">
            <span className="meth-stat-val">{pct(stats.medianApy)}</span>
            <span className="meth-stat-lbl">median 30d rate</span>
          </div>
          <div className="meth-stat" role="listitem">
            <span className="meth-stat-val">{usd(stats.totalTvlUsd)}</span>
            <span className="meth-stat-lbl">combined TVL</span>
          </div>
        </div>
      </div>

      <div className="meth-layout">
        <aside className="meth-toc" aria-label="Page sections">
          <p className="meth-toc-label mono">On this page</p>
          <ul className="meth-toc-list">
            {[
              { id: "tldr", label: "TL;DR" },
              { id: "ranking", label: "The ranking" },
              { id: "venues", label: "Where each rate comes from" },
              { id: "method", label: "Method & scope" },
            ].map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="meth-toc-link">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <article className="meth-body">
          <section className="meth-section" id="tldr">
            <h2 className="meth-h2">TL;DR</h2>
            <p>
              XRP has no native staking, so every real XRP yield comes from
              putting the asset to work in a market: providing liquidity on a
              DEX, supplying a lending market, or holding a wrapped form of XRP
              (or Ripple&rsquo;s RLUSD stablecoin) inside a DeFi protocol. As
              of {updated}, DeFiLlama tracks{" "}
              <strong>{stats.venues} such venues</strong> holding at least{" "}
              {usd(data.minTvlUsd)} each, across{" "}
              <strong>
                {stats.chains.length} networks (
                {stats.chains.map(chainLabel).join(", ")})
              </strong>
              . Thirty-day average rates in the top {ranked.length} run from{" "}
              <strong>
                {pct(lo)} to {pct(hi)}
              </strong>
              , with a median of <strong>{pct(stats.medianApy)}</strong> across
              all tracked venues. A caution that shapes the whole list:{" "}
              <strong>
                {stats.incentivized} of {stats.venues} venues ({incShare}%)
              </strong>{" "}
              draw most of their headline rate from incentive emissions rather
              than organic fees or interest, and those rates tend to fall once
              the emissions program ends. Venues where more than half the rate
              is emissions are flagged in the table.
            </p>
            <div className="meth-callout">
              Every venue on this page is an external protocol tracked for
              research purposes. None are {SITE_NAME} products, this page is
              informational only, and rate history is no assurance of what a
              venue pays next.
            </div>
          </section>

          <section className="meth-section" id="ranking">
            <h2 className="meth-h2">The ranking</h2>
            <p>
              Ranked by <strong>30-day average rate</strong> (not the spot rate,
              which a one-day emissions spike can distort). Venues under{" "}
              {usd(data.minTvlUsd)} TVL and DeFiLlama-flagged outliers are
              excluded.
            </p>
            <div className="rp-table-wrap">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Platform</th>
                    <th>Network</th>
                    <th>30d avg rate</th>
                    <th>Today</th>
                    <th>TVL</th>
                    <th aria-label="Link" />
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p, i) => (
                    <tr key={p.id}>
                      <td className="rp-rank">{i + 1}</td>
                      <td className="rp-product">
                        {p.symbol}
                        {p.incentivized && (
                          <span
                            className="rp-flag"
                            title="More than half of the current rate comes from incentive emissions"
                          >
                            incentives
                          </span>
                        )}
                        {p.poolMeta && (
                          <span className="rp-meta">{p.poolMeta}</span>
                        )}
                      </td>
                      <td>{p.platform}</td>
                      <td>{chainLabel(p.chain)}</td>
                      <td className="rp-rate">
                        {pct(histRate(p))}
                        {p.range90d && (
                          <span className="rp-rate-sub">
                            90d: {pct(p.range90d.min)}&ndash;
                            {pct(p.range90d.max)}
                          </span>
                        )}
                      </td>
                      <td className="rp-rate">{pct(p.apy)}</td>
                      <td>{usd(p.tvlUsd)}</td>
                      <td>
                        <a
                          className="rp-discover"
                          href={p.platformUrl ?? p.llamaUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                        >
                          Discover
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="meth-version mono dim" style={{ marginTop: 6 }}>
              Rates and TVL from DeFiLlama as of {updated}. &ldquo;Discover&rdquo;
              opens the platform&rsquo;s own site (or its DeFiLlama pool page).
            </p>
          </section>

          <section className="meth-section" id="venues">
            <h2 className="meth-h2">Where each rate comes from</h2>
            <p>
              The part of this page a headline number can&rsquo;t give you: what
              actually pays each rate, how much of it is emissions, and how long
              the venue has been running.
            </p>
            {detailed.map((p) => {
              const rank = pools.indexOf(p) + 1;
              const since = monthYear(p.inception);
              return (
                <div className="rp-card" key={p.id} id={`venue-${rank}`}>
                  <h3>
                    {rank}. {p.symbol} on {p.platform}
                  </h3>
                  <p className="rp-card-sub">
                    {chainLabel(p.chain)}
                    {p.category ? ` · ${p.category}` : ""}
                    {p.poolMeta ? ` · ${p.poolMeta}` : ""}
                  </p>
                  <ul className="rp-facts">
                    <li>
                      30d avg <strong>{pct(histRate(p))}</strong>
                    </li>
                    <li>
                      today <strong>{pct(p.apy)}</strong>
                    </li>
                    <li>
                      TVL <strong>{usd(p.tvlUsd)}</strong>
                    </li>
                    {since && (
                      <li>
                        tracked since <strong>{since}</strong>
                        {p.observations
                          ? ` (${p.observations.toLocaleString("en-US")} daily observations)`
                          : ""}
                      </li>
                    )}
                  </ul>
                  <p>
                    <strong>Yield source.</strong>{" "}
                    {p.apyBase != null && p.apyBase > 0 ? (
                      <>
                        The base rate ({pct(p.apyBase)}) comes from{" "}
                        {baseSource(p)}.
                      </>
                    ) : (
                      <>
                        This venue currently pays no organic base rate; the
                        figure is driven by incentives.
                      </>
                    )}{" "}
                    {p.apyReward != null && p.apyReward > 0 && (
                      <>
                        On top of that, {pct(p.apyReward)} comes from incentive
                        emissions,{" "}
                        {Math.round(p.rewardShare * 100)}% of the current
                        headline rate.{" "}
                        {p.incentivized &&
                          "Emissions programs are finite: treat this portion as temporary rather than structural."}
                      </>
                    )}
                  </p>
                  {p.range90d && (
                    <p>
                      <strong>Rate behaviour.</strong> Over the trailing 90
                      tracked days the rate moved between {pct(p.range90d.min)}{" "}
                      and {pct(p.range90d.max)}
                      {p.range90d.max > 0 &&
                      p.range90d.max >= p.range90d.min * 3
                        ? ", a wide band that usually signals emissions-driven or volume-sensitive yield."
                        : ", a comparatively steady band."}
                    </p>
                  )}
                  {(p.exposure === "multi" || p.ilRisk === "yes") && (
                    <p>
                      <strong>Pair exposure.</strong>{" "}This is a two-asset
                      liquidity pool, so the position carries impermanent-loss
                      exposure: if the pair&rsquo;s prices diverge, the pool
                      position can be worth less than simply holding the assets.
                    </p>
                  )}
                  {p.stablecoin && p.symbol.toUpperCase().includes("RLUSD") && (
                    <p>
                      <strong>RLUSD note.</strong>{" "}RLUSD is Ripple&rsquo;s
                      dollar stablecoin, so this venue is dollar-denominated
                      yield inside the XRP ecosystem rather than yield paid on
                      XRP itself.
                    </p>
                  )}
                </div>
              );
            })}
          </section>

          <section className="meth-section" id="method">
            <h2 className="meth-h2">Method &amp; scope</h2>
            <dl className="meth-defs">
              <dt>Inclusion</dt>
              <dd>
                Every pool DeFiLlama tracks whose symbol contains an XRP-family
                asset (XRP, wrapped variants such as FXRP/WXRP/cbXRP, or RLUSD),
                with at least {usd(data.minTvlUsd)} TVL. DeFiLlama-flagged
                outliers are excluded.
              </dd>
              <dt>Ranking</dt>
              <dd>
                By 30-day average rate, so short-lived emission spikes
                don&rsquo;t decide the order. The spot rate is shown alongside
                for comparison.
              </dd>
              <dt>Freshness</dt>
              <dd>
                The snapshot refreshes hourly from the free DeFiLlama API; this
                page was generated from the {updated} snapshot.
              </dd>
              <dt>What this page is not</dt>
              <dd>
                Not an endorsement, not a listing fee arrangement, and not
                financial advice. {SITE_NAME} indexes DeFi yield data; the
                venues above are external protocols we track, not products we
                operate. Our own coverage focuses on{" "}
                <Link href="/usdc" className="meth-link">
                  USDC
                </Link>
                ,{" "}
                <Link href="/eth" className="meth-link">
                  ETH
                </Link>{" "}
                and{" "}
                <Link href="/btc" className="meth-link">
                  BTC
                </Link>{" "}
                strategies, indexed with the same methodology used on every
                product page (see{" "}
                <Link href="/methodology" className="meth-link">
                  Methodology
                </Link>
                ).
              </dd>
            </dl>
          </section>
        </article>
      </div>
    </main>
  );
}

function Crumbs() {
  return (
    <nav className="meth-crumbs mono dim" aria-label="Breadcrumb">
      <Link href="/">{SITE_NAME}</Link> <span className="sep">/</span>{" "}
      <span>Report</span> <span className="sep">/</span>{" "}
      <span>XRP Yield Ranking</span>
    </nav>
  );
}
