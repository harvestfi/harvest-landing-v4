#!/usr/bin/env node
// One-off: attach a daily rate `history` to the curated ranking rows in the
// EXISTING data/xrp-yield.json snapshot, from cached DeFiLlama charts, without
// refetching the whole ranking (so current rows/rates are preserved). Use after
// wiring the report's per-venue charts so the committed snapshot has history
// right away, ahead of the hourly cron.
//
// Node's fetch ignores HTTPS_PROXY, and yields.llama.fi is proxied in dev, so
// point LLAMA_CHART_CACHE at a dir holding chart-<poolId>.json files curled in
// beforehand (one per curated, DeFiLlama-tracked row).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, "data", "xrp-yield.json");
const CACHE = process.env.LLAMA_CHART_CACHE;
if (!CACHE) {
  console.error("[xrp-history] set LLAMA_CHART_CACHE=<dir with chart-<id>.json>");
  process.exit(1);
}

function dailySeries(rows, capDays = 90) {
  const byDay = new Map();
  for (const r of rows || []) {
    if (!r || !Number.isFinite(r.apy)) continue;
    byDay.set(String(r.timestamp).slice(0, 10), Math.round(r.apy * 100) / 100);
  }
  return [...byDay.entries()]
    .map(([d, apy]) => ({ d, apy }))
    .sort((a, b) => (a.d < b.d ? -1 : 1))
    .slice(-capDays);
}

const data = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
let attached = 0;
for (const p of data.pools) {
  // Only DeFiLlama-tracked curated rows (Spectra PTs already carry history).
  if (!p.curated || p.id.startsWith("spectra-pt-")) continue;
  const f = join(CACHE, `chart-${p.id}.json`);
  if (!existsSync(f)) continue;
  try {
    const chart = JSON.parse(readFileSync(f, "utf-8"));
    const rows = chart?.data;
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const first = rows[0]?.timestamp;
    if (first && !p.inception) p.inception = String(first).slice(0, 10);
    const tail = rows.slice(-90).map((r) => r.apy).filter((v) => Number.isFinite(v));
    if (tail.length >= 7) {
      p.range90d = {
        min: Math.round(Math.min(...tail) * 100) / 100,
        max: Math.round(Math.max(...tail) * 100) / 100,
      };
    }
    const hist = dailySeries(rows);
    if (hist.length >= 2) {
      p.history = hist;
      attached++;
    }
  } catch {
    /* skip unreadable cache file */
  }
}

writeFileSync(OUT_FILE, JSON.stringify(data, null, 2), "utf-8");
console.log(`[xrp-history] attached daily history to ${attached} curated row(s) -> data/xrp-yield.json`);
