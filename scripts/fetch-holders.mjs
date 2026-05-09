#!/usr/bin/env node
// Fetches ERC-20 holder counts for every indexed vault and writes them
// to data/holders.json keyed by lowercased contract address.
//
// Source: per-chain Blockscout v2 (`/api/v2/tokens/{address}` returns a
// `holders` field as a string of the current positive-balance count).
// Chains without a public Blockscout instance (e.g. HyperEVM) are
// skipped; the missing entries simply don't render the holders row on
// the product page.

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

async function fetchHolderCount(host, address) {
  const url = `${host}/api/v2/tokens/${address}`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = data?.holders;
      if (raw == null) return null;
      const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      return Number.isFinite(n) ? n : null;
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.warn(`  ! ${address}: ${err.message}`);
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
  const count = await fetchHolderCount(host, v.contractAddress);
  if (count == null) {
    failed++;
  } else {
    out[v.contractAddress.toLowerCase()] = count;
    ok++;
  }
  await sleep(REQUEST_DELAY_MS);
}

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
console.log(`Holders: ${ok} fetched, ${skipped} skipped (no Blockscout), ${failed} failed.`);
console.log(`Wrote ${OUT_FILE}`);
