#!/usr/bin/env node
// Build-time emitter for the XRP-yield report's machine-readable data surface.
//
// WHY: /report/xrp-yield-ranking tracks a curated set of XRP DeFi products with
// a daily rate history each. AI answer engines and autonomous agents prefer
// fetching clean JSON/CSV over scraping the HTML table, so this script writes,
// for every product in data/xrp-yield.json:
//   public/data/xrp-yield/index.json      - the whole catalogue in one fetch
//   public/data/xrp-yield/<slug>.json     - one product: metadata + daily rate history
//   public/data/xrp-yield/<slug>.csv      - one product: date,apy_percent (history only)
//   public/data/xrp-yield/history.csv     - all products, long format, one file
// These are referenced from llms.txt and from the report page's Dataset
// JSON-LD (DataDownload distribution), so crawlers can discover them.
//
// Runs in the post-export phase of `npm run build` (after `mv out public`) so
// the files land in the deployed public/ rather than being wiped. Reads only
// the already-generated data/xrp-yield.json (no network), so it is safe to run
// offline and stays in lockstep with what the page renders.

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
const OUT_DIR = join(PUBLIC_DIR, "data", "xrp-yield");
const DATA_FILE = join(ROOT, "data", "xrp-yield.json");
const CONSTANTS_FILE = join(ROOT, "src", "lib", "constants.ts");

if (!existsSync(PUBLIC_DIR)) {
  console.error("[xrp-history] public/ not found; run after `mv out public`.");
  process.exit(1);
}
if (!existsSync(DATA_FILE)) {
  console.error("[xrp-history] data/xrp-yield.json not found; skipping.");
  process.exit(0);
}

// Single source of truth for the canonical origin (see build-seo-static.mjs).
function readSiteUrl() {
  const src = readFileSync(CONSTANTS_FILE, "utf-8");
  const m = src.match(/export\s+const\s+SITE_URL\s*=\s*["'`]([^"'`]+)["'`]/);
  if (!m) {
    console.error("[xrp-history] could not find SITE_URL in constants.ts");
    process.exit(1);
  }
  return m[1].replace(/\/$/, "");
}

const SITE_URL = readSiteUrl();
const GENERATED_AT = new Date().toISOString();
const REPORT_URL = `${SITE_URL}/report/xrp-yield-ranking`;
const LICENSE = "https://creativecommons.org/licenses/by/4.0/";
const DISCLAIMER =
  "Externally sourced (DeFiLlama, Spectra, Portals) XRP DeFi yield data indexed by Harvest for research, not financial advice. Every venue is a third-party protocol, not a Harvest product.";

const data = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
const pools = Array.isArray(data.pools) ? data.pools : [];

const round = (n, p = 2) =>
  Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null;
// A rate basis tag so consumers know what a number means: "30d" mean, live
// "current" spot, or a locked fixed rate.
const rateOf = (p) => (Number.isFinite(p.apyMean30d) ? p.apyMean30d : p.apy);
// CSV cell: never emit "null"/"undefined"; blank for missing.
const cell = (v) => (v == null || v === "" ? "" : String(v));
// A field is safe to embed in a CSV without quoting here (dates, numbers,
// short slugs/symbols) — but guard commas defensively anyway.
const csvSafe = (s) => {
  const str = String(s ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// Reset the output dir each build so products dropped from the allowlist don't
// leave orphan files behind.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const index = [];
const comboRows = ["slug,asset,platform,chain,date,apy_percent"];
let jsonWritten = 0;
let csvWritten = 0;

for (const p of pools) {
  const slug = p.venueSlug || p.project || p.id;
  if (!slug) continue;

  const history = Array.isArray(p.history)
    ? p.history
        .filter((h) => h && h.d && Number.isFinite(h.apy))
        .map((h) => ({ date: h.d, apyPercent: round(h.apy) }))
    : [];
  const dataAsOf = history.length ? history[history.length - 1].date : null;

  const jsonUrl = `${SITE_URL}/data/xrp-yield/${slug}.json`;
  const csvUrl = history.length
    ? `${SITE_URL}/data/xrp-yield/${slug}.csv`
    : null;

  // --- per-product JSON: metadata + full daily rate history ---
  const record = {
    slug,
    asset: p.asset ?? p.symbol ?? null,
    detail: p.detail ?? null,
    symbol: p.symbol ?? null,
    platform: p.platform ?? null,
    entity: p.entity ?? null,
    chain: p.chain ?? null,
    productType: p.productType ?? p.category ?? null,
    exposure: p.exposure ?? null,
    url: p.platformUrl ?? p.llamaUrl ?? null,
    rate: {
      basis: p.rateBasis ?? null,
      apyPercent: round(rateOf(p)),
      apyPercentCurrent: round(p.apy),
      apyPercent30dMean: round(p.apyMean30d),
    },
    tvlUsd: round(p.tvlUsd, 0),
    range90dPercent: p.range90d
      ? { min: round(p.range90d.min), max: round(p.range90d.max) }
      : null,
    incentivized: !!p.incentivized,
    rewardSharePercent: round((p.rewardShare ?? 0) * 100),
    historyPoints: history.length,
    dailyHistory: history,
    dataAsOf,
    source: {
      name: "DeFiLlama, Spectra and Portals",
      pageUrl: REPORT_URL,
      csv: csvUrl,
    },
    generatedAt: GENERATED_AT,
    license: LICENSE,
    disclaimer: DISCLAIMER,
  };
  writeFileSync(
    join(OUT_DIR, `${slug}.json`),
    JSON.stringify(record, null, 2),
    "utf-8",
  );
  jsonWritten++;

  // --- per-product CSV: date,apy_percent (only if there is a history) ---
  if (history.length) {
    const lines = ["date,apy_percent"];
    for (const h of history) lines.push(`${h.date},${cell(h.apyPercent)}`);
    writeFileSync(join(OUT_DIR, `${slug}.csv`), lines.join("\n") + "\n", "utf-8");
    csvWritten++;
    for (const h of history) {
      comboRows.push(
        [
          csvSafe(slug),
          csvSafe(p.asset ?? p.symbol ?? ""),
          csvSafe(p.platform ?? ""),
          csvSafe(p.chain ?? ""),
          h.date,
          cell(h.apyPercent),
        ].join(","),
      );
    }
  }

  index.push({
    slug,
    asset: p.asset ?? p.symbol ?? null,
    detail: p.detail ?? null,
    platform: p.platform ?? null,
    chain: p.chain ?? null,
    productType: p.productType ?? p.category ?? null,
    apyPercent30d: round(rateOf(p)),
    tvlUsd: round(p.tvlUsd, 0),
    historyPoints: history.length,
    url: p.platformUrl ?? p.llamaUrl ?? null,
    data: jsonUrl,
    history: csvUrl,
  });
}

// Deepest-TVL first, mirroring how the page frames "where deposits concentrate".
index.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));

writeFileSync(
  join(OUT_DIR, "index.json"),
  JSON.stringify(
    {
      name: "XRP DeFi yield ranking dataset",
      description:
        "Machine-readable index of every XRP-denominated DeFi yield product tracked by the Harvest XRP Yield Ranking report. Each entry links to a per-product JSON (metadata + full daily rate history) and a per-product CSV. Externally sourced from DeFiLlama, Spectra and Portals; refreshed hourly.",
      page: REPORT_URL,
      generatedAt: GENERATED_AT,
      dataAsOf: data.generatedAt ?? GENERATED_AT,
      count: index.length,
      combinedHistoryCsv: `${SITE_URL}/data/xrp-yield/history.csv`,
      license: LICENSE,
      disclaimer: DISCLAIMER,
      products: index,
    },
    null,
    2,
  ),
  "utf-8",
);

// One combined long-format CSV: every product's daily history in a single file.
writeFileSync(
  join(OUT_DIR, "history.csv"),
  comboRows.join("\n") + "\n",
  "utf-8",
);

console.log(
  `[xrp-history] wrote ${jsonWritten} JSON + ${csvWritten} CSV + index.json + history.csv (${index.length} products) to public/data/xrp-yield/`,
);
