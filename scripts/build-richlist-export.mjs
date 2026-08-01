#!/usr/bin/env node
// Build-time emitter for the /xrp-rich-list machine-readable surface.
//
// WHY this matters more here than on the other data pages: a downloadable
// holder distribution is exactly the artifact a journalist or a researcher
// cites, and a citation with a link is the thing this page is being built to
// earn. The YouTube channels and newsletters covering XRP holder stats
// currently quote figures with no source behind them; this gives them one.
//
// Writes into the already-exported public/ tree:
//   public/data/xrp-rich-list/index.json        whole snapshot in one fetch
//   public/data/xrp-rich-list/distribution.csv  balance bands
//   public/data/xrp-rich-list/thresholds.csv    percentage tiers
//   public/data/xrp-rich-list/top-accounts.csv  the ranked accounts, deepest first
//
// Runs in the post-export phase of `npm run build`, after `mv out public`, so
// the files survive rather than being wiped. Reads only the generated snapshot,
// makes no network calls, and therefore cannot drift from what the page shows.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const OUT_DIR = join(PUBLIC_DIR, "data", "xrp-rich-list");
const DATA_FILE = join(ROOT, "data", "xrp-richlist.json");

if (!existsSync(PUBLIC_DIR)) {
  console.error("[richlist-export] public/ not found; run after `mv out public`.");
  process.exit(1);
}
if (!existsSync(DATA_FILE)) {
  console.error("[richlist-export] data/xrp-richlist.json not found; skipping.");
  process.exit(0);
}

const d = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
if (!(d?.accounts > 0)) {
  console.error("[richlist-export] snapshot has no accounts; skipping.");
  process.exit(0);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const LICENSE = "CC-BY-4.0";
const ATTRIBUTION =
  "Harvest Research, https://harvest.finance/xrp-rich-list. Read from the XRP Ledger.";

const csv = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";
const q = (s) => (s == null ? "" : `"${String(s).replace(/"/g, '""')}"`);

writeFileSync(
  join(OUT_DIR, "index.json"),
  JSON.stringify(
    {
      name: "XRP Ledger holder distribution",
      license: LICENSE,
      attribution: ATTRIBUTION,
      // The ledger close, not the pipeline run. A consumer needs to know when
      // the state was true, not when we happened to ask.
      snapshotIso: d.ledgerCloseIso,
      ledgerIndex: d.ledgerIndex,
      generatedAt: d.generatedAt,
      method: d.method,
      accounts: d.accounts,
      xrpHeldInFundedAccounts: d.xrpHeld,
      totalSupplyXrp: d.totalSupplyXrp,
      tiers: d.tiers,
      exactCounts: d.exactCounts,
      bands: d.bands,
      ladder: d.ladder,
      top: d.top,
      yieldComparison: d.yieldComparison,
    },
    null,
    2,
  ) + "\n",
  "utf-8",
);

writeFileSync(
  join(OUT_DIR, "thresholds.csv"),
  csv([
    ["tier_top_pct", "min_xrp", "accounts_at_or_above", "xrp_held", "pct_of_xrp", "snapshot_iso", "ledger_index"],
    ...d.tiers.map((t) => [
      t.pct,
      t.minXrp,
      t.accounts,
      t.xrpHeld,
      t.pctOfXrp,
      d.ledgerCloseIso,
      d.ledgerIndex,
    ]),
  ]),
  "utf-8",
);

writeFileSync(
  join(OUT_DIR, "distribution.csv"),
  csv([
    ["band_min_xrp", "band_max_xrp", "accounts", "pct_of_accounts", "xrp_held", "pct_of_xrp", "snapshot_iso"],
    ...d.bands.map((b) => [
      b.min,
      b.max ?? "",
      b.accounts,
      b.pctOfAccounts,
      b.xrpHeld,
      b.pctOfXrp,
      d.ledgerCloseIso,
    ]),
  ]),
  "utf-8",
);

writeFileSync(
  join(OUT_DIR, "top-accounts.csv"),
  csv([
    ["rank", "address", "xrp", "pct_of_xrp_in_funded_accounts", "self_declared_domain", "snapshot_iso"],
    ...d.top.map((t) => [t.rank, t.address, t.xrp, t.pctOfSupply, q(t.domain), d.ledgerCloseIso]),
  ]),
  "utf-8",
);

console.error(
  `[richlist-export] wrote 4 files for ledger ${d.ledgerIndex} (${d.accounts.toLocaleString()} accounts) -> ${OUT_DIR}`,
);
