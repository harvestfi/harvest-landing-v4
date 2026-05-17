#!/usr/bin/env node
// Vault event indexer. Polls one chain's vaults forward-only from a
// per-vault cursor in Supabase, decodes ERC-20 Transfer logs on each
// vault contract, labels each as deposit (mint, from=0x0), withdraw
// (burn, to=0x0), or transfer (user-to-user, rare for vault tokens),
// and upserts into vault_events_prod.
//
// Runs once per GitHub Actions cron tick, scoped to one chain via
// --chain=<name>. Each chain is its own matrix job so they run in
// parallel and don't block each other on a slow RPC.
//
// Usage:
//   node scripts/index-vault-events.mjs --chain=Base
//
// Env:
//   SUPABASE_URL                Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY   Service role key (bypasses RLS for writes)
//   RPC_<CHAIN>                 Optional comma-separated RPC fallback
//                               list, e.g. RPC_BASE="https://...,https://..."
//                               Defaults to free public RPCs.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_TOPIC = "0x" + "00".repeat(32);

// How many blocks to scan in a single eth_getLogs call. Public RPCs
// typically cap at 5-10k blocks; we stay conservative.
const MAX_BLOCK_CHUNK = 4000;

// On a vault's first ever scan we start from this many blocks back,
// not from genesis. Keeps the first run cheap; old events stay
// missing until someone explicitly backfills (out of scope here).
const FIRST_RUN_LOOKBACK_BLOCKS = 1000;

// Spacing between RPC calls in the same job so we don't hammer the
// free public endpoints. ~5 req/sec.
const RPC_THROTTLE_MS = 200;

// Cap total events written per run so a single huge backlog doesn't
// blow out Supabase quota. The cursor still advances normally; the
// remaining events get caught up on the next cron tick.
const MAX_EVENTS_PER_RUN = 5000;

const RPC_DEFAULTS = {
  Ethereum: [
    "https://ethereum-rpc.publicnode.com",
    "https://rpc.ankr.com/eth",
    "https://cloudflare-eth.com",
  ],
  Base: [
    "https://base-rpc.publicnode.com",
    "https://mainnet.base.org",
    "https://base.llamarpc.com",
  ],
  Polygon: [
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon-rpc.com",
    "https://rpc.ankr.com/polygon",
  ],
  Arbitrum: [
    "https://arbitrum-one-rpc.publicnode.com",
    "https://arb1.arbitrum.io/rpc",
    "https://rpc.ankr.com/arbitrum",
  ],
  HyperEVM: ["https://rpc.hyperliquid.xyz/evm"],
  zkSync: ["https://mainnet.era.zksync.io"],
};

// ──────────────────────────────────────────────────────────────────
// Args + env
// ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const args = parseArgs();
const CHAIN = args.chain;
if (!CHAIN) {
  console.error("missing --chain=<name>");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
  );
  process.exit(1);
}

const envKey = `RPC_${CHAIN.toUpperCase()}`;
const RPC_URLS = (
  process.env[envKey] && process.env[envKey].length > 0
    ? process.env[envKey].split(",").map((s) => s.trim())
    : RPC_DEFAULTS[CHAIN] ?? []
).filter(Boolean);
if (RPC_URLS.length === 0) {
  console.error(`no RPC URLs configured for chain ${CHAIN}`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────
// Tiny helpers
// ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function topicToAddress(topic) {
  // Topic is 32 bytes; address is the last 20.
  return "0x" + topic.slice(-40).toLowerCase();
}

function hexToBigInt(h) {
  return BigInt(h);
}

let rpcIndex = 0;
async function rpcCall(method, params) {
  // Round-robin through configured RPC URLs on transient errors.
  let lastErr;
  for (let attempt = 0; attempt < RPC_URLS.length * 2; attempt++) {
    const url = RPC_URLS[rpcIndex % RPC_URLS.length];
    rpcIndex++;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
      });
      if (!r.ok) {
        lastErr = new Error(`HTTP ${r.status} from ${url}`);
        continue;
      }
      const j = await r.json();
      if (j.error) {
        lastErr = new Error(`RPC error ${j.error.code} ${j.error.message}`);
        continue;
      }
      await sleep(RPC_THROTTLE_MS);
      return j.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("all RPCs failed");
}

async function supabase(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Supabase ${path}: ${r.status} ${body}`);
  }
  if (opts.method === "POST" || opts.method === "PATCH") {
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }
  return r.json();
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

async function main() {
  const vaultsAll = JSON.parse(
    readFileSync(join(process.cwd(), "data", "vaults.json"), "utf8"),
  );
  const vaults = vaultsAll.filter((v) => v.chain === CHAIN);
  console.log(`[${CHAIN}] ${vaults.length} vaults to scan`);

  if (vaults.length === 0) return;

  // Load all cursors for this chain in one query.
  const cursorRows = await supabase(
    `vault_event_cursors?chain=eq.${encodeURIComponent(CHAIN)}&select=vault_address,last_block`,
  );
  const cursors = new Map();
  for (const c of cursorRows) {
    cursors.set(c.vault_address.toLowerCase(), Number(c.last_block));
  }

  const latestBlockHex = await rpcCall("eth_blockNumber", []);
  const latestBlock = Number(hexToBigInt(latestBlockHex));
  console.log(`[${CHAIN}] latest block ${latestBlock}`);

  // Block-timestamp cache so we don't refetch the same block once
  // per event when many events share a block.
  const blockTsCache = new Map();
  async function blockTimestamp(blockNumber) {
    if (blockTsCache.has(blockNumber)) return blockTsCache.get(blockNumber);
    const blk = await rpcCall("eth_getBlockByNumber", [
      "0x" + blockNumber.toString(16),
      false,
    ]);
    const ts = Number(hexToBigInt(blk.timestamp));
    blockTsCache.set(blockNumber, ts);
    return ts;
  }

  let totalWritten = 0;

  for (const vault of vaults) {
    if (totalWritten >= MAX_EVENTS_PER_RUN) {
      console.log(
        `[${CHAIN}] hit MAX_EVENTS_PER_RUN; remaining vaults deferred to next run`,
      );
      break;
    }
    const addr = (vault.id || vault.contractAddress || "").toLowerCase();
    if (!addr) continue;

    const cursorBlock = cursors.get(addr);
    const fromBlock =
      cursorBlock !== undefined
        ? cursorBlock + 1
        : Math.max(0, latestBlock - FIRST_RUN_LOOKBACK_BLOCKS);
    if (fromBlock > latestBlock) continue;

    let scanned = 0;
    let written = 0;

    for (
      let start = fromBlock;
      start <= latestBlock;
      start += MAX_BLOCK_CHUNK
    ) {
      const end = Math.min(start + MAX_BLOCK_CHUNK - 1, latestBlock);
      let logs;
      try {
        logs = await rpcCall("eth_getLogs", [
          {
            address: addr,
            fromBlock: "0x" + start.toString(16),
            toBlock: "0x" + end.toString(16),
            topics: [TRANSFER_TOPIC],
          },
        ]);
      } catch (e) {
        console.warn(
          `[${CHAIN}] ${vault.slug} blocks ${start}-${end} failed: ${e.message}`,
        );
        // Don't advance cursor past a failed chunk; next run retries.
        break;
      }
      scanned += end - start + 1;

      if (logs.length > 0) {
        // Decode and label.
        const rows = [];
        for (const log of logs) {
          if (!log.topics || log.topics.length < 3) continue;
          const fromAddr = topicToAddress(log.topics[1]);
          const toAddr = topicToAddress(log.topics[2]);
          let event_type;
          let wallet_address;
          if (fromAddr === ZERO_ADDRESS) {
            event_type = "deposit";
            wallet_address = toAddr;
          } else if (toAddr === ZERO_ADDRESS) {
            event_type = "withdraw";
            wallet_address = fromAddr;
          } else {
            event_type = "transfer";
            wallet_address = fromAddr; // sender
          }
          const blockNumber = Number(hexToBigInt(log.blockNumber));
          const ts = await blockTimestamp(blockNumber);
          rows.push({
            chain: CHAIN,
            vault_address: addr,
            vault_slug: vault.slug ?? null,
            tx_hash: log.transactionHash,
            log_index: Number(hexToBigInt(log.logIndex)),
            block_number: blockNumber,
            block_timestamp: new Date(ts * 1000).toISOString(),
            event_type,
            wallet_address,
            amount_shares: hexToBigInt(log.data).toString(),
          });
        }

        if (rows.length > 0) {
          // Upsert ignoring duplicates (on conflict tx_hash + log_index).
          await supabase("vault_events_prod", {
            method: "POST",
            headers: { Prefer: "resolution=ignore-duplicates" },
            body: JSON.stringify(rows),
          });
          written += rows.length;
          totalWritten += rows.length;
        }
      }

      // Advance cursor after each successful chunk so a later failure
      // doesn't lose progress.
      await supabase("vault_event_cursors?on_conflict=chain,vault_address", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({
          chain: CHAIN,
          vault_address: addr,
          last_block: end,
          updated_at: new Date().toISOString(),
        }),
      });

      if (totalWritten >= MAX_EVENTS_PER_RUN) break;
    }

    if (written > 0 || scanned > 0) {
      console.log(
        `[${CHAIN}] ${vault.slug ?? addr}: scanned ${scanned} blocks, wrote ${written} events`,
      );
    }
  }

  console.log(`[${CHAIN}] done. total events written: ${totalWritten}`);
}

main().catch((e) => {
  console.error(`[${CHAIN}] fatal:`, e);
  process.exit(1);
});
