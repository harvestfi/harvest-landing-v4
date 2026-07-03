#!/usr/bin/env node
// Build-time emitter for machine-readable JSON: one file per vault at
// public/data/<slug>.json, plus a consolidated public/data/index.json.
//
// WHY: AI answer engines and autonomous agents prefer fetching clean JSON
// over scraping HTML or parsing CSV. We already expose per-vault history as
// CSV (Google Dataset distribution) and the facts in static HTML; this adds
// the agent-native surface — a single fetch returns the current APY/TVL,
// contract addresses and a history summary for a vault, and index.json
// returns the whole catalogue at once. Referenced from llms.txt and from
// each product page's Dataset schema (application/json DataDownload).
//
// Runs in the post-export phase of `npm run build` (after `mv out public`)
// so the files land in the deployed public/ rather than being wiped.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const OUT_DIR = join(PUBLIC_DIR, "data");
const VAULTS_FILE = join(ROOT, "data", "vaults.json");
const HISTORY_FILE = join(ROOT, "data", "history.json");
const CONSTANTS_FILE = join(ROOT, "src", "lib", "constants.ts");

if (!existsSync(PUBLIC_DIR)) {
  console.error("[data-json] public/ not found; run after `mv out public`.");
  process.exit(1);
}
if (!existsSync(VAULTS_FILE) || !existsSync(HISTORY_FILE)) {
  console.error("[data-json] vaults.json or history.json not found; skipping.");
  process.exit(0);
}

// Single source of truth for the canonical origin (see build-seo-static.mjs).
function readSiteUrl() {
  const src = readFileSync(CONSTANTS_FILE, "utf-8");
  const m = src.match(/export\s+const\s+SITE_URL\s*=\s*["'`]([^"'`]+)["'`]/);
  if (!m) {
    console.error("[data-json] could not find SITE_URL in constants.ts");
    process.exit(1);
  }
  return m[1].replace(/\/$/, "");
}

const SITE_URL = readSiteUrl();
const GENERATED_AT = new Date().toISOString();
const vaults = JSON.parse(readFileSync(VAULTS_FILE, "utf-8"));
const history = JSON.parse(readFileSync(HISTORY_FILE, "utf-8"));

const histFor = (v) =>
  history[v.contractAddress] ??
  history[(v.contractAddress || "").toLowerCase()] ??
  null;

const isoDay = (ts) =>
  Number.isFinite(ts) && ts > 0
    ? new Date(ts * 1000).toISOString().slice(0, 10)
    : null;

const round = (n, p = 2) =>
  Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null;

function historySummary(h) {
  if (!h) return null;
  const apy = (h.apyHistory || []).filter((p) => Number.isFinite(p.apy));
  const tvl = (h.tvlHistory || []).filter((p) => Number.isFinite(p.value));
  const sp = (h.sharePriceHistory || []).filter((p) =>
    Number.isFinite(p.sharePrice),
  );
  const stamps = [...apy, ...tvl, ...sp]
    .map((p) => p.timestamp)
    .filter((t) => Number.isFinite(t) && t > 0);
  if (stamps.length === 0) return null;
  const latestTs = Math.max(...stamps);
  const earliestTs = Math.min(...stamps);
  const at = (arr, key) => {
    const last = arr.filter((p) => p.timestamp === latestTs)[0] ?? arr.at(-1);
    return last ? round(last[key], key === "sharePrice" ? 6 : 2) : null;
  };
  return {
    dataAsOf: new Date(latestTs * 1000).toISOString(),
    range: { from: isoDay(earliestTs), to: isoDay(latestTs) },
    points: { apy: apy.length, tvl: tvl.length, sharePrice: sp.length },
    latest: {
      apyPercent: at(apy, "apy"),
      tvlUsd: at(tvl, "value"),
      sharePrice: at(sp, "sharePrice"),
    },
  };
}

// Reset the output dir each build so vaults dropped from the index don't
// leave orphan JSON files behind.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const index = [];
let written = 0;

for (const v of vaults) {
  if (!v.slug) continue;
  const url = `${SITE_URL}/${v.slug}`;
  const summary = historySummary(histFor(v));
  const record = {
    slug: v.slug,
    name: v.productName,
    asset: v.asset,
    chain: v.chain,
    protocol: v.protocol?.name ?? null,
    vaultType: v.vaultType ?? null,
    category: v.category ?? null,
    url,
    addresses: {
      vault: v.contractAddress ?? null,
      strategy: v.strategyAddress ?? null,
      token: v.tokenAddress ?? null,
    },
    apyPercent: { "24h": round(v.apy24h), "30d": round(v.apy30d) },
    tvlUsd: round(v.tvl),
    riskLevel: v.riskLevel ?? null,
    history: summary,
    dataAsOf: summary?.dataAsOf ?? null,
    generatedAt: GENERATED_AT,
    disclaimer:
      "Informational onchain analytics indexed by Harvest, not financial advice.",
  };
  writeFileSync(
    join(OUT_DIR, `${v.slug}.json`),
    JSON.stringify(record, null, 2),
    "utf-8",
  );
  written++;
  index.push({
    slug: v.slug,
    name: v.productName,
    asset: v.asset,
    chain: v.chain,
    apyPercent30d: round(v.apy30d),
    tvlUsd: round(v.tvl),
    url,
    data: `${SITE_URL}/data/${v.slug}.json`,
  });
}

index.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
writeFileSync(
  join(OUT_DIR, "index.json"),
  JSON.stringify(
    {
      site: SITE_URL,
      description:
        "Machine-readable index of every yield strategy tracked by Harvest. Each entry links to a per-vault JSON with current APY, TVL, addresses and history summary.",
      generatedAt: GENERATED_AT,
      count: index.length,
      vaults: index,
    },
    null,
    2,
  ),
  "utf-8",
);

console.log(
  `[data-json] wrote ${written} per-vault JSON + index.json (${index.length} entries) to public/data/`,
);
