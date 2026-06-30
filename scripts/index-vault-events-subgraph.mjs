#!/usr/bin/env node
// Subgraph-backed indexer for Harvest vault + plasma-vault user
// transactions. Replaces (or runs alongside) the RPC-driven
// scripts/index-vault-events.mjs by pulling pre-decoded deposit /
// withdraw rows from the Harvest subgraph and upserting them into
// the same vault_events_prod table the admin Deposits (TVL) page
// already reads.
//
// Endpoint pattern (one subgraph per chain):
//   https://clownfish-app-2dsdk.ondigitalocean.app/{chainId}
//
// The six chain IDs match the networks Harvest currently indexes:
//   1     Ethereum
//   8453  Base
//   42161 Arbitrum
//   137   Polygon
//   324   zkSync
//   999   HyperEVM
//
// On first run per chain we back-fill the trailing 30 days; every
// subsequent run resumes forward-only from the latest indexed
// block_timestamp in vault_events_prod, with a 60-second guard so
// any rows that landed between query and write are picked up on the
// next tick.
//
// Usage:
//   node scripts/index-vault-events-subgraph.mjs               # all six chains
//   node scripts/index-vault-events-subgraph.mjs --chain=Base  # one chain
//   node scripts/index-vault-events-subgraph.mjs --probe       # log schema, no writes
//
// Env:
//   SUPABASE_URL                Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY   Service role key (bypasses RLS)
//   SUBGRAPH_BASE_URL           Override the default endpoint (optional)

const DEFAULT_SUBGRAPH_BASE =
  "https://clownfish-app-2dsdk.ondigitalocean.app";

const CHAINS = [
  { name: "Ethereum", chainId: 1 },
  { name: "Base", chainId: 8453 },
  { name: "Arbitrum", chainId: 42161 },
  { name: "Polygon", chainId: 137 },
  { name: "zkSync", chainId: 324 },
  { name: "HyperEVM", chainId: 999 },
];

const PAGE_SIZE = 1000;
// First-run backfill depth. 730d (~2y) reaches the inception of essentially
// every product we index, so the Deposit Activity feed can show deep history
// (well before 1 Jan 2026). Bounded per run by MAX_PAGES_PER_RUN below.
const BACKFILL_DAYS = 730;
// Incremental re-scan window. Each run resumes at (latest written timestamp -
// RESCAN_DAYS), NOT at latest-60s. Reason: the hosted subgraphs index events
// with LAG and out of order - an event can appear in the subgraph hours or
// days after its block timestamp, by which point a 60s guard has already let
// `since` advance past it, orphaning it forever (this is exactly why recent
// WETH Autopilot deposits were missing from the feed while older ones showed).
// Re-sweeping a multi-day window every run catches those stragglers; the
// on_conflict=ignore-duplicates write makes re-seeing existing rows free, and
// a week of one chain's events is only a page or two. Override with RESCAN_DAYS.
// Stragglers lagged longer than this window are still recovered by an
// occasional full re-run (clear the resume / first-run backfill path).
const RESCAN_DAYS = Number(process.env.RESCAN_DAYS) || 7;
const MAX_PAGES_PER_RUN = 400; // ~400k rows per chain per run, hard cap

// ──────────────────────────────────────────────────────────────────
// Args + env
// ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    if (a === "--probe") {
      args.probe = "true";
      continue;
    }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const args = parseArgs();
const PROBE = args.probe === "true";
const CHAIN_FILTER = args.chain;
const SUBGRAPH_BASE = (
  process.env.SUBGRAPH_BASE_URL || DEFAULT_SUBGRAPH_BASE
).replace(/\/$/, "");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!PROBE && (!SUPABASE_URL || !SERVICE_KEY)) {
  console.error(
    "missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
  );
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────
// Tiny helpers
// ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(chainId, query, variables) {
  const url = `${SUBGRAPH_BASE}/${chainId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`bad JSON from ${url}: ${text.slice(0, 200)}`);
  }
  if (body.errors) {
    throw new Error(
      `graphql errors at ${url}: ${JSON.stringify(body.errors).slice(0, 400)}`,
    );
  }
  return body.data;
}

async function supabase(path, init) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("supabase not configured");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`supabase ${r.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return r;
}

// ──────────────────────────────────────────────────────────────────
// Schema-probe mode. Lets the operator quickly inspect the subgraph
// schema for one chain without touching Supabase, so any field-name
// drift between this script's assumptions and the live schema is
// spotted in 5 seconds.
// ──────────────────────────────────────────────────────────────────

async function probe(chainId) {
  const data = await gql(
    chainId,
    `{
      __type(name: "UserTransaction") {
        name
        fields { name type { name kind ofType { name kind } } }
      }
    }`,
    {},
  );
  console.log(JSON.stringify(data, null, 2));
}

// ──────────────────────────────────────────────────────────────────
// Cursor + row helpers
// ──────────────────────────────────────────────────────────────────

async function latestTimestampForChain(chainName) {
  // Newest block_timestamp of a SUBGRAPH-sourced row on this chain. Scoped
  // to amount_usd IS NOT NULL on purpose: the RPC indexer also writes this
  // table (amount_usd null) and runs every 15 min, so an unscoped query
  // would return a near-`now` timestamp, collapse the resume window to the
  // last ~minute, and skip the backfill entirely (the bug that left the
  // page empty after a "successful" run). Scoping to our own rows means the
  // first run sees null here and backfills BACKFILL_DAYS, and later runs
  // resume from the last row we actually wrote. Returns null if we've never
  // written a subgraph row on this chain.
  const params = new URLSearchParams({
    select: "block_timestamp",
    chain: `eq.${chainName}`,
    amount_usd: "not.is.null",
    order: "block_timestamp.desc",
    limit: "1",
  });
  const r = await supabase(`vault_events_prod?${params.toString()}`, {
    method: "GET",
  });
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const t = Date.parse(rows[0].block_timestamp);
  if (!Number.isFinite(t)) return null;
  return Math.floor(t / 1000);
}

function mapTransactionType(raw) {
  // The subgraph likely emits a string enum. Coerce defensively so
  // future schema changes (numeric, lowercased, etc.) keep working.
  const v = String(raw ?? "").toLowerCase();
  if (v.includes("deposit") || v === "0") return "deposit";
  if (v.includes("withdraw") || v === "1") return "withdraw";
  if (v.includes("transfer") || v === "2") return "transfer";
  return null;
}

// The exact query, verified against the live Base schema (probe mode).
// Field names confirmed on UserTransaction:
//   userAddress  - the wallet whose position changed (the real depositor)
//   txOrigin     - the EOA that sent the tx (router for aggregator zaps)
//   transactionType - "Deposit" / "Withdraw" (string enum, capitalized)
//   value        - amount in UNDERLYING token units (wei-scale)
//   price        - USD price of one whole underlying token
//   sharePrice   - vault share price (informational)
//   tx           - the real transaction hash
//   createAtBlock - block number
//   vault.decimal / plasmaVault.decimals - underlying decimals, used to
//     scale `value` into a human amount before multiplying by `price`.
//
// IMPORTANT: every on-chain deposit/withdraw is logged as TWO legs - one
// with userAddress = 0x000...000 (the mint/burn counterpart) and one with
// the real userAddress. We keep only the real-user leg (see indexChain).
//
// Pagination: orderBy id / id_gt cursor is a stable keyset sweep that never
// re-reads a row; timestamp_gte bounds it to the resume window. (The entity
// id is an opaque hex blob, NOT "txHash-logIndex", so we take the tx hash
// from the dedicated `tx` field instead of parsing the id.)
const PAGE_QUERY = `
  query Page($since: BigInt!, $first: Int!, $cursor: String!) {
    userTransactions(
      first: $first
      orderBy: id
      orderDirection: asc
      where: { timestamp_gte: $since, id_gt: $cursor }
    ) {
      id
      tx
      timestamp
      createAtBlock
      transactionType
      value
      price
      userAddress
      txOrigin
      vault { id decimal }
      plasmaVault { id decimals }
    }
  }
`;

// Recent sweep: the newest events on a chain, newest-first, with NO timestamp
// filter. Run every cycle so each chain's latest activity always lands in the
// DB regardless of how far the keyset backfill has crawled - the keyset sweep
// is ordered by `id` (effectively random vs time), so on a chain that hasn't
// finished backfilling, recent events can sit unwritten for a long time. This
// is what was keeping every non-Base chain out of the Deposit Activity feed
// even though the subgraph has fresh data for them.
const RECENT_QUERY = `
  query Recent($first: Int!) {
    userTransactions(first: $first, orderBy: timestamp, orderDirection: desc) {
      id
      tx
      timestamp
      createAtBlock
      transactionType
      value
      price
      userAddress
      txOrigin
      vault { id decimal }
      plasmaVault { id decimals }
    }
  }
`;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// USD value of a transaction leg: scale `value` from the underlying
// token's smallest units up by its decimals, then price it. Returns null
// when we can't price it (missing decimals or price), so the column stays
// NULL rather than storing a wrong number.
function usdValue(value, price, decimals) {
  const dec = Number(decimals);
  const p = Number(price);
  const v = Number(value);
  if (!Number.isFinite(dec) || !Number.isFinite(p) || !Number.isFinite(v)) {
    return null;
  }
  const usd = (v / 10 ** dec) * p;
  return Number.isFinite(usd) ? Math.round(usd * 100) / 100 : null;
}

// Human token amount of a leg: `value` scaled down by the SAME decimals used
// for USD (vault.decimal for autocompounders, plasmaVault.decimals for
// autopilots - the latter carry an IPOR-style +2 offset, e.g. 8 for USDC /
// 20 for WETH). Storing this keeps the feed's Units column consistent with
// amount_usd instead of the page guessing decimals from the asset.
function tokenAmount(value, decimals) {
  const dec = Number(decimals);
  const v = Number(value);
  if (!Number.isFinite(dec) || !Number.isFinite(v)) return null;
  const n = v / 10 ** dec;
  return Number.isFinite(n) ? n : null;
}

// Stable per-LEG log_index derived from the entity id (which is unique per
// leg), so two legs of the same transaction - even on the same vault and
// wallet - get distinct (chain, tx_hash, log_index) keys and neither is
// dropped. FNV-1a over the id, offset into a high band (>= 1e9) that real
// on-chain log indices never reach, so a subgraph row and an RPC-indexer
// row for the same tx keep distinct identities and never clobber each
// other. The band fits in a 32-bit int column (< 2.147e9).
function syntheticLogIndex(entityId) {
  const s = String(entityId ?? "");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 1_000_000_000 + ((h >>> 0) % 1_000_000_000);
}

// Map raw subgraph userTransaction legs into vault_events_prod rows, keeping
// only the real-depositor leg (the zero-address mint/burn counterpart is
// dropped). Shared by the keyset backfill and the recent sweep.
function buildRows(txs, name) {
  const rows = [];
  for (const t of txs) {
    const event_type = mapTransactionType(t.transactionType);
    if (!event_type) continue;
    const wallet = String(t.userAddress ?? "").toLowerCase();
    if (!wallet || wallet === ZERO_ADDR) continue;
    const vaultAddr = t.vault?.id ?? t.plasmaVault?.id;
    if (!vaultAddr) continue;
    const decimals = t.vault?.decimal ?? t.plasmaVault?.decimals;
    const tx_hash = t.tx ? String(t.tx).toLowerCase() : null;
    if (!tx_hash) continue;
    const log_index = syntheticLogIndex(t.id);
    const tsSec = Number(t.timestamp ?? 0);
    if (!Number.isFinite(tsSec) || tsSec === 0) continue;
    rows.push({
      chain: name,
      vault_address: String(vaultAddr).toLowerCase(),
      vault_slug: null, // joined client-side via slug-by-address lookup
      tx_hash,
      log_index,
      block_number: Number(t.createAtBlock ?? 0) || 0,
      block_timestamp: new Date(tsSec * 1000).toISOString(),
      event_type,
      wallet_address: wallet,
      amount_shares: String(t.value ?? "0"),
      amount_usd: usdValue(t.value, t.price, decimals),
      amount_token: tokenAmount(t.value, decimals),
    });
  }
  return rows;
}

// Dedupe within the batch on the table's real unique key (chain, tx_hash,
// log_index), then upsert with ignore-duplicates so re-seen rows (resume
// overlap, recent sweep) are absorbed for free. Returns rows sent.
async function upsertRows(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const k = `${row.chain}|${row.tx_hash}|${row.log_index}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(row);
  }
  if (unique.length === 0) return 0;
  await supabase("vault_events_prod?on_conflict=chain,tx_hash,log_index", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(unique),
  });
  return unique.length;
}

async function indexChain(chain) {
  const { name, chainId } = chain;
  const nowSec = Math.floor(Date.now() / 1000);
  const latest = await latestTimestampForChain(name);
  const since = latest === null
    ? nowSec - BACKFILL_DAYS * 86400
    : latest - RESCAN_DAYS * 86400;

  console.log(
    `[${name}] indexing from ${new Date(since * 1000).toISOString()} (cursor latest=${latest ?? "none"})`,
  );

  // Recent sweep first: always pull this chain's newest events (newest-first,
  // no timestamp filter) so fresh activity surfaces immediately, independent
  // of how far the id-ordered keyset backfill below has progressed. This is
  // what brings the non-Base chains into the feed.
  let totalWritten = 0;
  try {
    const recent = await gql(chainId, RECENT_QUERY, { first: PAGE_SIZE });
    const n = await upsertRows(buildRows(recent?.userTransactions ?? [], name));
    if (n) console.log(`[${name}] recent sweep wrote ${n}`);
  } catch (e) {
    console.error(`[${name}] recent sweep failed: ${e.message}`);
  }

  let cursor = "";
  for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
    let data;
    try {
      data = await gql(chainId, PAGE_QUERY, {
        since: since.toString(),
        first: PAGE_SIZE,
        cursor,
      });
    } catch (e) {
      console.error(`[${name}] page ${page} failed: ${e.message}`);
      break;
    }
    const txs = data?.userTransactions ?? [];
    if (txs.length === 0) break;

    totalWritten += await upsertRows(buildRows(txs, name));

    // Advance the cursor to the last id we saw. Combined with the
    // `id_gt` filter + ascending timestamp order, this gives us a
    // stable forward pagination that never re-reads the same row.
    cursor = txs[txs.length - 1].id;
    if (txs.length < PAGE_SIZE) break;

    // Light throttle so the subgraph doesn't get hammered.
    await sleep(150);
  }

  console.log(`[${name}] wrote ${totalWritten} events`);
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

async function main() {
  const chains = CHAIN_FILTER
    ? CHAINS.filter((c) => c.name.toLowerCase() === CHAIN_FILTER.toLowerCase())
    : CHAINS;

  if (chains.length === 0) {
    console.error(`no chain matches --chain=${CHAIN_FILTER}`);
    process.exit(1);
  }

  if (PROBE) {
    for (const c of chains) {
      console.log(`=== ${c.name} (${c.chainId}) ===`);
      try {
        await probe(c.chainId);
      } catch (e) {
        console.error(`probe failed: ${e.message}`);
      }
    }
    return;
  }

  for (const c of chains) {
    try {
      await indexChain(c);
    } catch (e) {
      console.error(`[${c.name}] indexer failed: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
