#!/usr/bin/env node
// One-off / repeatable backfill: enrich each DeFiLlama-sourced product's daily
// history in data/xrp-yield.json with TVL and price-per-share to inception,
// pulled from the unauthenticated DeFiLlama /chart endpoint. The hourly fetcher
// (fetch-xrp-yield.mjs) now captures the same {d, apy, tvl, pps} shape going
// forward; this script backfills the existing snapshot without re-running the
// whole live pipeline (which would touch Spectra/Portals we don't want to
// disturb here). Portals-sourced products are left untouched — their history
// arrives once PORTALS_API_KEY is present and the historical endpoint is wired.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, "data", "xrp-yield.json");

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { accept: "application/json" },
      });
      if (r.ok) return await r.json();
      console.error(`[backfill] ${url} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[backfill] ${url} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return null;
}

// {d, apy, tvl, pps} per calendar day, full depth (to inception).
function dailySeries(rows) {
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
  return [...byDay.entries()]
    .map(([d, v]) => ({ d, apy: v.apy, tvl: v.tvl, pps: v.pps }))
    .sort((a, b) => (a.d < b.d ? -1 : 1));
}

// Same {d, apy, tvl, pps} shape from Portals' paid /v2/tokens/history endpoint,
// which carries liquidity (TVL), pricePerShare and apy per day. Needs a key.
const PORTALS_KEY = process.env.PORTALS_API_KEY || null;
async function portalsSeries(portalsKey) {
  if (!PORTALS_KEY) return [];
  const url = `https://api.portals.fi/v2/tokens/history?id=${encodeURIComponent(portalsKey)}`;
  let doc = null;
  for (let i = 0; i < 3 && !doc; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { accept: "application/json", Authorization: `Bearer ${PORTALS_KEY}` },
      });
      if (r.ok) doc = await r.json();
      else console.error(`[backfill] portals ${portalsKey} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[backfill] portals ${portalsKey} -> ${e.message ?? e}`);
    }
    if (!doc) await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
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

const data = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
const pools = Array.isArray(data.pools) ? data.pools : [];

// A DeFiLlama-backed product: its id is the DeFiLlama poolId (uuid) and it
// carries a llamaUrl. These are the only rows /chart can serve.
const isLlama = (p) =>
  typeof p.llamaUrl === "string" &&
  /^[0-9a-f-]{36}$/i.test(String(p.id || ""));

let updated = 0;
for (const p of pools) {
  if (!isLlama(p)) continue;
  const chart = await getJson(`https://yields.llama.fi/chart/${p.id}`);
  const rows = chart?.data;
  if (!Array.isArray(rows) || !rows.length) {
    console.error(`[backfill] no chart rows for ${p.venueSlug || p.id}`);
    continue;
  }
  const hist = dailySeries(rows);
  if (hist.length >= 2) {
    p.history = hist;
    p.inception = hist[0].d;
    const withTvl = hist.filter((h) => Number.isFinite(h.tvl)).length;
    console.log(
      `[backfill] ${String(p.venueSlug || p.id).padEnd(24)} ${hist.length} days (${hist[0].d}→${hist[hist.length - 1].d}), ${withTvl} with TVL`,
    );
    updated++;
  }
  await new Promise((res) => setTimeout(res, 300));
}

// Portals-sourced products: pull the same {d, apy, tvl, pps} depth from the
// paid /v2/tokens/history endpoint. These vaults are young, so histories are
// short (days to weeks) — that IS their inception depth.
const venues = JSON.parse(readFileSync(join(ROOT, "data", "xrp-venues.json"), "utf-8"));
const venueArr = Array.isArray(venues) ? venues : venues.venues || venues.products || [];
const portalsKeyBySlug = new Map(
  venueArr
    .filter((v) => v.source?.kind === "portals" && v.source?.portalsKey)
    .map((v) => [v.slug, v.source.portalsKey]),
);
let portalsUpdated = 0;
if (PORTALS_KEY) {
  for (const p of pools) {
    const pk = portalsKeyBySlug.get(p.venueSlug);
    if (!pk) continue;
    const hist = await portalsSeries(pk);
    if (hist.length >= 2) {
      p.history = hist;
      p.inception = hist[0].d;
      const withTvl = hist.filter((h) => Number.isFinite(h.tvl)).length;
      console.log(
        `[backfill] ${String(p.venueSlug).padEnd(24)} ${hist.length} days (${hist[0].d}→${hist[hist.length - 1].d}), ${withTvl} with TVL  [portals]`,
      );
      portalsUpdated++;
    } else {
      console.error(`[backfill] portals ${p.venueSlug}: <2 history points`);
    }
    await new Promise((res) => setTimeout(res, 300));
  }
} else {
  console.error("[backfill] PORTALS_API_KEY not set; skipped Portals products.");
}

writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(
  `[backfill] enriched ${updated} DeFiLlama + ${portalsUpdated} Portals products in data/xrp-yield.json`,
);
