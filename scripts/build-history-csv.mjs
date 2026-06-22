#!/usr/bin/env node
// Build-time per-vault history CSV emitter. The product-page Dataset
// schema (src/lib/jsonld.ts datasetSchema) advertises a downloadable CSV
// via its DataDownload distribution, and the Historical Data section
// renders a "Download CSV" link; both point at /history/<slug>.csv. This
// script writes those files into public/ after the static export, for
// every vault with enough indexed history to qualify for the Dataset
// schema (the same DATASET_MIN_POINTS = 30 floor as lib/jsonld.ts). Daily
// resolution, wide format (one row per UTC day) so the file is both
// researcher-friendly and parseable by Google's Dataset crawler.
//
// Runs in the post-export phase of `npm run build` (after `mv out
// public`), alongside build-search-index / build-design-system, so its
// output lands in the deployed public/ rather than being wiped.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const VAULTS_FILE = join(ROOT, "data", "vaults.json");
const HISTORY_FILE = join(ROOT, "data", "history.json");
const OUT_DIR = join(ROOT, "public", "history");

// Mirror lib/jsonld.ts DATASET_MIN_POINTS so the file set and the schema
// that references it stay in lockstep.
const DATASET_MIN_POINTS = 30;

if (!existsSync(VAULTS_FILE) || !existsSync(HISTORY_FILE)) {
  console.error(
    "[history-csv] vaults.json or history.json not found; skipping.",
  );
  process.exit(0);
}

const vaults = JSON.parse(readFileSync(VAULTS_FILE, "utf-8"));
const history = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));

const histFor = (v) =>
  history[v.contractAddress] ??
  history[(v.contractAddress || "").toLowerCase()] ??
  null;

const utcDay = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

// Keep the latest reading per UTC day for one series (end-of-day value),
// mirroring the on-page table's dedupeLatestPerDay. Returns Map<day, value>.
function dailyLatest(points, field) {
  const byDay = new Map(); // day -> { ts, value }
  for (const p of points || []) {
    const v = p[field];
    if (!Number.isFinite(v)) continue;
    const day = utcDay(p.timestamp);
    const cur = byDay.get(day);
    if (!cur || p.timestamp > cur.ts) byDay.set(day, { ts: p.timestamp, value: v });
  }
  const out = new Map();
  for (const [day, rec] of byDay) out.set(day, rec.value);
  return out;
}

const cell = (n) => (Number.isFinite(n) ? String(n) : "");

// Reset the output dir each build so vaults dropped from the index don't
// leave orphan CSV files behind.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
let totalBytes = 0;

for (const v of vaults) {
  const h = histFor(v);
  if (!h) continue;

  // Gate on raw point counts to match datasetSchema()'s threshold.
  const apyN = (h.apyHistory || []).length;
  const tvlN = (h.tvlHistory || []).length;
  if (apyN < DATASET_MIN_POINTS && tvlN < DATASET_MIN_POINTS) continue;

  // Filters mirror the on-page table (apy >= 0, tvl > 0, share price > 0).
  const apy = dailyLatest((h.apyHistory || []).filter((p) => p.apy >= 0), "apy");
  const tvl = dailyLatest(
    (h.tvlHistory || []).filter((p) => p.value > 0),
    "value",
  );
  const sp = dailyLatest(
    (h.sharePriceHistory || []).filter((p) => p.sharePrice > 0),
    "sharePrice",
  );

  const days = Array.from(
    new Set([...apy.keys(), ...tvl.keys(), ...sp.keys()]),
  ).sort();
  if (days.length === 0) continue;

  const lines = ["date,apy_percent,tvl_usd,share_price"];
  for (const d of days) {
    lines.push(
      [d, cell(apy.get(d)), cell(tvl.get(d)), cell(sp.get(d))].join(","),
    );
  }
  const csv = lines.join("\n") + "\n";
  writeFileSync(join(OUT_DIR, `${v.slug}.csv`), csv);
  written += 1;
  totalBytes += Buffer.byteLength(csv);
}

console.log(
  `[history-csv] wrote ${written} CSV file(s) to ${OUT_DIR} (${(
    totalBytes / 1024
  ).toFixed(1)}KB total)`,
);
