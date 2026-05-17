// Precompute network-wide daily TVL by summing per-vault tvlHistory
// from data/history.json. Output is a small JSON used by the
// Deposits (TVL) admin page so the client doesn't have to load and
// aggregate the 300 KB raw history file.
//
// Per-vault rule: keep the latest snapshot per UTC day, then forward-
// fill values from the vault's first reported day to its last. A
// vault's last value also extends forward to "today" if its final
// snapshot is within MAX_STALE_DAYS of the global latest snapshot
// (covers vaults that the indexer happened not to refresh in the
// last few hours). Vaults whose final snapshot is older than that
// are treated as ended at their last reported day - their TVL drops
// out of the daily sum from that point forward.
//
// Run by `npm run build` before next build so the JSON is fresh.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "data", "history.json");
const OUT = join(ROOT, "src", "data", "network-tvl-daily.json");

const DAY_MS = 86_400_000;
const MAX_STALE_DAYS = 7;

function dateKey(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dateKeyToMs(key) {
  return new Date(key + "T00:00:00Z").getTime();
}

const history = JSON.parse(readFileSync(SRC, "utf8"));

// Pass 1: bucket each vault to (UTC date -> latest value that day)
const perVault = new Map();
let globalLatestMs = 0;

for (const [vault, h] of Object.entries(history)) {
  const tvlHistory = h?.tvlHistory;
  if (!Array.isArray(tvlHistory) || tvlHistory.length === 0) continue;

  const buckets = new Map();
  for (const pt of tvlHistory) {
    if (typeof pt?.value !== "number" || typeof pt?.timestamp !== "number") continue;
    if (pt.value < 0) continue;
    const ms = pt.timestamp * 1000;
    const key = dateKey(ms);
    const existing = buckets.get(key);
    if (!existing || pt.timestamp > existing.ts) {
      buckets.set(key, { value: pt.value, ts: pt.timestamp });
    }
    if (ms > globalLatestMs) globalLatestMs = ms;
  }
  if (buckets.size > 0) perVault.set(vault, buckets);
}

if (globalLatestMs === 0) {
  console.error("[network-tvl] no usable snapshots found in history.json");
  process.exit(1);
}

const globalLatestKey = dateKey(globalLatestMs);
const globalLatestMsStart = dateKeyToMs(globalLatestKey);

// Pass 2: per vault, forward-fill from first to last day; extend to
// globalLatest if final snapshot is within MAX_STALE_DAYS.
const filledPerVault = new Map();
for (const [vault, buckets] of perVault) {
  const sortedKeys = [...buckets.keys()].sort();
  const firstMs = dateKeyToMs(sortedKeys[0]);
  const lastMs = dateKeyToMs(sortedKeys[sortedKeys.length - 1]);
  const stale = globalLatestMsStart - lastMs > MAX_STALE_DAYS * DAY_MS;
  const fillEndMs = stale ? lastMs : globalLatestMsStart;

  const filled = new Map();
  let lastVal = buckets.get(sortedKeys[0]).value;
  for (let ts = firstMs; ts <= fillEndMs; ts += DAY_MS) {
    const k = dateKey(ts);
    const b = buckets.get(k);
    if (b) lastVal = b.value;
    filled.set(k, lastVal);
  }
  filledPerVault.set(vault, filled);
}

// Pass 3: aggregate across vaults per day.
const allDates = new Set();
for (const m of filledPerVault.values()) {
  for (const k of m.keys()) allDates.add(k);
}
const sortedAll = [...allDates].sort();
const series = sortedAll.map((date) => {
  let sum = 0;
  for (const m of filledPerVault.values()) {
    const v = m.get(date);
    if (typeof v === "number") sum += v;
  }
  return { date, tvl: Math.round(sum * 100) / 100 };
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({
    generated_at: new Date().toISOString(),
    days: series.length,
    vaults: filledPerVault.size,
    series,
  }),
);
console.log(
  `[network-tvl] wrote ${series.length} daily points across ${filledPerVault.size} vaults -> ${OUT}`,
);
