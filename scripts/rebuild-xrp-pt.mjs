#!/usr/bin/env node
// One-off: merge Spectra Principal Token rows into the existing
// data/xrp-yield.json snapshot and recompute stats, without re-fetching the
// DeFiLlama pools. Idempotent (drops any prior spectra-pt-* rows first).
//
// Node's fetch ignores HTTPS_PROXY, so run with SPECTRA_CACHE pointing at a dir
// of curl-fetched pt-<addr>.json / pt-<addr>-chart.json files, e.g.:
//   SPECTRA_CACHE=/path/to/cache node scripts/rebuild-xrp-pt.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchSpectraPTs } from "./fetch-spectra-pt.mjs";

const OUT = join(process.cwd(), "data", "xrp-yield.json");
const data = JSON.parse(readFileSync(OUT, "utf-8"));

data.pools = data.pools.filter((p) => !String(p.id).startsWith("spectra-pt-"));
const pts = await fetchSpectraPTs();
data.pools.push(...pts);
data.pools.sort((a, b) => (b.apyMean30d ?? b.apy ?? 0) - (a.apyMean30d ?? a.apy ?? 0));

const apys = data.pools.map((p) => p.apyMean30d ?? p.apy ?? 0).sort((a, b) => a - b);
data.stats.venues = data.pools.length;
data.stats.chains = [...new Set(data.pools.map((p) => p.chain))];
data.stats.totalTvlUsd = Math.round(data.pools.reduce((s, p) => s + p.tvlUsd, 0));
data.stats.medianApy = Math.round((apys[Math.floor(apys.length / 2)] ?? 0) * 100) / 100;
data.stats.incentivized = data.pools.filter((p) => p.incentivized).length;

writeFileSync(OUT, JSON.stringify(data, null, 2), "utf-8");
console.log(`[xrp-pt] merged ${pts.length} PT row(s); total ${data.pools.length} pools -> data/xrp-yield.json`);
for (const p of pts) console.log(`  - ${p.displayName} | ${p.apy}% | ${Math.round(p.tvlUsd / 1000)}k | 90d ${p.range90d ? p.range90d.min + "-" + p.range90d.max : "n/a"}`);
