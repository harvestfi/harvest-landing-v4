// Shared arithmetic for the long-form asset hubs built on the /eth formula
// (/btc and /usdt). /eth keeps its own files; the pieces here are the parts of
// that formula that do not depend on the asset, so the two newer hubs cannot
// disagree with each other about what a "funded" row or a "type" is.
//
// The formula, as /eth runs it:
//   1. Title and H1 carry the two head terms Search Console shows for the
//      page, plus the month of the data. No live rate in the description.
//   2. Key takeaways first: the most-asked questions, one dated sentence each.
//   3. One paragraph on what is measured, then the top 10.
//   4. Sections whose headings read like the queries (network, type, safety,
//      calculator, how to start, the asset's own comparison, stability,
//      protocol, risk), each opening with its answer.
//   5. Questions answered in place, an index of them at the foot, FAQPage,
//      ItemList and Dataset schema, and a Markdown twin built from the same
//      sentences.

import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./data";
import { buildUsdcCohort, venueOf, type UsdcCohort } from "./usdc-hub";
import { strategyTypeOf, calendarAgeLabel, type EthStrategyType } from "./eth-hub";

export type HubCohort = UsdcCohort;
export type StrategyType = EthStrategyType;
export { strategyTypeOf };

export function buildHubCohort(
  vaults: YieldVault[],
  history: Record<string, FullVaultHistory> | null,
): HubCohort {
  return buildUsdcCohort(vaults, history);
}

/** Rows holding less than this are called dust where the median is qualified. */
export const DUST_TVL = 1_000;

export function median(asc: number[]): number {
  if (asc.length === 0) return 0;
  const mid = asc.length / 2;
  return asc.length % 2 ? asc[Math.floor(mid)] : (asc[mid - 1] + asc[mid]) / 2;
}

export const medianOf = (rows: YieldVault[]) =>
  median(rows.map((v) => v.apy24h).sort((a, b) => a - b));

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "all 5" or "3 of the 5": how many of a set, without "5 of the 5". */
export const countOf = (n: number, total: number) =>
  n === total ? `all ${total}` : `${n} of the ${total}`;

export const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");

export const bare = (v: { productName: string }) => v.productName.replace(/\s*\([^)]*\)$/, "");

export const SINGULAR: Record<StrategyType, string> = {
  allocator: "allocator",
  curated: "curated lending vault",
  "money-market": "money market",
  looping: "leveraged loop",
};

export const PLURAL: Record<StrategyType, string> = {
  allocator: "allocators",
  curated: "curated lending vaults",
  "money-market": "money markets",
  looping: "leveraged loops",
};

export const TYPE_LABEL: Record<StrategyType, string> = {
  allocator: "Allocators",
  curated: "Curated lending vaults",
  "money-market": "Money markets",
  looping: "Leveraged looping",
};

/** What each strategy type does with the asset, in one sentence. */
export function typeBlurb(type: StrategyType, unit: string): string {
  // "funds" is the network pages' word for whatever asset a vault holds.
  if (unit === "funds") {
    switch (type) {
      case "allocator":
        return "A contract moves the funds between lending venues as their rates change, so the position follows the best available rate without anyone rebalancing it by hand.";
      case "curated":
        return "A curator such as Gauntlet or Steakhouse spreads the funds across several isolated lending markets on Morpho and sets the risk limits for each one.";
      case "money-market":
        return "The funds are lent straight into one pooled market such as Aave, Fluid or Dolomite, where borrowers pay a rate set by how much of the pool is in use.";
      case "looping":
        return "The strategy supplies an asset, borrows against it and supplies again, multiplying the gap between the supply and borrow rates.";
    }
  }
  switch (type) {
    case "allocator":
      return `A contract moves the ${unit} between lending venues as their rates change, so the position follows the best available rate without anyone rebalancing it by hand.`;
    case "curated":
      return `A curator such as Gauntlet or Steakhouse spreads the ${unit} across several isolated lending markets on Morpho and sets the risk limits for each one.`;
    case "money-market":
      return `The ${unit} is lent straight into one pooled market such as Aave, Fluid or Dolomite, where borrowers pay a rate set by how much of the pool is in use.`;
    case "looping":
      return `The strategy supplies ${unit}, borrows against it and supplies again, multiplying the gap between the supply and borrow rates.`;
  }
}

// ---- strategy types -------------------------------------------------------

export interface TypeRow {
  type: StrategyType;
  label: string;
  count: number;
  fundedCount: number;
  medianApy: number;
  bestFunded: YieldVault | null;
  tvl: number;
}

export function byType(c: HubCohort): TypeRow[] {
  const order: StrategyType[] = ["allocator", "curated", "money-market", "looping"];
  return order
    .map((type) => {
      const rows = c.all.filter((v) => strategyTypeOf(v) === type);
      const funded = rows.filter((v) => v.tvl >= c.fundedFloor);
      return {
        type,
        label: TYPE_LABEL[type],
        count: rows.length,
        fundedCount: funded.length,
        medianApy: medianOf(rows),
        bestFunded: funded[0] ?? null,
        tvl: rows.reduce((s, v) => s + v.tvl, 0),
      };
    })
    .filter((r) => r.count > 0);
}

// ---- networks ----------------------------------------------------------------

export interface NetworkPicks {
  chain: string;
  count: number;
  tvl: number;
  /** Up to three funded strategies on the network, highest rate first. */
  picks: YieldVault[];
  /** Highest rate on the network with no floor, for context only. */
  bestRaw: YieldVault | null;
  medianApy: number;
}

/** Every network in the cohort, most tracked value first. */
export function networks(c: HubCohort, limit = 3): NetworkPicks[] {
  return c.chains
    .map((chain) => {
      const rows = c.all.filter((v) => v.chain === chain);
      return {
        chain,
        count: rows.length,
        tvl: rows.reduce((s, v) => s + v.tvl, 0),
        picks: rows.filter((v) => v.tvl >= c.fundedFloor).slice(0, limit),
        bestRaw: rows[0] ?? null,
        medianApy: medianOf(rows),
      };
    })
    .sort((a, b) => b.tvl - a.tvl);
}

// ---- evidence (the measured half of "is it safe") -----------------------------

export interface EvidenceRow {
  vault: YieldVault;
  type: StrategyType;
  trackedDays: number;
  ageLabel: string;
  stdev: number | null;
}

/**
 * Size, track record, 30-day swing and type per strategy. Drawn from the
 * funded rows when there are at least three of them; below that the table
 * would answer nothing, so it lists every row and lets the size column show
 * how thin they are.
 */
export function evidence(
  c: HubCohort,
  history: Record<string, FullVaultHistory> | null,
): { rows: EvidenceRow[]; fundedOnly: boolean } {
  const stdevBySlug = new Map(c.stability.rows.map((r) => [r.slug, r.stdev]));
  const asOfTs = Date.parse(c.asOfIso) / 1000;
  const fundedOnly = c.fundedCount >= 3;
  const rows = (fundedOnly ? c.funded : c.all)
    .map((v) => {
      const h = history?.[v.contractAddress] ?? history?.[v.contractAddress.toLowerCase()];
      const ts = [...(h?.apyHistory ?? []), ...(h?.tvlHistory ?? [])].map((p) => p.timestamp);
      const firstTs = ts.length ? Math.min(...ts) : asOfTs;
      return {
        vault: v,
        type: strategyTypeOf(v),
        trackedDays: Math.floor((asOfTs - firstTs) / 86400),
        ageLabel: calendarAgeLabel(firstTs, asOfTs),
        stdev: stdevBySlug.get(v.slug) ?? null,
      };
    })
    .sort((a, b) => b.vault.tvl - a.vault.tvl);
  return { rows, fundedOnly };
}

// ---- by protocol ---------------------------------------------------------------

export interface Venue {
  venue: string;
  rows: YieldVault[];
  count: number;
  minApy: number;
  maxApy: number;
  medianApy: number;
  tvl: number;
  chains: string[];
}

export function venues(c: HubCohort): Venue[] {
  // Protocols only: Harvest Autopilot moves funds between them and is not one.
  return c.byVenue
    .filter((v) => v.venue !== "Autopilot")
    .map((v) => {
      const rows = c.all.filter((r) => venueKey(r) === v.venue);
      return { ...v, rows };
    })
    .sort((a, b) => b.tvl - a.tvl);
}

export const venueKey = (v: YieldVault) => venueOf(v);

/** Autopilot is Harvest's own allocator, not a lending protocol. */
export const isAutopilot = (v: YieldVault) =>
  v.vaultType === "Autopilot" || venueOf(v) === "Autopilot";

/** The venue as a reader should see it: "Harvest Autopilot" is not a protocol. */
export const displayVenue = (v: YieldVault) => (isAutopilot(v) ? "Harvest Autopilot" : venueOf(v));

// ---- prose -------------------------------------------------------------------

/** Daily-compounded equivalent of an APR, both in percent. */
export const aprToApy = (apr: number) => ((1 + apr / 100 / 365) ** 365 - 1) * 100;

/** Amount earned over a year at a rate, in the asset's own unit. */
export const yearOf = (amount: number, rate: number, digits: number) =>
  ((amount * rate) / 100).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** Stable anchor for a question, so the index at the foot can link to it. */
export const qid = (q: string) =>
  "q-" +
  q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export type FaqSpot =
  | "top"
  | "network"
  | "types"
  | "compare"
  | "safety"
  | "calc"
  | "stability"
  | "assets"
  | "venue"
  | "start"
  | "risk"
  // /yield-on-tokenized-stocks
  | "fixed"
  | "tokens"
  | "fees"
  | "noticed";

export interface Faq {
  q: string;
  at: FaqSpot;
  a: string;
}

export interface Takeaway {
  k: string;
  a: string;
}

/** A risk line: its name, then text runs with any source link in place. */
export interface Risk {
  title: string;
  parts: (string | { text: string; href: string })[];
}
