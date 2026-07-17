#!/usr/bin/env node
// Fetches every XRP-family yield venue DeFiLlama tracks (XRP, wrapped XRP
// variants like FXRP/WXRP/cbXRP, and Ripple's RLUSD stablecoin) and writes
// data/xrp-yield.json for the /report/xrp-yield-ranking page.
//
// This powers an EXTERNAL-data report: none of these venues are Harvest
// products, and this pipeline deliberately touches nothing else - no
// vaults.json, no Supabase, no product data. Free DeFiLlama endpoints only:
//
//   yields.llama.fi/pools        current APY (base/reward split), TVL,
//                                30d mean APY, per-pool observation count
//   yields.llama.fi/chart/{id}   daily history -> first-tracked date and the
//                                90-day rate range (top pools only)
//   api.llama.fi/protocols       platform name, website, category (drives the
//                                Discover link + yield-source classification)
//
// Runs in the hourly update-data workflow (continue-on-error). If the API is
// unreachable or the filter comes back empty, the existing snapshot is kept -
// the report degrades to "as of <last date>", never to a blank page.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadVenues, applyOverrides } from "./apply-xrp-overrides.mjs";

// Optional local cache for offline / proxied dev (Node's fetch ignores
// HTTPS_PROXY, unlike curl). Set XRP_LLAMA_CACHE=<dir> holding pools.json,
// protocols.json and chart-<poolId>.json to read those instead of the network.
// Unset in CI, so CI always fetches live.
const CACHE_DIR = process.env.XRP_LLAMA_CACHE || null;
function cacheFor(url) {
  if (!CACHE_DIR) return null;
  let name = null;
  if (url.endsWith("/pools")) name = "pools.json";
  else if (url.endsWith("/protocols")) name = "protocols.json";
  else {
    const m = url.match(/\/chart\/([^/?]+)/);
    if (m) name = `chart-${m[1]}.json`;
  }
  if (!name) return null;
  const p = join(CACHE_DIR, name);
  return existsSync(p) ? p : null;
}

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, "data", "xrp-yield.json");

// Ignore dust so the ranking can't be gamed by a $3k pool paying 400%
// emissions for a week.
const MIN_TVL_USD = 25_000;
// Venues to omit by keyword (matched against symbol / poolMeta / project /
// platform, case-insensitive). mXRP is a Midas RWA wrapper, not a DeFi yield
// venue in the sense this report covers.
const EXCLUDE_KEYWORDS = ["mxrp", "midas"];
function isExcluded(p) {
  const hay = `${p.symbol ?? ""} ${p.poolMeta ?? ""} ${p.project ?? ""}`.toLowerCase();
  return EXCLUDE_KEYWORDS.some((k) => hay.includes(k));
}
// Pools that get the expensive per-pool history call (inception + 90d range).
const DETAIL_POOLS = 15;
// Hard cap on rows kept in the snapshot.
const MAX_POOLS = 40;

async function getJson(url, tries = 3) {
  const cached = cacheFor(url);
  if (cached) {
    try {
      return JSON.parse(readFileSync(cached, "utf-8"));
    } catch {
      /* fall through to network */
    }
  }
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { accept: "application/json" },
      });
      if (r.ok) return await r.json();
      console.error(`[xrp-yield] ${url} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[xrp-yield] ${url} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return null;
}

// A symbol token counts as XRP-denominated when it IS XRP or a short wrapped
// variant (WXRP, FXRP, CBXRP, STXRP, SXRP...). RLUSD - Ripple's dollar
// stablecoin - is intentionally NOT XRP-denominated, so pools whose only
// XRP-adjacent token is RLUSD are excluded (an XRP-RLUSD pair still qualifies
// on its XRP leg). Token-wise match on the dash-separated symbol so "XRP-USDC"
// qualifies but "TOKENXRPX" noise doesn't.
function isXrpToken(t) {
  const u = (t || "").toUpperCase();
  return u === "XRP" || (u.endsWith("XRP") && u.length <= 6);
}
function poolMatches(symbol) {
  return (symbol || "")
    .split(/[-_/\s]+/)
    .some((t) => isXrpToken(t));
}

const main = async () => {
  const [poolsRes, protocolsRes] = await Promise.all([
    getJson("https://yields.llama.fi/pools"),
    getJson("https://api.llama.fi/protocols"),
  ]);
  const all = poolsRes?.data;
  if (!Array.isArray(all) || all.length === 0) {
    console.error("[xrp-yield] pools endpoint empty/unreachable; keeping existing snapshot.");
    process.exit(0);
  }

  // project slug -> { name, url, category } for Discover links + classification.
  const protoMeta = new Map();
  if (Array.isArray(protocolsRes)) {
    for (const p of protocolsRes) {
      if (p?.slug) {
        protoMeta.set(p.slug, {
          name: p.name ?? p.slug,
          url: typeof p.url === "string" ? p.url : null,
          category: p.category ?? null,
        });
      }
    }
  }

  const prettify = (slug) =>
    (slug || "")
      .split("-")
      .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
      .join(" ");

  let pools = all
    .filter(
      (p) =>
        poolMatches(p.symbol) &&
        !isExcluded(p) &&
        !p.outlier &&
        Number.isFinite(p.tvlUsd) &&
        p.tvlUsd >= MIN_TVL_USD &&
        (Number.isFinite(p.apy) || Number.isFinite(p.apyMean30d)),
    )
    .map((p) => {
      const meta = protoMeta.get(p.project) ?? null;
      const apy = Number.isFinite(p.apy) ? p.apy : null;
      const apyBase = Number.isFinite(p.apyBase) ? p.apyBase : null;
      const apyReward = Number.isFinite(p.apyReward) ? p.apyReward : null;
      const rewardShare =
        apy && apy > 0 && apyReward != null ? apyReward / apy : 0;
      return {
        id: p.pool,
        chain: p.chain,
        project: p.project,
        platform: meta?.name ?? prettify(p.project),
        platformUrl: meta?.url ?? null,
        category: meta?.category ?? null,
        symbol: p.symbol,
        poolMeta: p.poolMeta ?? null,
        tvlUsd: Math.round(p.tvlUsd),
        apy,
        apyBase,
        apyReward,
        apyMean30d: Number.isFinite(p.apyMean30d) ? p.apyMean30d : null,
        // "heavily incentivised": most of the headline rate is emissions.
        rewardShare: Math.round(rewardShare * 100) / 100,
        incentivized: rewardShare > 0.5,
        ilRisk: p.ilRisk ?? null,
        exposure: p.exposure ?? null, // "single" | "multi"
        stablecoin: !!p.stablecoin,
        // Daily observations DeFiLlama holds for this pool (track-record proxy).
        observations: Number.isFinite(p.count) ? p.count : null,
        llamaUrl: `https://defillama.com/yields/pool/${p.pool}`,
        inception: null, // filled from chart below for top pools
        range90d: null, // { min, max } APY over trailing 90 tracked days
      };
    });

  // Drop venues paying nothing (0% headline rate): they're not opportunities.
  pools = pools.filter((p) => (p.apyMean30d ?? p.apy ?? 0) > 0);

  // Historical rate first: rank by 30d mean APY (falls back to spot APY), so a
  // one-day emissions spike can't top the table.
  pools.sort(
    (a, b) => (b.apyMean30d ?? b.apy ?? 0) - (a.apyMean30d ?? a.apy ?? 0),
  );
  pools = pools.slice(0, MAX_POOLS);

  // Per-pool history for the top of the ranking: first-tracked date + 90d
  // rate range. Sequential + throttled; failures leave the fields null.
  for (const p of pools.slice(0, DETAIL_POOLS)) {
    const chart = await getJson(`https://yields.llama.fi/chart/${p.id}`, 2);
    const rows = chart?.data;
    if (Array.isArray(rows) && rows.length > 0) {
      const first = rows[0]?.timestamp;
      if (first) p.inception = String(first).slice(0, 10);
      const tail = rows
        .slice(-90)
        .map((r) => r.apy)
        .filter((v) => Number.isFinite(v));
      if (tail.length >= 7) {
        p.range90d = {
          min: Math.round(Math.min(...tail) * 100) / 100,
          max: Math.round(Math.max(...tail) * 100) / 100,
        };
      }
    }
    await new Promise((res) => setTimeout(res, 300));
  }

  if (pools.length === 0) {
    console.error("[xrp-yield] zero pools matched the XRP/RLUSD filter; keeping existing snapshot.");
    process.exit(0);
  }

  // Curated overrides: swap generic platform links for real product deep-links
  // on matching rows, and embed the curated venue list for the report's info
  // section. Kept here (not the report page) so the hourly cron preserves them.
  const venues = loadVenues(ROOT);
  const overridden = applyOverrides(pools, venues);
  if (overridden > 0) console.log(`[xrp-yield] applied ${overridden} curated link override(s).`);

  // Spectra Principal Token fixed rates (single-exposure "Fixed-Rate" rows).
  // Gated OFF until the api.spectra.finance response shape is confirmed; enable
  // by setting XRP_SPECTRA_PT=1 (locally with SPECTRA_CACHE, or in the workflow
  // once verified). Failure never blocks the DeFiLlama snapshot.
  if (process.env.XRP_SPECTRA_PT === "1") {
    try {
      const { fetchSpectraPTs } = await import("./fetch-spectra-pt.mjs");
      const pts = await fetchSpectraPTs();
      if (pts.length) {
        pools.push(...pts);
        pools.sort((a, b) => (b.apyMean30d ?? b.apy ?? 0) - (a.apyMean30d ?? a.apy ?? 0));
        console.log(`[xrp-yield] added ${pts.length} Spectra PT row(s).`);
      }
    } catch (e) {
      console.error("[xrp-yield] Spectra PT fetch failed:", e?.message ?? e);
    }
  }

  const apys = pools.map((p) => p.apyMean30d ?? p.apy ?? 0).sort((a, b) => a - b);
  const median = apys[Math.floor(apys.length / 2)] ?? 0;
  const out = {
    generatedAt: new Date().toISOString(),
    source: "DeFiLlama (yields.llama.fi), free API",
    minTvlUsd: MIN_TVL_USD,
    stats: {
      venues: pools.length,
      chains: [...new Set(pools.map((p) => p.chain))],
      totalTvlUsd: Math.round(pools.reduce((s, p) => s + p.tvlUsd, 0)),
      medianApy: Math.round(median * 100) / 100,
      incentivized: pools.filter((p) => p.incentivized).length,
    },
    venues,
    pools,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf-8");
  console.log(
    `[xrp-yield] wrote ${pools.length} venues across ${out.stats.chains.length} chains (median 30d APY ${out.stats.medianApy}%) -> data/xrp-yield.json`,
  );
};

main().catch((e) => {
  // Never fail the data workflow over the report feed.
  console.error("[xrp-yield] fatal:", e);
  process.exit(0);
});
