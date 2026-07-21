// Spectra (Flare) data for the XRP report: Principal Token fixed rates, pool LP
// rates, and MetaVault APY, from api.spectra.finance.
//
//   GET /v1/flare/pools/<addr>        -> data[0].pools[0]: ptApy, impliedApy,
//                                        lpApy.total, liquidity.usd (percent
//                                        units; same market address serves both
//                                        the PT and the LP-pool products)
//   GET /v1/flare/pools/<addr>/chart  -> historical PT max fixed APY series
//   GET /v1/flare/metavaults          -> liveApy.boostedTotal || liveApy.total,
//                                        tvl.usd for each MetaVault
//
// Cache: set SPECTRA_CACHE=<dir> holding pt-<addr>.json, pt-<addr>-chart.json
// and metavaults.json to read those instead of the network (Node's fetch
// ignores HTTPS_PROXY; the host is proxied in dev). Unset in CI (fetches live).

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.spectra.finance/v1/flare";
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
      console.error(`[spectra] ${url} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[spectra] ${url} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return null;
}

const num = (v) => (v == null || v === "" || Number.isNaN(+v) ? null : +v);
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const toMs = (t) => {
  const n = num(t);
  if (n == null) return new Date(t).getTime();
  return n < 1e12 ? n * 1000 : n; // epoch seconds -> ms
};

// Unwrap { data: [...] } | { data: {...} } | bare object/array -> first object.
function unwrap(doc) {
  let d = doc?.data ?? doc;
  if (Array.isArray(d)) return d[0] ?? null;
  return d ?? null;
}
const poolOf = (m) => m?.pools?.[0] ?? null;
const sumObj = (o) => Object.values(o ?? {}).reduce((s, v) => s + (num(v) ?? 0), 0);

// Chart rows are [epochSeconds, { apy: "3.54", ... }]; apy is a percent string.
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

// Downsample the raw chart into one point per calendar day, {d, apy}, capped to
// the most recent capDays. Feeds the report's PT rate chart.
function dailySeries(chart, capDays = 400) {
  const byDay = new Map();
  for (const r of chart) byDay.set(new Date(r.t).toISOString().slice(0, 10), round2(r.apy));
  return [...byDay.entries()]
    .map(([d, apy]) => ({ d, apy }))
    .sort((a, b) => (a.d < b.d ? -1 : 1))
    .slice(-capDays);
}

// One Spectra market (PT + LP pool share an address). Returns the metrics both
// products read, plus the PT's daily history. Memoised per address so the PT
// and pool venues don't double-fetch.
const marketCache = new Map();
export async function fetchSpectraMarket(address) {
  if (marketCache.has(address)) return marketCache.get(address);
  const p = (async () => {
    const m = unwrap(await getJson(`${API}/pools/${address}`, `pt-${address}.json`));
    const pool = poolOf(m);
    if (!pool) return null;
    const chart = readChart(await getJson(`${API}/pools/${address}/chart`, `pt-${address}-chart.json`));
    const tail30 = chart.slice(-30).map((r) => r.apy);
    const tail90 = chart.slice(-90).map((r) => r.apy);
    const maturityMs = m?.maturity != null ? toMs(m.maturity) : NaN;
    const maturity = Number.isFinite(maturityMs) ? new Date(maturityMs) : null;
    const lpTotal = num(pool.lpApy?.total);
    const lpRewards = sumObj(pool.lpApy?.details?.rewards);
    return {
      ptApy: round2(num(pool.ptApy)),
      impliedApy: round2(num(pool.impliedApy)),
      lpApy: round2(lpTotal),
      // Share of the LP rate that is reward-token emissions (rFLR), for the
      // "incentivized" flag.
      lpRewardShare: lpTotal && lpTotal > 0 ? Math.round((lpRewards / lpTotal) * 100) / 100 : 0,
      tvlUsd: Math.round(num(pool.liquidity?.usd) ?? 0),
      maturity,
      matLabel: maturity
        ? maturity.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
        : null,
      ibtSymbol: m?.ibt?.symbol || null,
      observations: chart.length || null,
      inception: chart.length ? new Date(chart[0].t).toISOString().slice(0, 10) : null,
      ptMean30d: tail30.length ? round2(mean(tail30)) : null,
      range90d:
        tail90.length >= 7
          ? { min: round2(Math.min(...tail90)), max: round2(Math.max(...tail90)) }
          : null,
      history: dailySeries(chart),
    };
  })();
  marketCache.set(address, p);
  return p;
}

// MetaVault APY + TVL. boostedTotal preferred, else total. Percent units.
export async function fetchSpectraMetavault(address) {
  const doc = await getJson(`${API}/metavaults`, `metavaults.json`);
  const list = Array.isArray(doc) ? doc : doc?.data ?? [];
  const mv = list.find((v) => String(v?.address).toLowerCase() === String(address).toLowerCase());
  if (!mv) return null;
  const la = mv.liveApy ?? {};
  const apy = num(la.boostedTotal) ?? num(la.total);
  const det = la.details ?? {};
  const rewards = sumObj(det.rewards) + sumObj(det.mvRewards) + sumObj(det.ibtRewards);
  return {
    apy: round2(apy),
    rewardShare: apy && apy > 0 ? Math.round((rewards / apy) * 100) / 100 : 0,
    tvlUsd: Math.round(num(mv.tvl?.usd) ?? 0),
    name: mv.name ?? null,
  };
}
