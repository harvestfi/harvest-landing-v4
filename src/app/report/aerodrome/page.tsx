import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { AssetIcon } from "@/components/token-icons";
import { CopyAddressButton } from "@/components/copy-address-button";
import { ReportToc, type TocItem } from "@/components/report/report-toc";
import {
  breadcrumbSchema,
  faqPageSchema,
  reportDatasetSchema,
  reportItemListSchema,
  reportWebPageSchema,
} from "@/lib/jsonld";
import "../../_styles/home.css";
import "../../_styles/report.css";

// /report/aerodrome: a continuously updated ranking of the Aerodrome (Base)
// liquidity pools Harvest runs auto-compounding vaults for. The ranked metric is
// the objective on-chain pool yield (gauge emissions + swap fees), measured
// on-chain and aggregator-free. Harvest's own auto-compounded 30-day APY sits
// beside it as one lens; this page is the operator's transparent research view.

const PAGE_URL = `${SITE_URL}/report/aerodrome`;
const BASESCAN = "https://basescan.org/address/";
// Pools below this TVL are reward-driven micro-pools whose headline APR swings
// week to week, flagged so a large emission number on thin liquidity never
// reads as a durable rate.
const THIN_TVL = 250_000;

interface AeroPool {
  slug: string;
  productName: string;
  asset: string;
  pool: string;
  vaultAddress?: string;
  gauge?: string | null;
  pair: string;
  token0: string;
  token1: string;
  pairType: "volatile" | "correlated";
  stable: boolean;
  poolTvlUsd: number;
  stakedPct: number | null;
  emissionApr: number;
  feeApr: number;
  realApy: number;
  emissionSpot?: number;
  harvestApy24h: number | null;
  harvestApy30d: number | null;
  harvestTvlUsd: number | null;
  rateBasis: string;
  error?: string;
}

interface AeroData {
  generatedAt: string;
  chain: string;
  protocol: string;
  source: string;
  prices: { eth: number; btc: number; aero: number };
  poolCount: number;
  pools: AeroPool[];
}

function loadData(): AeroData | null {
  try {
    const f = join(process.cwd(), "data", "aerodrome-yield.json");
    if (!existsSync(f)) return null;
    const d = JSON.parse(readFileSync(f, "utf-8")) as AeroData;
    return Array.isArray(d.pools) && d.pools.length > 0 ? d : null;
  } catch {
    return null;
  }
}

const pct = (v: number | null | undefined) =>
  v == null ? "n/a" : `${v.toFixed(2)}%`;
const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${Math.round(n / 1_000)}k`
      : `$${Math.round(n)}`;
const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const metadata: Metadata = {
  title: "Aerodrome LP Yield Ranking: Real On-Chain APR | Harvest",
  description:
    "The Aerodrome liquidity pools on Base that Harvest auto-compounds, ranked by real on-chain pool yield (gauge emissions plus swap fees, measured on-chain), with Harvest's auto-compounded 30-day APY beside each pool. Refreshed regularly.",
  alternates: { canonical: PAGE_URL },
};

function Crumbs() {
  return (
    <nav className="rp-crumbs" aria-label="Breadcrumb">
      <Link href="/">{SITE_NAME}</Link>
      <span className="sep">/</span>
      <span>Aerodrome LP Yield</span>
    </nav>
  );
}

// Overlapping pair icons (token0 over token1).
function PairIcons({ a, b }: { a: string; b: string }) {
  return (
    <span className="rp-toks" aria-hidden="true">
      {[a, b].map((t, i) => (
        <span
          key={t + i}
          className="rp-tok"
          style={{ marginLeft: i ? -9 : 0, zIndex: 2 - i }}
        >
          <AssetIcon asset={t} size={24} />
        </span>
      ))}
    </span>
  );
}

function RankTable({ rows }: { rows: AeroPool[] }) {
  if (rows.length === 0) {
    return <div className="hub-empty">No pools in this category right now.</div>;
  }
  return (
    <div className="hub-table-wrap rp-rank ae-rank" data-nosnippet="">
      <div className="hub-table" role="table" aria-label="Aerodrome pool yield ranking">
        <div className="hub-thead" role="row">
          <span className="hub-th hub-th-rank">#</span>
          <span className="hub-th">Pool</span>
          <span className="hub-th hub-th-num">Pool APR</span>
          <span className="hub-th hub-th-num">Harvest 30d</span>
          <span className="hub-th">Pair</span>
          <span className="hub-th hub-th-num">Pool TVL</span>
          <span className="hub-th hub-th-right" />
        </div>
        <div className="hub-tbody" role="rowgroup">
          {rows.map((p, i) => {
            const thin = p.poolTvlUsd < THIN_TVL;
            return (
              <div className="hub-row" role="row" key={p.slug}>
                <span className="hub-cell hub-rank">{i + 1}</span>
                <span className="hub-cell hub-vault">
                  <PairIcons a={p.token0} b={p.token1} />
                  <span className="rp-rank-nameblock">
                    <span className="hub-vault-name">{p.pair}</span>
                    <span className="rp-rank-detail">
                      {p.emissionApr.toFixed(1)}% emissions + {p.feeApr.toFixed(1)}% fees
                    </span>
                    <span className="rp-rank-sub">
                      Base · Aerodrome · {usd(p.poolTvlUsd)} TVL
                    </span>
                  </span>
                </span>
                <span
                  className="hub-cell hub-num hub-apy"
                  title="On-chain pool APR: AERO gauge emissions + swap fees, measured on-chain"
                >
                  {pct(p.realApy)}
                  {thin ? (
                    <span
                      className="ae-thin"
                      title={`Reward-driven rate on thin liquidity (${usd(p.poolTvlUsd)}); swings week to week`}
                    >
                      ~
                    </span>
                  ) : null}
                </span>
                <span
                  className="hub-cell hub-num ae-harvest"
                  title="Harvest's auto-compounded 30-day realized APY for this pool (first-party, net of fee)"
                >
                  {pct(p.harvestApy30d)}
                </span>
                <span className="hub-cell rp-cell-text">
                  <span className="rp-type">
                    {p.pairType === "correlated" ? "Correlated" : "Volatile"}
                  </span>
                </span>
                <span className="hub-cell hub-num">{usd(p.poolTvlUsd)}</span>
                <span className="hub-cell rp-cell-action">
                  <Link href={`/${p.slug}`} className="rp-discover" aria-label={`View ${p.pair} on Harvest`}>
                    <span className="rp-discover-label">View</span>
                    <span className="rp-discover-arrow" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17 17 7" />
                        <path d="M8 7h9v9" />
                      </svg>
                    </span>
                  </Link>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AerodromeReportPage() {
  const data = loadData();
  if (!data) {
    return (
      <main className="rp-page uni-home-test">
        <div className="uni-home-shell">
          <p>Aerodrome yield data is being prepared. Check back shortly.</p>
        </div>
      </main>
    );
  }

  const pools = data.pools.filter((p) => !p.error);
  const volatile = pools
    .filter((p) => p.pairType !== "correlated")
    .sort((a, b) => b.realApy - a.realApy);
  const correlated = pools
    .filter((p) => p.pairType === "correlated")
    .sort((a, b) => b.realApy - a.realApy);

  const totalPoolTvl = pools.reduce((s, p) => s + p.poolTvlUsd, 0);
  const totalHarvestTvl = pools.reduce((s, p) => s + (p.harvestTvlUsd ?? 0), 0);
  const realRates = pools.map((p) => p.realApy);
  const medReal = median(realRates);
  const topReal = [...pools].sort((a, b) => b.realApy - a.realApy)[0];
  const byTvl = [...pools].sort((a, b) => b.poolTvlUsd - a.poolTvlUsd);
  const topByTvl = byTvl[0];
  const maxTvl = byTvl[0]?.poolTvlUsd ?? 1;
  const meaningful = pools
    .filter((p) => p.poolTvlUsd >= THIN_TVL)
    .sort((a, b) => b.realApy - a.realApy);
  const topDurable = meaningful[0];

  const updated = new Date(data.generatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const toc: TocItem[] = [
    { id: "overview", label: "Overview" },
    { id: "the-ranking", label: "The ranking" },
    { id: "volatile-pools", label: "Volatile pools", level: 1 },
    { id: "correlated-pools", label: "Correlated pools", level: 1 },
    { id: "how-ranked", label: "How it is ranked", level: 1 },
    { id: "tvl-landscape", label: "TVL landscape" },
    { id: "method-and-scope", label: "Method & scope" },
    { id: "onchain-references", label: "Onchain references" },
    { id: "data-downloads", label: "Data & downloads" },
    { id: "faq", label: "FAQ" },
  ];

  const faqs = [
    {
      q: "What does this report rank?",
      a: `The ${pools.length} Aerodrome liquidity pools on Base that Harvest runs auto-compounding vaults for, ranked by real on-chain pool APR: AERO gauge emissions plus swap fees. It is not a full Aerodrome index; it is the operator's transparent view of the pools we cover.`,
    },
    {
      q: "How is the pool APR measured?",
      a: "Directly on-chain and aggregator-free. Emissions are read from each pool's gauge (reward rate × AERO price ÷ the TVL actually staked in the gauge, since only staked liquidity earns emissions); swap fees are computed from on-chain swap volume × the pool's fee tier; TVL is priced from reserves against Chainlink feeds. Nothing is taken from a third-party API.",
    },
    {
      q: "Why is Harvest's 30-day APY often higher than the pool APR?",
      a: "The Pool APR column is the raw rate the pool pays right now. The Harvest 30d column is our vault's realized, auto-compounded return over the last 30 days; it compounds harvested AERO back into the position and reflects reward-token price moves over the window, so it can sit above the spot pool APR. They measure different things and are shown side by side on purpose.",
    },
    {
      q: "Why do tiny pools show the largest APRs?",
      a: "Emissions on a pool with very little liquidity divide across few dollars, so the APR reads high but is reward-driven and swings week to week as veAERO votes move. Those rows carry a marker and their small TVL is shown; weigh the rate against the pool's depth.",
    },
    {
      q: "What are impermanent loss and the risks here?",
      a: "Every row is a two-token liquidity pool, so it carries impermanent loss when the paired assets diverge, larger for volatile pairs than correlated ones. Emissions are incentive-driven and not guaranteed. All addresses are third-party contracts; verify each before use.",
    },
  ];

  const itemListItems = [...pools]
    .sort((a, b) => b.realApy - a.realApy)
    .map((p) => ({ name: `${p.pair} (Aerodrome, Base)`, url: `${SITE_URL}/${p.slug}` }));

  return (
    <div className="uni-home-test rp-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema([
          { name: SITE_NAME, url: SITE_URL },
          { name: "Aerodrome LP Yield Ranking", url: PAGE_URL },
        ])) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reportWebPageSchema({
          name: "Aerodrome LP Yield Ranking",
          url: PAGE_URL,
          description: `The ${pools.length} Aerodrome liquidity pools on Base that Harvest auto-compounds, ranked by real on-chain pool APR (gauge emissions + swap fees), measured on-chain, with Harvest's auto-compounded 30-day APY beside each.`,
          dateModified: data.generatedAt,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reportDatasetSchema({
          name: "Aerodrome LP Yield Ranking dataset",
          description: "Per-pool on-chain yield (emission APR, fee APR, TVL) for the Aerodrome Base pools Harvest runs vaults for, plus first-party auto-compounded APY, measured on-chain.",
          url: PAGE_URL,
          dateModified: data.generatedAt,
          numberOfItems: pools.length,
          keywords: ["Aerodrome", "Base", "liquidity pool", "LP", "AERO", "yield", "APR", "TVL", "DeFi"],
          sources: ["https://aerodrome.finance"],
          distribution: [
            { format: "application/json", url: `${SITE_URL}/data/aerodrome/index.json` },
            { format: "text/csv", url: `${SITE_URL}/data/aerodrome/pools.csv` },
          ],
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reportItemListSchema(itemListItems, PAGE_URL)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />

      <Crumbs />

      <section className="uni-home-hero rp-hero">
        <div className="uni-home-hero-inner">
          <h1 className="uni-home-h1">Aerodrome LP Yield Ranking</h1>
          <p className="uni-home-sub">
            The {pools.length}{" "}Aerodrome liquidity pools on Base that Harvest
            runs auto-compounding vaults for, ranked by their real on-chain pool
            APR: AERO gauge emissions plus swap fees, measured on-chain. Each
            pool&rsquo;s Harvest auto-compounded 30-day return sits beside it as a
            second lens.
          </p>
          <p className="rp-updated">Last updated {updated}</p>
          <a href="#the-ranking" className="uni-home-cta-primary">
            Explore the ranking
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <main className="uni-home-shell">
        <div className="rp-doc">
          <div className="rp-doc-main">
          <section className="uni-home-content" aria-labelledby="overview">
            <p className="rp-eyebrow">Summary</p>
            <h2 id="overview">Aerodrome yield right now</h2>
            <p>
              Across the {pools.length} covered pools, the highest durable
              on-chain pool APR is about {pct(topDurable?.realApy)} on{" "}
              {topDurable?.pair} ({usd(topDurable?.poolTvlUsd ?? 0)} of
              liquidity); the median across the set is {pct(medReal)}. Thin,
              reward-driven pools can post far larger headline numbers, up to{" "}
              {pct(topReal?.realApy)} on {topReal?.pair}, but on only{" "}
              {usd(topReal?.poolTvlUsd ?? 0)} of liquidity, where the rate is
              emission-driven and swings week to week. The deepest pool is{" "}
              {topByTvl?.pair} at {usd(topByTvl?.poolTvlUsd ?? 0)}. The covered
              pools hold {usd(totalPoolTvl)}{" "}between them; Harvest&rsquo;s vaults
              sit on {usd(totalHarvestTvl)} of that.
            </p>
          </section>

          <section className="uni-home-content" aria-labelledby="the-ranking">
            <p className="rp-eyebrow">The ranking</p>
            <h2 id="the-ranking">The ranking</h2>
            <p>
              Sorted by real on-chain pool APR (emissions + fees). The Pool APR
              column is what the pool pays on-chain today; the Harvest 30d column
              is our vault&rsquo;s realized auto-compounded return over the last
              30 days for the same pool. Two-token pools carry impermanent loss.
            </p>

            <div className="rp-rank-group">
              <div className="rp-rank-head">
                <h3 id="volatile-pools">
                  Volatile pools <span className="rp-rank-count">{volatile.length}</span>
                </h3>
                <p>
                  Uncorrelated token pairs (an asset against ETH, a stablecoin or
                  BTC). Higher fee and emission potential, higher impermanent-loss
                  exposure. Sorted by rate.
                </p>
              </div>
              <RankTable rows={volatile} />
            </div>

            {correlated.length > 0 ? (
              <div className="rp-rank-group">
                <div className="rp-rank-head">
                  <h3 id="correlated-pools">
                    Correlated pools <span className="rp-rank-count">{correlated.length}</span>
                  </h3>
                  <p>
                    Pegged or correlated pairs (e.g. an ETH derivative against ETH)
                    run as stable pools, with minimal impermanent loss and lower,
                    steadier rates. Sorted by rate.
                  </p>
                </div>
                <RankTable rows={correlated} />
              </div>
            ) : null}

            <div className="rp-rank-sort">
              <h3 id="how-ranked">How it is ranked</h3>
              <p>
                Pools are ranked by the real on-chain rate they pay: AERO gauge
                emissions (rate × AERO price over the liquidity actually staked in
                the gauge) plus swap fees (on-chain volume × the pool&rsquo;s fee
                tier), not a marketed headline number. Emissions rotate weekly with
                veAERO votes, so a large number on thin liquidity is opportunistic
                rather than durable; those rows carry a <span aria-hidden="true">~</span> marker
                and their small TVL is shown.
              </p>
            </div>
            <p className="rp-source-note">
              Pool rates and TVL are measured on-chain (Base), as of {updated}.
              The Harvest 30d column is our first-party auto-compounded vault
              return for the same pool; it compounds harvested AERO and reflects
              reward-token price moves, so it can sit above the spot pool APR; it
              is a different measure, shown as a lens. Each row links to
              Harvest&rsquo;s vault for that pool.
            </p>
          </section>

          <section className="uni-home-content" aria-labelledby="tvl-landscape">
            <p className="rp-eyebrow">Landscape</p>
            <h2 id="tvl-landscape">Where the liquidity sits</h2>
            <p>
              The {pools.length} covered pools hold {usd(totalPoolTvl)}{" "}of
              liquidity between them, concentrated in a handful of deep pools.
              Depth matters: the deeper the pool, the more durable its rate and
              the smaller the price impact of entering or leaving a position.
            </p>
            <div className="ae-landscape">
              {byTvl.slice(0, 12).map((p) => (
                <div className="ae-land-row" key={p.slug}>
                  <span className="ae-land-name" title={p.pair}>{p.pair}</span>
                  <span className="ae-land-bar-wrap">
                    <span
                      className="ae-land-bar"
                      style={{ width: `${Math.max(1.5, (p.poolTvlUsd / maxTvl) * 100)}%` }}
                    />
                  </span>
                  <span className="ae-land-val">{usd(p.poolTvlUsd)}</span>
                </div>
              ))}
            </div>
            <p className="rp-source-note">
              Pool TVL is measured on-chain from reserves, priced via Chainlink,
              as of {updated}. Bar length is relative to the deepest covered pool.
            </p>
          </section>

          <section className="uni-home-content" aria-labelledby="method-and-scope">
            <p className="rp-eyebrow">Method</p>
            <h2 id="method-and-scope">Method &amp; scope</h2>
            <dl className="rp-method">
              <dt>Scope</dt>
              <dd>
                The {pools.length}{" "}Aerodrome pools on Base that Harvest operates
                auto-compounding vaults for. This is disclosed deliberately: it is
                the operator&rsquo;s view of the pools we cover, not a full
                Aerodrome index.
              </dd>
              <dt>Pool APR (ranked)</dt>
              <dd>
                Measured on-chain and aggregator-free. Emissions: the gauge reward
                rate × AERO/USD (Chainlink) annualized over the TVL staked in the
                gauge, since only staked liquidity earns emissions. Fees: on-chain swap
                volume × the pool&rsquo;s factory fee tier, annualized. TVL: pool
                reserves priced against Chainlink feeds.
              </dd>
              <dt>Harvest 30d (lens)</dt>
              <dd>
                First-party, from Harvest&rsquo;s indexer: the vault&rsquo;s
                realized auto-compounded APY over the trailing 30 days, net of the
                performance fee.
              </dd>
              <dt>Freshness</dt>
              <dd>Re-read on a schedule; the timestamp above reflects the latest refresh.</dd>
            </dl>
          </section>

          <section className="uni-home-content" aria-labelledby="onchain-references">
            <p className="rp-eyebrow">Reference</p>
            <h2 id="onchain-references">Onchain references</h2>
            <p>
              Contract addresses for every pool in this report: the Aerodrome LP
              pool, its emissions gauge, and Harvest&rsquo;s vault. All are
              third-party or Harvest contracts on Base; verify each before use.
            </p>
            <div className="rp-dtable-wrap">
              <table className="rp-dtable rp-ref-table">
                <thead>
                  <tr>
                    <th>Pool</th>
                    <th>Kind</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {pools.flatMap((p) => {
                    const rows: { pair: string; kind: string; addr: string }[] = [
                      { pair: p.pair, kind: "LP pool", addr: p.pool },
                    ];
                    if (p.gauge) rows.push({ pair: p.pair, kind: "Gauge", addr: p.gauge });
                    if (p.vaultAddress) rows.push({ pair: p.pair, kind: "Harvest vault", addr: p.vaultAddress });
                    return rows.map((r, i) => (
                      <tr key={`${p.slug}-${r.kind}`} className={i === 0 ? "rp-ref-group" : undefined}>
                        <td className="strong">{i === 0 ? r.pair : ""}</td>
                        <td className="rp-ref-type">{r.kind}</td>
                        <td>
                          <span className="rp-ref-addr">
                            <code>{r.addr}</code>
                            <CopyAddressButton address={r.addr} compact />
                          </span>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
            <p className="rp-source-note">
              Aerodrome Voter{" "}
              <code>0x16613524e02ad97eDfeF371bC883F2F5d6C480A5</code> resolves each
              pool&rsquo;s gauge; PoolFactory{" "}
              <code>0x420DD381b31aEf6683db6B902084cB0FFECe40Da</code> provides the
              fee tier. Prices via Chainlink on Base.
            </p>
          </section>

          <section className="uni-home-content" aria-labelledby="data-downloads">
            <p className="rp-eyebrow">Data</p>
            <h2 id="data-downloads">Data &amp; downloads</h2>
            <p>
              The full snapshot is published as machine-readable files for agents
              and analysts, under a CC-BY-4.0 license (use it, including
              commercially, with attribution and a link back). The same files are
              declared in this page&rsquo;s Dataset metadata.
            </p>
            <p className="rp-source-note">
              Snapshot JSON:{" "}
              <a href="/data/aerodrome/index.json">/data/aerodrome/index.json</a>.
              Flat per-pool CSV:{" "}
              <a href="/data/aerodrome/pools.csv">/data/aerodrome/pools.csv</a>.
            </p>
          </section>

          <section className="uni-home-content" aria-labelledby="faq">
            <p className="rp-eyebrow">FAQ</p>
            <h2 id="faq">Frequently asked questions</h2>
            <div className="rp-faq">
              {faqs.map((f, i) => (
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
          </div>
          <aside className="rp-doc-aside" aria-label="In this report">
            <ReportToc items={toc} />
          </aside>
        </div>
      </main>
    </div>
  );
}
