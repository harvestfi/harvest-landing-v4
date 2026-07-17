// Spectra Principal Token (PT) fixed rates for the XRP report.
//
// Spectra exposes its own API. For each configured Flare pool we read:
//   GET /v1/flare/pools/<addr>        -> pools[0].ptApy = current max fixed APY
//   GET /v1/flare/pools/<addr>/chart  -> historical max fixed APY series
// and emit rows in the same shape the report renders, tagged productType
// "Fixed-Rate" (single-exposure) so they land in the Fixed-rate category.
//
// Gated OFF in CI (fetch-xrp-yield.mjs only calls this when XRP_SPECTRA_PT=1)
// until the live response shape is confirmed - the exact units of ptApy and the
// chart's field names are verified against a real sample first. A SPECTRA_CACHE
// dir holding pt-<addr>.json and pt-<addr>-chart.json lets us do that offline
// (Node's fetch ignores HTTPS_PROXY, and api.spectra.finance is egress-gated).

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.spectra.finance/v1/flare/pools";

// Curated PT pools on Spectra (Flare). asset drives the row icon + label.
export const SPECTRA_PT_POOLS = [
  { address: "0x22ebdb0a469a9f7ba4a287ea3c1c420762d98db9", asset: "stXRP" },
  { address: "0x966d1f376457a3aca5fbc2a6be985f6e5e7708eb", asset: "stXRP" },
];

const CACHE_DIR = process.env.SPECTRA_CACHE || null;
function cacheFile(name) {
  if (!CACHE_DIR) return null;
  const p = join(CACHE_DIR, name);
  return existsSync(p) ? p : null;
}

async function getJson(url, cacheName, tries = 3) {
  const cf = cacheFile(cacheName);
  if (cf) {
    try {
      return JSON.parse(readFileSync(cf, "utf-8"));
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
      console.error(`[spectra-pt] ${url} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[spectra-pt] ${url} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return null;
}

const num = (v) => (v == null || v === "" || Number.isNaN(+v) ? null : +v);
const toMs = (t) => {
  const n = num(t);
  if (n == null) return new Date(t).getTime();
  return n < 1e12 ? n * 1000 : n; // epoch seconds -> ms
};

// The PT object. Confirmed shape: { data: [ { name, symbol, maturity, ibt,
// underlying, tvl, pools: [ { ptApy, liquidity, ... } ] } ] }.
function readPT(doc) {
  const d = doc?.data;
  if (Array.isArray(d)) return d[0] ?? null;
  return d ?? null;
}
const poolOf = (pt) => pt?.pools?.[0] ?? null;
const ptApyOf = (pt) => num(poolOf(pt)?.ptApy);
const tvlOf = (pt) => num(poolOf(pt)?.liquidity?.usd) ?? num(pt?.tvl?.usd) ?? 0;
const assetOf = (pt, fallback) => pt?.ibt?.symbol || pt?.underlying?.symbol || fallback;
function maturityOf(pt) {
  const ms = pt?.maturity != null ? toMs(pt.maturity) : NaN;
  return Number.isFinite(ms) ? new Date(ms) : null;
}

// Chart rows are [epochSeconds, { apy: "3.54", buyUsd, sellUsd, ... }]. apy is
// a percent string. Normalise to [{ t: ms, apy }].
function readChart(data) {
  const rows = Array.isArray(data) ? data : data?.data ?? [];
  const out = [];
  for (const r of rows) {
    let tRaw, aRaw;
    if (Array.isArray(r)) {
      tRaw = r[0];
      aRaw = r[1]?.apy ?? r[1];
    } else {
      tRaw = r.timestamp ?? r.time ?? r.t ?? r.date;
      aRaw = r.apy ?? r.value ?? r.y;
    }
    const a = num(aRaw);
    const ms = tRaw != null ? toMs(tRaw) : NaN;
    if (a == null || !Number.isFinite(ms)) continue;
    out.push({ t: ms, apy: a });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

const round2 = (v) => Math.round(v * 100) / 100;
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

export async function fetchSpectraPTs() {
  const rows = [];
  for (const { address, asset } of SPECTRA_PT_POOLS) {
    const pt = readPT(await getJson(`${API}/${address}`, `pt-${address}.json`));
    const ptApy = ptApyOf(pt);
    if (ptApy == null || ptApy <= 0) {
      console.error(`[spectra-pt] ${address}: no usable ptApy, skipping`);
      continue;
    }

    const chart = readChart(await getJson(`${API}/${address}/chart`, `pt-${address}-chart.json`));
    const tail90 = chart.slice(-90).map((r) => r.apy);
    const tail30 = chart.slice(-30).map((r) => r.apy);
    const range90d =
      tail90.length >= 7
        ? { min: round2(Math.min(...tail90)), max: round2(Math.max(...tail90)) }
        : null;
    const inception = chart.length
      ? new Date(chart[0].t).toISOString().slice(0, 10)
      : null;
    const maturity = maturityOf(pt);
    const matLabel = maturity
      ? maturity.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
      : null;
    const sym = assetOf(pt, asset); // "stXRP" - drives the row icon

    rows.push({
      id: `spectra-pt-${address}`,
      chain: "Flare",
      project: "spectra-v2",
      platform: "Spectra",
      platformUrl: `https://app.spectra.finance/pools/flare:${address}`,
      category: "Fixed-Rate",
      symbol: sym,
      // Icon keys off `symbol`; `displayName` shows the PT + maturity so the two
      // maturities read apart in the ranking.
      displayName: matLabel ? `${sym} PT ${matLabel}` : `${sym} PT`,
      poolMeta: pt?.name ?? "Principal Token",
      tvlUsd: Math.round(tvlOf(pt)),
      apy: round2(ptApy),
      apyBase: round2(ptApy),
      apyReward: 0,
      apyMean30d: tail30.length ? round2(mean(tail30)) : round2(ptApy),
      rewardShare: 0,
      incentivized: false,
      ilRisk: "no",
      exposure: "single",
      stablecoin: false,
      observations: chart.length || null,
      llamaUrl: `https://app.spectra.finance/pools/flare:${address}`,
      inception,
      range90d,
      productType: "Fixed-Rate",
      curated: true,
      venueSlug: `spectra-pt-${address}`,
    });
  }
  return rows;
}
