// Machine-readable export for /report/aerodrome, for AI crawlers and analysts.
// Writes the current on-chain snapshot in two shapes:
//   public/data/aerodrome/index.json - the whole snapshot in one fetch
//   public/data/aerodrome/pools.csv  - one flat row per pool
// No history yet (the report is a live snapshot); when a history series exists
// this is where per-pool time series would be added.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "data", "aerodrome-yield.json");
const OUT_DIR = join(process.cwd(), "public", "data", "aerodrome");

if (!existsSync(SRC)) {
  console.log("[aerodrome-export] no data/aerodrome-yield.json, skipping");
  process.exit(0);
}

const data = JSON.parse(readFileSync(SRC, "utf-8"));
const pools = (data.pools || []).filter((p) => !p.error);
mkdirSync(OUT_DIR, { recursive: true });

// Optional first-party TVL history (aggregate footprint over time), if the
// prebuild aggregator produced it.
const HIST = join(process.cwd(), "data", "aerodrome-history.json");
let history = null;
if (existsSync(HIST)) {
  try {
    const h = JSON.parse(readFileSync(HIST, "utf-8"));
    if (Array.isArray(h.series) && h.series.length >= 2) {
      history = { latestTvl: h.latestTvl, series: h.series, perPool: h.perPool };
    }
  } catch {
    history = null;
  }
}

// index.json - the snapshot as published.
writeFileSync(
  join(OUT_DIR, "index.json"),
  JSON.stringify(
    {
      generatedAt: data.generatedAt,
      chain: data.chain,
      protocol: data.protocol,
      source: data.source,
      license: "CC-BY-4.0",
      poolCount: pools.length,
      pools,
      ...(history ? { tvlHistory: history } : {}),
    },
    null,
    2,
  ) + "\n",
  "utf-8",
);

// pools.csv - one flat row per pool.
const cols = [
  "slug",
  "pair",
  "pair_type",
  "pool_tvl_usd",
  "emission_apr_pct",
  "fee_apr_pct",
  "pool_apr_pct",
  "harvest_apy30d_pct",
  "volume_usd_day",
  "holders",
  "staked_pct",
  "pool_address",
  "gauge_address",
  "vault_address",
];
const esc = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const lines = [cols.join(",")];
for (const p of pools) {
  lines.push(
    [
      p.slug,
      p.pair,
      p.pairType,
      p.poolTvlUsd,
      p.emissionApr,
      p.feeApr,
      p.realApy,
      p.harvestApy30d,
      p.volumeUsdDay ?? "",
      p.holders ?? "",
      p.stakedPct != null ? (p.stakedPct * 100).toFixed(1) : "",
      p.pool,
      p.gauge ?? "",
      p.vaultAddress ?? "",
    ]
      .map(esc)
      .join(","),
  );
}
writeFileSync(join(OUT_DIR, "pools.csv"), lines.join("\n") + "\n", "utf-8");

console.log(`[aerodrome-export] wrote index.json + pools.csv (${pools.length} pools)`);
