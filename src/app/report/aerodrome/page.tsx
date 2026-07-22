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
  volumeUsdDay: number | null;
  harvestApy24h: number | null;
  harvestApy30d: number | null;
  harvestTvlUsd: number | null;
  holders: number | null;
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

  // Where the yield comes from: TVL-weighted split of emissions vs swap fees
  // across the covered set, and the pools whose yield is most fee-led (organic).
  const wEmit = pools.reduce((s, p) => s + p.emissionApr * p.poolTvlUsd, 0);
  const wFee = pools.reduce((s, p) => s + p.feeApr * p.poolTvlUsd, 0);
  const emitShare = wEmit + wFee > 0 ? (wEmit / (wEmit + wFee)) * 100 : 0;
  const feeShare = 100 - emitShare;
  // Composition bars: top pools by rate, each split into emission + fee.
  const byRate = [...pools].sort((a, b) => b.realApy - a.realApy);
  const maxRate = byRate[0]?.realApy ?? 1;
  const feeLed = [...pools]
    .filter((p) => p.realApy > 1 && p.poolTvlUsd >= THIN_TVL)
    .sort((a, b) => b.feeApr / b.realApy - a.feeApr / a.realApy)[0];

  // Auto-compounding edge: pools where the Harvest 30d return most exceeds the
  // raw pool APR (frequent AERO harvest + reward-token price moves).
  const compoundGaps = pools
    .filter((p) => p.harvestApy30d != null && p.realApy > 1)
    .map((p) => ({ ...p, ratio: (p.harvestApy30d ?? 0) / Math.max(0.5, p.realApy) }))
    .sort((a, b) => b.ratio - a.ratio);
  const topCompound = compoundGaps[0];

  // Rate stability: a rate made almost entirely of emissions is the least
  // durable (a weekly vote can move the incentive); a real fee share holds
  // steadier because it is earned from trading, not rented from the AERO budget.
  const emissionLed = pools
    .filter((p) => p.realApy > 1)
    .map((p) => ({ ...p, emShare: p.emissionApr / Math.max(0.5, p.realApy) }))
    .sort((a, b) => b.emShare - a.emShare);
  const mostEmissionLed = emissionLed[0];
  const feeBacked = [...emissionLed]
    .filter((p) => p.emShare < 0.75 && p.poolTvlUsd >= THIN_TVL)
    .sort((a, b) => a.emShare - b.emShare)[0];

  // Trading volume (most-traded pools) and depositor counts (second-wave depth).
  const byVolume = [...pools]
    .filter((p) => p.volumeUsdDay != null)
    .sort((a, b) => (b.volumeUsdDay ?? 0) - (a.volumeUsdDay ?? 0));
  const maxVol = byVolume[0]?.volumeUsdDay ?? 1;
  const totalVolDay = pools.reduce((s, p) => s + (p.volumeUsdDay ?? 0), 0);
  const byHolders = [...pools]
    .filter((p) => p.holders != null)
    .sort((a, b) => (b.holders ?? 0) - (a.holders ?? 0));
  const totalHolders = pools.reduce((s, p) => s + (p.holders ?? 0), 0);
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
    { id: "yield-sources", label: "Where yield comes from" },
    { id: "how-emissions", label: "How emissions work", level: 1 },
    { id: "rate-stability", label: "Rate stability", level: 1 },
    { id: "auto-compounding", label: "The auto-compounding edge" },
    { id: "tvl-landscape", label: "TVL landscape" },
    { id: "trading-volume", label: "Trading volume" },
    { id: "depositors", label: "Popular by depositors" },
    { id: "key-risks", label: "Key risks" },
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

          <section className="uni-home-content" aria-labelledby="yield-sources">
            <p className="rp-eyebrow">Sources</p>
            <h2 id="yield-sources">Where the yield comes from</h2>
            <p>
              An Aerodrome pool pays two kinds of yield. <strong>Emissions</strong>{" "}
              are AERO tokens the protocol mints to the pool&rsquo;s gauge as an
              incentive; <strong>fees</strong> are the cut of every swap that
              routes through the pool. Weighted by liquidity across the covered
              set, about {emitShare.toFixed(0)}% of the yield is emission-driven
              and {feeShare.toFixed(0)}% comes from swap fees. The split matters:
              fee yield is organic and tends to persist, while emissions are an
              incentive that rotates and can be cut.
            </p>
            <div className="ae-splitbar" aria-hidden="true">
              <span className="ae-split-emit" style={{ width: `${emitShare}%` }} />
              <span className="ae-split-fee" style={{ width: `${feeShare}%` }} />
            </div>
            <div className="ae-split-legend">
              <span><span className="ae-dot ae-dot-emit" /> Emissions {emitShare.toFixed(0)}%</span>
              <span><span className="ae-dot ae-dot-fee" /> Swap fees {feeShare.toFixed(0)}%</span>
            </div>
            <p>
              Per pool, the mix varies widely. The bars below split each
              pool&rsquo;s rate into its emission and fee parts (top pools by
              rate). A pool leaning on fees, like {feeLed ? feeLed.pair : "the deeper venues"},
              earns from real trading volume; a pool leaning on emissions is
              renting its rate from the AERO incentive budget.
            </p>
            <div className="ae-landscape">
              {byRate.slice(0, 10).map((p) => (
                <div className="ae-land-row" key={p.slug}>
                  <span className="ae-land-name" title={p.pair}>{p.pair}</span>
                  <span className="ae-land-bar-wrap ae-comp-wrap">
                    <span className="ae-split-emit" style={{ width: `${(p.emissionApr / maxRate) * 100}%` }} />
                    <span className="ae-split-fee" style={{ width: `${(p.feeApr / maxRate) * 100}%` }} />
                  </span>
                  <span className="ae-land-val">{pct(p.realApy)}</span>
                </div>
              ))}
            </div>

            <div className="rp-rank-sort">
              <h3 id="how-emissions">How emissions work</h3>
              <p>
                Aerodrome runs on veAERO: holders lock AERO for vote-escrowed
                veAERO and vote each week on which pools&rsquo; gauges receive
                emissions. Votes set the gauge weights, and emissions are
                distributed to stakers in that pool for the epoch (a one-week
                cycle). Because the votes are re-cast every epoch, a pool&rsquo;s
                emission rate can jump or fall week to week as vote incentives
                (bribes) and capital move around. Only liquidity staked in the
                gauge earns the emissions, which is why this report measures the
                rate against the staked TVL rather than the whole pool.
              </p>
            </div>

            <div className="rp-rank-sort">
              <h3 id="rate-stability">Rate stability</h3>
              <p>
                Because emissions reset weekly, a pool&rsquo;s headline rate is
                only as durable as its votes, and the tell is how much of the
                rate is emissions versus fees. A rate that is almost entirely
                emissions{mostEmissionLed ? `, like ${mostEmissionLed.pair} at about ${(mostEmissionLed.emShare * 100).toFixed(0)}% emission-led,` : ""}{" "}
                can reset at the next epoch if voters move the incentive
                elsewhere. A pool with a real fee share{feeBacked ? `, like ${feeBacked.pair},` : ""}{" "}
                earns from trading volume that does not vanish on a vote, so its
                rate holds steadier. Read a high, emission-heavy rate as
                opportunistic and a fee-backed rate as the more dependable one.
              </p>
            </div>
            <p className="rp-source-note">
              Emission and fee APRs are measured on-chain (Base), as of {updated}.
              The weighted split is by pool TVL across the covered set.
            </p>
          </section>

          <section className="uni-home-content" aria-labelledby="auto-compounding">
            <p className="rp-eyebrow">The edge</p>
            <h2 id="auto-compounding">The auto-compounding edge</h2>
            <p>
              The Pool APR is what the pool pays before anything is done with the
              rewards. Left alone, emitted AERO just accumulates as claimable
              tokens; its value is exposed to the AERO price and earns nothing
              further. Harvest&rsquo;s vault harvests that AERO on a schedule,
              swaps it back into the pool&rsquo;s assets and re-deposits, so the
              position compounds on itself. Over a 30-day window that compounding,
              plus any move in the AERO price while the rewards were held, is why
              the Harvest 30d column can sit well above the raw Pool APR.
            </p>
            <p>
              The effect is largest exactly where emissions are largest.{" "}
              {topCompound ? (
                <>
                  On {topCompound.pair}, for instance, the raw pool rate is about{" "}
                  {pct(topCompound.realApy)}, while Harvest&rsquo;s realized
                  30-day return was near {pct(topCompound.harvestApy30d)}.
                </>
              ) : null}{" "}
              On low-emission pools the two numbers converge, because there is
              little reward to compound. The trade-off is that the Harvest figure
              is a realized, backward-looking number net of the vault&rsquo;s
              performance fee, whereas the Pool APR is the forward rate the pool
              is paying now; both are shown so neither is mistaken for the other.
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

          <section className="uni-home-content" aria-labelledby="trading-volume">
            <p className="rp-eyebrow">Activity</p>
            <h2 id="trading-volume">Trading volume</h2>
            <p>
              Fees only exist where swaps happen, so volume is what separates a
              fee-backed rate from a purely emission-rented one. Across the
              covered pools, on-chain swaps run at about {usd(totalVolDay)} a day,
              heavily concentrated:{" "}
              {byVolume[0] ? `${byVolume[0].pair} alone does roughly ${usd(byVolume[0].volumeUsdDay ?? 0)} a day` : "in a few deep pools"}.
              The bars below rank the covered pools by average daily swap volume.
            </p>
            <div className="ae-landscape">
              {byVolume.slice(0, 10).map((p) => (
                <div className="ae-land-row" key={p.slug}>
                  <span className="ae-land-name" title={p.pair}>{p.pair}</span>
                  <span className="ae-land-bar-wrap">
                    <span
                      className="ae-land-bar ae-bar-vol"
                      style={{ width: `${Math.max(1.5, ((p.volumeUsdDay ?? 0) / maxVol) * 100)}%` }}
                    />
                  </span>
                  <span className="ae-land-val">{usd(p.volumeUsdDay ?? 0)}</span>
                </div>
              ))}
            </div>
            <p className="rp-source-note">
              Average daily swap volume, computed from the pool&rsquo;s on-chain
              swap logs over the trailing fee window, as of {updated}.
            </p>
          </section>

          <section className="uni-home-content" aria-labelledby="depositors">
            <p className="rp-eyebrow">Adoption</p>
            <h2 id="depositors">Most popular by depositors</h2>
            <p>
              Depositor counts are the clearest read on which pools people
              actually trust with capital through Harvest, independent of the
              headline rate. Across the covered vaults there are {totalHolders.toLocaleString("en-US")}{" "}
              depositors;{" "}
              {byHolders[0] ? `${byHolders[0].pair} leads with ${byHolders[0].holders}` : "adoption is spread across the set"}.
            </p>
            <div className="rp-dtable-wrap">
              <table className="rp-dtable">
                <thead>
                  <tr>
                    <th>Pool</th>
                    <th className="num">Depositors</th>
                    <th className="num">Pool TVL</th>
                    <th className="num">Harvest 30d</th>
                  </tr>
                </thead>
                <tbody>
                  {byHolders.slice(0, 10).map((p) => (
                    <tr key={p.slug}>
                      <td className="strong">{p.pair}</td>
                      <td className="num">{p.holders?.toLocaleString("en-US") ?? "n/a"}</td>
                      <td className="num">{usd(p.poolTvlUsd)}</td>
                      <td className="num">{pct(p.harvestApy30d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rp-source-note">
              Depositor counts are the number of distinct addresses holding each
              Harvest vault token, from our indexer, as of {updated}.
            </p>
          </section>

          <section className="uni-home-content" aria-labelledby="key-risks">
            <p className="rp-eyebrow">Risk</p>
            <h2 id="key-risks">Key risks</h2>
            <p>
              Every row here is a two-token liquidity position, which carries a
              specific set of risks distinct from simply holding the assets.
            </p>
            <dl className="rp-method">
              <dt>Impermanent loss</dt>
              <dd>
                When the two paired assets move apart in price, an LP ends up with
                more of the loser and less of the winner than simply holding would
                have left them. It is larger on volatile pairs (an asset against
                ETH) and small on correlated pairs (an ETH derivative against ETH).
                A high rate can still be eroded by impermanent loss.
              </dd>
              <dt>Emission decay</dt>
              <dd>
                Most of the yield is AERO emissions, which are an incentive, not a
                fee. veAERO voters can move emissions away from a pool at the next
                weekly epoch, so a rate that looks high today is not guaranteed to
                last.
              </dd>
              <dt>Reward-token exposure</dt>
              <dd>
                Rewards are paid in AERO. Until they are harvested and swapped, the
                realized return depends on the AERO price, which can fall as well
                as rise.
              </dd>
              <dt>Depeg and contract risk</dt>
              <dd>
                Correlated pairs assume the two legs stay pegged; a depeg breaks
                that. And every pool, gauge and vault is a third-party or Harvest
                smart contract with the usual smart-contract risk. Verify each
                address before use.
              </dd>
            </dl>
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
