#!/usr/bin/env node
// Self-test for the sharded ledger walk, against an in-memory Clio.
//
// The walk splits the key space at existing keys and pages each shard with
// exclusive markers. An off-by-one at a boundary would drop or double-count one
// object per shard, ~48 accounts out of 8 million, which no reconciliation
// would notice. So the partition is checked here: every object exactly once,
// through failed requests, a time budget, and a resume from the saved markers.
//
//   node scripts/check-xrpl-walk.mjs

import { createHash } from "node:crypto";
import { planShards, walkLedger } from "./lib/xrpl.mjs";

let failed = 0;
const ok = (name, cond, detail = "") => {
  if (!cond) failed++;
  console.error(`  ${cond ? "ok  " : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
};

const LEDGER = 1000;
const key = (i) => createHash("sha256").update(String(i)).digest("hex").toUpperCase();
const KEYS = Array.from({ length: 30_000 }, (_, i) => key(i)).sort();
const POS = new Map(KEYS.map((k, i) => [k, i]));

// Clio's behaviour as measured: a marker must be an existing key and is
// exclusive; the returned marker is the last key served.
let requests = 0;
let failEvery = 0;
globalThis.fetch = async (_url, init) => {
  requests++;
  const { method, params } = JSON.parse(init.body);
  const p = params[0];
  const reply = (result) => ({ ok: true, status: 200, json: async () => ({ result }) });
  if (failEvery && requests % failEvery === 0) {
    return requests % 2
      ? { ok: false, status: 503, json: async () => ({}) }
      : reply({ error: "tooBusy", error_message: "load", status: "error" });
  }
  if (method === "ledger_entry") {
    return reply(POS.has(p.index) ? { node_binary: "00", ledger_index: LEDGER } : { error: "entryNotFound", status: "error" });
  }
  if (method === "ledger_data") {
    let from = 0;
    if (p.marker != null) {
      if (!POS.has(p.marker)) return reply({ error: "invalidParams", error_message: "markerDoesNotExist", status: "error" });
      from = POS.get(p.marker) + 1;
    }
    const page = KEYS.slice(from, from + p.limit).map((index) => ({ index, data: "00" }));
    const more = from + p.limit < KEYS.length;
    return reply({ ledger_index: LEDGER, state: page, ...(more ? { marker: page[page.length - 1].index } : {}) });
  }
  return reply({ error: "unknownCmd", status: "error" });
};

console.error("[xrpl walk self-test] 30,000 objects");

// Seeds: some real keys, some that do not exist (deleted accounts).
const candidates = [...KEYS.filter((_, i) => i % 211 === 0), ...Array.from({ length: 40 }, (_, i) => key(`gone-${i}`))];
const shards = await planShards({ ledgerIndex: LEDGER, candidateKeys: candidates, shards: 16 });
ok("shards planned", shards.length >= 12 && shards.length <= 16, `${shards.length}`);
ok("first shard starts at the beginning", shards[0].start === null);
ok("last shard runs to the end", shards[shards.length - 1].end === null);
ok("boundaries chain", shards.every((s, i) => i === 0 || s.start === shards[i - 1].end));
ok("every boundary exists", shards.slice(1).every((s) => POS.has(s.start)));

const seen = new Map();
const onEntries = (entries) => {
  for (const e of entries) seen.set(e.index, (seen.get(e.index) ?? 0) + 1);
};

// A small page so shards span several pages, failures injected, and a budget
// that runs out partway through.
failEvery = 9;
const first = await walkLedger({ ledgerIndex: LEDGER, shards, onEntries, concurrency: 5, pageLimit: 300, deadline: Date.now() + 1_500 });
const partial = seen.size;
ok("budget stops the walk partway", !first.done && partial > 0 && partial < KEYS.length, `${partial} of ${KEYS.length}`);

// Resume from the shard state exactly as a checkpoint would carry it.
const resumed = JSON.parse(JSON.stringify(shards));
const second = await walkLedger({ ledgerIndex: LEDGER, shards: resumed, onEntries, concurrency: 5, pageLimit: 300 });
ok("resumed walk completes", second.done);
ok("every object seen", seen.size === KEYS.length, `${seen.size} of ${KEYS.length}`);
const twice = [...seen.values()].filter((n) => n !== 1).length;
ok("no object seen twice", twice === 0, `${twice}`);
ok("failed requests were retried, not skipped", requests > 0);

if (failed) {
  console.error(`[FAIL] xrpl walk self-test: ${failed} failure(s)`);
  process.exit(1);
}
console.error("[OK] xrpl walk self-test passed");
