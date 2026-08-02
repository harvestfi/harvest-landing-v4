// Loader and derived constants for /xrp-rich-list.
//
// Every figure the page states comes from here, and here reads exactly one
// file. The build spec's rule is that prose, table, calculator, chart and the
// dataset export must all resolve to the same constant, because a rich list
// whose headline disagrees with its own table is worth less than no rich list.
// So nothing on the page recomputes a number from a different input.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface RichListTier {
  pct: number;
  minXrp: number;
  accounts: number;
  xrpHeld: number;
  pctOfXrp: number;
}

export interface RichListBand {
  min: number;
  max: number | null;
  accounts: number;
  pctOfAccounts: number;
  xrpHeld: number;
  pctOfXrp: number;
}

export interface LadderPoint {
  xrp: number;
  atOrAbove: number;
}

export interface TopAccount {
  rank: number;
  address: string;
  xrp: number;
  pctOfSupply: number;
  domain: string | null;
  // `xrp` is the ranked quantity: spendable plus escrowed. These two split it,
  // because an account holding 200 XRP with 5bn locked is not the same as one
  // holding 5bn it can move today.
  spendableXrp?: number;
  escrowedXrp?: number;
  escrows?: number;
  // Registry label, attached and re-verified by the pipeline. Null when the
  // address is not in data/xrpl-account-labels.json, or when its live check
  // failed, in which case the label is dropped rather than shown stale.
  label?: {
    name: string;
    type?: string;
    // Who the holder is connected to, held apart from what kind of holder it
    // is. "ripple" is XRP the company controls; "ripple-founder" is a personal
    // balance belonging to someone who co-founded it, which is a different
    // claim and gets a different filter.
    affiliation?: "ripple" | "ripple-founder" | null;
    evidence: "account-domain" | "xrpl-toml" | "published" | "third-party";
    evidenceUrl: string | null;
    attribution: string | null;
    verifiedOn: string | null;
  } | null;
}

/**
 * How a label was established, in reader-facing words. Shown next to the name
 * so an attribution is never a bare assertion: the table says who, and this
 * says on what basis.
 */
export const evidenceLabel = (e: NonNullable<TopAccount["label"]>): string => {
  switch (e.evidence) {
    case "account-domain":
      return "verified onchain: the account publishes this domain";
    case "xrpl-toml":
      return "verified: the operator's domain lists this address";
    case "published":
      return `published by the operator, checked ${e.verifiedOn ?? "on file"}`;
    case "third-party":
      return `attributed by ${e.attribution ?? "a third party"}`;
  }
};

export interface RichList {
  generatedAt: string;
  source: string;
  ledgerIndex: number;
  ledgerCloseIso: string;
  method: {
    description: string;
    bucketsPerDecade: number;
    thresholdRelativeErrorPct: number;
    fundedAccountDefinition: string;
    labelPolicy: string;
  };
  accounts: number;
  // Total XRP controlled across all funded accounts: spendable plus escrowed.
  xrpHeld: number;
  escrowedXrp?: number;
  spendableXrp?: number;
  escrowAccounts?: number;
  escrowObjects?: number;
  totalSupplyXrp: number | null;
  // Walked total against the ledger's own total_coins. A complete walk closes
  // to within rounding; a truncated one shows a gap of billions.
  supplyReconciliation?: {
    ledgerTotalCoinsXrp: number;
    walkedXrp: number;
    differenceXrp: number;
    differencePct: number;
  } | null;
  tiers: RichListTier[];
  exactCounts: Record<string, number>;
  bands: RichListBand[];
  ladder: LadderPoint[];
  top: TopAccount[];
  topLabelled: number;
  topWithEscrow?: number;
  // XRP/USD from Flare's FTSOv2, the same oracle the XRP yield report prices
  // with, so the two pages cannot disagree about what an XRP was worth.
  xrpUsd?: number | null;
  xrpUsdSource?: string | null;
  // Concentration read with and without exchange wallets, plus the largest
  // holding attributed to a person. Absent on snapshots written before it.
  concentration?: {
    top100Xrp: number;
    top100PctOfXrp: number;
    exchangeAccounts: number;
    exchangeXrp: number;
    exExchangeXrp: number;
    exExchangePctOfXrp: number;
    rippleAccounts?: number;
    rippleXrp?: number;
    ripplePctOfXrp?: number;
    rippleEscrowedXrp?: number;
    founderAccounts?: number;
    founderXrp?: number;
    founderPctOfXrp?: number;
    residualAccounts?: number;
    residualXrp?: number;
    residualPctOfXrp?: number;
    largestIndividual: {
      rank: number;
      address: string;
      name: string;
      xrp: number;
      attribution: string | null;
    } | null;
    labelledAccounts: number;
    basis: string;
  } | null;
  yieldComparison: {
    receiptTokenHolders: number;
    products: number;
    asOf: string | null;
    basis: string;
  } | null;
  // One row per UTC day, appended by each walk. Absent on the first snapshot
  // and on any snapshot written before the history was added, so every reader
  // has to treat it as optional.
  thresholdHistory?: {
    d: string;
    accounts: number;
    xrpHeld: number;
    tiers: Record<string, number>;
  }[];
}

export function loadRichList(): RichList | null {
  const p = join(process.cwd(), "data", "xrp-richlist.json");
  if (!existsSync(p)) return null;
  try {
    const d = JSON.parse(readFileSync(p, "utf-8")) as RichList;
    // A snapshot with no accounts is a failed walk, not an empty ledger. The
    // page renders its "not available" state rather than a distribution of
    // nothing, which would print a 0 XRP top-1% threshold.
    return d?.accounts > 0 && Array.isArray(d.ladder) && d.ladder.length > 1 ? d : null;
  } catch {
    return null;
  }
}

export const tierOf = (d: RichList, pct: number): RichListTier | undefined =>
  d.tiers.find((t) => t.pct === pct);

/**
 * Accounts holding at least `xrp`, interpolated in log space against the same
 * ladder the browser uses. Server and client run identical arithmetic so the
 * prose and the calculator can never disagree about a rank.
 */
export function accountsAtOrAbove(ladder: LadderPoint[], xrp: number): number {
  if (!ladder.length) return 0;
  if (xrp <= ladder[0].xrp) return ladder[0].atOrAbove;
  const last = ladder[ladder.length - 1];
  if (xrp >= last.xrp) return last.atOrAbove;
  let lo = 0;
  let hi = ladder.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ladder[mid].xrp <= xrp) lo = mid;
    else hi = mid;
  }
  const a = ladder[lo];
  const b = ladder[hi];
  const span = Math.log10(b.xrp) - Math.log10(a.xrp);
  const t = span > 0 ? (Math.log10(xrp) - Math.log10(a.xrp)) / span : 0;
  return a.atOrAbove + t * (b.atOrAbove - a.atOrAbove);
}

// ---- formatting -----------------------------------------------------------

export const xrpAmount = (n: number): string => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}bn`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return Math.round(n).toLocaleString("en-US");
  if (n >= 1) return (Math.round(n * 100) / 100).toLocaleString("en-US");
  return String(Math.round(n * 1e6) / 1e6);
};

export const count = (n: number): string => Math.round(n).toLocaleString("en-US");

/** Compact count for prose: "8.4 million", "6,200". */
export const countProse = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`;
  return Math.round(n).toLocaleString("en-US");
};

export const pctLabel = (v: number): string => {
  // Nothing short of a true 100 may print as "100%". The tier table renders
  // shares like 99.91, and rounding that to a whole number put "the top 25%
  // held 100% of XRP" on the page, which is false and is exactly the kind of
  // rounded-up claim a reader checks and a competitor screenshots. Anything in
  // the last percent keeps a decimal so the reader can see it is not all of it.
  if (v >= 100) return "100%";
  if (v >= 99.95) return "over 99.9%";
  if (v >= 99) return `${v.toFixed(1)}%`;
  if (v >= 10) return `${v.toFixed(0)}%`;
  if (v >= 1) return `${v.toFixed(1)}%`;
  if (v >= 0.01) return `${v.toFixed(2)}%`;
  return "under 0.01%";
};

export const utcDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

/** "July 31, 2026 at 09:34 UTC" for the hero freshness line. */
export const utcStamp = (iso: string): string => {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${utcDate(iso)} at ${hh}:${mm} UTC`;
};

export const bandLabel = (b: RichListBand): string => {
  const lo = b.min === 0 ? "under 1" : xrpAmount(b.min);
  if (b.max == null) return `${xrpAmount(b.min)}+`;
  return b.min === 0 ? `${lo} XRP` : `${lo} to ${xrpAmount(b.max)}`;
};
