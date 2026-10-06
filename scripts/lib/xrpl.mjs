// XRP Ledger JSON-RPC client for the rich list pipeline.
//
// WHY a ledger walk rather than an explorer's rich-list endpoint: the same
// reason scripts/lib/onchain.mjs exists for Base and Flare. An explorer's
// distribution is that explorer's dataset, with its own terms and its own
// refresh cadence, and the build spec is explicit that the figures circulating
// on this SERP must not be carried over. A full pass over the ledger's
// AccountRoot objects is nobody's proprietary dataset, and the snapshot time is
// ours to state.
//
// XRPL differs from the EVM chains already wired here in ways that shape this
// file. There are no contracts to call: account balances live directly in the
// ledger's state tree, and `ledger_data` walks that tree a page at a time
// behind an opaque `marker`. There is no batching and no way to ask for one
// field, so whole objects come back and the caller discards what it does not
// need.

import { createHash } from "node:crypto";

// Where the walk runs, and why only there. Measured 2026-10-06.
//
// xrpl.ws became a rate-limited proxy in mid-September 2026. It meters by
// response size, per client IP: `units-60` 10,000 and `units-3600` 500,000,
// with a 2,048-entry account page costing ~1,100 units. A full walk returns
// ~8.3 million AccountRoots, about 11 million units, so on that budget it can
// no longer finish at all. GitHub runners also share IPs, so other people's
// traffic spends the same budget. It answers `tooBusy ... retry in ~110000ms`.
//
// s1/s2.ripple.com are Clio 2.8 with no unit quota, but cap `ledger_data` at
// 256 entries per JSON page or 2,048 per binary page, at ~6-8 seconds a page.
// Throughput scales with concurrent requests up to ~20 per IP, then queues.
// A sharded binary walk at 12 streams reads ~4,000 entries a second.
//
// Markers are not portable between the two implementations: a rippled marker
// sent to Clio is rejected with `invalidParams: markerDoesNotExist`. The old
// walk failed over across both kinds within one walk, which is exactly the
// error every failed run since 2026-09-16 died on. So paging stays on Clio,
// and rippled is only a fallback for single calls that carry no marker.
export const CLIO_ENDPOINTS = ["https://s1.ripple.com/", "https://s2.ripple.com/"];
export const RIPPLED_ENDPOINTS = ["https://xrpl.ws/"];
const POINT_ENDPOINTS = [...CLIO_ENDPOINTS, ...RIPPLED_ENDPOINTS];

export const DROPS_PER_XRP = 1_000_000;

// Every AccountRoot in the ledger is by definition funded: an account cannot
// exist without meeting the base reserve, which validators lowered from 10 XRP
// to 1 XRP in December 2024. So "funded account" needs no balance filter, and
// the count of AccountRoot objects IS the funded account count. Recorded here
// because the page states that definition and it has to match the code.
export const BASE_RESERVE_XRP = 1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class RpcError extends Error {
  constructor(message, { code = null, retryAfterMs = null } = {}) {
    super(message);
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

async function postOnce(url, method, params, timeoutMs) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params: [params] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new RpcError(`HTTP ${r.status} from ${url}`);
  const j = await r.json();
  // Clio's DoS guard answers at the top level, outside `result`.
  if (!j?.result) throw new RpcError(`no result from ${url}: ${JSON.stringify(j).slice(0, 160)}`, { code: j?.error ?? null });
  const res = j.result;
  if (res.error || res.status === "error") {
    const msg = `${res.error ?? "error"}: ${res.error_message ?? ""}`.trim();
    const hint = /retry in ~(\d+)ms/.exec(res.error_message ?? "");
    throw new RpcError(`${msg} (${url})`, { code: res.error ?? null, retryAfterMs: hint ? Number(hint[1]) : null });
  }
  return res;
}

/**
 * One JSON-RPC call, rotating across `endpoints` and backing off on each try.
 *
 * Public XRPL nodes shed load with an error body rather than a transport error,
 * so every error is treated as retryable: a walk must never silently skip a
 * page, so this throws rather than returning partial data. lgrNotFound is in
 * scope deliberately; it has been observed mid-walk on a ledger every endpoint
 * served when probed a minute later.
 */
export async function xrplRpc(
  method,
  params = {},
  { endpoints = POINT_ENDPOINTS, tries = 8, timeoutMs = 120_000 } = {},
) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    const url = endpoints[attempt % endpoints.length];
    try {
      return await postOnce(url, method, params, timeoutMs);
    } catch (e) {
      lastErr = e;
      // A server that names its own wait is believed, up to two minutes. With
      // a single endpoint that is the only useful thing to do; with several,
      // the next one is tried after the normal backoff instead.
      const hinted = endpoints.length === 1 && e?.retryAfterMs ? Math.min(e.retryAfterMs, 120_000) : 0;
      await sleep(Math.max(hinted, Math.min(30_000, 1_000 * 2 ** attempt)));
    }
  }
  throw lastErr ?? new Error(`xrpl ${method} failed`);
}

// How far behind the validated tip to pin a walk.
//
// A load-balanced pool can advertise a tip that the instance answering any one
// request does not have yet. Fifty ledgers is roughly three minutes, and the
// close time this reports is the pinned ledger's own, so the page still states
// exactly what it read.
const TIP_LOOKBACK = 50;

/**
 * A recent validated ledger, with its close time.
 *
 * Deliberately not the newest one. See TIP_LOOKBACK.
 */
export async function validatedLedger() {
  const tip = await xrplRpc("ledger", { ledger_index: "validated", accounts: false, transactions: false });
  const tipIndex = Number(tip.ledger_index ?? tip.ledger?.ledger_index);
  const target = Number.isFinite(tipIndex) ? tipIndex - TIP_LOOKBACK : "validated";
  const res = await xrplRpc("ledger", { ledger_index: target, accounts: false, transactions: false });
  const l = res.ledger ?? {};
  // close_time is seconds since the Ripple epoch (2000-01-01T00:00:00Z), not
  // the Unix epoch. Getting this wrong dates every snapshot 30 years early.
  const rippleEpoch = Date.UTC(2000, 0, 1) / 1000;
  const closeUnix = Number(l.close_time) + rippleEpoch;
  return {
    ledgerIndex: Number(res.ledger_index ?? l.ledger_index),
    closeIso: new Date(closeUnix * 1000).toISOString(),
    totalDrops: l.total_coins != null ? BigInt(l.total_coins) : null,
  };
}

// ------------------------------------------------------------------ addresses

const B58 = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz";
const B58_INDEX = new Map([...B58].map((c, i) => [c, BigInt(i)]));
const sha256 = (buf) => createHash("sha256").update(buf).digest();

/** 20-byte AccountID (hex) to a classic r-address. */
export function encodeAccountId(hex) {
  const payload = Buffer.concat([Buffer.from([0]), Buffer.from(hex, "hex")]);
  const full = Buffer.concat([payload, sha256(sha256(payload)).subarray(0, 4)]);
  let n = BigInt(`0x${full.toString("hex")}`);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of full) {
    if (b !== 0) break;
    out = B58[0] + out;
  }
  return out;
}

/** Classic r-address to its 20-byte AccountID (hex), checksum verified. */
export function decodeAddress(address) {
  let n = 0n;
  for (const c of address) {
    const v = B58_INDEX.get(c);
    if (v == null) throw new Error(`not an XRPL address: ${address}`);
    n = n * 58n + v;
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let lead = 0;
  for (const c of address) {
    if (c !== B58[0]) break;
    lead++;
  }
  const full = Buffer.concat([Buffer.alloc(lead), Buffer.from(hex, "hex")]);
  if (full.length !== 25 || full[0] !== 0) throw new Error(`not a classic address: ${address}`);
  const payload = full.subarray(0, 21);
  if (!sha256(sha256(payload)).subarray(0, 4).equals(full.subarray(21))) {
    throw new Error(`bad checksum: ${address}`);
  }
  return payload.subarray(1).toString("hex").toUpperCase();
}

/** The ledger key of an account's AccountRoot: SHA-512Half(0x0061 || AccountID). */
export function accountRootKey(address) {
  const id = Buffer.from(decodeAddress(address), "hex");
  const h = createHash("sha512").update(Buffer.concat([Buffer.from([0x00, 0x61]), id])).digest();
  return h.subarray(0, 32).toString("hex").toUpperCase();
}

// ------------------------------------------------------------- binary objects

// A binary ledger entry is a canonical STObject. Every object starts with its
// LedgerEntryType (field header 0x11, then a UInt16), so the type is readable
// from the first three bytes without decoding anything else.
const TYPE_ACCOUNT_ROOT = "110061";
const TYPE_ESCROW = "110075";

export const entryKind = (hex) =>
  hex.startsWith(TYPE_ACCOUNT_ROOT) ? "account" : hex.startsWith(TYPE_ESCROW) ? "escrow" : null;

// Fields are serialised sorted by type code, then field code. Everything this
// pipeline reads has a type code of 8 or below, and those eight types all have
// a fixed or self-describing length, so the parser reads up to type 8 and stops
// there. Field types introduced by future amendments sort above that and are
// never reached.
const FIXED = { 1: 2, 2: 4, 3: 8, 4: 16, 5: 32 };

function readVl(buf, i) {
  const b0 = buf[i];
  if (b0 <= 192) return [b0, i + 1];
  if (b0 <= 240) return [193 + (b0 - 193) * 256 + buf[i + 1], i + 2];
  return [12_481 + (b0 - 241) * 65_536 + buf[i + 1] * 256 + buf[i + 2], i + 3];
}

/** { "type:field": value } for the type-1..8 fields of one binary object. */
function readFields(hex) {
  const buf = Buffer.from(hex, "hex");
  const out = {};
  let i = 0;
  while (i < buf.length) {
    let type = buf[i] >> 4;
    let field = buf[i] & 0x0f;
    i++;
    if (type === 0) type = buf[i++];
    if (field === 0) field = buf[i++];
    if (type > 8) break;
    let len;
    if (FIXED[type]) {
      len = FIXED[type];
    } else if (type === 6) {
      // Amount: 48 bytes for an issued currency, 33 for an MPT, 8 for XRP.
      len = buf[i] & 0x80 ? 48 : buf[i] & 0x20 ? 33 : 8;
    } else {
      [len, i] = readVl(buf, i);
    }
    out[`${type}:${field}`] = buf.subarray(i, i + len);
    i += len;
  }
  return out;
}

// XRP amounts: top bit 0 (native), next bit 1 (positive), low 62 bits drops.
function xrpDrops(amount) {
  if (!amount || amount.length !== 8 || amount[0] & 0x80 || amount[0] & 0x20) return null;
  const v = amount.readBigUInt64BE(0);
  const drops = v & 0x3fffffffffffffffn;
  return v & 0x4000000000000000n ? drops : -drops;
}

/** AccountRoot: AccountID (hex), Balance (drops, BigInt), Domain (hex or null). */
export function decodeAccountRoot(hex) {
  const f = readFields(hex);
  const account = f["8:1"];
  const balance = xrpDrops(f["6:2"]);
  if (!account || account.length !== 20 || balance == null) {
    throw new Error(`malformed AccountRoot: ${hex.slice(0, 80)}`);
  }
  return {
    accountHex: account.toString("hex").toUpperCase(),
    drops: balance,
    domainHex: f["7:7"] ? f["7:7"].toString("hex") : null,
  };
}

/**
 * Escrow: owner AccountID (hex) and the escrowed drops, or null for an escrow
 * of an issued currency or MPT, which is not part of an XRP rich list.
 */
export function decodeEscrow(hex) {
  const f = readFields(hex);
  const drops = xrpDrops(f["6:1"]);
  const account = f["8:1"];
  if (!account || account.length !== 20) throw new Error(`malformed Escrow: ${hex.slice(0, 80)}`);
  if (drops == null) return null;
  return { accountHex: account.toString("hex").toUpperCase(), drops };
}

// --------------------------------------------------------------------- walk

const MAX_KEY = "F".repeat(64);

/**
 * Split the keyspace into shards bounded by keys that exist in the ledger.
 *
 * Clio rejects a marker that is not an existing key, and treats a valid one as
 * exclusive: the page starts strictly after it. So shard i covers
 * (seed[i-1], seed[i]] and the shards partition the tree with no gap and no
 * overlap. Ledger keys are uniform hashes, so AccountRoot keys of any known
 * accounts are evenly spread seeds; each is confirmed to exist at the pinned
 * ledger before it is used.
 */
export async function planShards({ ledgerIndex, candidateKeys, shards: wanted }) {
  const sorted = [...new Set(candidateKeys)].sort();
  const seeds = [];
  for (let s = 1; s < wanted && sorted.length; s++) {
    const target = (BigInt(`0x${MAX_KEY}`) * BigInt(s)) / BigInt(wanted);
    // Nearest candidates to the target first, so a missing one falls back to
    // its neighbour rather than leaving a hole in the spread.
    const near = sorted
      .map((k) => [k, (BigInt(`0x${k}`) - target) ** 2n])
      .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
      .slice(0, 6)
      .map(([k]) => k);
    for (const k of near) {
      if (seeds.includes(k)) continue;
      try {
        await xrplRpc("ledger_entry", { index: k, ledger_index: ledgerIndex, binary: true }, { endpoints: CLIO_ENDPOINTS, tries: 3 });
        seeds.push(k);
        break;
      } catch {
        // Deleted since the candidate list was written; try the next nearest.
      }
    }
  }
  seeds.sort();
  const bounds = [null, ...seeds, null];
  return bounds.slice(0, -1).map((start, i) => ({ start, end: bounds[i + 1], marker: start, pages: 0, done: false }));
}

/**
 * Walk every object in one ledger across `shards`, `concurrency` at a time.
 *
 * Pinned to a single `ledger_index` so the walk is a consistent snapshot: the
 * ledger closes every three to five seconds, and paging across closes would
 * double-count objects that moved and miss others entirely.
 *
 * `onEntries(entries)` receives the binary `{ index, data }` objects of one page
 * and must be synchronous. `onPage()` runs straight after it, before any other
 * page is processed, so shard markers and the caller's totals are always
 * consistent with each other at that point, which is where a checkpoint is safe.
 *
 * Stops picking up new pages at `deadline` (ms epoch) and returns with shards
 * still open; their markers resume the walk later.
 */
export async function walkLedger({
  ledgerIndex,
  shards,
  onEntries,
  onPage = () => {},
  concurrency = 12,
  deadline = Infinity,
  pageLimit = 2048,
  maxFailures = 25,
}) {
  let failures = 0;
  let fatal = null;
  const queue = shards.filter((s) => !s.done);

  async function worker() {
    for (;;) {
      if (fatal || Date.now() >= deadline) return;
      const shard = queue.shift();
      if (!shard) return;
      try {
        for (;;) {
          if (fatal || Date.now() >= deadline) {
            queue.push(shard);
            return;
          }
          const res = await xrplRpc(
            "ledger_data",
            { ledger_index: ledgerIndex, binary: true, limit: pageLimit, ...(shard.marker ? { marker: shard.marker } : {}) },
            { endpoints: CLIO_ENDPOINTS },
          );
          if (Number(res.ledger_index) !== ledgerIndex) {
            throw new Error(`asked for ledger ${ledgerIndex}, got ${res.ledger_index}`);
          }
          const state = res.state ?? [];
          const take = shard.end ? state.filter((e) => e.index <= shard.end) : state;
          onEntries(take);
          shard.pages++;
          const last = state.length ? state[state.length - 1].index : null;
          if (!res.marker || take.length < state.length || (shard.end && last && last >= shard.end)) {
            shard.done = true;
            shard.marker = null;
          } else {
            shard.marker = res.marker;
          }
          failures = 0;
          onPage();
          if (shard.done) break;
        }
      } catch (e) {
        failures++;
        console.error(`[xrpl] shard ${shard.start?.slice(0, 8) ?? "start"} page failed (${failures} in a row): ${e?.message ?? e}`);
        queue.push(shard);
        if (failures >= maxFailures) fatal = e;
        else await sleep(5_000);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, shards.length) }, worker));
  if (fatal) throw fatal;
  return { done: shards.every((s) => s.done) };
}

/**
 * AccountRoot.Domain is hex-encoded ASCII that the account holder set on
 * itself. It is the only identity signal that is both onchain and
 * self-declared, which is exactly the standard the build spec sets for
 * labelling: publicly confirmed, never inferred from behaviour.
 */
export function decodeDomain(hex) {
  if (!hex || typeof hex !== "string") return null;
  const clean = hex.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2) return null;
  let out = "";
  for (let i = 0; i < clean.length; i += 2) {
    const c = parseInt(clean.slice(i, i + 2), 16);
    // Printable ASCII only. A domain with control bytes in it is not a domain.
    if (c < 0x20 || c > 0x7e) return null;
    out += String.fromCharCode(c);
  }
  const trimmed = out.trim().toLowerCase();
  return trimmed.length >= 3 && trimmed.length <= 120 ? trimmed : null;
}

export const dropsToXrp = (drops) => Number(BigInt(drops)) / DROPS_PER_XRP;
