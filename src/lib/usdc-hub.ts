import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./data";
import { formatAPY, formatTVL, stripChainSuffix } from "./format";
import { freshness } from "./freshness";
import { LOW_LIQUIDITY_TVL_THRESHOLD } from "./admin-rules";

// Single source for every figure on /usdc.
//
// The rebuild's whole premise is that the page states its answer in prose
// before the table, so the same rate now appears in the hero sentence, a key
// finding, table 1, a venue bullet, an FAQ answer and the ItemList. Six
// renderings of one number is six chances to disagree, and a page whose own
// hero contradicts its own table is worth less than one that never made the
// claim. Everything below is computed once here and read from everywhere
// else; no consumer recomputes.

export interface UsdcNetwork {
  chain: string;
  count: number;
  bestApy: number;
  tvl: number;
}

export interface UsdcVenue {
  /** "Aave", "Morpho", "Compound V3" - the venue half of vault.category. */
  venue: string;
  count: number;
  minApy: number;
  maxApy: number;
  medianApy: number;
  tvl: number;
  chains: string[];
}

export interface UsdcCohort {
  /** Vaults sorted by 24h APY desc, productName already disambiguated. */
  all: YieldVault[];
  top10: YieldVault[];
  count: number;
  chains: string[];
  chainCount: number;
  /** Newest observation across the cohort's history, as an ISO string. */
  asOfIso: string;
  /** "July 31, 2026" - house format, UTC. */
  asOf: string;
  /**
   * Highest-paying strategy that clears the low-liquidity floor. Every
   * "the highest USDC yield was X" claim on the page reads from here, never
   * from the raw top of the table. See fundedFloor.
   */
  best: YieldVault | null;
  /** Raw top of the ranking, floor ignored. Used only alongside its own TVL. */
  bestRaw: YieldVault | null;
  funded: YieldVault[];
  fundedCount: number;
  fundedFloor: number;
  fundedMinApy: number;
  fundedMaxApy: number;
  minApy: number;
  maxApy: number;
  medianApy: number;
  meanApy: number;
  /** Mean weighted by TVL. Named for the column, since "capital" is banned. */
  tvlWeightedApy: number;
  totalTvl: number;
  byNetwork: UsdcNetwork[];
  byVenue: UsdcVenue[];
  /** Which strategies carry a reward token beside their rate. See rewardsOf. */
  rewards: UsdcRewards;
  /** 30-day rate stability, per strategy and cohort-level. */
  stability: UsdcStability;
  /**
   * The wider USDC market, measured by our own stablecoin report. Null when
   * that dataset is absent, and every consumer must then render nothing.
   */
  benchmark: UsdcBenchmark | null;
}

export interface UsdcRewards {
  /** Strategies with no live reward token beside their rate. */
  usdcOnly: YieldVault[];
  /** Strategies whose rate blends lending interest with a reward emission. */
  withReward: YieldVault[];
  usdcOnlyMedian: number;
  withRewardMedian: number;
  /** Distinct reward-token symbols, most common first. */
  tokens: { symbol: string; count: number }[];
}

export interface UsdcStabilityRow {
  slug: string;
  name: string;
  /** Standard deviation of the last 30 daily APY readings, in points. */
  stdev: number;
  mean: number;
  min: number;
  max: number;
}

export interface UsdcStability {
  rows: UsdcStabilityRow[];
  steadiest: UsdcStabilityRow | null;
  mostVolatile: UsdcStabilityRow | null;
  /** Strategies whose 30-day deviation is under one percentage point. */
  steadyCount: number;
  measuredCount: number;
}

export interface UsdcBenchmark {
  /** Largest external USDC product by tracked value. */
  largestName: string;
  largestApy: number;
  largestTvl: number;
  /** Median rate across external products carrying a measured rate. */
  externalMedian: number;
  externalCount: number;
}

// True median. The shared asset-hub body takes sortedApys[floor(len / 2)],
// which on an even-length cohort returns the upper-middle element rather than
// the midpoint of the two middle ones. With 54 rows that is the 28th value
// presented as "the median". Corrected here rather than there so /eth, /btc
// and /usdt stay byte-identical: they are the control group this rebuild is
// measured against.
function median(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const mid = sortedAsc.length / 2;
  return sortedAsc.length % 2
    ? sortedAsc[Math.floor(mid)]
    : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

// Spec section 4: 51 of the 54 rows resolve to only 36 distinct names, with
// "USDC Aave" appearing four times and "USDC Autopilot" three, separated in
// the rendered table by a network icon alone. A parser reading four identical
// names against four different rates cannot tell them apart, and neither can
// a reader on a screen narrow enough to have dropped the network column.
//
// Applied unconditionally rather than only on collision, so every name in
// both tables and in the ItemList carries its network. getDisambiguatedDisplayName
// in lp-pair.ts does the collision-only variant for product-page FAQ copy;
// this page wants the invariant.
export function usdcDisplayName(vault: YieldVault): string {
  return `${vault.productName} (${vault.chain})`;
}

export function venueOf(vault: YieldVault): string {
  return stripChainSuffix(vault.category, vault.chain) || "Other";
}

// The same product, written for a sentence instead of a table cell.
//
// "USDC 40 Acres (Base)" is a good tabular label and a bad clause: a reader
// meeting it mid-sentence has to infer that the parenthetical is a network,
// and a parser has no reason to. Tables and the ItemList keep the compact
// form, where the column header supplies the context. Prose spells it out.
export function proseName(vault: YieldVault, withNetworkWord = false): string {
  const bare = vault.productName
    .replace(new RegExp(`\\s*\\(${vault.chain}\\)\\s*$`), "")
    .trim();
  return withNetworkWord
    ? `${bare}, which runs on the ${vault.chain} network`
    : `${bare} on ${vault.chain}`;
}

// Which row is allowed to be called "the highest USDC yield".
//
// The raw top of this ranking is routinely a vault holding a few hundred
// dollars: on 2 August 2026 it was USDC Aave on zkSync paying 42.55% against
// $352, with 31 of 55 rows under $100. Putting that figure in the page's
// first sentence hands an answer engine a number no reader can act on, and it
// is the first thing a visitor comparing against the table would call wrong.
//
// LOW_LIQUIDITY_TVL_THRESHOLD is the operator's existing floor for exactly
// this judgement, documented in admin-rules.ts as the point below which a
// thin pool "can't read as an unqualified best pick". Reused rather than
// duplicated so the page and the admin panel cannot disagree.
//
// It scopes the superlative only. Nothing is hidden: every row still renders
// in both tables with its own TVL beside it, and the page states the floor in
// the sentence that applies it rather than filtering silently.
const FUNDED_FLOOR = LOW_LIQUIDITY_TVL_THRESHOLD;

// Networks this ranking does not cover.
//
// zkSync is legacy dust. Across the whole index it holds $1,027 spread over 11
// vaults, and its entire USDC presence is one Aave market holding $352. That
// single row sorted first at 42.55% and became the top of the ranking, the
// network breakdown's "top APY" for zkSync, and the outer bound of the venue
// range for Aave: one dead $352 position shaping three separate claims on the
// page.
//
// Excluded here rather than in data/hidden.json because that file is
// sitewide and would move /eth, /btc and /usdt, which are the control group
// for measuring this rebuild. Revisit as a sitewide hide once the measurement
// window closes.
const EXCLUDED_CHAINS = new Set(["zkSync"]);

// A rate below a hundredth of a percent formats as "0.00%", which asserts a
// measured zero for what is really no measurable rate. Same dust cutoff the
// prose generators elsewhere use.
export function apyFloorLabel(v: number): string {
  return v > 0 && v < 0.005 ? "under 0.01%" : formatAPY(v);
}

// The reward tokens a strategy harvests alongside its lending interest.
//
// This used to read apyBreakdown[0].source and call it the payout token. That
// was wrong, and the way it was wrong matters enough to record.
//
// apyBreakdown and rewardTokens are built from two different upstream arrays
// in harvest-api.ts: the breakdown maps over estimatedApyBreakdown (the
// values), rewardTokens maps over apyTokenSymbols (the symbols). The source
// string is therefore apyTokenSymbols[0], which is the first ICON shown beside
// the APY in the app, not a settlement currency. Three things follow:
//
//   1. When upstream sends more symbols than values, the extra symbols survive
//      only in rewardTokens. Six Morpho vaults on Arbitrum report source "ARB"
//      while their rewardTokens list ARB and MORPHO, so one number labelled ARB
//      covers at least two emissions plus the underlying interest.
//   2. Five identical Aave v3 USDC supply positions carry two different labels:
//      the Ethereum pair reports "USDC", the Base, Polygon and Arbitrum three
//      report "AAVE", and all five sit in the same 2.3% to 3.4% band. Our own
//      feed disagrees with itself about the same strategy.
//   3. The "Base Rate" fallback fires on zero rows. Every source in the file is
//      a ticker, so "USDC" is the same kind of label as "MORPHO".
//
// So the page cannot claim a rate is paid in a token, and it equally cannot
// claim a split between base interest and emissions, because apyBreakdown
// carries one entry per vault whose apy equals apy24h. What it can report is
// the token list: which tokens a strategy harvests. Reading the whole
// rewardTokens array rather than one label also picks up the second tokens
// point 1 was dropping.
//
// Curated override of an upstream label, named here rather than buried: Aave
// no longer issues AAVE emissions on its USDC markets. The three rows still
// carrying the label hold about $570 between them, and two identical positions
// on Ethereum are labelled USDC, so the label is stale metadata rather than a
// live reward. Remove an entry here if a program restarts.
const RETIRED_REWARD_TOKENS = new Set(["AAVE"]);

/** Distinct live reward-token symbols beside a strategy's rate, excluding its own asset. */
export function rewardsOf(vault: YieldVault): string[] {
  const own = vault.asset.toUpperCase();
  const seen = new Set<string>();
  for (const t of vault.rewardTokens ?? []) {
    const s = (t?.symbol ?? "").trim();
    if (!s) continue;
    const up = s.toUpperCase();
    if (up === own || RETIRED_REWARD_TOKENS.has(up)) continue;
    if (!seen.has(up)) seen.add(up);
  }
  // Preserve the feed's own casing (crvUSD, axlOP, dQUICK) rather than the
  // uppercased dedup key, which would print CRVUSD in prose.
  const out: string[] = [];
  const used = new Set<string>();
  for (const t of vault.rewardTokens ?? []) {
    const s = (t?.symbol ?? "").trim();
    const up = s.toUpperCase();
    if (seen.has(up) && !used.has(up)) {
      used.add(up);
      out.push(s);
    }
  }
  return out;
}

export const hasRewardToken = (v: YieldVault): boolean => rewardsOf(v).length > 0;

/** Population standard deviation, in the same units as the input. */
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

// Minimum daily readings before a deviation is worth publishing. Matches the
// floor isBrokenLowTvlVault already uses for "enough history to judge".
const STABILITY_MIN_POINTS = 14;
/** Below this 30-day deviation a rate is described as steady. */
const STEADY_STDEV = 1;

const utcLongDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export function buildUsdcCohort(
  usdcVaults: YieldVault[],
  history: Record<string, FullVaultHistory> | null,
): UsdcCohort {
  const all = usdcVaults
    .filter((v) => !EXCLUDED_CHAINS.has(v.chain))
    .map((v) => ({ ...v, productName: usdcDisplayName(v) }))
    .sort((a, b) => b.apy24h - a.apy24h);

  const apysAsc = all.map((v) => v.apy24h).sort((a, b) => a - b);
  const totalTvl = all.reduce((s, v) => s + v.tvl, 0);

  // dateModified must be the newest reading we actually hold, never the build
  // clock: the site rebuilds hourly whether or not the upstream feed moved, and
  // stamping a build time onto unchanged data is a freshness claim we cannot
  // support. freshness() already defines freshestTs as "the honest as-of
  // reference" for exactly this reason.
  let newestTs = 0;
  if (history) {
    for (const v of usdcVaults) {
      const h = history[v.contractAddress] ?? history[v.contractAddress.toLowerCase()];
      if (!h) continue;
      const ts = freshness(h).freshestTs;
      if (ts > newestTs) newestTs = ts;
    }
  }
  const asOfIso = new Date((newestTs || Math.floor(Date.now() / 1000)) * 1000).toISOString();

  const byNetwork = Object.values(
    all.reduce<Record<string, UsdcNetwork>>((acc, v) => {
      const cur = acc[v.chain] ?? { chain: v.chain, count: 0, bestApy: 0, tvl: 0 };
      cur.count += 1;
      cur.tvl += v.tvl;
      if (v.apy24h > cur.bestApy) cur.bestApy = v.apy24h;
      acc[v.chain] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count || b.bestApy - a.bestApy);

  const venueGroups = all.reduce<Record<string, YieldVault[]>>((acc, v) => {
    const k = venueOf(v);
    (acc[k] ??= []).push(v);
    return acc;
  }, {});

  const byVenue: UsdcVenue[] = Object.entries(venueGroups)
    .map(([venue, rows]) => {
      const asc = rows.map((r) => r.apy24h).sort((a, b) => a - b);
      return {
        venue,
        count: rows.length,
        minApy: asc[0],
        maxApy: asc[asc.length - 1],
        medianApy: median(asc),
        tvl: rows.reduce((s, r) => s + r.tvl, 0),
        chains: [...new Set(rows.map((r) => r.chain))],
      };
    })
    .sort((a, b) => b.count - a.count || b.medianApy - a.medianApy);

  const funded = all.filter((v) => v.tvl >= FUNDED_FLOOR);
  const fundedApysAsc = funded.map((v) => v.apy24h).sort((a, b) => a - b);

  const usdcOnly = all.filter((v) => !hasRewardToken(v));
  const withReward = all.filter(hasRewardToken);
  // Counted over every token on a row, not just the first, so a Morpho vault
  // emitting both ARB and MORPHO is counted under each.
  const tokenCounts = withReward.reduce<Record<string, number>>((acc, v) => {
    for (const t of rewardsOf(v)) acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const rewards: UsdcRewards = {
    usdcOnly,
    withReward,
    usdcOnlyMedian: median(usdcOnly.map((v) => v.apy24h).sort((a, b) => a - b)),
    withRewardMedian: median(withReward.map((v) => v.apy24h).sort((a, b) => a - b)),
    tokens: Object.entries(tokenCounts)
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol)),
  };

  // Rate stability. The reviewers wanted per-strategy risk quantified rather
  // than four prose headings; this is the part that is measured rather than
  // scored, so it is the part that ships. A composite safety score would mean
  // choosing weights ourselves and publishing them as a rating.
  const stabilityRows: UsdcStabilityRow[] = [];
  if (history) {
    for (const v of all) {
      const h = history[v.contractAddress] ?? history[v.contractAddress.toLowerCase()];
      const pts = (h?.apyHistory ?? [])
        .filter((p) => p.apy >= 0)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-30)
        .map((p) => p.apy);
      if (pts.length < STABILITY_MIN_POINTS) continue;
      stabilityRows.push({
        slug: v.slug,
        name: proseName(v),
        stdev: stdev(pts),
        mean: pts.reduce((a, b) => a + b, 0) / pts.length,
        min: Math.min(...pts),
        max: Math.max(...pts),
      });
    }
  }
  // Named steadiest and most volatile are picked from the funded cohort only.
  // Over the whole set the steadiest row is whatever pays closest to nothing:
  // a 0.07% rate that barely moves is arithmetically the least volatile and
  // useless as a recommendation. Same floor the headline uses, so the two
  // superlatives on the page are drawn from the same population.
  const fundedSlugs = new Set(funded.map((v) => v.slug));
  const fundedStdev = stabilityRows
    .filter((r) => fundedSlugs.has(r.slug))
    .sort((a, b) => a.stdev - b.stdev);
  const stability: UsdcStability = {
    rows: stabilityRows,
    // A zero deviation is a flat feed rather than a steady rate, so the
    // "steadiest" claim skips it instead of crowning a stalled series.
    steadiest: fundedStdev.find((r) => r.stdev > 0) ?? null,
    mostVolatile: fundedStdev[fundedStdev.length - 1] ?? null,
    steadyCount: stabilityRows.filter((r) => r.stdev < STEADY_STDEV).length,
    measuredCount: stabilityRows.length,
  };

  return {
    all,
    top10: all.slice(0, 10),
    count: all.length,
    chains: byNetwork.map((n) => n.chain),
    chainCount: byNetwork.length,
    asOfIso,
    asOf: utcLongDate(asOfIso),
    best: funded[0] ?? all[0] ?? null,
    bestRaw: all[0] ?? null,
    funded,
    fundedCount: funded.length,
    fundedFloor: FUNDED_FLOOR,
    fundedMinApy: fundedApysAsc[0] ?? 0,
    fundedMaxApy: fundedApysAsc[fundedApysAsc.length - 1] ?? 0,
    minApy: apysAsc[0] ?? 0,
    maxApy: apysAsc[apysAsc.length - 1] ?? 0,
    medianApy: median(apysAsc),
    meanApy: all.length ? apysAsc.reduce((s, v) => s + v, 0) / all.length : 0,
    tvlWeightedApy: totalTvl > 0 ? all.reduce((s, v) => s + v.apy24h * v.tvl, 0) / totalTvl : 0,
    totalTvl,
    byNetwork,
    byVenue,
    rewards,
    stability,
    benchmark: buildBenchmark(),
  };
}

// The wider USDC market benchmark, disabled on this deployment.
//
// On the v4 build this reads data/stablecoin-yield.json, the stablecoin rate
// comparison we publish there, and produces "Aave v3 held $2.12B at 3.27%"
// alongside this index's own scale. That report and its data file do not
// exist here, so there is nothing to measure against and the function returns
// null unconditionally.
//
// Null is a supported state throughout, not a special case: the scope block's
// comparison paragraph and the "How does this compare to Aave and the wider
// USDC market?" FAQ entry both render nothing when it is null, which is
// verified on v4 by moving the data file aside and rebuilding. So the page
// simply ships without the benchmark until the report lands here.
//
// To restore: port src/lib/stablecoin-yield.ts and data/stablecoin-yield.json,
// then replace the body below with the v4 implementation.
function buildBenchmark(): UsdcBenchmark | null {
  return null;
}

// ---- prose helpers --------------------------------------------------------
// Every sentence below leads with its scope clause and closes with a date,
// per spec section 3.3: answer engines lift partial sentences, so a figure
// whose grammatical subject is "USDC yield" rather than "the strategies
// Harvest tracks" gets quoted as a market-wide claim we never made.

export const apy = (v: number): string => formatAPY(v);
export const tvl = (v: number): string => formatTVL(v);

/** Oxford-free list join: "Base, Ethereum and Arbitrum". */
export function listOf(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const plural = (n: number, one: string, many: string): string =>
  n === 1 ? one : many;

/**
 * The first sentence a reader and an answer engine both hit.
 *
 * It leads with the answer instead of the scope. The previous shape spent
 * twenty words on qualification before reaching the figure, which buries the
 * one thing the query asked for, and the page's job is to answer a query about
 * the best USDC rate.
 *
 * Scope still precedes the figure, which is the rule that matters: the
 * grammatical subject is "the best USDC yield in Harvest's index", not "USDC
 * yield", so a partial lift carries the scope with it and cannot be read as a
 * claim about the whole market. The floor, the median and the cohort size move
 * into the second sentence, where they qualify without delaying.
 *
 * "yield" rather than "APY" as the head noun, with APY kept as the unit. The
 * keyword pull behind this rebuild puts `usdc yield` at 350 US searches a
 * month and `usdc interest rate` at another 350 at KD 16, while `usdc apy`
 * does not register as a head term. Sentence two carries "interest rate" in
 * the FAQ and the venue H2; this one matches the H1.
 */
export function answerSentence(c: UsdcCohort): string {
  if (!c.best) return "";
  return (
    `The best USDC yield in Harvest's index is ${apy(c.best.apy24h)} APY, paid by ` +
    `${proseName(c.best, true)}, as of ${c.asOf}. That is the highest rate among strategies ` +
    `holding at least ${tvl(c.fundedFloor)}, against a median of ` +
    `${apy(c.medianApy)} across all ${c.count} USDC strategies tracked on ${c.chainCount} ` +
    `${plural(c.chainCount, "network", "networks")}.`
  );
}

export function keyFindings(c: UsdcCohort): string[] {
  if (!c.best || !c.bestRaw) return [];
  const [first, second] = c.byNetwork;
  // "USDC 40 Acres (Base), a 40 Acres strategy" is the shape to avoid: many
  // product names already carry their venue, so the clause only earns its place
  // when it adds one.
  // The headline rate is deliberately absent here. It is the opening sentence's
  // job now, and repeating it as the first bullet gave an engine two competing
  // renderings of one claim inside the same retrieval chunk. The summary
  // carries the four facts the opener does not.
  const out = [
    `The ${c.count} USDC strategies tracked here held ${tvl(c.totalTvl)} between them, ` +
      `across ${c.byVenue.length} venue families.`,
    `The median USDC rate across all ${c.count} tracked strategies was ` +
      `${apy(c.medianApy)}, and the average weighted by TVL was ` +
      `${apy(c.tvlWeightedApy)}.`,
  ];
  // The spread claim is made over the funded cohort. When the raw top of the
  // ranking is a different, thinner vault it gets named with its size in the
  // same breath, because the two figures otherwise look like a contradiction
  // to anyone reading the table underneath. When the two coincide the clause
  // is dropped rather than restating the first bullet.
  const rawDiffers = c.bestRaw.slug !== c.best.slug;
  out.push(
    `Rates on the ${c.fundedCount} strategies holding at least ${tvl(c.fundedFloor)} ran from ` +
      `${apy(c.fundedMinApy)} to ${apy(c.fundedMaxApy)}` +
      (rawDiffers
        ? `, while the highest rate anywhere in the index was ${apy(c.bestRaw.apy24h)} on ` +
          `${proseName(c.bestRaw)}, which held ${tvl(c.bestRaw.tvl)}.`
        : `, across ${listOf([...new Set(c.funded.map((v) => v.chain))])}.`),
  );
  if (first) {
    out.push(
      `${first.chain} carried more USDC strategies than any other network Harvest tracks, ` +
        `${first.count} of ${c.count}, holding ${tvl(first.tvl)}` +
        (second
          ? `, against ${second.count} on ${second.chain} holding ${tvl(second.tvl)}`
          : "") +
        `.`,
    );
  }
  return out;
}

/**
 * One dated sentence per venue family, for the block that answers the
 * venue-qualified half of the keyword set (spec section 6.1: 1,870 of 4,390
 * US searches name a protocol). Only families actually present in the cohort
 * produce a line, so a build where a venue drops out silently loses its
 * bullet instead of printing a stale rate.
 */
export function venueLines(c: UsdcCohort, families: string[]): string[] {
  return families
    .map((name) => c.byVenue.find((v) => v.venue === name))
    .filter((v): v is UsdcVenue => Boolean(v))
    .map((v) => {
      // Median first, range second. The median is the figure worth quoting,
      // and leading with a range hands an answer engine the top of it.
      const where = `on ${listOf(v.chains)}`;
      if (v.count === 1) {
        return `${v.venue} USDC paid ${apy(v.medianApy)} ${where}.`;
      }
      const head =
        `${v.venue} USDC paid a median of ${apy(v.medianApy)} across ${v.count} markets ` +
        `${where}`;
      if (v.minApy.toFixed(2) === v.maxApy.toFixed(2)) return `${head}.`;
      return `${head}, within a range of ${apyFloorLabel(v.minApy)} to ${apy(v.maxApy)}.`;
    });
}

/** "MORPHO on 28, ARB on 6 and AERO on 4" */
export function tokenBlock(c: UsdcCohort, limit = 4): string {
  return listOf(
    c.rewards.tokens
      .slice(0, limit)
      .map((t) => `${t.symbol} on ${t.count}`),
  );
}

export function rewardsLead(c: UsdcCohort): string {
  const r = c.rewards;
  return (
    `Of the ${c.count} USDC strategies tracked here, ${r.usdcOnly.length} earn lending interest ` +
    `alone and ${r.withReward.length} earn lending interest plus a reward token the strategy ` +
    `harvests and sells.`
  );
}

export function stabilityLead(c: UsdcCohort): string {
  const s = c.stability;
  if (!s.mostVolatile || !s.steadiest) return "";
  return (
    `Across the ${s.measuredCount} USDC strategies with a month of readings behind them, ` +
    `${s.steadyCount} moved by less than a percentage point over the 30 days to ${c.asOf}, ` +
    `and the rest moved more.`
  );
}

/** "Base (19 strategies, top APY 11.24%), Ethereum (17, top 10.17%)" */
export function networkBlock(c: UsdcCohort): string {
  return listOf(
    c.byNetwork.map(
      (n) =>
        `${n.chain} (${n.count} ${plural(n.count, "strategy", "strategies")}, ` +
        `top APY ${apy(n.bestApy)})`,
    ),
  );
}

export function protocolBlock(c: UsdcCohort, limit = 5): string {
  return listOf(c.byVenue.slice(0, limit).map((v) => `${v.venue} (${v.count})`));
}
