#!/usr/bin/env node
// Builds data/xrp-richlist.json for /xrp-rich-list.
//
// One pass over every object in a single validated ledger, streamed into a
// histogram rather than collected, then written out as tier thresholds, a
// balance ladder the browser can interpolate, decade bands for the chart, and
// the largest accounts.
//
// Pinned to one ledger index for the whole walk. XRPL closes a ledger every
// three to five seconds, so paging across closes would count accounts that
// moved twice and miss others entirely, and the resulting "snapshot" would
// describe no state that ever existed.
//
// The walk is ~10,000 pages read in parallel shards (see scripts/lib/xrpl.mjs
// for why), so it checkpoints its shard markers and its totals. A run that
// reaches its time budget saves the checkpoint and exits cleanly; the next run
// picks up the same ledger where it stopped, so a slow day costs freshness
// rather than the snapshot.
//
// Usage:
//   node scripts/fetch-xrpl-richlist.mjs                    walk, resuming a recent checkpoint
//   node scripts/fetch-xrpl-richlist.mjs --fresh            ignore any checkpoint
//   node scripts/fetch-xrpl-richlist.mjs --budget-min=90    stop picking up pages after 90 minutes
//   node scripts/fetch-xrpl-richlist.mjs --budget-min=2 --dry   smoke test, writes nothing

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  validatedLedger,
  planShards,
  walkLedger,
  entryKind,
  decodeAccountRoot,
  decodeEscrow,
  encodeAccountId,
  accountRootKey,
  decodeDomain,
  xrplRpc,
  CLIO_ENDPOINTS,
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
const CKPT_VERSION = 2;

const argVal = (n, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};
const FRESH = process.argv.includes("--fresh");
// Re-runs only the top-account enrichment against the snapshot already on
// disk. The walk is the expensive part and the enrichment is local, so
// iterating on the column should not cost an hour and a half.
const ENRICH_ONLY = process.argv.includes("--enrich-only");
const DRY = process.argv.includes("--dry");
const BUDGET_MIN = Number(argVal("budget-min", Infinity));
// Clio queues past ~20 concurrent requests per IP, so keep the walk at that limit.
const CONCURRENCY = Number(argVal("concurrency", 20));
// More shards than streams, so one slow shard does not hold up the end of the
// walk while the other streams sit idle.
const SHARDS = Number(argVal("shards", 48));
// A checkpoint older than this is discarded rather than finished: completing
// it would publish a snapshot already a day old.
const MAX_RESUME_HOURS = Number(argVal("max-resume-hours", 24));
const CKPT_EVERY_MS = 60_000;
// Five pages of a hundred in the ranking. The scheduled job passes no --top, so
// this default is what the page actually renders.
const TOP_N = Number(argVal("top", 500));

const t0 = Date.now();
const deadline = Number.isFinite(BUDGET_MIN) ? t0 + BUDGET_MIN * 60_000 : Infinity;

// ---------------------------------------------------------------- checkpoint

function saveCheckpoint(s) {
  mkdirSync(dirname(CKPT_FILE), { recursive: true });
  writeFileSync(
    CKPT_FILE,
    JSON.stringify({
      version: CKPT_VERSION,
      ledgerIndex: s.ledgerIndex,
      closeIso: s.closeIso,
      // A BigInt does not survive JSON, hence the strings.
      totalSupplyDrops: s.totalSupplyDrops != null ? String(s.totalSupplyDrops) : null,
      shards: s.shards,
      pages: s.pages,
      total: s.dist.total,
      sumXrp: s.dist.sumXrp,
      counts: Array.from(s.dist.counts),
      exact: [...s.dist.exact],
      top: s.dist.topBuffer(),
      escrow: [...s.escrow].map(([k, v]) => [k, String(v)]),
      escrowObjects: s.escrowObjects,
    }),
  );
}

function loadCheckpoint(dist) {
  if (FRESH || !existsSync(CKPT_FILE)) return null;
  let c;
  try {
    c = JSON.parse(readFileSync(CKPT_FILE, "utf-8"));
  } catch {
    console.error("[richlist] checkpoint unreadable, starting fresh");
    return null;
  }
  if (c.version !== CKPT_VERSION) {
    console.error(`[richlist] checkpoint is format ${c.version ?? 1}, starting fresh`);
    return null;
  }
  const ageH = (Date.now() - Date.parse(c.closeIso)) / 3_600_000;
  if (!(ageH <= MAX_RESUME_HOURS)) {
    console.error(`[richlist] checkpoint ledger closed ${ageH.toFixed(1)}h ago, starting fresh`);
    return null;
  }
  // The Actions cache hands back the newest checkpoint it holds, and a run that
  // finished its walk has none to save, so the one restored can belong to a
  // ledger a later run already published.
  const published = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, "utf-8")).ledgerIndex : null;
  if (published != null && c.ledgerIndex <= published) {
    console.error(`[richlist] checkpoint ledger ${c.ledgerIndex} is already published, starting fresh`);
    return null;
  }
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
let shards;
let pages = 0;
// Escrowed drops per owning AccountID. AccountRoot.Balance excludes escrow: the
// ledger moves those drops out of the balance and into the Escrow object, so a
// rich list on balances alone omits the largest positions on the network and
// comes to ~68bn against a 100bn supply.
let escrow = new Map();
let escrowObjects = 0;

const resumed = loadCheckpoint(dist);
if (resumed) {
  ledgerIndex = resumed.ledgerIndex;
  closeIso = resumed.closeIso;
  totalSupplyDrops = resumed.totalSupplyDrops != null ? BigInt(resumed.totalSupplyDrops) : null;
  shards = resumed.shards;
  pages = resumed.pages;
  escrow = new Map(resumed.escrow.map(([k, v]) => [k, BigInt(v)]));
  escrowObjects = resumed.escrowObjects;
  console.error(
    `[richlist] resuming ledger ${ledgerIndex} (closed ${closeIso}): ` +
      `${shards.filter((s) => s.done).length}/${shards.length} shards done, ` +
      `${pages} pages, ${dist.total.toLocaleString()} accounts so far`,
  );
} else {
  const l = await validatedLedger();
  ledgerIndex = l.ledgerIndex;
  closeIso = l.closeIso;
  totalSupplyDrops = l.totalDrops;
  // Shard seeds: the AccountRoot keys of every account the last snapshot and
  // the label registry name. Several hundred uniform hashes, so any shard
  // count up to ~100 finds a seed near each boundary.
  const known = new Set(loadLabels(ROOT).labels.map((l) => l.address));
  if (existsSync(OUT_FILE)) {
    for (const t of JSON.parse(readFileSync(OUT_FILE, "utf-8")).top ?? []) known.add(t.address);
  }
  const candidateKeys = [];
  for (const a of known) {
    try {
      candidateKeys.push(accountRootKey(a));
    } catch {
      // Not a classic address; it cannot seed a shard.
    }
  }
  shards = await planShards({ ledgerIndex, candidateKeys, shards: SHARDS });
  console.error(`[richlist] ledger ${ledgerIndex} closed ${closeIso}, ${shards.length} shards`);
}

const state = () => ({ ledgerIndex, closeIso, totalSupplyDrops, shards, pages, dist, escrow, escrowObjects });

let lastCkpt = Date.now();
let lastLog = Date.now();
const pagesAtStart = pages;
let walkError = null;
let walk;
try {
  walk = await walkLedger({
    ledgerIndex,
    shards,
    concurrency: CONCURRENCY,
    deadline,
    onEntries: (entries) => {
      // Decode the whole page before applying any of it. A page that fails is
      // retried, and one that had been half-applied would be counted twice.
      const accounts = [];
      const escrows = [];
      for (const { data } of entries) {
        const kind = entryKind(data);
        if (kind === "account") accounts.push(decodeAccountRoot(data));
        else if (kind === "escrow") {
          const e = decodeEscrow(data);
          if (e) escrows.push(e);
        }
      }
      for (const a of accounts) {
        const spendable = Number(a.drops) / 1e6;
        dist.add(spendable, {
          accountHex: a.accountHex,
          spendableXrp: Math.round(spendable),
          escrowedXrp: 0,
          // Self-declared and onchain. Anything absent stays unlabelled rather
          // than being guessed at from transaction behaviour.
          domain: decodeDomain(a.domainHex),
        });
      }
      for (const e of escrows) {
        escrowObjects++;
        escrow.set(e.accountHex, (escrow.get(e.accountHex) ?? 0n) + e.drops);
      }
    },
    onPage: () => {
      pages++;
      const now = Date.now();
      if (now - lastLog >= 30_000) {
        lastLog = now;
        const done = shards.filter((s) => s.done).length;
        const rate = (pages - pagesAtStart) / ((now - t0) / 60_000);
        console.error(
          `[richlist] ${pages} pages, ${done}/${shards.length} shards done, ` +
            `${dist.total.toLocaleString()} accounts, ${escrowObjects} escrows, ${rate.toFixed(0)} pages/min`,
        );
      }
      if (now - lastCkpt >= CKPT_EVERY_MS) {
        lastCkpt = now;
        saveCheckpoint(state());
      }
    },
  });
} catch (e) {
  walkError = e;
}

if (walkError || !walk.done) {
  saveCheckpoint(state());
  const open = shards.filter((s) => !s.done).length;
  if (walkError) {
    console.error(`[richlist] walk failed with ${open}/${shards.length} shards open; checkpoint saved: ${walkError.message}`);
    process.exit(1);
  }
  console.error(
    `[richlist] time budget reached with ${open}/${shards.length} shards open after ${pages} pages; ` +
      `checkpoint saved, the next run resumes ledger ${ledgerIndex}`,
  );
  process.exit(0);
}

console.error(
  `[richlist] walk complete: ${pages} pages, ${dist.total.toLocaleString()} accounts, ` +
    `${escrowObjects} escrow objects across ${escrow.size} accounts`,
);

// Fold escrow into each holder's balance. The ranked quantity is what an
// account controls, spendable plus escrowed: that is what "rich list" means,
// and it is the only definition under which the distribution reconciles
// against the ledger's supply. The pass met most holders before their escrow,
// so each is read back at the pinned ledger and raised to the full figure.
{
  const holders = [...escrow];
  let next = 0;
  await Promise.all(
    Array.from({ length: 20 }, async () => {
      while (next < holders.length) {
        const [hex, lockedDrops] = holders[next++];
        const address = encodeAccountId(hex);
        const info = await xrplRpc(
          "account_info",
          { account: address, ledger_index: ledgerIndex },
          { endpoints: CLIO_ENDPOINTS },
        );
        const spendable = Number(info.account_data.Balance) / 1e6;
        const locked = Number(lockedDrops) / 1e6;
        dist.raise(spendable, spendable + locked, (t) => t.accountHex === hex, {
          accountHex: hex,
          spendableXrp: Math.round(spendable),
          escrowedXrp: Math.round(locked),
          domain: decodeDomain(info.account_data.Domain),
        });
      }
    }),
  );
}
const escrowedXrpTotal = Number([...escrow.values()].reduce((a, b) => a + b, 0n)) / 1e6;
console.error(
  `[richlist] ${escrow.size} escrow holders folded in, ${Math.round(escrowedXrpTotal).toLocaleString()} XRP locked`,
);

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
    address: encodeAccountId(t.accountHex),
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
  escrowAccounts: escrow.size,
  escrowObjects,
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
    `[richlist] DRY: ${dist.total.toLocaleString()} accounts over ${pages} pages, ` +
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
// The snapshot is published; the next run starts a new ledger.
rmSync(CKPT_FILE, { force: true });
console.error(
  `[richlist] ${dist.total.toLocaleString()} funded accounts, ` +
    `${Math.round(dist.sumXrp).toLocaleString()} XRP, ledger ${ledgerIndex} -> ${OUT_FILE}`,
);
