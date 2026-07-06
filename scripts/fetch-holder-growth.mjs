#!/usr/bin/env node
// Fetch per-vault DEPOSITOR-GROWTH data from the Harvest subgraph and write
// data/holder-growth.json (keyed by lowercased contract address).
//
// WHY: holder growth over time is a unique, factual, freshness-carrying signal
// no competitor has for our vaults - it enriches product pages (SEO + AI
// citation) with "N wallets have deposited since {launch}, M earning today,
// +K in the last 30 days" plus a cumulative curve. The product page gates it
// behind a threshold so near-empty pass-through vaults (autopilot liquidity
// channels with a couple of internal holders) never surface a thin/embarrassing
// count.
//
// Source: the same subgraph the indexer uses, entity `userBalances`
//   { userAddress, timestamp (first-seen), value (current balance), vault{id} }
// One row per (user, vault); timestamp is first-seen, value is the live balance.
//
// FILTERS (mirrors the Deposit Activity feed's intent):
//   - drop the zero address
//   - drop every AUTOPILOT vault contract (an autopilot depositing into an
//     underlying autocompounder shows up as a "holder" of it - not a real user).
//     Built dynamically from vaults.json (vaultType === "Autopilot").
//
// METRICS per vault:
//   totalDepositors   distinct real wallets that ever held (any balance)
//   currentDepositors distinct real wallets with a live balance (value > 0)
//   new30d            real wallets first seen in the last 30 days
//   launchDate        earliest first-seen timestamp (ISO date)
//   curve             cumulative distinct real depositors by first-seen month
//
// Usage:  node scripts/fetch-holder-growth.mjs [--chain=Base]
//   Chains whose userBalances aren't synced yet simply return nothing and are
//   skipped; those vaults don't render the section (same as a missing holders
//   row). Wire into update-data.yml so it refreshes hourly.

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const VAULTS_FILE = join(ROOT, "data", "vaults.json");
const OUT_FILE = join(ROOT, "data", "holder-growth.json");

const SUBGRAPH_BASE =
  process.env.SUBGRAPH_BASE_URL ||
  "https://clownfish-app-2dsdk.ondigitalocean.app";

const CHAIN_ID = {
  Ethereum: 1,
  Base: 8453,
  Arbitrum: 42161,
  Polygon: 137,
  zkSync: 324,
  HyperEVM: 999,
};

const ZERO = "0x0000000000000000000000000000000000000000";
const DAY = 86_400_000;
const PAGE = 1000;
const REQ_TIMEOUT_MS = 20_000;

const chainFilter = process.argv
  .find((a) => a.startsWith("--chain="))
  ?.split("=")[1];

const vaults = JSON.parse(readFileSync(VAULTS_FILE, "utf-8"));

// Every autopilot vault contract is a false "holder" of the autocompounders it
// allocates into - exclude them across all chains.
const EXCLUDE = new Set([ZERO]);
for (const v of vaults) {
  if (v.vaultType === "Autopilot" && v.contractAddress) {
    EXCLUDE.add(v.contractAddress.toLowerCase());
  }
}

async function gql(chainId, query) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  try {
    const r = await fetch(`${SUBGRAPH_BASE}/${chainId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: ctrl.signal,
    });
    const j = await r.json();
    if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 200));
    return j.data;
  } finally {
    clearTimeout(t);
  }
}

async function fetchBalances(chainId, vaultAddr) {
  const rows = [];
  let skip = 0;
  for (;;) {
    const q = `{ userBalances(first:${PAGE}, skip:${skip}, where:{ vault:"${vaultAddr}" }, orderBy:timestamp, orderDirection:asc) { userAddress timestamp value } }`;
    const d = await gql(chainId, q);
    const batch = d?.userBalances ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    skip += PAGE;
    if (skip > 100_000) break; // safety
  }
  return rows;
}

function metricsFor(rows) {
  const now = Date.now();
  const clean = rows.filter((x) => {
    const u = (x.userAddress || "").toLowerCase();
    return u && !EXCLUDE.has(u);
  });
  if (clean.length === 0) return null;

  const current = clean.filter((x) => Number(x.value) > 0).length;
  const cutoff = now - 30 * DAY;
  const new30d = clean.filter(
    (x) => Number(x.timestamp) * 1000 >= cutoff,
  ).length;

  // Cumulative distinct depositors by first-seen month.
  const byMonth = {};
  let launchTs = Infinity;
  for (const x of clean) {
    const ts = Number(x.timestamp);
    if (!Number.isFinite(ts)) continue;
    if (ts < launchTs) launchTs = ts;
    const m = new Date(ts * 1000).toISOString().slice(0, 7);
    byMonth[m] = (byMonth[m] || 0) + 1;
  }
  let c = 0;
  const curve = Object.keys(byMonth)
    .sort()
    .map((m) => ({ m, c: (c += byMonth[m]) }));

  return {
    totalDepositors: clean.length,
    currentDepositors: current,
    new30d,
    launchDate: Number.isFinite(launchTs)
      ? new Date(launchTs * 1000).toISOString().slice(0, 10)
      : null,
    curve,
  };
}

const out = {};
let ok = 0;
let empty = 0;
let failed = 0;
const generatedAt = new Date().toISOString();

// Skip a whole chain once its subgraph looks unsynced/unreachable, so a stuck
// chain (userBalances not synced yet) can't burn a per-request timeout on every
// one of its vaults. 3 consecutive failures on a chain => skip the rest of it.
const chainFails = new Map();
const deadChains = new Set();

for (const v of vaults) {
  if (!v.contractAddress || !v.chain) continue;
  if (chainFilter && v.chain !== chainFilter) continue;
  const chainId = CHAIN_ID[v.chain];
  if (!chainId) continue;
  if (deadChains.has(chainId)) continue;
  const addr = v.contractAddress.toLowerCase();
  try {
    const rows = await fetchBalances(chainId, addr);
    chainFails.set(chainId, 0);
    const m = metricsFor(rows);
    if (!m) {
      empty++;
      continue;
    }
    out[addr] = { chain: v.chain, ...m, generatedAt };
    ok++;
    console.log(
      `[holder-growth] ${v.productName} (${v.chain}): ${m.currentDepositors} now / ${m.totalDepositors} ever / +${m.new30d} 30d`,
    );
  } catch (e) {
    failed++;
    const n = (chainFails.get(chainId) || 0) + 1;
    chainFails.set(chainId, n);
    console.error(`[holder-growth] ${v.productName} (${v.chain}) failed: ${e.message}`);
    if (n >= 3) {
      deadChains.add(chainId);
      console.error(`[holder-growth] ${v.chain}: 3 consecutive failures, skipping the rest of this chain (subgraph likely unsynced).`);
    }
  }
}

writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
console.log(
  `[holder-growth] wrote ${OUT_FILE}: ${ok} vaults, ${empty} empty/unsynced, ${failed} failed.`,
);
