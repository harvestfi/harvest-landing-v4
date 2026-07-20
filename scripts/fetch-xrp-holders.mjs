#!/usr/bin/env node
// Holder-count + concentration fetcher for /report/xrp-yield-ranking.
//
// WHY: TVL and APY say how much money and what rate; holder counts say how many
// wallets actually hold a product — a popularity / adoption signal, and (with
// the top-holder split) a read on whether a product is retail-broad or a single
// whale parked in it. No aggregator serves this for these tokens (Portals'
// holders endpoint returns empty for them), so we read each product's ERC-20
// receipt/LP/PT token directly from the chain's Blockscout v2 API:
//   /api/v2/tokens/{addr}          -> holders_count, total_supply
//   /api/v2/tokens/{addr}/holders  -> top holders (value desc) for concentration
//
// The holder-bearing token per product was resolved and verified once (symbol
// matches the product) and pinned here — all 14 tracked products: vault/receipt
// tokens for the vaults and lending markets (Kinetic's isoFXRP, Moonwell's
// mcbXRP, Upshift/Superform vault shares), PT and LP tokens for Spectra, and the
// raw vAMM LP tokens for the Aerodrome pools.
// Results are written into data/xrp-yield.json as pool.holders; the page ranks
// by count and renders the concentration read. Needs open network to the
// explorers (Flare + Base Blockscout). In the sandbox, run with
// NODE_USE_ENV_PROXY=1 so Node's fetch honours the agent proxy.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, "data", "xrp-yield.json");

const BLOCKSCOUT = {
  Flare: "https://flare-explorer.flare.network",
  Base: "https://base.blockscout.com",
};

// slug -> the ERC-20 token whose holders represent this product's users.
// Verified against the token symbol on the explorer at resolution time.
const HOLDER_TOKEN = {
  "upshift-earnxrp": "0xe533e447fd7720b2f8654da2b1953efa06b60bfa", // earnXRP vault
  "upshift-mxrpy": "0x36f236af59cb279bab884e464ef1bc23c7b1a115", // MXRPY vault
  "superform-bizfxrp": "0x34f90dfa0f1b2f691ee3a3a87954f8d282193c16", // bizFXRP vault
  "spectra-pt-aug-2026": "0x91bada8de2119aaab49bf1d5e3daafd707b088a6", // PT token
  "spectra-pt-nov-2026": "0xa7cb1fa9aab0157f0380b29e48dfe2b305171181", // PT token
  "spectra-pool-aug-2026": "0x22ebdb0a469a9f7ba4a287ea3c1c420762d98db9", // LP token
  "spectra-pool-nov-2026": "0x966d1f376457a3aca5fbc2a6be985f6e5e7708eb", // LP token
  "spectra-metavault-fxrp": "0x6420a613e936602ca3f1ad5680b3f4d47d473bf1", // Gami Labs MetaVault token (user-provided)
  "kinetic-fxrp": "0xd1b7a5efa9bd88f291f7a4563a8f6185c0249cb3", // isoFXRP lending receipt (Kinetic docs)
  "mystic-vault": "0x53184adabf312b490bf1ebcfdc896feff6019a14", // csXRP vault
  "sparkdex-stxrp-fxrp": "0x46a8e5d76a34b75a199acbf318e0e5ccc65fc6eb", // SparkDEX LP
  "moonwell-cbxrp": "0xb4fb8fed5b3aaa8434f0b19b1b623d977e07e86d", // mcbXRP (Base)
  "aerodrome-cbxrp-weth": "0x84080a26f978d7c402c2786ad8bf1fe6712d209b", // vAMM LP (Base)
  "aerodrome-cbxrp-cbbtc": "0x5591c94d9826fb84a136e31ad249362a3bd709ce", // vAMM LP (Base)
};

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { accept: "application/json" },
      });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      console.error(`[xrp-holders] ${url} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[xrp-holders] ${url} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return null;
}

function holderCount(tok) {
  for (const k of ["holders_count", "holders"]) {
    const v = tok?.[k];
    if (v != null && Number.isFinite(+v)) return +v;
  }
  return null;
}

// Concentration from the top holders: share of total supply held by the #1
// wallet and by the top 10. Uses BigInt so 18-decimal balances don't lose
// precision; falls back to null when supply is unavailable.
function concentration(items, totalSupply) {
  if (!Array.isArray(items) || !items.length || !totalSupply) return {};
  let supply;
  try {
    supply = BigInt(totalSupply);
  } catch {
    return {};
  }
  if (supply <= 0n) return {};
  const vals = items
    .map((h) => {
      try {
        return BigInt(h.value);
      } catch {
        return 0n;
      }
    })
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const pctOf = (x) => Math.round(Number((x * 10000n) / supply)) / 100;
  const top1 = vals[0] ?? 0n;
  const top10 = vals.slice(0, 10).reduce((s, v) => s + v, 0n);
  const top1Pct = pctOf(top1);
  const top10Pct = pctOf(top10);
  // Some LP/receipt tokens report a total_supply that is inconsistent with the
  // sum of holder balances (burned minimum-liquidity, un-synced supply), which
  // makes the share exceed 100%. Rather than show a nonsense figure, drop the
  // concentration for those and let the page fall back to holder count only.
  if (top1Pct > 100 || top10Pct > 105) return {};
  return { top1Pct, top10Pct: Math.min(top10Pct, 100) };
}

const data = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
const pools = Array.isArray(data.pools) ? data.pools : [];
const asOf = new Date().toISOString();

let ok = 0;
for (const p of pools) {
  const addr = HOLDER_TOKEN[p.venueSlug];
  const host = BLOCKSCOUT[p.chain];
  if (!addr || !host) continue;
  const tok = await getJson(`${host}/api/v2/tokens/${addr}`);
  const count = holderCount(tok);
  if (count == null) {
    console.error(`[xrp-holders] ${p.venueSlug}: no holder count`);
    continue;
  }
  const holdersDoc = await getJson(`${host}/api/v2/tokens/${addr}/holders`);
  const conc = concentration(holdersDoc?.items, tok?.total_supply);
  p.holders = {
    count,
    token: addr,
    symbol: tok?.symbol ?? null,
    ...conc,
    asOf,
  };
  console.log(
    `[xrp-holders] ${String(p.venueSlug).padEnd(24)} ${String(count).padStart(6)} holders  top1=${conc.top1Pct ?? "—"}%  top10=${conc.top10Pct ?? "—"}%`,
  );
  ok++;
  await new Promise((res) => setTimeout(res, 250));
}

writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`[xrp-holders] wrote holder data for ${ok}/${pools.length} products (as of ${asOf.slice(0, 10)})`);
