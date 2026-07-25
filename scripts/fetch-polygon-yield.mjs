#!/usr/bin/env node
// Builds data/polygon-yield.json for the /polygon mixed ranking and its
// /polygon/[venue] pages.
//
// This is an ALLOWLIST hydrator, not a scanner: the ranking shows exactly the
// venues in data/polygon-venues.json, and this script fills each one's live
// rate/TVL from its `source`:
//   - onchain:  direct Aave v3 Pool.getReserveData() read (the spine -- see
//               scripts/lib/polygon-onchain-adapters.mjs). USD pricing for
//               non-stable underlyings (ETH/BTC/MATIC/EUR) comes from Portals
//               spot prices; the RATE itself never does.
//   - portals:  api.portals.fi current APY, used only for the three
//               Securitize-tokenized RWA funds and the Morpho market, which
//               have no simple public rate-reading contract. Needs
//               PORTALS_API_KEY, else falls back to the venue's
//               staticApy/staticTvl snapshot. Same disclosed-fallback role
//               Portals already plays for 3 of 15 XRP venues -- never the
//               primary source for a venue that has one.
//
// Every venue is an EXTERNAL protocol, not a Harvest product. Harvest's own
// Polygon vaults are rendered on the same page from data/vaults.json as
// usual; this pipeline does not touch that file.
//
// Offline/proxied dev: set POLYGON_PORTALS_CACHE (portals-<key>.json) to read
// cached responses instead of the network.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { aaveV3Supply, portalsTokenPrice } from "./lib/polygon-onchain-adapters.mjs";
import { sameIgnoringStamps } from "./lib/snapshot-stamp.mjs";

const ROOT = process.cwd();
const OUT_FILE = join(ROOT, "data", "polygon-yield.json");
const VENUES_FILE = join(ROOT, "data", "polygon-venues.json");

const PORTALS_KEY = process.env.PORTALS_API_KEY || null;
const PORTALS_CACHE = process.env.POLYGON_PORTALS_CACHE || null;

// Native-asset pricing addresses (Polygon), used only to convert Aave's
// USD-denominated TVL for non-stable reserves. The rate itself is always
// read straight from the Pool.
const PRICE_TOKEN = {
  eth: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH
  btc: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", // WBTC
  matic: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
  eur: "0xe111178a87a3bff0c8d18decba5798827539ae99", // EURS (priced directly; its own price IS the EUR/USD rate)
};

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
      console.error(`[polygon-yield] portals ${key} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[polygon-yield] portals ${key} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return null;
}

function baseRow(v) {
  return {
    id: v.slug,
    venueSlug: v.slug,
    chain: v.chain,
    asset: v.asset,
    assetGroup: v.assetGroup,
    detail: v.detail ?? null,
    symbol: v.symbol,
    platform: v.platform,
    platformUrl: v.url,
    entity: v.entity ?? null,
    category: v.productType ?? null,
    productType: v.productType ?? null,
    operator: v.operator ?? "external",
    exposure: v.exposure ?? "single",
    accessNote: v.accessNote ?? null,
    editorialNote: v.editorialNote ?? null,
    tvlUsd: 0,
    apy: null,
    apyBase: null,
    rateNa: false,
    rateBasis: "current",
  };
}

async function getPolygonPrices() {
  const out = { usd: 1 };
  for (const [ref, addr] of Object.entries(PRICE_TOKEN)) {
    out[ref] = await portalsTokenPrice(addr, PORTALS_KEY);
  }
  return out;
}

const main = async () => {
  const venuesDoc = JSON.parse(readFileSync(VENUES_FILE, "utf-8"));
  const venues = venuesDoc.venues ?? [];
  if (!venues.length) {
    console.error("[polygon-yield] no venues; keeping existing snapshot.");
    process.exit(0);
  }

  let prev = null;
  try {
    if (existsSync(OUT_FILE)) prev = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
  } catch {
    prev = null;
  }
  const prevRow = new Map();
  for (const p of prev?.venues ?? []) {
    if (p.venueSlug) prevRow.set(p.venueSlug, p);
  }

  const needOnchain = venues.some((v) => v.source?.kind === "onchain");
  const prices = needOnchain ? await getPolygonPrices() : null;

  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  for (const v of venues) {
    const row = baseRow(v);
    const src = v.source ?? { kind: "none" };
    try {
      if (src.kind === "onchain") {
        const priceUsd = prices[src.priceRef];
        if (!Number.isFinite(priceUsd)) {
          throw new Error(`no ${src.priceRef} price available`);
        }
        const r = await aaveV3Supply({
          pool: venuesDoc.aaveV3Pool,
          asset: src.asset,
          underlyingDec: src.underlyingDec,
          priceUsd,
        });
        row.apy = r.apy;
        row.apyBase = r.apyBase;
        row.tvlUsd = r.tvlUsd;
        row.source = "onchain";
      } else if (src.kind === "portals") {
        const doc = await portalsCurrent(src.portalsKey);
        const t = doc?.tokens?.[0];
        const m = t?.metrics ?? {};
        const apy = m.apy != null ? +m.apy : src.staticApy ?? null;
        row.apy = apy;
        row.apyBase = m.baseApy != null ? +m.baseApy : apy;
        row.tvlUsd = Math.round(t?.liquidity ?? src.staticTvl ?? 0);
        row.rateBasis = doc ? "current" : "current (last known)";
        row.source = doc ? "portals" : "portals (static fallback)";
        if (apy == null) {
          row.rateNa = true;
          row.rateBasis = "na";
        }
      } else {
        row.rateNa = true;
        row.rateBasis = "na";
      }
    } catch (e) {
      console.error(`[polygon-yield] ${v.slug} hydrate failed:`, e?.message ?? e);
      const prior = prevRow.get(v.slug);
      if (prior && !prior.rateNa) {
        // Degrade to the last good reading rather than a blank row.
        row.apy = prior.apy;
        row.apyBase = prior.apyBase;
        row.tvlUsd = prior.tvlUsd;
        row.source = prior.source;
        row.rateBasis = "current (last known)";
      } else {
        row.rateNa = true;
        row.rateBasis = "na";
      }
    }

    // Onchain rows accumulate their own daily series (mirrors the XRP
    // pipeline): carry prior points forward only when the row was already
    // onchain-sourced, then append today's reading.
    if (row.source === "onchain" && !row.rateNa) {
      const prior = prevRow.get(v.slug);
      const priorHist = prior?.source === "onchain" ? prior.history ?? [] : [];
      const merged = priorHist.filter((h) => h.d !== today);
      merged.push({ d: today, apy: row.apy, tvl: row.tvlUsd });
      row.history = merged.slice(-90);
    }

    rows.push(row);
  }

  rows.sort((a, b) => (b.apy ?? -Infinity) - (a.apy ?? -Infinity));

  const rated = rows.filter((r) => !r.rateNa).map((r) => r.apy);
  const out = {
    generatedAt: new Date().toISOString(),
    source: "on-chain reads (Aave v3 Pool, Polygon) and the Portals API",
    stats: {
      venues: rows.length,
      rated: rated.length,
      totalTvlUsd: Math.round(rows.reduce((s, r) => s + (r.tvlUsd || 0), 0)),
    },
    venues: rows,
  };

  if (prev && prev.generatedAt != null && sameIgnoringStamps(prev, out, ["generatedAt"])) {
    console.log(
      "[polygon-yield] no material change since the last snapshot; leaving data/polygon-yield.json (and its generatedAt) untouched.",
    );
    return;
  }

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf-8");
  console.log(
    `[polygon-yield] wrote ${rows.length} venues (${rated.length} rated), total TVL $${out.stats.totalTvlUsd.toLocaleString()} -> data/polygon-yield.json`,
  );
};

main().catch((e) => {
  console.error("[polygon-yield] fatal:", e);
  process.exit(0);
});
