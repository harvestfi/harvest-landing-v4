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

// One point per calendar day from a DeFiLlama chart, {d, apy}, capped.
function dailySeries(rows, capDays = 90) {
  const byDay = new Map();
  for (const r of rows || []) {
    if (!r || !Number.isFinite(r.apy)) continue;
    byDay.set(String(r.timestamp).slice(0, 10), Math.round(r.apy * 100) / 100);
  }
  return [...byDay.entries()]
    .map(([d, apy]) => ({ d, apy }))
    .sort((a, b) => (a.d < b.d ? -1 : 1))
    .slice(-capDays);
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

const main = async () => {
  const venues = loadVenues(ROOT);
  if (!venues.length) {
    console.error("[xrp-yield] no canonical venues; keeping existing snapshot.");
    process.exit(0);
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

  // Rank by best available rate (30-day mean or current), n/a rows last.
  const rateOf = (p) => (p.rateNa ? -Infinity : p.apyMean30d ?? p.apy ?? -Infinity);
  pools.sort((a, b) => rateOf(b) - rateOf(a));

  const rated = pools.filter((p) => !p.rateNa).map((p) => p.apyMean30d ?? p.apy);
  const sorted = [...rated].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  const out = {
    generatedAt: new Date().toISOString(),
    source: "DeFiLlama, Spectra and Portals APIs",
    stats: {
      venues: pools.length,
      rated: rated.length,
      chains: [...new Set(pools.map((p) => p.chain))],
      totalTvlUsd: Math.round(pools.reduce((s, p) => s + (p.tvlUsd || 0), 0)),
      medianApy: round2(median),
      incentivized: pools.filter((p) => p.incentivized).length,
    },
    venues,
    pools,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf-8");
  console.log(
    `[xrp-yield] wrote ${pools.length} products (${rated.length} rated) across ${out.stats.chains.length} chains, median ${out.stats.medianApy}% -> data/xrp-yield.json`,
  );
};

main().catch((e) => {
  console.error("[xrp-yield] fatal:", e);
  process.exit(0);
});
