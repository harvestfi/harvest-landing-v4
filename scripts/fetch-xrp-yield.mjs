#!/usr/bin/env node
// Builds data/xrp-yield.json for the /report/xrp-yield-ranking page.
//
// This is an ALLOWLIST hydrator, not a scanner: the report shows exactly the
// products in data/xrp-venues.json, and this script fills each one's live rate
// and TVL from its `source`:
//   - defillama:        yields.llama.fi/pools by poolId (+ /chart -> 30-day
//                       history for the report charts and the 90-day range)
//   - spectra-pt:       Spectra API PT max fixed rate + daily history
//   - spectra-pool:     Spectra API pool LP APY + TVL (same market address)
//   - spectra-metavault Spectra API MetaVault liveApy + TVL
//   - portals:          api.portals.fi current APY (products DeFiLlama misses;
//                       needs PORTALS_API_KEY, else falls back to the venue's
//                       staticApy/staticTvl snapshot)
//   - none:             no public rate feed -> rate shown as n/a on the page
//
// Every venue is an EXTERNAL protocol, not a Harvest product. This pipeline
// touches nothing else (no vaults.json, no Supabase). Runs hourly in the
// update-data workflow (continue-on-error); on failure the existing snapshot is
// kept, so the report degrades to "as of <last date>", never to a blank page.
//
// Offline/proxied dev (Node's fetch ignores HTTPS_PROXY): set XRP_LLAMA_CACHE
// (pools.json, chart-<id>.json), SPECTRA_CACHE (pt-<addr>.json,
// pt-<addr>-chart.json, metavaults.json) and PORTALS_CACHE (portals-<key>.json)
// to read cached responses instead of the network.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadVenues } from "./apply-xrp-overrides.mjs";
import { fetchSpectraMarket, fetchSpectraMetavault } from "./fetch-spectra.mjs";
import {
  getPrices,
  readOnchain,
  aerodromePool,
  aerodromeMean30d,
  BASE_FEEDS,
} from "./lib/xrp-onchain-adapters.mjs";

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, "data", "xrp-yield.json");

const LLAMA_CACHE = process.env.XRP_LLAMA_CACHE || null;
const PORTALS_CACHE = process.env.PORTALS_CACHE || null;
const PORTALS_KEY = process.env.PORTALS_API_KEY || null;

function readCache(dir, name) {
  if (!dir) return null;
  const p = join(dir, name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

async function getJson(url, cache, tries = 3) {
  if (cache) return cache;
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

const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

// One point per calendar day from a DeFiLlama chart. Keeps APY plus the TVL and
// per-share price on the same day so the report can chart landscape TVL growth
// and (for vaults) share-price appreciation, not just the rate. Older callers
// read `.apy`; the extra `.tvl`/`.pps` fields are additive and default to null.
// capDays defaults to the full series (to each pool's inception) — the report's
// per-card charts slice their own window, but the landscape aggregate wants
// depth, so we no longer truncate at the source.
function dailySeries(rows, capDays = Infinity) {
  const byDay = new Map();
  for (const r of rows || []) {
    if (!r) continue;
    const apy = Number.isFinite(r.apy) ? Math.round(r.apy * 100) / 100 : null;
    const tvl = Number.isFinite(r.tvlUsd) ? Math.round(r.tvlUsd) : null;
    const pps = Number.isFinite(r.pricePerShare)
      ? Math.round(r.pricePerShare * 1e6) / 1e6
      : null;
    if (apy == null && tvl == null) continue;
    byDay.set(String(r.timestamp).slice(0, 10), { apy, tvl, pps });
  }
  const out = [...byDay.entries()]
    .map(([d, v]) => ({ d, apy: v.apy, tvl: v.tvl, pps: v.pps }))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  return Number.isFinite(capDays) ? out.slice(-capDays) : out;
}

// Base row shared by every product, from its venue display fields. Live metrics
// are filled per source below.
function baseRow(v) {
  return {
    id: v.slug,
    chain: v.chain,
    project: v.slug,
    platform: v.platform,
    platformUrl: v.url,
    category: v.productType ?? null,
    symbol: v.symbol,
    poolMeta: v.detail ?? null,
    // Ranking Product column: clean asset headline + smaller detail sub-line.
    asset: v.asset,
    detail: v.detail ?? null,
    entity: v.entity ?? null,
    tvlUsd: 0,
    apy: null,
    apyBase: null,
    apyReward: null,
    apyMean30d: null,
    rewardShare: 0,
    incentivized: false,
    ilRisk: v.exposure === "multi" ? "yes" : "no",
    exposure: v.exposure ?? "single",
    stablecoin: false,
    observations: null,
    llamaUrl: v.url,
    inception: null,
    range90d: null,
    curated: true,
    productType: v.productType ?? null,
    venueSlug: v.slug,
    displayName: v.asset,
    // "30d" when the rate is a 30-day average / fixed rate; "current" when it is
    // a live spot APY (Portals, Spectra pool/metavault); "na" when unavailable.
    rateBasis: "30d",
    rateNa: false,
    // When the displayed rate deliberately excludes an off-chain reward we
    // can't read on-chain (e.g. SparkDEX's rFLR), the row carries this note.
    offchainRewardNote: v.offchainRewardNote ?? null,
  };
}

async function portalsCurrent(key) {
  const safe = key.replace(/[:]/g, "_");
  const cached = readCache(PORTALS_CACHE, `portals-${safe}.json`);
  if (cached) return cached;
  if (!PORTALS_KEY) return null;
  const url = `https://api.portals.fi/v2/tokens?addresses=${encodeURIComponent(key)}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { accept: "application/json", Authorization: `Bearer ${PORTALS_KEY}` },
      });
      if (r.ok) return await r.json();
      console.error(`[xrp-yield] portals ${key} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[xrp-yield] portals ${key} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return null;
}

// Daily {d, apy, tvl, pps} history for a Portals token, to inception. The paid
// /v2/tokens/history endpoint (id=<network:address>) returns per-day points
// carrying liquidity (TVL), pricePerShare and apy — the same shape we derive
// from DeFiLlama's /chart, so the landscape aggregate can sum both sources on
// one axis. Newest-first from the API; we sort ascending. Needs PORTALS_KEY.
async function portalsHistory(key) {
  const safe = key.replace(/[:]/g, "_");
  const cached = readCache(PORTALS_CACHE, `portals-hist-${safe}.json`);
  let doc = cached;
  if (!doc) {
    if (!PORTALS_KEY) return [];
    const url = `https://api.portals.fi/v2/tokens/history?id=${encodeURIComponent(key)}`;
    for (let i = 0; i < 3 && !doc; i++) {
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(30_000),
          headers: { accept: "application/json", Authorization: `Bearer ${PORTALS_KEY}` },
        });
        if (r.ok) doc = await r.json();
        else console.error(`[xrp-yield] portals history ${key} -> HTTP ${r.status}`);
      } catch (e) {
        console.error(`[xrp-yield] portals history ${key} -> ${e.message ?? e}`);
      }
      if (!doc) await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
    }
  }
  const rows = Array.isArray(doc?.history) ? doc.history : [];
  const byDay = new Map();
  for (const r of rows) {
    const d = String(r?.time ?? "").slice(0, 10);
    if (!d) continue;
    const apy = Number.isFinite(+r.apy) ? Math.round(+r.apy * 100) / 100 : null;
    const tvl = Number.isFinite(+r.liquidity) ? Math.round(+r.liquidity) : null;
    const pps = Number.isFinite(+r.pricePerShare)
      ? Math.round(+r.pricePerShare * 1e6) / 1e6
      : null;
    if (apy == null && tvl == null) continue;
    byDay.set(d, { apy, tvl, pps });
  }
  return [...byDay.entries()]
    .map(([d, v]) => ({ d, apy: v.apy, tvl: v.tvl, pps: v.pps }))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
}

const main = async () => {
  const venues = loadVenues(ROOT);
  if (!venues.length) {
    console.error("[xrp-yield] no canonical venues; keeping existing snapshot.");
    process.exit(0);
  }

  // Carry forward the enrichment that separate (daily) scripts add to the same
  // file — landscape aggregate, yield-trading activity, and per-pool holder
  // counts. This script rebuilds pools/stats every hour; without preserving
  // these the hourly run would strip the report's Landscape, Most-popular and
  // Trading sections until the next daily pipeline re-added them.
  let prev = null;
  try {
    if (existsSync(OUT_FILE)) prev = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
  } catch {
    prev = null;
  }
  const prevHolders = new Map();
  const prevHistory = new Map();
  const prevSource = new Map();
  for (const p of prev?.pools ?? []) {
    const key = p.venueSlug ?? p.id;
    if (!key) continue;
    if (p.holders) prevHolders.set(key, p.holders);
    if (Array.isArray(p.history) && p.history.length) prevHistory.set(key, p.history);
    if (p.source) prevSource.set(key, p.source);
  }

  // DeFiLlama pools once, indexed by poolId for the defillama-sourced rows.
  const needLlama = venues.some((v) => v.source?.kind === "defillama");
  let byId = new Map();
  if (needLlama) {
    const poolsRes = await getJson(
      "https://yields.llama.fi/pools",
      readCache(LLAMA_CACHE, "pools.json"),
    );
    const all = poolsRes?.data;
    if (Array.isArray(all)) for (const p of all) byId.set(p.pool, p);
    else console.error("[xrp-yield] DeFiLlama pools unreachable; defillama rows may be rate-n/a.");
  }

  // On-chain venues read their rate + TVL straight from Base/Flare state. Fetch
  // the shared prices (XRP/FLR from FTSOv2, ETH/BTC/AERO from Chainlink, WELL
  // from the explorer) once for the whole run.
  const NOW = Math.floor(Date.now() / 1000);
  const needOnchain = venues.some((v) => v.source?.kind === "onchain");
  const prices = needOnchain ? await getPrices() : null;

  const pools = [];
  for (const v of venues) {
    const row = baseRow(v);
    const src = v.source ?? { kind: "none" };
    try {
      if (src.kind === "defillama") {
        const p = byId.get(src.poolId);
        if (p) {
          row.id = p.pool;
          row.llamaUrl = `https://defillama.com/yields/pool/${p.pool}`;
          row.apy = Number.isFinite(p.apy) ? p.apy : null;
          row.apyBase = Number.isFinite(p.apyBase) ? p.apyBase : null;
          row.apyReward = Number.isFinite(p.apyReward) ? p.apyReward : null;
          row.apyMean30d = Number.isFinite(p.apyMean30d) ? p.apyMean30d : null;
          row.tvlUsd = Math.round(p.tvlUsd ?? 0);
          row.stablecoin = !!p.stablecoin;
          row.observations = Number.isFinite(p.count) ? p.count : null;
          const rs = row.apy && row.apy > 0 && row.apyReward != null ? row.apyReward / row.apy : 0;
          row.rewardShare = Math.round(rs * 100) / 100;
          row.incentivized = rs > 0.5;
          // Daily history + 90-day range for the charts.
          const chart = await getJson(
            `https://yields.llama.fi/chart/${p.pool}`,
            readCache(LLAMA_CACHE, `chart-${p.pool}.json`),
            2,
          );
          const rows = chart?.data;
          if (Array.isArray(rows) && rows.length) {
            row.inception = String(rows[0]?.timestamp ?? "").slice(0, 10) || null;
            const tail = rows.slice(-90).map((r) => r.apy).filter(Number.isFinite);
            if (tail.length >= 7) {
              row.range90d = {
                min: Math.round(Math.min(...tail) * 100) / 100,
                max: Math.round(Math.max(...tail) * 100) / 100,
              };
            }
            const hist = dailySeries(rows);
            if (hist.length >= 2) row.history = hist;
          }
          await new Promise((res) => setTimeout(res, 300));
        } else {
          row.rateNa = true;
          row.rateBasis = "na";
          console.error(`[xrp-yield] defillama pool ${src.poolId} not found for ${v.slug}.`);
        }
      } else if (src.kind === "spectra-pt") {
        const m = await fetchSpectraMarket(src.address);
        if (m && m.ptApy != null) {
          row.apy = m.ptApy;
          row.apyBase = m.ptApy;
          row.apyMean30d = m.ptMean30d ?? m.ptApy;
          row.tvlUsd = m.tvlUsd;
          row.observations = m.observations;
          row.inception = m.inception;
          row.range90d = m.range90d;
          if ((m.history?.length ?? 0) >= 2) row.history = m.history;
          if (m.matLabel) row.detail = v.detail ?? `PT · ${m.matLabel}`;
        } else {
          row.rateNa = true;
          row.rateBasis = "na";
        }
      } else if (src.kind === "spectra-pool") {
        const m = await fetchSpectraMarket(src.address);
        if (m && m.lpApy != null) {
          row.apy = m.lpApy;
          row.tvlUsd = m.tvlUsd;
          row.rewardShare = m.lpRewardShare ?? 0;
          row.incentivized = (m.lpRewardShare ?? 0) > 0.5;
          row.rateBasis = "current";
        } else {
          row.rateNa = true;
          row.rateBasis = "na";
          if (src.staticTvl) row.tvlUsd = src.staticTvl;
        }
      } else if (src.kind === "spectra-metavault") {
        const mv = await fetchSpectraMetavault(src.address);
        if (mv && mv.apy != null) {
          row.apy = mv.apy;
          row.tvlUsd = mv.tvlUsd;
          row.rewardShare = mv.rewardShare ?? 0;
          row.incentivized = (mv.rewardShare ?? 0) > 0.5;
          row.rateBasis = "current";
        } else {
          row.rateNa = true;
          row.rateBasis = "na";
        }
      } else if (src.kind === "portals") {
        const doc = await portalsCurrent(src.portalsKey);
        const t = doc?.tokens?.[0];
        const m = t?.metrics ?? {};
        const apy = m.apy != null ? +m.apy : src.staticApy ?? null;
        row.apy = apy;
        row.apyBase = m.baseApy != null ? +m.baseApy : null;
        row.apyReward = m.rewardApy != null ? +m.rewardApy : null;
        row.tvlUsd = Math.round(t?.liquidity ?? src.staticTvl ?? 0);
        const rs = apy && apy > 0 && row.apyReward != null ? row.apyReward / apy : 0;
        row.rewardShare = Math.round(rs * 100) / 100;
        row.incentivized = rs > 0.5;
        row.rateBasis = "current";
        if (apy == null) {
          row.rateNa = true;
          row.rateBasis = "na";
        }
        // Daily TVL/APY/share-price to inception for the landscape aggregate.
        const phist = await portalsHistory(src.portalsKey);
        if (phist.length >= 2) {
          row.history = phist;
          row.inception = phist[0].d;
          const rates = phist.map((h) => h.apy).filter(Number.isFinite).slice(-90);
          if (rates.length >= 7) {
            row.range90d = {
              min: Math.round(Math.min(...rates) * 100) / 100,
              max: Math.round(Math.max(...rates) * 100) / 100,
            };
          }
        }
      } else if (src.kind === "onchain") {
        // Read APY + TVL directly from chain state (see scripts/lib).
        if (src.protocol === "aerodrome") {
          // Small, emission-driven pools: spot APR swings hard, so the headline
          // is a weekly-sampled mean and the row is flagged high-variance.
          const cfg = { ...src, pairFeed: BASE_FEEDS[src.pairFeed], aeroUsd: prices.aero };
          const spot = await aerodromePool({ ...cfg, now: NOW });
          const m = await aerodromeMean30d(cfg, NOW);
          const apy = m ? m.mean : spot.apy;
          row.apy = apy;
          row.apyMean30d = apy;
          row.apyBase = m ? m.feeApr : spot.feeApr; // swap fees
          row.apyReward = m ? m.emissionMean : spot.emissionApr; // AERO emissions
          row.tvlUsd = spot.tvlUsd;
          row.rateBasis = "30d";
          row.variance = "high";
          row.incentivized = true;
          row.rewardShare = apy > 0 ? Math.round((row.apyReward / apy) * 100) / 100 : 0;
        } else {
          const r = await readOnchain(src, { now: NOW, prices });
          row.apy = r.apy;
          row.apyBase = r.apyBase ?? null;
          row.apyReward = r.apyReward ?? null;
          row.apyMean30d = r.apyMean30d ?? r.apy;
          row.tvlUsd = r.tvlUsd;
          // Lending/pool spot rates read as "current"; the vault's realized
          // figure is a trailing average.
          row.rateBasis = src.protocol === "mystic-vault" ? "30d" : "current";
          if (r.apyReward != null && r.apy > 0) {
            row.rewardShare = Math.round((r.apyReward / r.apy) * 100) / 100;
            row.incentivized = r.apyReward / r.apy > 0.5;
          }
        }
        row.source = "onchain";
        row.llamaUrl = v.url;
      } else {
        // kind === "none": tracked, but no public rate feed.
        row.rateNa = true;
        row.rateBasis = "na";
        if (src.staticTvl) row.tvlUsd = src.staticTvl;
      }
    } catch (e) {
      console.error(`[xrp-yield] ${v.slug} hydrate failed:`, e?.message ?? e);
      row.rateNa = true;
      row.rateBasis = "na";
    }
    pools.push(row);
  }

  // Re-attach enrichment that this script doesn't produce itself: holder counts
  // (from fetch-xrp-holders) always, and a daily-backfilled history where this
  // run didn't already capture one. Keeps the report whole between daily runs.
  const today = new Date(NOW * 1000).toISOString().slice(0, 10);
  for (const p of pools) {
    const key = p.venueSlug ?? p.id;
    if (!key) continue;
    if (!p.holders && prevHolders.has(key)) p.holders = prevHolders.get(key);
    if (p.source === "onchain") {
      // On-chain venues accumulate their OWN daily series: carry prior on-chain
      // points (never stale aggregator history from before the switch), then
      // append today's reading. One point per UTC day; keep ~90 days.
      const prior = prevSource.get(key) === "onchain" ? prevHistory.get(key) ?? [] : [];
      if (!p.rateNa && Number.isFinite(p.apy)) {
        const merged = prior.filter((h) => h.d !== today);
        merged.push({ d: today, apy: p.apy, tvl: p.tvlUsd });
        p.history = merged.slice(-90);
        p.inception = p.history[0]?.d ?? today;
        const tail = p.history.slice(-90).map((h) => h.apy).filter(Number.isFinite);
        if (tail.length >= 7) {
          p.range90d = {
            min: Math.round(Math.min(...tail) * 100) / 100,
            max: Math.round(Math.max(...tail) * 100) / 100,
          };
        }
      }
    } else if ((p.history?.length ?? 0) < 2 && prevHistory.has(key)) {
      p.history = prevHistory.get(key);
    }
  }

  // Rank by best available rate (30-day mean or current), n/a rows last.
  const rateOf = (p) => (p.rateNa ? -Infinity : p.apyMean30d ?? p.apy ?? -Infinity);
  pools.sort((a, b) => rateOf(b) - rateOf(a));

  const rated = pools.filter((p) => !p.rateNa).map((p) => p.apyMean30d ?? p.apy);
  const sorted = [...rated].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  const out = {
    generatedAt: new Date().toISOString(),
    source: "on-chain reads (Base + Flare) and the Spectra API",
    stats: {
      venues: pools.length,
      rated: rated.length,
      chains: [...new Set(pools.map((p) => p.chain))],
      // Exclude Spectra PTs from the TVL total: a PT and its liquidity pool
      // share the same underlying liquidity, so summing both double-counts it.
      totalTvlUsd: Math.round(
        pools
          .filter((p) => !String(p.venueSlug || p.id || "").startsWith("spectra-pt-"))
          .reduce((s, p) => s + (p.tvlUsd || 0), 0),
      ),
      medianApy: round2(median),
      incentivized: pools.filter((p) => p.incentivized).length,
    },
    venues,
    pools,
  };

  // Preserve the sections owned by the daily enrichment scripts so an hourly
  // rate refresh never drops the Landscape / Trading parts of the report.
  if (prev?.landscape) out.landscape = prev.landscape;
  if (prev?.yieldTrading) out.yieldTrading = prev.yieldTrading;

  // Only rewrite the file when something OTHER than the run stamp changed.
  //
  // WHY: `generatedAt` used to be set to now() on every run and written
  // unconditionally. Because it lives inside the file the workflow diffs, the
  // "commit only if changed" guard in update-data.yml / update-xrp-data.yml
  // could never fire — the file was always byte-different, so every run
  // committed, every commit rebuilt, and the report's visible "Last updated"
  // date plus its three schema `dateModified` fields advanced whether or not a
  // single rate had moved. That trains answer engines to read our freshness
  // signal as a pipeline heartbeat carrying no information, which is expensive
  // for a site whose whole citation strategy rests on those dates.
  //
  // With this guard, `generatedAt` means "when the data last changed". If the
  // report's figures are identical, the file is left untouched, the workflow's
  // guard fires, and no rebuild happens. Note this does not stop most hourly
  // commits — on-chain rates and oracle-priced TVL genuinely move — but it does
  // make the claim true: if the date advanced, something changed.
  if (prev && canonicalJson(stripRunStamp(prev)) === canonicalJson(stripRunStamp(out))) {
    console.log(
      "[xrp-yield] no material change since the last snapshot; leaving data/xrp-yield.json (and its generatedAt) untouched.",
    );
    return;
  }

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf-8");
  console.log(
    `[xrp-yield] wrote ${pools.length} products (${rated.length} rated) across ${out.stats.chains.length} chains, median ${out.stats.medianApy}% -> data/xrp-yield.json`,
  );
};

// Drop the only field this script stamps with wall-clock time, so two snapshots
// can be compared on their actual content. The nested stamps
// (landscape.generatedAt, yieldTrading.generatedAt, pools[].holders.asOf) are
// owned by the daily enrichment scripts and are carried over verbatim, so a
// change in one of those IS a material change and should commit.
function stripRunStamp(snapshot) {
  const { generatedAt: _ignored, ...rest } = snapshot;
  return rest;
}

// Key-order-independent serialization: the enrichment scripts rewrite the file
// and may not preserve our key order, so a plain JSON.stringify comparison
// would report a false difference.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

main().catch((e) => {
  console.error("[xrp-yield] fatal:", e);
  process.exit(0);
});
