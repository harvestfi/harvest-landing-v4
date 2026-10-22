import fs from "node:fs";
import path from "node:path";
import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./data";
import {
  buildUsdcCohort,
  venueOf,
  type UsdcCohort,
} from "./usdc-hub";

// Single source for every figure on /eth.
//
// The cohort itself (sorting, the liquidity floor, medians, the TVL-weighted
// rate, per-venue and per-network rollups, 30-day stability) is the same
// arithmetic /usdc runs, so it is reused rather than copied: buildUsdcCohort is
// asset-agnostic despite its name, and two hubs disagreeing about what "the
// median" means would be worse than one shared definition.
//
// What /eth adds is what its queries ask for and /usdc's never did. Search
// Console shows the questions arriving as full sentences scoped to a network:
// "where can I earn yield on ETH on Base", "which protocols pay the highest ETH
// yield on an L2", "which ETH yield options on Base are the safest". So the
// page needs per-network picks, a strategy-type breakdown, and a way to talk
// about "safest" that is measured rather than scored.

export type EthCohort = UsdcCohort;

/** Networks the page answers for by name, in the order a reader meets them. */
export const ETH_NETWORKS = ["Base", "Arbitrum", "Ethereum"] as const;

/** Rollups. Ethereum mainnet is the one network here that is not an L2. */
const L2S = new Set(["Base", "Arbitrum"]);
export const isL2 = (chain: string): boolean => L2S.has(chain);

export function buildEthCohort(
  ethVaults: YieldVault[],
  history: Record<string, FullVaultHistory> | null,
): EthCohort {
  return buildUsdcCohort(ethNamed(ethVaults), history);
}

// Names a reader can tell apart.
//
// Two different products on Base are both called "ETH Lend" (one on Arcadia,
// one on ExtraFi), and a parser reading both rows merges them into one. Where
// a name repeats on the same network, the protocol goes in front of it. And
// "ETH Base ETH Lending Optimizer" says ETH twice, so the leading token is
// dropped when the rest of the name already carries it.
function ethNamed(vaults: YieldVault[]): YieldVault[] {
  const key = (v: YieldVault) => `${v.chain}|${v.productName}`;
  const seen = new Map<string, number>();
  for (const v of vaults) seen.set(key(v), (seen.get(key(v)) ?? 0) + 1);
  return vaults.map((v) => {
    let name = v.productName;
    if ((seen.get(key(v)) ?? 0) > 1) name = `${venueOf(v)} ${name}`;
    const rest = name.replace(/^ETH\s+/, "");
    if (rest !== name && /\bETH\b/.test(rest)) name = rest;
    return name === v.productName ? v : { ...v, productName: name };
  });
}

// ---- strategy types -------------------------------------------------------
//
// Four shapes cover every row. They are told apart by how many contracts sit
// between the ETH and the borrower, which is the property a reader comparing
// "safe" against "high" actually needs:
//
//   money market   ETH lent straight into one pooled market (Aave, Compound,
//                  Fluid, Dolomite...). One protocol, one rate curve.
//   curated vault  ETH spread by a curator across several isolated markets on
//                  Morpho or Euler. The curator's parameter set is a layer.
//   allocator      A contract that moves ETH between venues as rates change
//                  (Autopilot, the IPOR lending optimizer). One more layer,
//                  bought for the right to chase the best rate.
//   looping        ETH supplied, borrowed against and resupplied to multiply
//                  the spread. Leverage is the layer, and it brings a
//                  liquidation path the others do not have.

export type EthStrategyType = "money-market" | "curated" | "allocator" | "looping";

export const STRATEGY_LABEL: Record<EthStrategyType, string> = {
  "money-market": "Money markets",
  curated: "Curated lending vaults",
  allocator: "Allocators",
  looping: "Leveraged looping",
};

export function strategyTypeOf(v: YieldVault): EthStrategyType {
  const name = v.productName.toLowerCase();
  const venue = venueOf(v).toLowerCase();
  if (name.includes("looping")) return "looping";
  if (v.vaultType === "Autopilot" || name.includes("optimizer") || venue.startsWith("ipor")) {
    return "allocator";
  }
  if (venue.startsWith("morpho") || venue.startsWith("euler")) return "curated";
  return "money-market";
}

export interface EthTypeRow {
  type: EthStrategyType;
  label: string;
  count: number;
  fundedCount: number;
  medianApy: number;
  /** Best rate in the type among strategies clearing the liquidity floor. */
  bestFunded: YieldVault | null;
  tvl: number;
}

function median(asc: number[]): number {
  if (asc.length === 0) return 0;
  const mid = asc.length / 2;
  return asc.length % 2 ? asc[Math.floor(mid)] : (asc[mid - 1] + asc[mid]) / 2;
}

export function byStrategyType(c: EthCohort): EthTypeRow[] {
  const order: EthStrategyType[] = ["allocator", "curated", "money-market", "looping"];
  return order
    .map((type) => {
      const rows = c.all.filter((v) => strategyTypeOf(v) === type);
      const funded = rows.filter((v) => v.tvl >= c.fundedFloor);
      return {
        type,
        label: STRATEGY_LABEL[type],
        count: rows.length,
        fundedCount: funded.length,
        medianApy: median(rows.map((v) => v.apy24h).sort((a, b) => a - b)),
        bestFunded: funded[0] ?? null,
        tvl: rows.reduce((s, v) => s + v.tvl, 0),
      };
    })
    .filter((r) => r.count > 0);
}

// ---- per-network picks ------------------------------------------------------

export interface EthNetworkPicks {
  chain: string;
  count: number;
  tvl: number;
  /** Up to three funded strategies on the network, highest rate first. */
  picks: YieldVault[];
  /** Highest rate on the network with no floor, for context only. */
  bestRaw: YieldVault | null;
}

export function networkPicks(c: EthCohort, chain: string, limit = 3): EthNetworkPicks {
  const rows = c.all.filter((v) => v.chain === chain);
  return {
    chain,
    count: rows.length,
    tvl: rows.reduce((s, v) => s + v.tvl, 0),
    picks: rows.filter((v) => v.tvl >= c.fundedFloor).slice(0, limit),
    bestRaw: rows[0] ?? null,
  };
}

// ---- track record and steadiness ------------------------------------------
//
// "Which option is safest" has no measured answer, and a composite safety score
// would be weights chosen here and published as a rating. What can be measured
// is the evidence a reader would weigh: how much ETH a strategy holds, how long
// Harvest has been reading it, how far its rate moved over the last 30 days,
// and how many contract layers it adds. The page reports those and lets the
// reader do the weighing.

export interface EthEvidenceRow {
  vault: YieldVault;
  type: EthStrategyType;
  /** Days from the vault's first reading to the page's as-of date. */
  trackedDays: number;
  /** The same span in calendar years and months, for display. */
  ageLabel: string;
  /** 30-day standard deviation of the daily APY, in points, when measured. */
  stdev: number | null;
}

export function evidenceRows(
  c: EthCohort,
  history: Record<string, FullVaultHistory> | null,
): EthEvidenceRow[] {
  const stdevBySlug = new Map(c.stability.rows.map((r) => [r.slug, r.stdev]));
  const asOfTs = Date.parse(c.asOfIso) / 1000;
  return c.funded
    .map((v) => {
      const h = history?.[v.contractAddress] ?? history?.[v.contractAddress.toLowerCase()];
      const ts = [...(h?.apyHistory ?? []), ...(h?.tvlHistory ?? [])].map((p) => p.timestamp);
      const firstTs = ts.length ? Math.min(...ts) : asOfTs;
      const trackedDays = Math.floor((asOfTs - firstTs) / 86400);
      return {
        vault: v,
        type: strategyTypeOf(v),
        trackedDays,
        ageLabel: calendarAgeLabel(firstTs, asOfTs),
        stdev: stdevBySlug.get(v.slug) ?? null,
      };
    })
    .sort((a, b) => b.vault.tvl - a.vault.tvl);
}

/**
 * trackedLabel on calendar dates. Dividing whole days by an average month
 * reads a vault opened six years and a day ago as "5 years and 11 months".
 */
export function calendarAgeLabel(fromTs: number, toTs: number): string {
  const a = new Date(fromTs * 1000);
  const b = new Date(toTs * 1000);
  let months =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  const days = Math.floor((toTs - fromTs) / 86400);
  if (days < 60 || months < 1) return `${days} days`;
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest
    ? `${years} ${years === 1 ? "year" : "years"} and ${rest} ${rest === 1 ? "month" : "months"}`
    : `${years} ${years === 1 ? "year" : "years"}`;
}

/** "3 years and 2 months", "11 months", "26 days". */
export function trackedLabel(days: number): string {
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest
    ? `${years} ${years === 1 ? "year" : "years"} and ${rest} ${rest === 1 ? "month" : "months"}`
    : `${years} ${years === 1 ? "year" : "years"}`;
}

/** Median 24h APY across strategies clearing the liquidity floor. */
export function fundedMedian(c: EthCohort): number {
  return median(c.funded.map((v) => v.apy24h).sort((a, b) => a - b));
}

// ---- by protocol ------------------------------------------------------------
//
// c.byVenue groups on the protocol name alone, so the leveraged WETH loop on
// Aave lands in the Aave group and stretches its range to the loop's rate,
// which is a claim about Aave lending that Aave lending never paid. The loop
// gets its own group here, as it does in the strategy-type breakdown.

export interface EthVenue {
  venue: string;
  loop: boolean;
  rows: YieldVault[];
  count: number;
  minApy: number;
  maxApy: number;
  medianApy: number;
  tvl: number;
  chains: string[];
}

export function ethVenues(c: EthCohort): EthVenue[] {
  const groups = new Map<string, YieldVault[]>();
  for (const v of c.all) {
    const k = `${venueOf(v)}|${strategyTypeOf(v) === "looping" ? "loop" : ""}`;
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  return [...groups.entries()]
    .map(([k, rows]) => {
      const asc = rows.map((r) => r.apy24h).sort((a, b) => a - b);
      return {
        venue: k.split("|")[0],
        loop: k.endsWith("|loop"),
        rows,
        count: rows.length,
        minApy: asc[0],
        maxApy: asc[asc.length - 1],
        medianApy: median(asc),
        tvl: rows.reduce((s, r) => s + r.tvl, 0),
        chains: [...new Set(rows.map((r) => r.chain))],
      };
    })
    .sort((a, b) => Number(a.loop) - Number(b.loop) || b.count - a.count || b.medianApy - a.medianApy);
}

// ---- staking reference ------------------------------------------------------
//
// Lido's stETH APR, read from its TokenRebased events by
// scripts/fetch-eth-staking-reference.mjs and committed daily. It is a
// reference beside the ranking, never a row in it: stETH is a liquid staking
// token and the page excludes those. Null when the file is absent or older
// than a week, and the page then says the index does not measure staking
// rather than quoting a stale or invented figure.

export interface StakingReference {
  name: string;
  aprAverage: number;
  aprLatest: number;
  reportCount: number;
  fromIso: string;
  asOfIso: string;
  contract: string;
  /** "October 21, 2026", UTC. */
  asOf: string;
  latestTx: string;
}

const STAKING_MAX_AGE_DAYS = 7;

export function loadStakingReference(): StakingReference | null {
  const file = path.join(process.cwd(), "data", "eth-staking-reference.json");
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    const asOfMs = Date.parse(raw.asOfIso);
    if (!Number.isFinite(asOfMs) || typeof raw.aprAverage !== "number") return null;
    if (Date.now() - asOfMs > STAKING_MAX_AGE_DAYS * 86400_000) return null;
    return {
      name: raw.name,
      aprAverage: raw.aprAverage,
      aprLatest: raw.aprLatest,
      reportCount: raw.reportCount,
      fromIso: raw.fromIso,
      asOfIso: raw.asOfIso,
      contract: raw.contract,
      asOf: new Date(asOfMs).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
      latestTx: raw.reports?.at(-1)?.tx ?? "",
    };
  } catch {
    return null;
  }
}

/** WETH, ETH or stETH: the token a row is denominated in, from its name. */
export function tokenOf(v: YieldVault): string {
  return v.productName.split(" ")[0];
}
