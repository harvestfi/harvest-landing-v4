#!/usr/bin/env node
// Fetches ERC-20 holder counts for every indexed vault and writes them
// to data/holders.json keyed by lowercased contract address.
//
// Source: per-chain Blockscout v2 (`/api/v2/tokens/{address}` returns
// the count under either `holders_count` or `holders` depending on the
// instance version, so we read both). Chains without a public
// Blockscout instance (e.g. HyperEVM) are skipped; the missing entries
// simply don't render the holders row on the product page.

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const VAULTS_FILE = join(process.cwd(), "data", "vaults.json");
const OUT_FILE = join(process.cwd(), "data", "holders.json");

const BLOCKSCOUT_HOSTS = {
  Ethereum: "https://eth.blockscout.com",
  Base: "https://base.blockscout.com",
  Arbitrum: "https://arbitrum.blockscout.com",
  Polygon: "https://polygon.blockscout.com",
  zkSync: "https://zksync.blockscout.com",
};

const REQUEST_DELAY_MS = 250;
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let firstFailureLogged = false;

function readCount(data) {
  // Blockscout >=6.x returns `holders_count` (string); older instances
  // expose it as `holders`. Fall through both before declaring a miss.
  for (const key of ["holders_count", "holders"]) {
    const raw = data?.[key];
    if (raw == null || raw === "") continue;
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

async function fetchHolderCount(host, address, label) {
  const url = `${host}/api/v2/tokens/${address}`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.status === 404) {
        console.warn(`  ! ${label}: 404 ${url}`);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const n = readCount(data);
      if (n == null && !firstFailureLogged) {
        firstFailureLogged = true;
        console.warn(
          `  ! ${label}: response had no holders/holders_count. Sample keys: ${Object.keys(data ?? {}).join(", ")}`,
        );
      }
      return n;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.warn(`  ! ${label}: ${err.message}`);
        return null;
      }
      await sleep(500 * attempt);
    }
  }
  return null;
}

const vaults = JSON.parse(readFileSync(VAULTS_FILE, "utf-8"));
const out = {};
let ok = 0;
let skipped = 0;
let failed = 0;

for (const v of vaults) {
  const host = BLOCKSCOUT_HOSTS[v.chain];
  if (!host || !v.contractAddress) {
    skipped++;
    continue;
  }
  const label = `${v.productName} [${v.chain}]`;
  const count = await fetchHolderCount(host, v.contractAddress, label);
  if (count == null) {
    failed++;
  } else {
    out[v.contractAddress.toLowerCase()] = count;
    console.log(`  ok ${label}: ${count}`);
    ok++;
  }
  await sleep(REQUEST_DELAY_MS);
}

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
console.log(`Holders: ${ok} fetched, ${skipped} skipped (no Blockscout), ${failed} failed.`);
console.log(`Wrote ${OUT_FILE}`);
