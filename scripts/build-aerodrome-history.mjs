#!/usr/bin/env node
// Landscape history aggregator for /report/aerodrome.
//
// WHY: the Aerodrome report is otherwise a single live snapshot. This adds the
// one thing it lacked versus the XRP report: a time series. It stitches a single
// honest "Harvest liquidity on Aerodrome over time" line from FIRST-PARTY data
// already in the repo (data/history.json, the same source the per-vault history
// CSVs are built from), so nothing is fetched at build time and no on-chain
// backfill is needed.
//
// It writes data/aerodrome-history.json with:
//   - series:  daily total Harvest vault TVL summed across the covered pools
//              (each pool forward-filled within its own indexed span so a missing
//              day never drops it out of the total), for the page's growth chart.
//   - perPool: since-inception compounded growth per pool, read from the vault
//              share price (last / first - 1), which is the realized, fee-net
//              return a deposit has actually earned.
//   - summary: latest total, the value ~1 year earlier, and the best compounder.
//
// Runs as a PREBUILD step (before `next build`) so the RSC page can read it;
// data/history.json is refreshed by the main data pipeline, so the series stays
// current without a dedicated fetch here.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const YIELD_FILE = join(ROOT, "data", "aerodrome-yield.json");
const HISTORY_FILE = join(ROOT, "data", "history.json");
const OUT_FILE = join(ROOT, "data", "aerodrome-history.json");

if (!existsSync(YIELD_FILE) || !existsSync(HISTORY_FILE)) {
  console.log("[aerodrome-history] missing aerodrome-yield.json or history.json; skipping");
  process.exit(0);
}

const yieldData = JSON.parse(readFileSync(YIELD_FILE, "utf-8"));
const history = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));
const pools = (yieldData.pools || []).filter((p) => !p.error && p.vaultAddress);

const utcDay = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

// Case-insensitive lookup of a vault's history block.
function histFor(addr) {
  const lc = String(addr || "").toLowerCase();
  for (const k of Object.keys(history)) {
    if (k.toLowerCase() === lc) return history[k];
  }
  return null;
}

// Latest reading per UTC day for one field, as Map<day, number>.
function dailyLatest(points, field) {
  const byDay = new Map(); // day -> { ts, value }
  for (const p of points || []) {
    const v = p[field];
    if (!Number.isFinite(v)) continue;
    const day = utcDay(p.timestamp);
    const cur = byDay.get(day);
    if (!cur || p.timestamp > cur.ts) byDay.set(day, { ts: p.timestamp, value: v });
  }
  const out = new Map();
  for (const [day, { value }] of byDay) out.set(day, value);
  return out;
}

// Per-pool daily TVL maps and their [firstDay, lastDay] spans.
const perPoolTvl = [];
const perPool = [];
const allDays = new Set();

for (const p of pools) {
  const h = histFor(p.vaultAddress);
  if (!h) continue;

  const tvlMap = dailyLatest(h.tvlHistory, "value");
  if (tvlMap.size >= 2) {
    const days = [...tvlMap.keys()].sort();
    perPoolTvl.push({ slug: p.slug, tvlMap, first: days[0], last: days[days.length - 1] });
    for (const d of days) allDays.add(d);
  }

  // Since-inception compounded growth from the vault share price.
  const spPts = (h.sharePriceHistory || [])
    .filter((x) => Number.isFinite(x.sharePrice) && x.sharePrice > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (spPts.length >= 2) {
    const first = spPts[0];
    const last = spPts[spPts.length - 1];
    const growthPct = (last.sharePrice / first.sharePrice - 1) * 100;
    const days = Math.max(1, Math.round((last.timestamp - first.timestamp) / 86_400));
    perPool.push({
      slug: p.slug,
      pair: p.pair,
      firstDate: utcDay(first.timestamp),
      days,
      growthPct: Math.round(growthPct * 100) / 100,
      annualizedPct: Math.round((growthPct / days) * 365 * 100) / 100,
    });
  }
}

// Aggregate daily total: forward-fill each pool within its own span so a gap
// day carries the last known value rather than dropping the pool from the sum.
const sortedDays = [...allDays].sort();
const series = [];
for (const day of sortedDays) {
  let total = 0;
  let contributors = 0;
  for (const pool of perPoolTvl) {
    if (day < pool.first || day > pool.last) continue;
    // last known value on or before `day`
    let v = pool.carry;
    if (pool.tvlMap.has(day)) {
      v = pool.tvlMap.get(day);
      pool.carry = v;
    }
    if (Number.isFinite(v)) {
      total += v;
      contributors++;
    }
  }
  if (contributors > 0) series.push({ d: day, tvl: Math.round(total), n: contributors });
}

// Summary: latest total, value ~1 year earlier (nearest prior day), best compounder.
const latest = series[series.length - 1] ?? null;
let yearAgo = null;
if (latest) {
  const target = new Date(`${latest.d}T00:00:00Z`);
  target.setUTCFullYear(target.getUTCFullYear() - 1);
  const targetStr = target.toISOString().slice(0, 10);
  for (const pt of series) {
    if (pt.d <= targetStr) yearAgo = pt;
    else break;
  }
}
perPool.sort((a, b) => b.growthPct - a.growthPct);

const out = {
  generatedAt: yieldData.generatedAt,
  chain: yieldData.chain,
  protocol: yieldData.protocol,
  source:
    "First-party Harvest vault history (TVL and share price), aggregated across the covered Aerodrome pools",
  poolsWithHistory: perPoolTvl.length,
  latestTvl: latest?.tvl ?? null,
  latestDate: latest?.d ?? null,
  tvlOneYearAgo: yearAgo?.tvl ?? null,
  series: series.map(({ d, tvl }) => ({ d, tvl })),
  perPool,
};

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n", "utf-8");
console.log(
  `[aerodrome-history] wrote ${series.length} daily points from ${perPoolTvl.length} pools ` +
    `(latest ${latest ? "$" + latest.tvl.toLocaleString("en-US") : "n/a"})`,
);
