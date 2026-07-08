#!/usr/bin/env node
// Build-time emitter for the Sales funnel's ranking map:
// public/data/sales-surfaces.json.
//
// WHY: the /control-room/sales funnel needs to know, for each "surface"
// page a visitor can land on (homepage, asset hubs, network hubs), the
// ordered list of products shown there - so a page view of a surface can
// be read as an impression of the products ranked on it, and each product
// can be bucketed by its position (top1/top2/top3...). Product impressions
// and ranking positions are NOT logged per-event anywhere; they are
// deterministic from the catalogue, so we reconstruct them here.
//
// The ranking each surface renders is: getLiveVaults() (the same live
// filter the public pages use) -> scoped by asset/chain -> sorted by
// apy24h descending. We replicate that filter chain exactly against
// data/vaults.json (+ history.json for the staleness/broken checks and
// hidden.json for the ranking opt-out) so positions match what visitors
// actually saw. Kept in sync with src/lib/data.ts getLiveVaults() and
// src/lib/admin-rules.ts constants; if those change, update here.
//
// Runs in the post-export phase of `npm run build` (after `mv out public`)
// so the file lands in the deployed public/.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const OUT_DIR = join(PUBLIC_DIR, "data");
const VAULTS_FILE = join(ROOT, "data", "vaults.json");
const HISTORY_FILE = join(ROOT, "data", "history.json");
const HIDDEN_FILE = join(ROOT, "data", "hidden.json");

// --- filter constants, mirrored from src/lib/admin-rules.ts ---
const STALE_APY_DAYS = 14;
const BROKEN_TVL_THRESHOLD = 10_000;
const BROKEN_MIN_OBSERVATIONS = 14;
// HIDE_AERODROME is false upstream, so the aerodrome hide is a no-op and
// intentionally omitted. HIDE_LP_PAIR is true: LP-pair vaults (more than
// one underlying logo) are dropped from every ranking surface.

// --- surface definitions: page_path -> scope predicate ---
const ASSET_HUBS = { "/usdc": "USDC", "/usdt": "USDT", "/eth": "ETH", "/btc": "BTC" };
const NETWORK_HUBS = {
  "/base": "Base",
  "/ethereum": "Ethereum",
  "/arbitrum": "Arbitrum",
  "/polygon": "Polygon",
  "/hyperevm": "HyperEVM",
  "/zksync": "zkSync",
};

if (!existsSync(PUBLIC_DIR)) {
  console.error("[sales-surfaces] public/ not found; run after `mv out public`.");
  process.exit(1);
}
if (!existsSync(VAULTS_FILE)) {
  console.error("[sales-surfaces] vaults.json not found; skipping.");
  process.exit(0);
}

const vaults = JSON.parse(readFileSync(VAULTS_FILE, "utf-8"));
const history = existsSync(HISTORY_FILE)
  ? JSON.parse(readFileSync(HISTORY_FILE, "utf-8"))
  : {};
const hidden = new Set(
  (existsSync(HIDDEN_FILE)
    ? JSON.parse(readFileSync(HIDDEN_FILE, "utf-8"))
    : []
  )
    .filter((s) => typeof s === "string" && s.trim())
    .map((s) => s.trim().toLowerCase()),
);

const histFor = (v) =>
  history[v.contractAddress] ??
  history[(v.contractAddress || "").toLowerCase()] ??
  null;

// isStaleApyHistory (src/lib/data.ts): APY value unchanged for STALE_APY_DAYS+.
function isStale(h) {
  const apy = h && Array.isArray(h.apyHistory) ? h.apyHistory : [];
  if (apy.length < 2) return false;
  const sorted = [...apy].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  const cutoff = latest.timestamp - STALE_APY_DAYS * 86400;
  for (const p of sorted) {
    if (p.apy !== latest.apy) return p.timestamp <= cutoff;
  }
  const oldest = sorted[sorted.length - 1];
  return latest.timestamp - oldest.timestamp >= STALE_APY_DAYS * 86400;
}

// isBrokenLowTvlVault (src/lib/data.ts): sub-threshold TVL with a flat
// 30-day APY history across BROKEN_MIN_OBSERVATIONS+ observations.
function isBroken(v, h) {
  if (v.tvl <= 0 || v.tvl >= BROKEN_TVL_THRESHOLD) return false;
  const apy = h && Array.isArray(h.apyHistory) ? h.apyHistory : [];
  if (apy.length < BROKEN_MIN_OBSERVATIONS) return false;
  const sorted = [...apy].sort((a, b) => b.timestamp - a.timestamp);
  const cutoff = sorted[0].timestamp - 30 * 86400;
  const recent = sorted.filter((p) => p.timestamp >= cutoff);
  if (recent.length < BROKEN_MIN_OBSERVATIONS) return false;
  return new Set(recent.map((p) => p.apy)).size === 1;
}

// isLpPairVault (src/lib/lp-pair.ts): more than one distinct underlying logo.
function isLp(v) {
  const logos = Array.isArray(v.underlyingLogos) ? v.underlyingLogos : [];
  if (logos.length <= 1) return false;
  const symbols = new Set(
    logos
      .map((p) => (p.split("/").pop() ?? "").replace(/\.(svg|png|jpg|jpeg|webp)$/i, "").trim().toLowerCase())
      .filter(Boolean),
  );
  return symbols.size > 1;
}

// getLiveVaults (src/lib/data.ts): apy24h>0 && tvl>0, not stale, not
// broken-low-tvl, not an LP pair, not hidden.
function isLive(v) {
  const h = histFor(v);
  return (
    v.apy24h > 0 &&
    v.tvl > 0 &&
    !isStale(h) &&
    !isBroken(v, h) &&
    !isLp(v) &&
    !hidden.has((v.slug || "").toLowerCase())
  );
}

const live = vaults.filter((v) => v.slug && isLive(v));

// Ranking within a scope: sort by apy24h descending (HubTable default).
const rank = (list) =>
  [...list].sort((a, b) => (b.apy24h ?? 0) - (a.apy24h ?? 0)).map((v) => v.slug);

const surfaces = {};
surfaces["/"] = rank(live); // homepage: whole live catalogue
for (const [path, asset] of Object.entries(ASSET_HUBS)) {
  surfaces[path] = rank(live.filter((v) => v.asset === asset));
}
for (const [path, chain] of Object.entries(NETWORK_HUBS)) {
  surfaces[path] = rank(live.filter((v) => v.chain === chain));
}

// Lightweight product directory for labels in the funnel UI.
const products = {};
for (const v of live) {
  products[v.slug] = {
    name: v.productName,
    asset: v.asset,
    chain: v.chain,
    apy24h: Math.round((v.apy24h ?? 0) * 100) / 100,
  };
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const out = {
  generatedAt: new Date().toISOString(),
  note:
    "Per-surface ranked product order (apy24h desc, live-filtered) used by the /control-room/sales funnel to attribute impressions and positions. Reflects the current catalogue; on-page order can shift if a visitor re-sorts or re-filters.",
  surfaceGroups: {
    home: ["/"],
    asset: Object.keys(ASSET_HUBS),
    network: Object.keys(NETWORK_HUBS),
  },
  surfaces,
  products,
};
writeFileSync(join(OUT_DIR, "sales-surfaces.json"), JSON.stringify(out), "utf-8");

const surfaceCount = Object.keys(surfaces).length;
console.log(
  `[sales-surfaces] wrote ${surfaceCount} surfaces, ${live.length} live products to public/data/sales-surfaces.json`,
);
