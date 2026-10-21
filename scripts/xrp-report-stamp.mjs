// Prints the dateModified that /report/xrp-yield-ranking will render for the
// current data/xrp-yield.json, so the IndexNow job can wait for exactly that
// string on the live page.
//
// Mirrors changeTs in src/app/report/xrp-yield-ranking/page.tsx: the newest of
// the top-level, landscape and yield-trading generatedAt stamps and the first
// holder asOf. Keep the two in step. The page's observation-day cap is left
// out on purpose: when it bites, the page shows an older date, the wait times
// out and nothing is submitted, which is right for data that did not move.
//
//   node scripts/xrp-report-stamp.mjs   ->   2026-10-21T11:17:20.126Z

import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("data/xrp-yield.json", "utf8"));

const ts = [
  data.generatedAt,
  data.landscape?.generatedAt,
  data.yieldTrading?.generatedAt,
  data.pools?.find((p) => p.holders?.asOf)?.holders?.asOf,
]
  .filter((s) => typeof s === "string")
  .map((s) => Date.parse(s))
  .filter((t) => Number.isFinite(t));

if (ts.length === 0) {
  console.error("[xrp-report-stamp] no timestamps in data/xrp-yield.json");
  process.exit(1);
}

console.log(new Date(Math.max(...ts)).toISOString());
