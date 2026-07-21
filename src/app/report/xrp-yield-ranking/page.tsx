import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { AssetIcon } from "@/components/token-icons";
import { HomeHeroPreview } from "@/components/home-hero-preview";
import { DiscoverButton } from "@/components/report/discover-button";
import { ReportToc, type TocItem } from "@/components/report/report-toc";
import { ReportChart } from "@/components/report/report-chart";
import { LandscapeChart } from "@/components/report/landscape-chart";
import { TradingChart } from "@/components/report/trading-chart";
import { OverlayChart } from "@/components/report/overlay-chart";
import { CopyAddressButton } from "@/components/copy-address-button";
import { VENUE_GROUPS, WRAPPED_TOKENS, type VenueNote } from "./venue-notes";
import {
  articleSchema,
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
// Editorial publish date for the report (Article schema datePublished). The
// live figures still refresh hourly via dateModified.
const DATE_PUBLISHED = "2026-07-01T00:00:00Z";

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
  // "high" for small, emission-driven pools whose rate swings week to week.
  variance?: string;
  source?: string;
  // Set when the shown rate excludes an off-chain reward we can't read on-chain.
  offchainRewardNote?: string | null;
  // Daily series for the charts. `apy` feeds the rate charts; `tvl` and `pps`
  // (added by the TVL backfill) feed the landscape aggregate and are optional so
  // older snapshots still type-check.
  history?: { d: string; apy: number; tvl?: number | null; pps?: number | null }[];
  // Holder count + concentration from the chain explorer (scripts/
  // fetch-xrp-holders.mjs). top1Pct/top10Pct are the share of supply held by
  // the largest wallet / top 10, omitted when the token's supply figure is
  // inconsistent. Absent for products with no public holder-bearing token.
  holders?: {
    count: number;
    token?: string;
    symbol?: string | null;
    top1Pct?: number;
    top10Pct?: number;
    asOf?: string;
  };
}
// Landscape TVL aggregate written by scripts/build-xrp-landscape.mjs: the daily
// total across venues with a real XRP-clean history, plus the metadata the
// section needs to frame it honestly (what share of today's total it covers).
interface XrpLandscape {
  generatedAt: string;
  note: string;
  coverage: { venue: string; basis: string; points: number }[];
  indexedShareOfTotalPct: number;
  snapshotRemainderUsd: number;
  currentTotalUsd: number;
  start: { d: string; tvl: number };
  peak: { d: string; tvl: number };
  latest: { d: string; tvl: number };
  series: { d: string; tvl: number }[];
}
// Spectra stXRP yield-market trading activity written by
// scripts/fetch-xrp-trading.mjs: how much the fixed-yield markets are traded.
interface XrpTradingMarket {
  maturityDate: string | null;
  expired?: boolean;
  pool: string;
  // The Spectra market / Principal Token address (distinct from the LP `pool`
  // for live markets; collapses to `pool` for pinned expired markets).
  market?: string;
  yt: string | null;
  txns: number;
  traders: number;
  buyUsd: number;
  sellUsd: number;
  buyCount: number;
  sellCount: number;
  // Daily PT max-fixed-rate history for this maturity (from the Spectra pool
  // /chart endpoint). Present for every market including matured ones, which is
  // what lets the overlay chart reach back further than the live PTs alone.
  rateHistory?: { d: string; apy: number }[];
}
interface XrpYieldTrading {
  generatedAt: string;
  asset: string;
  venue: string;
  note: string;
  totals: {
    buyUsd: number;
    sellUsd: number;
    txns: number;
    traders: number;
    markets: number;
    activeMarkets: number;
    firstDate: string | null;
    lastDate: string | null;
  };
  monthly: { mo: string; buyUsd: number; sellUsd: number }[];
  daily: { d: string; buyUsd: number; sellUsd: number }[];
  markets: XrpTradingMarket[];
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
  landscape?: XrpLandscape;
  yieldTrading?: XrpYieldTrading;
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
// Top-wallet share for the holder table. A two-holder pool where one wallet
// holds 99.99% must not read as a flat "100%" (which implies the other holder
// doesn't exist), so a value that rounds to 100 without being exactly 100 is
// shown as ">99%".
const walletPct = (v: number | null | undefined) =>
  v == null ? "n/a" : v < 100 && v >= 99.5 ? ">99%" : `${v.toFixed(0)}%`;
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

// Grammatical "A, B and C" join for prose lists built from live data.
const joinList = (items: string[]): string => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

// Nicer casing for display (icons still key off the raw token).
const nice = (s: string) =>
  s
    .replace(/STXRP/gi, "stXRP")
    .replace(/CBXRP/gi, "cbXRP")
    .replace(/\bWXRP\b/gi, "wXRP")
    .replace(/CSXRP/gi, "csXRP")
    .replace(/SXRP/gi, "sXRP");

// Join a list into readable prose ("Base and Flare", "a, b and c") so names
// weave into sentences instead of sitting in parentheses.
const joinAnd = (arr: string[]): string =>
  arr.length <= 1
    ? arr[0] ?? ""
    : arr.length === 2
      ? `${arr[0]} and ${arr[1]}`
      : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;

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
  const chains = data?.stats.chains?.length ?? 2;
  const title = "Best XRP Yield 2026: List of 10+ DeFi Products ranked by APY";
  const desc = `Where to earn yield on XRP, ranked by top rates. Over 10 XRP-denominated yield sources across ${chains} networks. Discover vaults, lending markets, Principal Tokens, and liquidity pools for XRP, FXRP, stXRP, and cbXRP.`;
  // Kept consistent across every head surface (page title, canonical, Open
  // Graph and Twitter) so the snippet renders the same everywhere.
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
    twitter: { card: "summary_large_image", title, description: desc },
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

  // A Spectra Principal Token and its liquidity pool share the same underlying
  // liquidity, so their TVL is one and the same — the PT's TVL just mirrors the
  // pool's. Count it once (via the pool) in every TVL aggregate so totals aren't
  // inflated. The PT still appears in the rate and holder rankings; only its
  // TVL contribution is suppressed to avoid the double-count.
  const tvlCounts = (p: XrpPool) => !(p.venueSlug ?? "").startsWith("spectra-pt-");

  // Hero hook: the rank-1 single-sided product — the highest-rate one-sided
  // position (no impermanent loss), whatever it currently is. Pools arrive
  // rate-sorted, so the first non-dual with a live rate is the top of the
  // single-exposure table (today the stXRP PT · Nov 2026).
  const featured =
    pools.find((p) => !isDual(p) && !p.rateNa) ??
    pools.find((p) => !isDual(p)) ??
    pools[0];

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
  // Selected venues with a real daily DeFiLlama history feed the 30-day rate
  // charts (curated headline products, excluding the fixed-rate PTs which have
  // their own chart). A meaningful window is required — products that only
  // expose a couple of points (e.g. Portals-sourced vaults with 2 days of
  // history) would otherwise grab a slot and render as two lonely bars.
  const CHART_MIN_POINTS = 14;
  const venueCharts = pools
    .filter(
      (p) =>
        p.curated &&
        productTypeOf(p) !== "Fixed-rate" &&
        (p.history?.length ?? 0) >= CHART_MIN_POINTS,
    )
    .sort((a, b) => (histRate(b) ?? 0) - (histRate(a) ?? 0))
    .slice(0, 6);
  // Answer-first highlight for the 30-day rate-history section: the current
  // spread across the charted venues and the single largest 30-day move, so the
  // section opens with a citable read instead of a caption.
  const rhStats = venueCharts.map((p) => {
    const h = (p.history ?? []).slice(-30);
    const start = h[0]?.apy ?? null;
    const now = histRate(p);
    return {
      name: assetHead(p),
      now,
      delta: start != null && now != null ? now - start : null,
    };
  });
  const rhRates = rhStats.map((s) => s.now).filter((v): v is number => v != null);
  const rhHi = rhRates.length ? Math.max(...rhRates) : null;
  const rhLo = rhRates.length ? Math.min(...rhRates) : null;
  const rhTop = rhHi != null ? rhStats.find((s) => s.now === rhHi) : null;
  const rhMover = rhStats
    .filter((s) => s.delta != null)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))[0];
  // Trajectory + TVL blend for the PT commentary (derived, so it stays accurate
  // between snapshots).
  const ptTvl = ptRows.reduce((s, p) => s + p.tvlUsd, 0);
  const ptOpenHi = ptRows.length
    ? Math.max(...ptRows.map((p) => p.history?.[0]?.apy ?? 0))
    : 0;
  const ptNowHi = ptRows.length
    ? Math.max(...ptRows.map((p) => histRate(p) ?? 0))
    : 0;

  // Both charts in the trading section are clamped to a recent window (Jun 1 →
  // today) so they read cleanly on the active period; the maturity table below
  // keeps every market's all-time figures.
  const TRADING_WINDOW_START = "2026-06-01";
  // Combined "max fixed rate" overlay: one line per stXRP maturity that carried
  // real volume, on a shared axis, over the trading window. Each line is trimmed
  // at its maturity (the Spectra chart pads post-maturity points with a rate
  // that decays to zero) and dust markets are dropped, so the picture stays
  // honest.
  const PT_OVERLAY_MIN_VOL = 1_000_000;
  const matLabelShort = (d: string | null) =>
    d
      ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
      : "n/a";
  // A PT's implied fixed rate annualizes over its remaining term, so in the
  // final days before maturity a sliver of price gap explodes to absurd APYs
  // (millions of %). Drop the last week before maturity and cap at a sane
  // ceiling so those degenerate points never distort the shared axis.
  const PT_RATE_CEILING = 60;
  const PT_TAIL_DAYS = 10;
  const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const ptOverlay = (data.yieldTrading?.markets ?? [])
    .filter((m) => m.buyUsd + m.sellUsd >= PT_OVERLAY_MIN_VOL)
    .map((m) => {
      const matMs = m.maturityDate ? dayNum(m.maturityDate) : null;
      return {
        label: matLabelShort(m.maturityDate),
        maturityDate: m.maturityDate,
        expired: !!m.expired,
        points: (m.rateHistory ?? []).filter((p) => {
          if (!(p.apy > 0) || p.apy > PT_RATE_CEILING) return false;
          if (p.d < TRADING_WINDOW_START) return false;
          if (matMs == null) return true;
          const dtm = (matMs - dayNum(p.d)) / 86_400_000;
          return dtm >= PT_TAIL_DAYS;
        }),
      };
    })
    .filter((s) => s.points.length >= 8)
    .sort((a, b) => ((a.maturityDate ?? "") < (b.maturityDate ?? "") ? -1 : 1));

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

  // Headline range is single-exposure only: those are the comparable, durable
  // rates. Two-asset LP pools read far higher but are reward emissions on very
  // small pools, so they get a separate, caveated clause rather than the
  // headline (which they would otherwise dominate and distort).
  const singleRates = singles
    .filter((p) => !p.rateNa)
    .map(histRate)
    .filter((v): v is number => v != null);
  const sLo = singleRates.length ? Math.min(...singleRates) : 0;
  const sHi = singleRates.length ? Math.max(...singleRates) : 0;
  const sSorted = [...singleRates].sort((a, b) => a - b);
  const sMedian = sSorted.length ? sSorted[Math.floor(sSorted.length / 2)] : stats.medianApy;
  const topDualPool =
    duals
      .filter((p) => !p.rateNa)
      .slice()
      .sort((a, b) => (histRate(b) ?? 0) - (histRate(a) ?? 0))[0] ?? null;
  const dHi = topDualPool ? histRate(topDualPool) : null;

  // Popularity read for the "XRP yield right now" intro. Holder counts aren't
  // published across these venues, so we weigh how much capital each platform
  // holds (TVL) against what it pays: score = TVL x average rate. The average is
  // TVL-WEIGHTED over the same counted (non-PT) positions that make up the TVL
  // figure — a Spectra PT's TVL mirrors its pool and is suppressed everywhere
  // else, so it carries no weight here either. This keeps the "$X at Y%" prose
  // exactly consistent with the ranking table and the dedup methodology (a plain
  // mean of the per-product rates would not be).
  const platformAgg = new Map<
    string,
    { tvl: number; wRate: number; wTvl: number; products: number }
  >();
  for (const p of pools) {
    const cur =
      platformAgg.get(p.platform) ?? { tvl: 0, wRate: 0, wTvl: 0, products: 0 };
    if (tvlCounts(p)) {
      cur.tvl += p.tvlUsd || 0;
      cur.products += 1;
      const r = histRate(p);
      if (r != null && p.tvlUsd > 0) {
        cur.wRate += r * p.tvlUsd;
        cur.wTvl += p.tvlUsd;
      }
    }
    platformAgg.set(p.platform, cur);
  }
  const platformRanked = [...platformAgg.entries()]
    .map(([name, s]) => {
      const avgApy = s.wTvl > 0 ? s.wRate / s.wTvl : 0;
      return { name, tvl: s.tvl, products: s.products, avgApy, score: s.tvl * avgApy };
    })
    .sort((a, b) => b.score - a.score);
  const pop1 = platformRanked[0];
  const pop2 = platformRanked[1];

  // TVL-weighted average rate: what the tracked capital actually earns on
  // average (bigger positions count more). Backs the "best XRP yield" FAQ
  // answer with a real, derived figure instead of an evergreen platitude.
  const tvlWeightedApy = (() => {
    let weighted = 0;
    let total = 0;
    for (const p of pools) {
      const r = histRate(p);
      if (r == null || !(p.tvlUsd > 0) || !tvlCounts(p)) continue;
      weighted += r * p.tvlUsd;
      total += p.tvlUsd;
    }
    return total > 0 ? weighted / total : stats.medianApy;
  })();
  const spectraStats = platformRanked.find((p) => p.name === "Spectra");
  const earnXrp = pools.find((p) => p.venueSlug === "upshift-earnxrp");
  const bestYieldAnswer =
    spectraStats && earnXrp
      ? `It depends on risk appetite, but the deepest and most active XRP yield sits with the venues highlighted above: Spectra's staked-XRP markets and MetaVault, averaging about ${pct(spectraStats.avgApy)} across the capital tracked there, and the Clearstar Labs earnXRP vault on Upshift, the single largest at ${usd(earnXrp.tvlUsd)}. As a benchmark, the capital-weighted average across the ${ratedCount} tracked products is about ${pct(tvlWeightedApy)}. Two-asset pools post higher headline rates, at the cost of impermanent loss and a reliance on incentives; the ranking sorts every venue by its real 30-day average to keep the comparison fair.`
      : `It depends on risk appetite. As a benchmark, the capital-weighted average rate across the ${ratedCount} tracked products is about ${pct(tvlWeightedApy)}. Single-sided lending and vaults are the closest to a plain rate; liquidity pools show higher headline numbers but add impermanent loss and usually lean on incentives.`;
  // Highest-rate product for the "highest APY" answer (pools arrive rate-sorted).
  const topRate = pools
    .filter((p) => !p.rateNa)
    .reduce<XrpPool | null>(
      (best, p) => (best && (histRate(best) ?? 0) >= (histRate(p) ?? 0) ? best : p),
      null,
    );
  const totalTvlFaq = pools
    .filter(tvlCounts)
    .reduce((s, p) => s + (p.tvlUsd || 0), 0);
  // Answers rewritten at request time with live report data, so every one
  // mentions XRP and carries a real figure from the page above.
  const FAQ_DATA: Record<string, string> = {
    "What is the best XRP yield right now?": bestYieldAnswer,
    "How do you earn interest on XRP?": `You move XRP onto a smart-contract chain as a wrapped token such as FXRP or cbXRP, then put it to work: supply it to a lending market for borrower interest, deposit it in a curated vault, hold a fixed-rate Principal Token, or add it to a liquidity pool for swap fees. This report tracks ${stats.venues} such XRP products across ${stats.chains.length} networks (${joinAnd(stats.chains.map(chainLabel))}), holding about ${usd(totalTvlFaq)} in total, ranked by their real 30-day rate.`,
    "What is the highest APY for XRP?": topRate
      ? `The highest durable rate is single-sided: right now the top single-exposure 30-day rate is about ${pct(sHi)} on ${assetHead(topSingle)} at ${topSingle.platform}. Two-asset liquidity pools can post far larger headline numbers${dHi != null && topDualPool ? `, up to ${pct(dHi)}` : ""}, though these are reward emissions on very small pools${topDualPool ? ` — the top one holds only ${usd(topDualPool.tvlUsd)}` : ""} — that carry impermanent loss and fade quickly, which makes them opportunistic rather than a comparable yield. Across the ${ratedCount} rated XRP products the capital-weighted average is nearer ${pct(tvlWeightedApy)}. The 30-day figure is a better guide than the spot number.`
      : FAQ.find((f) => f.q === "What is the highest APY for XRP?")!.a,
    "What is impermanent loss in an XRP liquidity pool?": `It is the gap between simply holding your two tokens and supplying them to a pool. In an XRP pool that pairs a wrapped XRP token such as cbXRP or FXRP with a second asset, if the two prices drift apart the pool rebalances against your position, so it can end up worth less than holding, even after the swap fees and rewards it earned. It is the main reason the dual-exposure XRP pools in the ranking above carry more risk than their headline rate suggests.`,
  };
  const faqs = FAQ.map((f) =>
    FAQ_DATA[f.q] ? { ...f, a: FAQ_DATA[f.q] } : f,
  );

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

  // Right-rail "In this report" tree. Conditional sections are included only
  // when they render, so scroll-spy never points at a missing anchor.
  const tocItems: TocItem[] = [
    { id: "yield-now", label: "XRP yield right now" },
    { id: "ranking", label: "The ranking" },
    { id: "ranking-single-exposure", label: "Single-exposure", level: 1 },
    { id: "ranking-dual-exposure", label: "Dual-exposure", level: 1 },
    { id: "how-the-ranking-is-sorted", label: "How it is sorted", level: 1 },
    { id: "overview", label: "Overview" },
    { id: "yield-landscape", label: "XRP yield landscape" },
    ...(pools.some((p) => p.holders)
      ? [{ id: "most-popular", label: "Most popular by holders" }]
      : []),
    ...(venueCharts.length > 0
      ? [{ id: "rate-history", label: "30-day rate history" }]
      : []),
    ...(ptRows.length > 0 || data.yieldTrading
      ? [
          { id: "yield-trading", label: "XRP yield trading activity" },
          ...(ptOverlay.length > 0 || ptRows.length > 0
            ? [{ id: "yield-trading-fixed-rate", label: "Fixed-rate (Principal Tokens)", level: 1 }]
            : []),
          ...(data.yieldTrading
            ? [{ id: "yield-trading-variable-rate", label: "Variable-rate (Yield Tokens)", level: 1 }]
            : []),
        ]
      : []),
    { id: "where-yield-comes-from", label: "Where yield comes from" },
    { id: "source-lending", label: "Lending", level: 1 },
    { id: "source-vaults", label: "Vaults & liquid staking", level: 1 },
    { id: "source-liquidity", label: "Liquidity provision", level: 1 },
    { id: "source-fixed-rate-pts", label: "Fixed-rate PTs", level: 1 },
    { id: "source-yield-tokens", label: "Yield Tokens", level: 1 },
    { id: "wrapped-xrp", label: "Wrapped forms of XRP" },
    { id: "can-you-stake-xrp", label: "Can you stake XRP?" },
    { id: "cefi-vs-defi", label: "CeFi vs DeFi" },
    { id: "key-risks", label: "Key risks" },
    { id: "venues-in-depth", label: "Venues in depth" },
    { id: "faq", label: "FAQ" },
    { id: "machine-readable-data", label: "Data & downloads" },
    { id: "onchain-references", label: "Onchain references" },
    { id: "method-and-scope", label: "Method & scope" },
  ];

  // Three representative marks for the hero: XRP and its two headline wrapped
  // forms. Kept to three so the cluster reads as a small left-aligned accent.
  const heroTokens = ["XRP", "FXRP", "stXRP"];

  // XRP Yield Landscape: total TVL now + how it grew. TVL split by network and
  // by product type is derived from `pools` at render time so it never drifts
  // from the tables; the growth series comes from the build-time aggregate.
  const land = data.landscape;
  const totalTvl = pools
    .filter(tvlCounts)
    .reduce((s, p) => s + (p.tvlUsd || 0), 0);
  const tvlBy = (key: (p: XrpPool) => string) => {
    const m = new Map<string, number>();
    for (const p of pools) {
      if (!tvlCounts(p)) continue;
      m.set(key(p), (m.get(key(p)) ?? 0) + (p.tvlUsd || 0));
    }
    return [...m.entries()]
      .map(([label, tvl]) => ({ label, tvl, pctOfTotal: totalTvl ? (tvl / totalTvl) * 100 : 0 }))
      .sort((a, b) => b.tvl - a.tvl);
  };
  const tvlByNetwork = tvlBy((p) => chainLabel(p.chain));
  const typeGroup = (p: XrpPool) => {
    const k = productTypeOf(p);
    return k === "Fixed-rate" ? "Fixed-rate PTs" : k === "Vault" ? "Vaults" : k;
  };
  const tvlByType = tvlBy(typeGroup);
  const tvlLeaders = platformRanked
    .filter((p) => p.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 4);

  // Popularity by holder count (from the chain explorer). Ranks the products
  // that expose a public holder-bearing token, most wallets first, and derives
  // a retail-vs-concentrated read from the count and the top-wallet share.
  const holderRanked = pools
    .filter((p) => p.holders && Number.isFinite(p.holders.count))
    .sort((a, b) => (b.holders!.count ?? 0) - (a.holders!.count ?? 0));
  const holderProfile = (h: NonNullable<XrpPool["holders"]>): string => {
    if (h.count >= 500 && h.top1Pct != null && h.top1Pct < 15) return "Retail-broad";
    if (h.count <= 20 || (h.top1Pct != null && h.top1Pct >= 60)) return "Concentrated";
    return "Mixed";
  };
  const holderTotal = holderRanked.reduce((s, p) => s + (p.holders!.count ?? 0), 0);
  const holderTop = holderRanked[0];
  const holderAsOf = new Date(
    holderTop?.holders?.asOf ?? data.generatedAt,
  ).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  // Answer-first walk of the holder ranking, top to bottom, so the section
  // leads with a citable summary rather than methodology. The runners-up are
  // named with their counts; a long tail collapses to a "+N more" clause.
  const holderRunnerUps = holderRanked
    .slice(1)
    .map((p) => `${assetHead(p)} on ${p.platform} (${(p.holders!.count ?? 0).toLocaleString()})`);
  const holderFollow =
    holderRunnerUps.length <= 4
      ? joinList(holderRunnerUps)
      : `${holderRunnerUps.slice(0, 4).join(", ")}, and ${
          holderRunnerUps.length - 4
        } more`;

  // Spectra stXRP yield-market trading activity: total flow, the active markets
  // ranked by volume, and the buy/sell skew that reads as sentiment on the rate.
  const trading = data.yieldTrading;
  const tradeVol = trading ? trading.totals.buyUsd + trading.totals.sellUsd : 0;
  const tradeTop = trading?.markets.find((m) => m.buyUsd + m.sellUsd > 0) ?? null;
  // Markets with meaningful flow (drop dust markets with a trade or two).
  const tradeMkts = trading
    ? trading.markets.filter((m) => m.buyUsd + m.sellUsd >= 1000)
    : [];
  const tradeActive = tradeMkts; // alias kept for existing references
  // The nearest live (not-yet-matured) market, and how much of all-time volume
  // ran through markets that have since matured.
  const tradeLiveTop = tradeMkts.find((m) => !m.expired) ?? null;
  const tradeExpiredVol = tradeMkts
    .filter((m) => m.expired)
    .reduce((s, m) => s + m.buyUsd + m.sellUsd, 0);
  const tradeExpiredPct = tradeVol ? Math.round((tradeExpiredVol / tradeVol) * 100) : 0;
  const tradeMaturedCount = tradeMkts.filter((m) => m.expired).length;
  const matLabel = (d: string | null) =>
    d
      ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
      : "n/a";

  // Onchain references: raw contract addresses, grouped. Wrapped-XRP assets;
  // the vault / lending-market / LP receipt tokens we actually read holders from
  // (holders.token); and every Spectra stXRP market split into its three legs —
  // the LP pool token, the Principal Token and the Yield Token — matured markets
  // included (their PT address collapses to the pool once they roll off the live
  // list, so only LP + YT are shown there).
  interface RefRow {
    name: string;
    type: string;
    chain: string;
    address: string;
    expired?: boolean;
    group: "asset" | "vault" | "market";
  }
  const isSpectraMarketToken = (p: XrpPool) =>
    (p.venueSlug ?? "").startsWith("spectra-pt-") ||
    (p.venueSlug ?? "").startsWith("spectra-pool-");
  const onchainRefs: RefRow[] = [
    ...WRAPPED_TOKENS.filter((t) => t.address).map<RefRow>((t) => ({
      name: nice(t.token),
      type: "Wrapped token",
      chain: t.chain,
      address: t.address as string,
      group: "asset",
    })),
    ...pools
      .filter((p) => p.holders?.token && !isSpectraMarketToken(p))
      .map<RefRow>((p) => ({
        name: `${assetHead(p)}${p.detail ? ` · ${p.detail}` : ""}`,
        type: typeLabel(p),
        chain: p.chain,
        address: p.holders!.token as string,
        group: "vault",
      })),
    ...(data.yieldTrading?.markets ?? [])
      .filter((m) => m.maturityDate)
      .slice()
      // Live markets first (by maturity), matured markets pushed to the end.
      .sort((a, b) => {
        if (!!a.expired !== !!b.expired) return a.expired ? 1 : -1;
        return (a.maturityDate ?? "") < (b.maturityDate ?? "") ? -1 : 1;
      })
      .flatMap<RefRow>((m) => {
        const mat = matLabel(m.maturityDate);
        const rows: RefRow[] = [];
        if (m.pool)
          rows.push({ name: `stXRP · ${mat}`, type: "LP pool token", chain: "Flare", address: m.pool, expired: !!m.expired, group: "market" });
        if (m.market && m.market.toLowerCase() !== m.pool.toLowerCase())
          rows.push({ name: `stXRP · ${mat}`, type: "Principal Token", chain: "Flare", address: m.market, expired: !!m.expired, group: "market" });
        if (m.yt)
          rows.push({ name: `stXRP · ${mat}`, type: "Yield Token", chain: "Flare", address: m.yt, expired: !!m.expired, group: "market" });
        return rows;
      }),
  ];

  // Freshness date shown as "Last updated" / "As of". Uses the most recent of
  // the snapshot and its enrichment passes (landscape, holders, trading) so the
  // date reflects when the report's data was actually last refreshed — and a
  // scheduled job (.github/workflows/update-xrp-data.yml) re-runs the pipeline
  // daily so it keeps moving.
  const freshestTs = Math.max(
    ...[
      data.generatedAt,
      data.landscape?.generatedAt,
      data.yieldTrading?.generatedAt,
      data.pools.find((p) => p.holders?.asOf)?.holders?.asOf,
    ]
      .filter((s): s is string => typeof s === "string")
      .map((s) => new Date(s).getTime())
      .filter((t) => Number.isFinite(t)),
  );
  const updated = new Date(freshestTs).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const dataModifiedIso = new Date(freshestTs).toISOString();

  const rates = pools.map(histRate).filter((v): v is number => v != null);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);

  const heroVault = featured
    ? {
        productName: assetHead(featured),
        asset: featured.symbol,
        chain: featured.chain,
        protocol: featured.platform,
        vaultType: featured.detail ?? "Single-exposure",
        apy24h: featured.apy ?? 0,
        apy30d: featured.apyMean30d ?? 0,
        tvl: featured.tvlUsd,
        // Real PT rate history drives the card's bars so it mirrors the
        // stXRP PT · Aug 2026 opportunity, not a decorative series.
        apySpark:
          featured.history && featured.history.length >= 2
            ? featured.history.map((h) => h.apy)
            : synthSpark(featured),
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
              dateModified: dataModifiedIso,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            articleSchema({
              title: "XRP Yield Ranking: Where XRP Actually Earns",
              description: `Where to earn yield on XRP across ${stats.venues} DeFi products (XRP, FXRP, stXRP and cbXRP) on ${stats.chains.length} networks, ranked by real 30-day rate. Lending, vaults, fixed-rate Principal Tokens and liquidity pools; XRP has no native staking, so these are the real onchain rates. Informational research, refreshed hourly.`,
              url: PAGE_URL,
              datePublished: DATE_PUBLISHED,
              dateModified: dataModifiedIso,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportDatasetSchema({
              name: "XRP DeFi yield ranking dataset",
              description: `Rate, TVL and 90-day range for ${stats.venues} curated XRP-denominated DeFi products (lending, vaults, liquid staking, fixed-rate Principal Tokens and liquidity pools) across ${stats.chains.length} networks, refreshed hourly. Measured on-chain (Base and Flare) with the Spectra API; informational research, not financial advice.`,
              url: PAGE_URL,
              dateModified: dataModifiedIso,
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
              distribution: [
                {
                  format: "application/json",
                  url: `${SITE_URL}/data/xrp-yield/index.json`,
                },
                {
                  format: "text/csv",
                  url: `${SITE_URL}/data/xrp-yield/history.csv`,
                },
                {
                  format: "text/csv",
                  url: `${SITE_URL}/data/xrp-yield/landscape-tvl.csv`,
                },
              ],
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
          <div className="rp-hero-tokens" aria-hidden="true">
            {heroTokens.map((t, i) => (
              <span
                key={t}
                className="rp-hero-tok"
                style={{ marginLeft: i ? -4 : 0, zIndex: heroTokens.length - i }}
              >
                <AssetIcon asset={t} size={13} />
              </span>
            ))}
          </div>
          <h1 className="uni-home-h1">XRP Yield Ranking: Where XRP Actually Earns</h1>
          <p className="uni-home-sub">
            The clearest way to earn yield on XRP, ranked by real rates. This
            report follows {pools.length} curated XRP products, from lending and
            vaults to fixed-rate Principal Tokens and liquidity pools, ranked by
            rate and split by exposure.
          </p>
          <p className="rp-updated">Last updated {updated}</p>
          <a href="#ranking" className="uni-home-cta-primary">
            Explore the ranking
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <main className="uni-home-shell">
       <div className="rp-doc">
        <div className="rp-doc-main">
        <section className="uni-home-content" aria-labelledby="overview">
          <p className="rp-eyebrow">Report</p>
          <h2 id="overview">Overview</h2>
          <div className="rp-article">
            <p>
              Through 2026, earning yield on XRP has quietly grown into one of
              the more active corners of DeFi. XRP is not a proof-of-stake asset,
              so there is no native staking rate to claim.
            </p>
            <p>
              The XRP Ledger&rsquo;s native AMM already pays trading fees
              on-ledger, and on-ledger lending is starting to arrive. The deeper
              and more varied rates live on smart-contract chains.
            </p>
            <p>
              There, XRP is held as a wrapped token such as FXRP or cbXRP, or a
              staked form like stXRP, and supplied to a lending market, a vault, a
              fixed-rate Principal Token, or a liquidity pool. This page follows a
              curated set of these products and ranks them by rate.
            </p>
            <p>
              As of {updated} this report tracks{" "}
              <strong>{stats.venues} XRP products</strong> across{" "}
              <strong>{stats.chains.length} networks</strong>,{" "}
              {joinAnd(stats.chains.map(chainLabel))}. Single-exposure XRP yield
              sources span <strong>{pct(sLo)}</strong> to{" "}
              <strong>{pct(sHi)}</strong>, with a median of{" "}
              <strong>{pct(sMedian)}</strong>.
              {dHi != null && topDualPool ? (
                <>
                  {" "}
                  Two-asset liquidity pools that pair XRP with an uncorrelated
                  asset reach far higher, up to <strong>{pct(dHi)}</strong>.
                  Those figures are almost entirely reward emissions on very
                  thin liquidity, roughly {usd(topDualPool.tvlUsd)} in the top
                  pool, and move sharply week to week, which makes them
                  opportunistic rather than a comparable yield.
                </>
              ) : null}
            </p>
            <p>
              <strong>{stats.incentivized} of the {stats.venues}</strong> lean on
              reward-token incentives for the bulk of their rate, so those tend to
              ease off once a rewards program winds down.
            </p>
          </div>
          <nav className="rp-toc" aria-label="On this page">
            <span className="rp-toc-label">On this page</span>
            <a href="#yield-landscape">Landscape</a>
            <a href="#ranking">The ranking</a>
            <a href="#rate-history">30-day rate history</a>
            <a href="#where-yield-comes-from">Where yield comes from</a>
            <a href="#wrapped-xrp">Wrapped forms of XRP</a>
            <a href="#can-you-stake-xrp">Can you stake XRP?</a>
            <a href="#cefi-vs-defi">CeFi vs DeFi</a>
            <a href="#key-risks">Risks</a>
            <a href="#venues-in-depth">Venues in depth</a>
            <a href="#faq">FAQ</a>
            <a href="#method-and-scope">Method</a>
          </nav>
        </section>

        <section className="uni-home-content" aria-labelledby="ranking">
          <p className="rp-eyebrow">Live rates</p>
          <h2 id="ranking">The ranking</h2>
          <p className="rp-lead">
            The curated XRP products, ranked by rate and split by exposure.
            Single-exposure positions sit on one side of the market; dual-exposure
            positions pair an XRP token with a second asset. The Type column names
            each product.
          </p>
          <div className="rp-rank-group">
            <div className="rp-rank-head">
              <h3 id="ranking-single-exposure">Single-exposure XRP yield</h3>
              <p>
                {singles.length} one-sided positions with no second asset:
                lending markets, curated vaults, liquid staking, fixed-rate
                Principal Tokens and stXRP pools. Sorted by rate.
              </p>
            </div>
            <RankTable rows={singles} />
          </div>
          <div className="rp-rank-group">
            <div className="rp-rank-head">
              <h3 id="ranking-dual-exposure">Dual-exposure XRP pools</h3>
              <p>
                {duals.length} two-asset liquidity pools that pair an XRP token
                with something else and earn swap fees plus rewards. Their
                headline rates are the highest on the page, yet the top ones sit
                on very thin liquidity, a few hundred thousand dollars, where the
                rate is mostly reward emissions and shifts week to week.
                Impermanent loss applies. Sorted by rate.
              </p>
            </div>
            <RankTable rows={duals} />
          </div>
          <div className="rp-rank-sort">
            <h3 id="how-the-ranking-is-sorted">How the ranking is sorted</h3>
            <p>
              Venues are sorted by the 30-day average rate rather than
              today&rsquo;s spot number, so a single big day of rewards cannot
              flatter a venue to the top. The tables are split by exposure, and a
              Type column names each product so like compares with like.
            </p>
            <TipBox>
              When comparing XRP venues, weigh the <strong>30-day rate</strong>{" "}
              over the spot number: a wrapped-XRP pool riding a short reward
              spike can top the spot ranking yet fade within weeks, while a deep
              single-sided lending or vault rate tends to hold.
            </TipBox>
          </div>
          <p className="rp-source-note">
            Rates and TVL measured on-chain (Base and Flare) and via the Spectra
            API, as of {updated}, refreshed hourly. Each row links to the
            platform&rsquo;s own site.
            {pools.some((p) => p.offchainRewardNote) ? (
              <>
                {" "}
                <span aria-hidden="true">†</span> Shows the on-chain yield only;
                the venue also pays a Flare reward incentive (rFLR or sFLR)
                allocated off-chain that is not readable on-chain and so is
                excluded from the ranking rate.
              </>
            ) : null}
          </p>
        </section>

        <section className="uni-home-content" aria-labelledby="yield-now">
          <p className="rp-eyebrow">Summary</p>
          <h2 id="yield-now">XRP yield right now</h2>
          <div className="rp-snapshot">
            <p>
              As of {updated}, the top vault or lending rate is{" "}
              <strong>{pct(histRate(topSingle))}</strong> on {assetHead(topSingle)}{" "}
              at {topSingle.platform}
              {topDual ? (
                <>
                  . Two-asset liquidity pools post larger headline numbers, up to{" "}
                  <strong>{pct(histRate(topDual))}</strong> on {assetHead(topDual)}{" "}
                  at {topDual.platform}, a reward-driven rate on only{" "}
                  {usd(topDual.tvlUsd)} of liquidity that shifts week to week
                </>
              ) : null}
              {topPt ? (
                <>
                  . Fixed-rate Principal Tokens sit near{" "}
                  <strong>{pct(histRate(topPt))}</strong>, locked to maturity
                </>
              ) : null}
              . The median single-exposure rate is{" "}
              <strong>{pct(sMedian)}</strong>.
            </p>
            {pop1 && pop2 ? (
              <p>
                Weighing how much capital sits on each platform against the
                rate it pays, <strong>{pop1.name}</strong> and{" "}
                <strong>{pop2.name}</strong> hold the largest, most active
                positions on the page: {pop1.name} with{" "}
                <strong>{usd(pop1.tvl)}</strong> across {pop1.products}{" "}
                {pop1.products === 1 ? "product" : "products"} at an average{" "}
                <strong>{pct(pop1.avgApy)}</strong>, and {pop2.name} with{" "}
                <strong>{usd(pop2.tvl)}</strong> at{" "}
                <strong>{pct(pop2.avgApy)}</strong>.
              </p>
            ) : null}
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="yield-landscape">
          <p className="rp-eyebrow">The big picture</p>
          <h2 id="yield-landscape">XRP yield landscape</h2>
          <div className="rp-land-stats">
            <div className="rp-land-stat">
              <span className="rp-land-num">{usd(totalTvl)}</span>
              <span className="rp-land-lab">Total TVL tracked</span>
            </div>
            <div className="rp-land-stat">
              <span className="rp-land-num">{stats.venues}</span>
              <span className="rp-land-lab">Products</span>
            </div>
            <div className="rp-land-stat">
              <span className="rp-land-num">{stats.chains.length}</span>
              <span className="rp-land-lab">Networks</span>
            </div>
            <div className="rp-land-stat">
              <span className="rp-land-num">{pct(tvlWeightedApy)}</span>
              <span className="rp-land-lab">Capital-weighted rate</span>
            </div>
          </div>

          {land && land.series.length > 2 ? (
            <>
              <p className="rp-lead">
                XRP-denominated DeFi deposits grew from{" "}
                <strong>{usd(land.start.tvl)}</strong> in{" "}
                {new Date(`${land.start.d}T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}{" "}
                to a peak of <strong>{usd(land.peak.tvl)}</strong> in{" "}
                {new Date(`${land.peak.d}T00:00:00Z`).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
                , and stand near <strong>{usd(land.latest.tvl)}</strong> today
                across the venues with a continuous on-chain record. That covers{" "}
                <strong>{land.indexedShareOfTotalPct}%</strong> of the{" "}
                {usd(totalTvl)} total; the remainder sits in venues tracked at
                their current value.
              </p>
              <LandscapeChart
                series={land.series}
                title="Tracked XRP DeFi TVL"
                subtitle="daily total"
                nowLabel={new Date(`${land.latest.d}T00:00:00Z`).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
                )}
              />
            </>
          ) : null}

          <div className="rp-land-splits">
            <div className="rp-land-split">
              <h3 className="rp-land-split-h">By network</h3>
              <div className="rp-dtable-wrap">
                <table className="rp-dtable">
                  <thead>
                    <tr>
                      <th>Network</th>
                      <th className="num">TVL</th>
                      <th className="num">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tvlByNetwork.map((r) => (
                      <tr key={r.label}>
                        <td className="strong">{r.label}</td>
                        <td className="num">{usd(r.tvl)}</td>
                        <td className="num">{r.pctOfTotal.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rp-land-split">
              <h3 className="rp-land-split-h">By product type</h3>
              <div className="rp-dtable-wrap">
                <table className="rp-dtable">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="num">TVL</th>
                      <th className="num">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tvlByType.map((r) => (
                      <tr key={r.label}>
                        <td className="strong">{r.label}</td>
                        <td className="num">{usd(r.tvl)}</td>
                        <td className="num">{r.pctOfTotal.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {tvlLeaders.length > 0 ? (
            <p className="rp-article rp-insight">
              By depth, {joinAnd(tvlLeaders.map((v) => `${v.name} at ${usd(v.tvl)}`))}{" "}
              hold the largest XRP positions on the page. Deposits concentrate on{" "}
              {tvlByNetwork[0].label}, which carries{" "}
              <strong>{tvlByNetwork[0].pctOfTotal.toFixed(0)}%</strong> of tracked
              TVL, reflecting where wrapped XRP liquidity is deepest.
            </p>
          ) : null}

          <div className="rp-methodology">
            <span className="rp-methodology-label">Chart Methodology Note</span>
            <p>
              {land
                ? land.note
                : "Total XRP-denominated DeFi TVL across tracked venues. Sources: on-chain reads (Base and Flare), Spectra and Portals."}{" "}
              TVL split by network and type is computed from the {stats.venues}{" "}
              tracked products as of {updated}.
            </p>
          </div>
        </section>

        {holderRanked.length > 0 && (
          <section className="uni-home-content" aria-labelledby="most-popular">
            <p className="rp-eyebrow">Adoption</p>
            <h2 id="most-popular">Most popular XRP yield sources</h2>
            {holderTop ? (
              <p className="rp-lead">
                By on-chain holder count, the most widely held XRP yield product
                is {assetHead(holderTop)} on {holderTop.platform}, with{" "}
                {(holderTop.holders!.count ?? 0).toLocaleString()} wallets as of{" "}
                {holderAsOf}.
                {holderFollow ? ` It is followed by ${holderFollow}.` : ""}
              </p>
            ) : null}
            {holderTop ? (
              <p className="rp-lead">
                Across the {holderRanked.length} products that expose a public
                holder-bearing token, roughly {holderTotal.toLocaleString()}{" "}
                wallets hold XRP yield onchain.
              </p>
            ) : null}
            <p className="rp-lead">
              Rate and TVL show how much is deposited; holder counts show how
              many wallets actually hold each product, a read on real adoption
              and on whether a product is spread across many depositors or
              concentrated in a few. The table below ranks by on-chain holders,
              with the largest wallet&rsquo;s share where the token&rsquo;s
              supply exposes it.
            </p>
            <div className="hub-table-wrap rp-rank rp-rank-holders" data-nosnippet="">
              <div className="hub-table" role="table" aria-label="XRP products by holders">
                <div className="hub-thead" role="row">
                  <span className="hub-th hub-th-rank">#</span>
                  <span className="hub-th">Product</span>
                  <span className="hub-th hub-th-num">Holders</span>
                  <span className="hub-th hub-th-num">Top wallet</span>
                  <span className="hub-th hub-th-right">Profile</span>
                </div>
                <div className="hub-tbody" role="rowgroup">
                  {holderRanked.map((p, i) => {
                    const h = p.holders!;
                    const profile = holderProfile(h);
                    return (
                      <div className="hub-row" role="row" key={p.id}>
                        <span className="hub-cell hub-rank">{i + 1}</span>
                        <span className="hub-cell hub-vault">
                          <TokenIcons symbol={p.symbol} />
                          <span className="rp-rank-nameblock">
                            <span className="hub-vault-name">{assetHead(p)}</span>
                            <span className="rp-rank-detail">
                              {p.detail ? `${p.detail} · ` : ""}
                              {p.platform}
                            </span>
                          </span>
                        </span>
                        <span className="hub-cell hub-num rp-hcount">
                          {h.count.toLocaleString()}
                        </span>
                        <span className="hub-cell hub-num">
                          {walletPct(h.top1Pct)}
                        </span>
                        <span className="hub-cell rp-cell-tag">
                          <span
                            className={`rp-hprofile rp-hprofile-${profile
                              .toLowerCase()
                              .replace(/[^a-z]/g, "")}`}
                          >
                            {profile}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {holderTop ? (
              <p className="rp-article rp-insight">
                {assetHead(holderTop)} on {holderTop.platform} is the most widely
                held by a wide margin, with{" "}
                <strong>{holderTop.holders!.count.toLocaleString()} wallets</strong>
                {holderTop.holders!.top1Pct != null ? (
                  <>
                    {" "}
                    and no single wallet above{" "}
                    <strong>{holderTop.holders!.top1Pct.toFixed(0)}%</strong> of
                    supply, a broad, retail-style base
                  </>
                ) : null}
                .
              </p>
            ) : null}
            {holderTop ? (
              <p className="rp-article rp-insight">
                Counts fall off steeply from there: the smallest liquidity pools
                sit with only a handful of wallets, where one provider can hold
                nearly the entire position. Across the ranking,{" "}
                <strong>{holderTotal.toLocaleString()}</strong> holder positions
                are tracked.
              </p>
            ) : null}
            <p className="rp-source-note">
              Holder counts and top-wallet shares from each token&rsquo;s
              chain explorer (Flare and Base Blockscout), as of {holderAsOf}.
              One wallet can hold several products, and a product can be held
              through an aggregator or staking contract, which reads as a single
              large holder.
            </p>
          </section>
        )}

        {(ptRows.length > 0 || (trading && tradeActive.length > 0)) && (
          <section className="uni-home-content" aria-labelledby="yield-trading">
            <p className="rp-eyebrow">Yield trading</p>
            <h2 id="yield-trading">XRP yield trading activity</h2>
            <p className="rp-lead">
              There are two ways to trade the XRP yield itself, both on
              Spectra&rsquo;s dated staked-XRP markets: lock a fixed rate by
              holding a Principal Token, or take the variable-yield side. Below is
              the fixed rate each market has offered, then how actively the
              markets have traded this year.
            </p>

            {ptOverlay.length > 0 || ptRows.length > 0 ? (
              <>
                <h3 id="yield-trading-fixed-rate" className="rp-trade-subhead">
                  XRP: Fixed-Rate Yield Trading Activity (Principal Tokens)
                </h3>
                {ptOverlay.length > 0 ? (
                  <>
                    <p className="rp-lead rp-trade-sublead">
                      The locked-in max fixed rate on each liquid staked-XRP
                      maturity, overlaid on one axis since June 2026, straight
                      from Spectra. A PT secures its rate to maturity, so each
                      line is that market&rsquo;s running record of the fixed
                      rate on offer.
                    </p>
                    <OverlayChart
                      series={ptOverlay}
                      title="Max fixed rate by maturity"
                      subtitle="daily, liquid stXRP markets · since Jun 2026"
                    />
                    <div className="rp-methodology">
                      <span className="rp-methodology-label">Methodology</span>
                      <p>
                        Each line is one maturity&rsquo;s daily max fixed rate
                        from Spectra, from June 2026, capped and trimmed near
                        maturity where the annualized rate degenerates. The
                        figure beside each maturity is its{" "}
                        <strong>latest</strong> reading, so it can differ
                        slightly from the ranking table above, which sorts on the
                        30-day average. Only markets that carried real volume are
                        overlaid; the thinnest maturities are left out. The two
                        live Spectra PTs together hold {usd(ptTvl)} in liquidity.
                        The maturity table below covers every market over its full
                        life.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="rp-lead rp-trade-sublead">
                      The locked-in fixed rate on each staked-XRP Principal Token,
                      tracked day by day since the market opened, straight from
                      Spectra. A PT secures this rate to maturity, so the line is
                      the full record of what each maturity has offered.
                    </p>
                    <div className="rp-charts">
                      {ptRows.map((p) => (
                        <ReportChart
                          key={p.id}
                          history={p.history ?? []}
                          title={nice(p.displayName ?? p.symbol)}
                          tvlLabel={`${usd(p.tvlUsd)} TVL`}
                          nowValue={
                            p.history?.[p.history.length - 1]?.apy ?? histRate(p)
                          }
                          nowLabel="max fixed"
                        />
                      ))}
                    </div>
                    <p className="rp-source-note">
                      Both maturities opened near {pct(ptOpenHi)} and have eased
                      into the low single digits since, a gentle downtrend as
                      early demand settled. The top fixed rate now sits around{" "}
                      {pct(ptNowHi)}, still competitive with the single-sided
                      field, and the two Spectra pools together hold {usd(ptTvl)}{" "}
                      in liquidity.
                    </p>
                  </>
                )}
              </>
            ) : null}

            {trading && tradeActive.length > 0 ? (
              <>
                <h3 id="yield-trading-variable-rate" className="rp-trade-subhead">
                  XRP: Variable-Rate Yield Trading Activity (Yield Tokens)
                </h3>
                <p className="rp-lead rp-trade-sublead">
                  The flip side is how actively these markets trade. Every
                  fixed-rate (PT) trade has a variable-yield (YT) counterpart, so
                  the buy and sell flow is a direct read on demand for the stXRP
                  yield. The figures below cover every stXRP market on Spectra,
                  including the {tradeMaturedCount} that have since matured.
                </p>
            <div className="rp-land-stats">
              <div className="rp-land-stat">
                <span className="rp-land-num">{usd(tradeVol)}</span>
                <span className="rp-land-lab">Traded volume</span>
              </div>
              <div className="rp-land-stat">
                <span className="rp-land-num">
                  {trading.totals.txns.toLocaleString()}
                </span>
                <span className="rp-land-lab">Trades</span>
              </div>
              <div className="rp-land-stat">
                <span className="rp-land-num">
                  {trading.totals.traders.toLocaleString()}
                </span>
                <span className="rp-land-lab">Unique traders</span>
              </div>
              <div className="rp-land-stat">
                <span className="rp-land-num">{tradeMkts.length}</span>
                <span className="rp-land-lab">stXRP markets</span>
              </div>
            </div>

            {trading.daily.filter((p) => p.d >= TRADING_WINDOW_START).length > 2 ? (
              <TradingChart
                series={trading.daily.filter((p) => p.d >= TRADING_WINDOW_START)}
                title="Daily stXRP fixed-yield trading volume"
                subtitle="Principal-Token buy + sell across every Spectra stXRP market · since Jun 2026"
              />
            ) : null}

            <div className="rp-dtable-wrap">
              <table className="rp-dtable">
                <thead>
                  <tr>
                    <th>Maturity</th>
                    <th className="num">Volume</th>
                    <th className="num">Traders</th>
                    <th className="num">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeMkts.map((m) => (
                    <tr key={m.pool}>
                      <td className="strong">{matLabel(m.maturityDate)}</td>
                      <td className="num">{usd(m.buyUsd + m.sellUsd)}</td>
                      <td className="num">{m.traders.toLocaleString()}</td>
                      <td className="num">
                        <span
                          className={`rp-dtag${m.expired ? "" : " rp-dtag-live"}`}
                        >
                          {m.expired ? "Matured" : "Live"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="rp-article rp-insight rp-trade-insights">
              XRP fixed-yield trading has run at real scale since late 2025:{" "}
              <strong>{usd(tradeVol)}</strong> across {tradeMkts.length} stXRP
              markets and {trading.totals.traders} unique traders. The bulk ran
              through markets that have since matured, which carried{" "}
              <strong>{tradeExpiredPct}%</strong> of all volume; the single
              busiest was the{" "}
              <strong>{matLabel(tradeTop?.maturityDate ?? null)}</strong>{" "}
              maturity at{" "}
              <strong>
                {usd((tradeTop?.buyUsd ?? 0) + (tradeTop?.sellUsd ?? 0))}
              </strong>
              .
            </p>
            <p className="rp-article rp-insight">
              Among live markets, the nearest{" "}
              <strong>{matLabel(tradeLiveTop?.maturityDate ?? null)}</strong>{" "}
              maturity leads. Buys and sells run close to even overall,{" "}
              <strong>{usd(trading.totals.buyUsd)}</strong> to{" "}
              <strong>{usd(trading.totals.sellUsd)}</strong>, a market roughly
              balanced between locking the fixed rate and taking the variable
              side.
            </p>

                <div className="rp-methodology">
                  <span className="rp-methodology-label">Methodology</span>
                  <p>
                    {trading.note} Every stXRP market is included, so quiet
                    stretches on the daily chart are real lulls between
                    maturities (demand thinning as one maturity winds down
                    before the next ramps), not missing pools. As of{" "}
                    {holderAsOf}. Trade and trader counts are a floor on the
                    busiest matured markets, where the venue caps the returned
                    history.
                  </p>
                </div>
              </>
            ) : null}
          </section>
        )}

        {venueCharts.length > 0 && (
          <section className="uni-home-content" aria-labelledby="rate-history">
            <p className="rp-eyebrow">Charts</p>
            <h2 id="rate-history">30-day rate history</h2>
            <p className="rp-lead">
              {rhHi != null && rhLo != null && rhTop ? (
                <>
                  Over the last 30 days, headline rates across the{" "}
                  {venueCharts.length} larger charted venues sat between{" "}
                  <strong>{pct(rhLo)}</strong> and <strong>{pct(rhHi)}</strong>,
                  topped by {rhTop.name} at {pct(rhHi)}.
                  {rhMover && rhMover.delta != null && Math.abs(rhMover.delta) >= 0.1
                    ? ` ${rhMover.name} moved most, ${
                        rhMover.delta >= 0 ? "up" : "down"
                      } about ${Math.abs(rhMover.delta).toFixed(1)} points. `
                    : " "}
                </>
              ) : null}
              How the rate has moved over the last 30 days for a selection of
              the larger venues, from DeFiLlama&rsquo;s daily record. Useful for
              telling a steady rate apart from one riding a short-lived incentive
              spike.
            </p>
            <div className="rp-charts">
              {venueCharts.map((p) => (
                <ReportChart
                  key={p.id}
                  history={(p.history ?? []).slice(-30)}
                  title={assetHead(p)}
                  subtitle={p.platform}
                  tvlLabel={`${usd(p.tvlUsd)} TVL`}
                  nowValue={histRate(p)}
                  nowLabel="30d APY"
                />
              ))}
            </div>
            <p className="rp-source-note">
              Daily APY from DeFiLlama, last 30 days, as of {updated}.
            </p>
          </section>
        )}

        <section className="uni-home-content" aria-labelledby="where-yield-comes-from">
          <p className="rp-eyebrow">Guide</p>
          <h2 id="where-yield-comes-from">Where XRP yield comes from</h2>
          <div className="rp-article">
            <p>
              <strong>
                In short, XRP yield comes from four sources: lending wrapped XRP
                to money markets, vaults and liquid staking, providing liquidity
                in pools, and fixed-rate Principal Tokens.
              </strong>{" "}
              Every rate on this page traces back to one of them. Knowing which
              source is behind a number makes it much easier to tell a steady,
              organic rate from one that is mostly short-term rewards.
            </p>

            <h3 id="source-lending">Lending</h3>
            <p>
              Wrapped XRP supplied to a money market such as Kinetic on Flare or
              Moonwell on Base earns the interest borrowers pay on their loans.
            </p>
            <p>
              It is single-sided, so there is no second asset to track, and on
              Flare the base rate is often topped up with rFLR reward tokens. This
              is the closest thing XRP has to a plain savings rate.
            </p>

            <h3 id="source-vaults">Vaults and liquid staking</h3>
            <p>
              Vaults and liquid-staking tokens do the work automatically. A
              curated vault such as Spectra, Upshift, Mystic or Superform, or a
              staking token like Firelight&rsquo;s stXRP, takes the wrapped XRP
              and runs a strategy with it.
            </p>
            <p>
              The results compound into a single token managed by a curator, and
              the rate blends whatever the strategy earns with any reward
              incentives on top.
            </p>

            <h3 id="source-liquidity">Liquidity provision</h3>
            <p>
              Pairing an XRP token with another asset in a pool on SparkDEX or
              Aerodrome earns a share of the swap fees, usually with extra reward
              tokens layered on.
            </p>
            <p>
              The headline rates are the highest on the page, with one trade-off:
              if the two tokens drift apart in price the position can suffer
              impermanent loss, so these pools reward active management.
            </p>

            <h3 id="source-fixed-rate-pts">Fixed-rate Principal Tokens</h3>
            <p>
              Spectra adds one more mechanism that is unique on this list: the
              Principal Token, or PT. A PT for staked XRP trades at a discount
              today and redeems one-for-one for the underlying at a set maturity
              date.
            </p>
            <p>
              The gap between that discounted price and the full redemption value
              is a fixed rate locked in up front, so unlike everything else here
              the number does not drift day to day.
            </p>
            <p>
              It is single-sided with no impermanent loss; the trade-off is that
              the position runs to maturity, and an early exit takes whatever the
              market will pay. Spectra publishes each PT&rsquo;s current max fixed
              rate, which is the figure this report tracks.
            </p>

            <h3 id="source-yield-tokens">Yield Tokens</h3>
            <p>
              Yield Tokens, or YTs, are the other half of a Spectra market and
              are worth naming even though a YT is not a yield source in itself.
              A YT is a derivative of XRP-denominated yield: it strips out and
              trades the variable yield a wrapped-XRP position earns up to
              maturity, which lets a holder amplify exposure to that onchain
              yield and to any associated points program without posting the full
              principal.
            </p>
            <p>
              Spectra is currently the leader for XRP yield trading, and most YT
              activity these days sits on the stXRP pools, where traders buy YT
              to bet on a potential Firelight airdrop by accumulating its
              Firelight points.
            </p>

            <p className="rp-fineprint">
              Every venue on this page is an external protocol tracked for
              research. None are {SITE_NAME} products. This page is informational
              only, and past rates are no promise of what a venue pays next.
            </p>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="wrapped-xrp">
          <p className="rp-eyebrow">Tokens</p>
          <h2 id="wrapped-xrp">The wrapped forms of XRP</h2>
          <div className="rp-article">
            <p>
              Beyond the XRP Ledger&rsquo;s own native AMM, every rate on this
              page starts with XRP moved onto a smart-contract chain in a wrapped
              form.
            </p>
            <p>
              The wrapper matters as much as the venue: some are trustless and
              collateral-backed, others rest on a single custodian. The first
              three below, FXRP, stXRP and cbXRP, back every venue in
              this report; wXRP is included as the main form on Solana, a market
              that sits outside this report&rsquo;s Flare-and-Base scope for now.
            </p>
            <div className="rp-gloss-list">
              {WRAPPED_TOKENS.map((t) => (
                <article className="rp-gloss-card" key={t.token}>
                  <div className="rp-gloss-head">
                    <AssetIcon asset={t.icon} size={26} />
                    <span className="rp-gloss-tok">{nice(t.token)}</span>
                    <span className="rp-gloss-chain">{t.chain}</span>
                  </div>
                  <p className="rp-gloss-desc">{t.desc}</p>
                  {t.address ? (
                    <div className="rp-gloss-addr">
                      <code className="rp-gloss-addr-val" title={t.address}>
                        {t.address}
                      </code>
                      <CopyAddressButton address={t.address} compact />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="can-you-stake-xrp">
          <p className="rp-eyebrow">Explainer</p>
          <h2 id="can-you-stake-xrp">Can you stake XRP?</h2>
          <div className="rp-article">
            <p>
              Short answer: no. XRP is not a proof-of-stake asset, and the XRP
              Ledger has no validator staking and no native staking rewards.
            </p>
            <p>
              So an advertised &ldquo;XRP staking&rdquo; rate is really describing
              something else. Every rate on this page comes from putting XRP to
              work in a market.
            </p>
            <p>
              The label usually covers one of three mechanisms: lending XRP and
              earning the interest borrowers pay; supplying it to a liquidity pool
              and earning swap fees; or holding a liquid staking token such as
              stXRP, where a protocol stakes the wrapped XRP behind the scenes.
            </p>
            <p>
              The XRP Ledger&rsquo;s native AMM also pays trading fees on-ledger.
              None are native staking, and each carries its own risk, which is why
              every venue here is labelled by what it actually does.
            </p>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="cefi-vs-defi">
          <p className="rp-eyebrow">Compare</p>
          <h2 id="cefi-vs-defi">CeFi vs DeFi XRP yield</h2>
          <div className="rp-article">
            <p>
              XRP can also earn through centralized &ldquo;Earn&rdquo; programs
              on exchanges and lenders. They are worth understanding, because they
              compete for the same searches and make a different trade-off.
            </p>
            <p>
              Centralized programs are simple: XRP is held on the platform, which
              pays a rate, sometimes higher than DeFi thanks to promotional or
              token incentives. The trade-off is custody.
            </p>
            <p>
              The XRP sits with the provider, which introduces solvency and
              counterparty risk, and the rate can change or be pulled at will.
            </p>
            <p>
              This report focuses on DeFi instead, because the positions are
              onchain and verifiable: the contract, the collateral and the real
              rate are all visible, and self-custody is usually retained.
            </p>
            <p>
              There the trade-off is smart-contract and bridge risk rather than
              counterparty risk. Neither is strictly safer; they fail in different
              ways.
            </p>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="key-risks">
          <p className="rp-eyebrow">Risk</p>
          <h2 id="key-risks">Key risks</h2>
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
                reward-token emissions, mostly rFLR on Flare, for the bulk of
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
            <InfoBox>
              This page is informational only. It does not constitute financial
              advice. Past rates are no promise of future ones, and no DeFi yield
              is risk-free.
            </InfoBox>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="venues-in-depth">
          <p className="rp-eyebrow">Reference</p>
          <h2 id="venues-in-depth">XRP yield venues, explained</h2>
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

        <section className="uni-home-content" aria-labelledby="faq">
          <p className="rp-eyebrow">FAQ</p>
          <h2 id="faq">XRP yield, answered</h2>
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

        <section className="uni-home-content" aria-labelledby="machine-readable-data">
          <p className="rp-eyebrow">Data</p>
          <h2 id="machine-readable-data">Machine-readable data</h2>
          <div className="rp-article">
            <p className="rp-lead">
              Every product on this page is published as clean, downloadable
              data for research and AI agents, licensed CC-BY-4.0. Each JSON
              carries the current rate and TVL plus its full daily rate and TVL
              history; each CSV is that daily series. The landscape&rsquo;s total
              TVL over time is published too.
            </p>
            <div className="rp-data-primary">
              <a className="rp-data-btn" href="/data/xrp-yield/index.json">
                Full dataset · JSON
              </a>
              <a className="rp-data-btn" href="/data/xrp-yield/history.csv">
                All products, daily rate &amp; TVL · CSV
              </a>
              <a className="rp-data-btn" href="/data/xrp-yield/landscape-tvl.csv">
                Landscape TVL over time · CSV
              </a>
            </div>
            <div className="rp-data-list">
              {pools.map((p) => (
                <div className="rp-data-row" key={p.id}>
                  <span className="rp-data-name">
                    <span className="rp-data-asset">{assetHead(p)}</span>
                    <span className="rp-data-plat">
                      {p.detail ? `${p.detail} · ` : ""}
                      {p.platform}
                    </span>
                  </span>
                  <span className="rp-data-links">
                    <a href={`/data/xrp-yield/${p.venueSlug}.json`}>JSON</a>
                    {(p.history?.length ?? 0) >= 2 ? (
                      <a href={`/data/xrp-yield/${p.venueSlug}.csv`}>CSV</a>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
            <p className="rp-source-note">
              The full catalogue lives in{" "}
              <a href="/data/xrp-yield/index.json">index.json</a>, and{" "}
              <a href="/data/xrp-yield/history.csv">history.csv</a> holds every
              product&rsquo;s daily rate in one file. The same files are declared
              in this page&rsquo;s Dataset metadata and in{" "}
              <a href="/llms.txt">llms.txt</a>.
            </p>
          </div>
        </section>

        <section className="uni-home-content" aria-labelledby="onchain-references">
          <p className="rp-eyebrow">Reference</p>
          <h2 id="onchain-references">Onchain references</h2>
          <p className="rp-lead">
            Contract addresses for every asset and product in this report: the
            wrapped-XRP tokens, the vault / lending / LP receipt tokens the
            holder counts are read from, and each Spectra stXRP market split into
            its LP pool, Principal and Yield tokens, matured markets included.
            All are third-party contracts; verify each before you use it.
          </p>
          <div className="rp-dtable-wrap">
            <table className="rp-dtable rp-ref-table">
              <thead>
                <tr>
                  <th>Asset / Product</th>
                  <th>Type</th>
                  <th>Network</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {onchainRefs.map((r, i) => (
                  <tr
                    key={`${r.name}-${r.type}-${r.address}`}
                    className={
                      i > 0 && onchainRefs[i - 1].group !== r.group
                        ? "rp-ref-group"
                        : undefined
                    }
                  >
                    <td className="strong">
                      {r.name}
                      {r.expired ? (
                        <span className="rp-dtag rp-ref-tag">Matured</span>
                      ) : null}
                    </td>
                    <td className="rp-ref-type">{r.type}</td>
                    <td>{chainLabel(r.chain)}</td>
                    <td>
                      <span className="rp-ref-addr">
                        <code>{r.address}</code>
                        <CopyAddressButton address={r.address} compact />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rp-source-note">
            Wrapped-token rows are the canonical ERC-20 (or SPL) contracts; vault
            and market rows are the receipt / share tokens the holder ranking is
            read from; Spectra rows are each stXRP market&rsquo;s LP pool,
            Principal and Yield token contracts on Flare, matured markets
            included. Underlying rates and TVL are measured on-chain (Base and
            Flare), with the Spectra API for Spectra&rsquo;s own markets.
          </p>
        </section>

        <section className="uni-home-content" aria-labelledby="method-and-scope">
          <p className="rp-eyebrow">Method</p>
          <h2 id="method-and-scope">Method &amp; scope</h2>
          <dl className="rp-method">
            <dt>Inclusion</dt>
            <dd>
              A defined set of {stats.venues}{" "}XRP-denominated products, whether
              XRP itself or a wrapped variant such as FXRP, stXRP or cbXRP, across
              lending, vaults, liquid staking, fixed-rate Principal Tokens and
              liquidity pools. RLUSD, Ripple&rsquo;s dollar stablecoin, is out of
              scope because it is not XRP-denominated.
              <span className="rp-method-break">
                Every rate and TVL is <strong>measured on-chain</strong>: read
                directly from each venue&rsquo;s own contracts on Base and Flare
                (lending supply rates, vault share prices, pool reserves and
                gauge emissions), priced with on-chain oracles (Flare&rsquo;s
                FTSOv2 for XRP, Chainlink on Base). Spectra&rsquo;s own markets
                come from the Spectra API, and Portals covers the few products
                the others do not. No third-party yield aggregator is used.
              </span>
            </dd>
            <dt>Ranking</dt>
            <dd>
              By 30-day average rate where a history is available, so short-lived
              emission spikes don&rsquo;t decide the order; the 90-day range is
              shown alongside.
            </dd>
            <dt>Freshness</dt>
            <dd>Refreshed hourly by reading Base and Flare on-chain state directly (with the Spectra API for Spectra markets); this page reflects the {updated} snapshot.</dd>
            <dt>What this is not</dt>
            <dd>
              The figures are informational only and are not an endorsement or
              financial advice. Our own coverage is{" "}
              <Link href="/usdc">USDC</Link>, <Link href="/eth">ETH</Link> and{" "}
              <Link href="/btc">BTC</Link> strategies, indexed with the same
              methodology used on every product page (see{" "}
              <Link href="/methodology">Methodology</Link>).
            </dd>
          </dl>
        </section>
        </div>
        <aside className="rp-doc-aside" aria-label="In this report">
          <ReportToc items={tocItems} />
        </aside>
       </div>
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
    q: "Does XRP have staking rewards?",
    a: "No. XRP has no native staking or validator rewards, so there is no protocol staking rate. What is marketed as XRP staking rewards is really lending interest, liquidity-pool fees, or the yield on a liquid staking token such as stXRP that stakes wrapped XRP behind the scenes. Each is a market rate with its own risk, not an inflation reward.",
  },
  {
    q: "How do you earn interest on XRP?",
    a: "You move XRP onto a smart-contract chain as a wrapped token such as FXRP or cbXRP, then put it to work: supply it to a lending market to earn borrower interest, deposit it in a curated vault, hold a fixed-rate Principal Token, or add it to a liquidity pool for swap fees. The rate depends on the venue and the wrapper; this report ranks the main options by their real 30-day rate.",
  },
  {
    // The rendered answer is replaced at request time with live, data-backed
    // figures (see `faqs` in the component); this static copy is the fallback.
    q: "What is the best XRP yield right now?",
    a: "It depends on the level of risk. Single-sided options such as lending and vaults are the closest to a plain rate; liquidity pools show higher headline numbers but add impermanent loss and usually rely on incentives. The ranking above sorts every venue by its real 30-day average, so like compares with like.",
  },
  {
    q: "What are FXRP, stXRP and cbXRP?",
    a: "They are wrapped forms of XRP. FXRP is XRP bridged trustlessly onto Flare through the FAssets system; cbXRP is Coinbase-custodied wrapped XRP on Base; stXRP is Firelight's liquid staking token for FXRP. The choice of wrapper changes the trust model and the risk.",
  },
  {
    q: "FXRP vs cbXRP: what is the difference?",
    a: "Both are wrapped XRP, but the trust model differs. FXRP is minted trustlessly on Flare through the FAssets system, over-collateralized by independent agents while the real XRP stays on the XRP Ledger. cbXRP is Coinbase-custodied wrapped XRP on Base, backed 1:1 by XRP that Coinbase holds, with published proof of reserves. FXRP leans on onchain collateral; cbXRP leans on a single custodian.",
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

// Neutral info box: tinted (i) icon chip + body.
function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="rp-info">
      <span className="rp-callout-ico" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="5.7" r="1.5" fill="currentColor" />
          <rect x="8.7" y="8.6" width="2.6" height="6.7" rx="1.3" fill="currentColor" />
        </svg>
      </span>
      <p className="rp-info-body">{children}</p>
    </div>
  );
}

// Green tip box: tinted lightbulb chip + body.
function TipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rp-tip">
      <span className="rp-callout-ico" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2.8a4.6 4.6 0 0 0-2.7 8.3c.5.37.85.9.95 1.5l.1.6h3.3l.1-.6c.1-.6.45-1.13.95-1.5A4.6 4.6 0 0 0 10 2.8Z"
            fill="currentColor"
          />
          <path
            d="M8.5 15.3h3M9.1 17h1.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <p className="rp-tip-body">{children}</p>
    </div>
  );
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
                    : p.offchainRewardNote
                      ? p.offchainRewardNote
                      : p.variance === "high"
                        ? "Reward-driven rate on a small pool; varies week to week"
                        : p.rateBasis === "current"
                          ? "Current on-chain rate"
                          : undefined
                }
              >
                {p.rateNa ? "n/a" : pct(histRate(p))}
                {p.variance === "high" ? (
                  <span className="rp-apy-flag" aria-hidden="true">
                    ~
                  </span>
                ) : null}
                {p.offchainRewardNote ? (
                  <span className="rp-apy-flag" aria-hidden="true">
                    †
                  </span>
                ) : null}
              </span>
              <span className="hub-cell rp-cell-text">
                <span className="rp-type">{typeLabel(p)}</span>
              </span>
              <span className="hub-cell rp-cell-text">{p.platform}</span>
              <span className="hub-cell rp-cell-text">{chainLabel(p.chain)}</span>
              <span className="hub-cell hub-num">
                {p.tvlUsd > 0 ? usd(p.tvlUsd) : "n/a"}
              </span>
              <span className="hub-cell rp-cell-action">
                <DiscoverButton
                  href={p.platformUrl ?? p.llamaUrl}
                  platform={p.platform}
                  label="Open"
                  source={`ranking:${p.venueSlug ?? p.project}`}
                  product={assetHead(p)}
                  chain={p.chain}
                  rank={i + 1}
                  icon={<TokenIcons symbol={p.symbol} />}
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
            label="Open"
            source={`venue:${v.slug}`}
            product={nice(v.product)}
            chain={v.chain}
            icon={<TokenIcons symbol={v.assets.join("-")} />}
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
