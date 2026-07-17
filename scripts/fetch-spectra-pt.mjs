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

const num = (v) => (Number.isFinite(+v) ? +v : null);

// pools[0].ptApy per the Spectra team; handle {pools:[...]}, a bare array, or a
// bare object defensively.
function readPool(data) {
  if (!data) return null;
  if (Array.isArray(data)) return data[0] ?? null;
  if (Array.isArray(data.pools)) return data.pools[0] ?? null;
  return data;
}
function maturityOf(pool) {
  const m = pool?.maturity ?? pool?.maturityTimestamp ?? pool?.expiry;
  if (m == null) return null;
  const ms = String(m).length <= 10 ? Number(m) * 1000 : Number(m);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}
function tvlOf(pool) {
  return (
    num(pool?.liquidity?.usd) ??
    num(pool?.tvl) ??
    num(pool?.tvlUsd) ??
    num(pool?.liquidity) ??
    0
  );
}

// Normalise a chart payload into [{ t: ms, apy }]. Field names vary between
// providers, so try the common ones; confirmed against a real sample before CI.
function readChart(data) {
  const rows = Array.isArray(data)
    ? data
    : data?.data ?? data?.points ?? data?.chart ?? [];
  const out = [];
  for (const r of rows) {
    const tRaw = r.timestamp ?? r.time ?? r.date ?? r.t;
    const aRaw = r.ptApy ?? r.apy ?? r.maxFixedApy ?? r.value ?? r.y;
    const a = num(aRaw);
    if (a == null || tRaw == null) continue;
    const isEpoch = /^\d+$/.test(String(tRaw));
    const ms = isEpoch
      ? (String(tRaw).length <= 10 ? Number(tRaw) * 1000 : Number(tRaw))
      : new Date(tRaw).getTime();
    if (!Number.isFinite(ms)) continue;
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
    const pool = readPool(await getJson(`${API}/${address}`, `pt-${address}.json`));
    const ptApy = pool ? num(pool.ptApy) : null;
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
    const maturity = maturityOf(pool);

    rows.push({
      id: `spectra-pt-${address}`,
      chain: "Flare",
      project: "spectra-v2",
      platform: "Spectra",
      platformUrl: `https://app.spectra.finance/pools/flare:${address}`,
      category: "Fixed-Rate",
      symbol: asset,
      poolMeta: maturity
        ? `Matures ${maturity.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`
        : "Principal Token",
      tvlUsd: Math.round(tvlOf(pool)),
      apy: ptApy,
      apyBase: ptApy,
      apyReward: 0,
      apyMean30d: tail30.length ? round2(mean(tail30)) : ptApy,
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
