// Build data/aerodrome-yield.json for the /report/aerodrome ranking.
//
// For each Aerodrome pool Harvest runs a vault for, read the pool's REAL yield
// on-chain (emission APR via the gauge with the staked-TVL denominator + fee APR
// from swap volume), and join our first-party auto-compounded vault figures
// (apy24h / apy30d / vault TVL) from data/vaults.json by slug.
//
// The ranking metric is the objective on-chain pool yield; the Harvest vault is
// one lens (a column), disclosed as the operator of the covered pools.
//
// Usage:
//   NODE_USE_ENV_PROXY=1 node scripts/fetch-aerodrome-yield.mjs [--mean] [--fee-days N]
//   --mean       use the 30-day weekly-sampled emission mean (default: spot)
//   --fee-days N fee window in days (default 7; use a smaller value for a quick run)

import { readFileSync, writeFileSync } from "fs";
import {
  getPrices,
  aeroPoolYield,
  aeroPoolMean30d,
} from "./lib/aerodrome-onchain-adapters.mjs";

const args = process.argv.slice(2);
const USE_MEAN = args.includes("--mean");
const FEE_DAYS = (() => {
  const i = args.indexOf("--fee-days");
  return i >= 0 ? Number(args[i + 1]) : 7;
})();

const venuesDoc = JSON.parse(readFileSync("data/aerodrome-venues.json", "utf8"));
const vaultsDoc = JSON.parse(readFileSync("data/vaults.json", "utf8"));
const vaults = Array.isArray(vaultsDoc)
  ? vaultsDoc
  : vaultsDoc.vaults || Object.values(vaultsDoc);
const vaultBySlug = new Map(vaults.map((v) => [v.slug, v]));

// Holder counts per vault (data/holders.json is { vaultAddress(lowercase): count }).
let holdersMap = {};
try {
  holdersMap = JSON.parse(readFileSync("data/holders.json", "utf8"));
} catch {
  /* holders optional */
}

const now = Math.floor(Date.now() / 1000);

async function main() {
  const px = await getPrices();
  console.error(
    `[aero] prices ETH $${px.eth.toFixed(0)} BTC $${px.btc.toFixed(0)} AERO $${px.aero.toFixed(4)} | mode=${USE_MEAN ? "30d-mean" : "spot"} feeDays=${FEE_DAYS}`,
  );

  const rows = [];
  for (const v of venuesDoc.venues) {
    const vault = vaultBySlug.get(v.slug) || {};
    try {
      const y = USE_MEAN
        ? await aeroPoolMean30d({ pool: v.pool, px, now, feeWindowDays: FEE_DAYS })
        : await aeroPoolYield({ pool: v.pool, px, feeWindowDays: FEE_DAYS });
      if (y.error) {
        console.error(`[aero] ${v.slug}: ${y.error} (${y.pair})`);
        rows.push({ slug: v.slug, pool: v.pool, error: y.error });
        continue;
      }
      const row = {
        slug: v.slug,
        productName: v.productName,
        asset: v.asset,
        pool: v.pool,
        vaultAddress: v.vaultAddress,
        gauge: y.gauge,
        pair: y.pair,
        token0: y.s0,
        token1: y.s1,
        pairType: y.pairType, // "volatile" | "correlated"
        stable: y.stable,
        // On-chain pool reality (the ranked metric)
        poolTvlUsd: y.tvlUsd,
        stakedPct: y.stakedPct != null ? Number(y.stakedPct.toFixed(4)) : null,
        emissionApr: Number(y.emissionApr.toFixed(3)),
        feeApr: Number(y.feeApr.toFixed(3)),
        realApy: Number((y.emissionApr + y.feeApr).toFixed(3)),
        emissionSpot: y.emissionSpot != null ? Number(y.emissionSpot.toFixed(3)) : undefined,
        // Trailing average daily swap volume (USD), from the fee-window logs.
        volumeUsdDay: y.volumeUsdDay != null ? Math.round(y.volumeUsdDay) : null,
        // Harvest lens (first-party, auto-compounded)
        harvestApy24h: vault.apy24h ?? null,
        harvestApy30d: vault.apy30d ?? null,
        harvestTvlUsd: vault.tvl != null ? Math.round(vault.tvl) : null,
        holders: holdersMap[(v.vaultAddress || "").toLowerCase()] ?? null,
        rateBasis: USE_MEAN ? "30d" : "spot",
      };
      rows.push(row);
      console.error(
        `[aero] ${v.slug.padEnd(30)} ${row.pair.padEnd(14)} pool$${(row.poolTvlUsd / 1e6).toFixed(2)}M em=${row.emissionApr}% fee=${row.feeApr}% real=${row.realApy}% | harvest30d=${row.harvestApy30d?.toFixed?.(1)}%`,
      );
    } catch (e) {
      console.error(`[aero] ${v.slug}: ERROR ${e.message}`);
      rows.push({ slug: v.slug, pool: v.pool, error: e.message });
    }
  }

  rows.sort((a, b) => (b.realApy ?? -1) - (a.realApy ?? -1));

  const out = {
    generatedAt: new Date(now * 1000).toISOString(),
    chain: "base",
    protocol: "Aerodrome",
    source: "on-chain reads (Base): Aerodrome gauge emissions + swap-fee volume, priced via Chainlink; Harvest vault figures are first-party",
    prices: { eth: px.eth, btc: px.btc, aero: px.aero },
    poolCount: rows.filter((r) => !r.error).length,
    pools: rows,
  };
  writeFileSync("data/aerodrome-yield.json", JSON.stringify(out, null, 2) + "\n");
  console.error(`\n[aero] wrote data/aerodrome-yield.json (${out.poolCount} pools)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
