// Precompute network-wide daily TVL by summing per-vault tvlHistory
// from data/history.json, with data/vaults.json acting as the live
// truth for "today" and as the alive/dead signal for vaults whose
// history-indexer happens to lag.
//
// Per-vault rule:
//  - Bucket history.tvlHistory to one snapshot per UTC day (latest
//    wins).
//  - Forward-fill from the vault's first reported day to its last
//    reported day inside that history range.
//  - If the vault is still alive in vaults.json (tvl > 0), continue
//    forward-filling from last-history-day to today-1 using the
//    last-known history value (flat) and stamp today with the live
//    vaults.json number. This recovers the ~$2-4M that was being
//    cut off by the previous 7-day staleness rule.
//  - If the vault has zero TVL in vaults.json or is missing there,
//    treat it as ended at its last history snapshot.
//
// Vaults present in vaults.json but with no history at all contribute
// only to "today" via their live tvl.
//
// Output goes to src/data/network-tvl-daily.json. Run by `npm run
// build` before next build so the JSON is fresh.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const HISTORY_FILE = join(ROOT, "data", "history.json");
const VAULTS_FILE = join(ROOT, "data", "vaults.json");
const OUT = join(ROOT, "src", "data", "network-tvl-daily.json");

const DAY_MS = 86_400_000;

function dateKey(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function dateKeyToMs(key) {
  return new Date(key + "T00:00:00Z").getTime();
}

const history = JSON.parse(readFileSync(HISTORY_FILE, "utf8"));
const vaultsArr = JSON.parse(readFileSync(VAULTS_FILE, "utf8"));

// vaults.json -> liveTvl map keyed by lowercase address so we can
// match history.json's keys without worrying about checksum casing.
const liveTvl = new Map();
for (const v of vaultsArr) {
  const addr = (v?.id || v?.contractAddress || "").toLowerCase();
  if (!addr) continue;
  const tvl = typeof v?.tvl === "number" && v.tvl >= 0 ? v.tvl : 0;
  liveTvl.set(addr, tvl);
}

// Pass 1: per-vault bucket of history -> (UTC date -> latest value).
const perVaultBuckets = new Map();
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
  if (buckets.size > 0) perVaultBuckets.set(vault, buckets);
}

if (globalLatestMs === 0) {
  console.error("[network-tvl] no usable snapshots in history.json");
  process.exit(1);
}

// "Today" is the larger of (now, latest history snapshot day). When
// the cron has just refreshed and we're rebuilding minutes later
// these are the same; on a cold local build "now" may already be
// past the latest snapshot's UTC day.
const todayMs = Math.max(Date.now(), globalLatestMs);
const todayKey = dateKey(todayMs);
const todayKeyMs = dateKeyToMs(todayKey);

// Pass 2: forward-fill per vault. Within history range always; from
// last-history-day to today only if vaults.json says the vault is
// still alive.
const filledPerVault = new Map();
for (const [vault, buckets] of perVaultBuckets) {
  const sortedKeys = [...buckets.keys()].sort();
  const firstMs = dateKeyToMs(sortedKeys[0]);
  const lastHistMs = dateKeyToMs(sortedKeys[sortedKeys.length - 1]);
  const liveNow = liveTvl.get(vault.toLowerCase()) ?? 0;
  const alive = liveNow > 0;
  const fillEndMs = alive ? todayKeyMs : lastHistMs;

  const filled = new Map();
  let lastVal = buckets.get(sortedKeys[0]).value;
  for (let ts = firstMs; ts <= fillEndMs; ts += DAY_MS) {
    const k = dateKey(ts);
    const b = buckets.get(k);
    if (b) lastVal = b.value;
    filled.set(k, lastVal);
  }
  // Stamp today with the live vaults.json number (source of truth
  // for the most recent point - covers indexer-lag undercount).
  if (alive) filled.set(todayKey, liveNow);
  filledPerVault.set(vault, filled);
}

// Pass 2b: vaults that are alive in vaults.json but absent from
// history.json get a single "today" point from vaults.json so the
// headline number is complete.
for (const [addr, liveNow] of liveTvl) {
  if (liveNow <= 0) continue;
  // Find the matching key in perVaultBuckets (case insensitive).
  const present = [...perVaultBuckets.keys()].some(
    (k) => k.toLowerCase() === addr,
  );
  if (present) continue;
  filledPerVault.set(addr, new Map([[todayKey, liveNow]]));
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
  `[network-tvl] wrote ${series.length} daily points across ${filledPerVault.size} vaults -> ${OUT} (today=${series[series.length - 1]?.tvl})`,
);
