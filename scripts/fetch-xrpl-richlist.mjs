#!/usr/bin/env node
// Builds data/xrp-richlist.json for /xrp-rich-list.
//
// One pass over every AccountRoot object in a single validated ledger,
// streamed into a histogram rather than collected, then written out as tier
// thresholds, a balance ladder the browser can interpolate, decade bands for
// the chart, and the largest 100 accounts.
//
// Pinned to one ledger index for the whole walk. XRPL closes a ledger every
// three to five seconds, so paging across closes would count accounts that
// moved twice and miss others entirely, and the resulting "snapshot" would
// describe no state that ever existed.
//
// Runtime is a few thousand requests against public clusters, so the walk
// checkpoints its marker and its histogram every N pages. A run that dies at
// 80% resumes instead of starting over.
//
// Usage:
//   node scripts/fetch-xrpl-richlist.mjs              full walk
//   node scripts/fetch-xrpl-richlist.mjs --resume     continue from checkpoint
//   node scripts/fetch-xrpl-richlist.mjs --max-pages=20 --dry   smoke test

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  validatedLedger,
  walkAccounts,
  walkEscrows,
  decodeDomain,
  dropsToXrp,
  xrplRpc,
  BASE_RESERVE_XRP,
} from "./lib/xrpl.mjs";
import { Distribution, BUCKETS_PER_DECADE } from "./lib/richlist-distribution.mjs";
import { loadLabels, verifyAgainstAccount } from "./lib/xrpl-labels.mjs";
import { xrpUsd } from "./lib/xrp-onchain-adapters.mjs";
import { freezeStampIfUnchanged } from "./lib/snapshot-stamp.mjs";
import { concentrationOf, CONCENTRATION_N } from "./lib/richlist-concentration.mjs";

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, "data", "xrp-richlist.json");
const YIELD_FILE = join(ROOT, "data", "xrp-yield.json");
const CKPT_FILE = join(ROOT, ".cache", "xrpl-richlist-checkpoint.json");

const argVal = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const RESUME = process.argv.includes("--resume");
// Re-runs only the top-account enrichment against the snapshot already on
// disk. The walk is the expensive part and the enrichment is 100 calls, so
// iterating on the column should not cost eleven minutes.
const ENRICH_ONLY = process.argv.includes("--enrich-only");
const DRY = process.argv.includes("--dry");
const MAX_PAGES = Number(argVal("max-pages", Infinity));
const CKPT_EVERY = Number(argVal("checkpoint-every", 20));
// Five pages of a hundred in the ranking. The hourly job passes no --top, so
// this default is what the page actually renders; leaving it at 100 while the
// page pages through 500 would have shipped a pager with nowhere to go.
const TOP_N = Number(argVal("top", 500));

// ---------------------------------------------------------------- checkpoint

function saveCheckpoint(state) {
  mkdirSync(dirname(CKPT_FILE), { recursive: true });
  writeFileSync(
    CKPT_FILE,
    JSON.stringify({
      ledgerIndex: state.ledgerIndex,
      closeIso: state.closeIso,
      marker: state.marker,
      pages: state.pages,
      total: state.dist.total,
      sumXrp: state.dist.sumXrp,
      counts: Array.from(state.dist.counts),
      exact: [...state.dist.exact],
      // The ledger's own total_coins, read once when the walk pinned its
      // ledger. It was not in the checkpoint and not restored on resume, so
      // every --resume run published `totalSupplyXrp: null` and silently
      // dropped the supply reconciliation from the artifact. The hourly job
      // runs a resume pass after the first one, so in practice that was most
      // snapshots. A BigInt does not survive JSON, hence the string.
      totalSupplyDrops:
        state.totalSupplyDrops != null ? String(state.totalSupplyDrops) : null,
      top: state.dist.topBuffer(),
    }),
  );
}

function loadCheckpoint(dist) {
  if (!existsSync(CKPT_FILE)) return null;
  const c = JSON.parse(readFileSync(CKPT_FILE, "utf-8"));
  dist.counts = Float64Array.from(c.counts);
  dist.total = c.total;
  dist.sumXrp = c.sumXrp;
  dist.exact = new Map(c.exact);
  dist.top = c.top.map((t) => ({ ...t }));
  return c;
}

// XRP/USD from Flare's FTSOv2, the same oracle the XRP yield report prices
// every venue with. Read here rather than from a price API so the dollar
// column on this page and the TVL figures on that one cannot disagree about
// what an XRP was worth. A failure leaves the column out rather than guessing.
async function readXrpUsd() {
  try {
    const p = await xrpUsd();
    return Number.isFinite(p) && p > 0.05 && p < 100 ? Math.round(p * 1e6) / 1e6 : null;
  } catch (e) {
    console.error("[richlist] XRP/USD unavailable:", e?.message ?? e);
    return null;
  }
}

// ---------------------------------------------------------------------- walk

if (ENRICH_ONLY) {
  const cur = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
  const enriched = await enrichTop(cur.ledgerIndex, cur.top);
  cur.top = enriched;
  cur.topLabelled = enriched.filter((t) => t.label).length;
  cur.topWithEscrow = enriched.filter((t) => t.escrows > 0).length;
  cur.concentration = concentrationOf(enriched.slice(0, CONCENTRATION_N), cur.xrpHeld);
  const p = await readXrpUsd();
  cur.xrpUsd = p;
  cur.xrpUsdSource = p == null ? null : "Flare FTSOv2 XRP/USD oracle";
  writeFileSync(OUT_FILE, JSON.stringify(cur, null, 2) + "\n");
  console.error(
    `[richlist] enriched ${enriched.length} top accounts: ${cur.topLabelled} labelled, ` +
      `${enriched.filter((t) => t.domain).length} publishing a domain onchain, ` +
      `${cur.topWithEscrow} holding escrow` +
      (enriched.filter((t) => t.labelDropped).length
        ? `, ${enriched.filter((t) => t.labelDropped).length} label(s) dropped on a failed live check`
        : ""),
  );
  process.exit(0);
}

const dist = new Distribution({ topN: TOP_N });

let ledgerIndex;
let closeIso;
let totalSupplyDrops = null;
let startMarker = null;
let pagesDone = 0;

const resumed = RESUME ? loadCheckpoint(dist) : null;
if (resumed) {
  ledgerIndex = resumed.ledgerIndex;
  closeIso = resumed.closeIso;
  startMarker = resumed.marker;
  pagesDone = resumed.pages;
  totalSupplyDrops =
    resumed.totalSupplyDrops != null ? BigInt(resumed.totalSupplyDrops) : null;
  console.error(
    `[richlist] resuming ledger ${ledgerIndex} at page ${pagesDone}, ${resumed.total.toLocaleString()} accounts so far`,
  );
} else {
  const l = await validatedLedger();
  ledgerIndex = l.ledgerIndex;
  closeIso = l.closeIso;
  totalSupplyDrops = l.totalDrops;
  console.error(`[richlist] ledger ${ledgerIndex} closed ${closeIso}`);
}

// Escrowed XRP, walked first so the account pass can add it to each balance.
//
// AccountRoot.Balance excludes escrowed drops: the ledger moves them out of the
// balance and into the Escrow object. A rich list on balances alone therefore
// omits the six largest XRP positions on the network, which each hold a couple
// of hundred XRP in balance and five billion in escrow. It also fails to
// reconcile: balances alone come to 67.5bn against a 100bn supply, and the
// 32.4bn gap is exactly the escrow.
//
// Both walks are pinned to the same ledger index so the totals add up to the
// ledger's own total_coins rather than to two different moments.
console.error(`[richlist] walking escrows at ledger ${ledgerIndex}`);
const esc = await walkEscrows({
  ledgerIndex,
  onProgress: ({ pages, objects }) => {
    if (pages % 25 === 0) console.error(`[richlist] escrow page ${pages}, ${objects} objects`);
  },
});
const escrowByAccount = esc.byAccount;
const escrowedXrpTotal = Number(esc.totalDrops) / 1e6;
console.error(
  `[richlist] ${esc.objects} escrow objects across ${escrowByAccount.size} accounts, ` +
    `${Math.round(escrowedXrpTotal).toLocaleString()} XRP locked`,
);

const t0 = Date.now();
const result = await walkAccounts({
  ledgerIndex,
  startMarker,
  maxPages: MAX_PAGES,
  onPage: (accounts) => {
    for (const a of accounts) {
      const d = a.Balance;
      if (d == null) continue;
      const spendable = dropsToXrp(d);
      const lockedDrops = escrowByAccount.get(a.Account) ?? 0n;
      const locked = Number(lockedDrops) / 1e6;
      // The ranked quantity is what the account controls: spendable plus
      // escrowed. That is what "rich list" means, and it is the only definition
      // under which the distribution reconciles against the ledger's supply.
      dist.add(spendable + locked, {
        address: a.Account,
        spendableXrp: Math.round(spendable),
        escrowedXrp: Math.round(locked),
        // Self-declared and onchain. Anything absent stays unlabelled rather
        // than being guessed at from transaction behaviour.
        domain: decodeDomain(a.Domain),
      });
    }
  },
  onProgress: ({ pages, seen, marker }) => {
    const n = pagesDone + pages;
    if (n % 5 === 0) {
      const rate = dist.total / ((Date.now() - t0) / 1000);
      console.error(
        `[richlist] page ${n}, ${dist.total.toLocaleString()} accounts, ${Math.round(rate).toLocaleString()}/s`,
      );
    }
    if (n % CKPT_EVERY === 0) {
      saveCheckpoint({ ledgerIndex, closeIso, marker, pages: n, dist, totalSupplyDrops });
    }
  },
});

pagesDone += result.pages;

if (!result.done) {
  saveCheckpoint({
    ledgerIndex,
    closeIso,
    marker: result.marker,
    pages: pagesDone,
    dist,
    totalSupplyDrops,
  });
  console.error(
    `[richlist] stopped after ${pagesDone} pages with a marker outstanding; rerun with --resume`,
  );
  if (!DRY) process.exit(0);
}

// ---------------------------------------------------------------- enrichment

// Everything the top-100 table shows beyond its numbers: the registry label and
// the account's self-declared Domain. Escrow is not queried per account here,
// because the escrow walk above already has every account's locked total, and
// the old per-account pass could only see accounts that reached the top 100 on
// spendable balance alone. That is precisely the set which excludes the six
// largest positions on the ledger.
//
// Labels are the reason this table beats an explorer, so they stay. What
// changed after measuring is where they can come from. Not one of the hundred
// largest accounts sets a Domain, which is the only identity an account can
// publish about itself onchain, so the labels cannot be harvested from the
// walk. They come from data/xrpl-account-labels.json, where each one carries
// the evidence it rests on, and scripts/check-xrpl-labels.mjs refuses to build
// an entry that cannot say where it came from.
//
// The one tier that is machine-checkable, an account publishing a Domain, is
// re-verified here on every run rather than trusted from the file. An exchange
// that rotates a wallet or drops its Domain silently invalidates a label, and
// a stale attribution on somebody else's money is worse than no attribution.
//
// Alongside the label, the column carries what the ledger says directly: the
// Domain when there is one, and the escrow position when the account holds one.
// Those are facts about state rather than claims about ownership.
async function enrichTop(ledgerIdx, list) {
  const labels = loadLabels(ROOT);
  return list.map((t) => {
    // Attach the registry label, and re-verify the one tier that can be checked
    // from an AccountRoot. A label that no longer matches the ledger is dropped
    // rather than shown, because a stale attribution is worse than none.
    const label = labels.byAddress.get(t.address) ?? null;
    const check = verifyAgainstAccount(label, t.domain);
    return {
      ...t,
      label:
        label && check.ok
          ? {
              name: label.name,
              type: label.type ?? "unknown",
              affiliation: label.affiliation ?? null,
              evidence: label.evidence,
              evidenceUrl: label.evidenceUrl ?? null,
              attribution: label.attribution ?? null,
              verifiedOn: label.verifiedOn ?? null,
            }
          : null,
      labelDropped: label && !check.ok ? check.note : null,
    };
  });
}

// ------------------------------------------------------------- reconciliation

// The build spec asks for one comparison nobody else on this SERP can make:
// how many XRP holders actually earn a yield. The two populations are NOT the
// same kind of thing and the wording has to survive that. An XRPL AccountRoot
// is an account on the XRP Ledger. A yield-product holder is an address on
// Flare or Base holding a wrapped or staked XRP receipt token. One person can
// be both, or several of either. So the numbers are reported as two scoped
// counts and a ratio between them, never as a subset claim.
function yieldHolders() {
  if (!existsSync(YIELD_FILE)) return null;
  try {
    const y = JSON.parse(readFileSync(YIELD_FILE, "utf-8"));
    const rows = (y.pools ?? []).filter((p) => p.holders?.count > 0);
    if (!rows.length) return null;
    const asOf = rows
      .map((p) => p.holders.asOf)
      .filter(Boolean)
      .sort()
      .pop();
    return {
      // A sum of per-product holder counts. An address holding two products is
      // counted twice, which makes this an upper bound on distinct holders and
      // therefore a conservative input to "how few earn anything".
      receiptTokenHolders: rows.reduce((s, p) => s + p.holders.count, 0),
      products: rows.length,
      asOf: asOf ?? null,
      basis: "sum of per-product receipt-token holder counts on Flare and Base, not deduplicated across products",
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------- assemble

const tiers = dist.tiers();
const ladder = dist.ladder({ perDecade: 40 });
const bands = dist.bands();
const top = await enrichTop(
  ledgerIndex,
  dist.topAccounts().map((t) => ({
    rank: t.rank,
    address: t.address,
    // `xrp` is the ranked quantity: spendable plus escrowed. Both parts are
    // carried separately so the table can show that an account holding two
    // hundred XRP and five billion in escrow is not the same as one holding
    // five billion it can move today.
    xrp: t.xrp,
    spendableXrp: t.spendableXrp ?? t.xrp,
    escrowedXrp: t.escrowedXrp ?? 0,
    escrows: (t.escrowedXrp ?? 0) > 0 ? 1 : 0,
    pctOfSupply: dist.sumXrp ? Math.round((t.xrp / dist.sumXrp) * 1e6) / 1e4 : 0,
    domain: t.domain ?? null,
  })),
);

const labelled = top.filter((t) => t.label).length;
const withEscrow = top.filter((t) => t.escrows > 0).length;

const concentration = concentrationOf(top.slice(0, CONCENTRATION_N), dist.sumXrp);
const priceUsd = await readXrpUsd();

const payload = {
  generatedAt: new Date().toISOString(),
  source: "xrpl-ledger-walk",
  ledgerIndex,
  ledgerCloseIso: closeIso,
  method: {
    description:
      "One pass over every AccountRoot object in a single validated XRP Ledger, read from public XRPL nodes over JSON-RPC. Balances are aggregated into a log-spaced histogram as they stream, so no third-party rich list or explorer dataset is involved.",
    bucketsPerDecade: BUCKETS_PER_DECADE,
    // The number the methodology section quotes, derived rather than asserted.
    thresholdRelativeErrorPct: Math.round((10 ** (1 / BUCKETS_PER_DECADE) - 1) * 1e6) / 1e4,
    fundedAccountDefinition: `Every AccountRoot in the ledger. An XRP Ledger account cannot exist without meeting the base reserve, which validators lowered to ${BASE_RESERVE_XRP} XRP in December 2024, so the count of AccountRoot objects is the count of funded accounts.`,
    labelPolicy:
      "Top accounts are labelled only from the AccountRoot Domain field, which the account holder sets on itself onchain. Accounts with no Domain are shown unlabelled. No identity is inferred from transaction behaviour.",
  },
  accounts: dist.total,
  xrpHeld: Math.round(dist.sumXrp),
  escrowedXrp: Math.round(escrowedXrpTotal),
  spendableXrp: Math.round(dist.sumXrp - escrowedXrpTotal),
  escrowAccounts: escrowByAccount.size,
  escrowObjects: esc.objects,
  totalSupplyXrp: totalSupplyDrops != null ? Math.round(Number(totalSupplyDrops) / 1e6) : null,
  // The check that says the walk saw everything. Spendable plus escrowed, both
  // read at the same ledger, must equal the ledger's own total_coins. A walk
  // that silently truncated shows up here as a gap of billions rather than of
  // rounding, which is how the first escrow pass was caught.
  supplyReconciliation:
    totalSupplyDrops != null
      ? (() => {
          const supply = Number(totalSupplyDrops) / 1e6;
          const walked = dist.sumXrp;
          return {
            ledgerTotalCoinsXrp: Math.round(supply),
            walkedXrp: Math.round(walked),
            differenceXrp: Math.round(supply - walked),
            differencePct: Math.round(((supply - walked) / supply) * 1e8) / 1e6,
          };
        })()
      : null,
  tiers,
  exactCounts: dist.exactCounts(),
  bands,
  ladder,
  top,
  topLabelled: labelled,
  topWithEscrow: withEscrow,
  concentration,
  xrpUsd: priceUsd,
  xrpUsdSource: priceUsd == null ? null : "Flare FTSOv2 XRP/USD oracle",
  yieldComparison: yieldHolders(),
};

// Threshold history. Nobody on this SERP shows how the top 10% cutoff has
// moved, and it is the reason to come back to the page next month, which is
// worth more than any single visit. One row per UTC day, the last walk of the
// day winning, capped so the snapshot cannot grow without limit.
{
  const prevHist = existsSync(OUT_FILE)
    ? (JSON.parse(readFileSync(OUT_FILE, "utf-8")).thresholdHistory ?? [])
    : [];
  const day = payload.ledgerCloseIso.slice(0, 10);
  const row = {
    d: day,
    accounts: payload.accounts,
    xrpHeld: payload.xrpHeld,
    tiers: Object.fromEntries(tiers.map((t) => [String(t.pct), t.minXrp])),
  };
  payload.thresholdHistory = [...prevHist.filter((h) => h.d !== day), row]
    .sort((a, b) => (a.d < b.d ? -1 : 1))
    .slice(-400);
}

if (DRY) {
  console.error(
    `[richlist] DRY: ${dist.total.toLocaleString()} accounts over ${pagesDone} pages, ` +
      `top1% ${tiers.find((t) => t.pct === 1)?.minXrp} XRP, ladder ${ladder.length} pts, ${labelled}/${top.length} labelled`,
  );
  process.exit(0);
}

// Freeze the stamp when nothing moved, the same guard the XRP report uses, so
// an idle rerun leaves the file byte-identical and the page's "Updated" line
// does not advance on data that did not change.
const prev = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, "utf-8")) : null;
const out = freezeStampIfUnchanged(prev, payload);

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
console.error(
  `[richlist] ${dist.total.toLocaleString()} funded accounts, ` +
    `${Math.round(dist.sumXrp).toLocaleString()} XRP, ledger ${ledgerIndex} -> ${OUT_FILE}`,
);
