#!/usr/bin/env node
// Spectra stXRP yield-market trading activity for /report/xrp-yield-ranking.
//
// WHY: the report's landscape and holder sections cover size and adoption; this
// adds ACTIVITY — how much the XRP fixed-yield markets are actually traded, and
// what that flow says about sentiment on the stXRP rate.
//
// Spectra runs Curve-style markets where a Principal Token (PT, the fixed-rate
// leg) trades against the interest-bearing token. Buying PT locks a fixed yield;
// selling PT exits it. Spectra's own API classifies and USD-prices every trade,
// so we read its /activity (per-tx type + USD) and /volume (daily buy/sell USD)
// endpoints for each stXRP market — no subgraph or RPC needed.
//
// NOTE: this is PT-market trading, the tradeable leg of the yield market. The YT
// (variable-yield) token is the mirror side and is never swapped in the pool, so
// isolating literal YT flows would need the Spectra subgraph; we deliberately
// report the PT-market flow that the API exposes directly and label it as such.
//
// Writes data.yieldTrading into data/xrp-yield.json. Requires network to
// api.spectra.finance (reachable). Sandbox: run with NODE_USE_ENV_PROXY=1.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, "data", "xrp-yield.json");
const API = "https://api.spectra.finance/v1/flare";

async function getJson(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { accept: "application/json" },
      });
      if (r.ok) return await r.json();
      console.error(`[xrp-trading] ${url} -> HTTP ${r.status}`);
    } catch (e) {
      console.error(`[xrp-trading] ${url} -> ${e.message ?? e}`);
    }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  return null;
}

const dstr = (unixSec) => new Date(unixSec * 1000).toISOString().slice(0, 10);
const mstr = (unixSec) => new Date(unixSec * 1000).toISOString().slice(0, 7);

// Spectra pool /chart rows are [epochSeconds, { apy: "6.50", ... }]; apy is the
// PT max fixed rate as a percent string. Normalise to {t(ms), apy(number)}.
function readChartRows(doc) {
  const rows = Array.isArray(doc) ? doc : Array.isArray(doc?.data) ? doc.data : [];
  const out = [];
  for (const r of rows) {
    let ms, aRaw;
    if (Array.isArray(r)) {
      ms = Number(r[0]) * 1000;
      aRaw = r[1]?.apy ?? r[1];
    } else {
      ms = Number(r.timestamp ?? r.t) * 1000;
      aRaw = r.apy ?? r.value ?? r.y;
    }
    const apy = Number(aRaw);
    if (Number.isFinite(ms) && Number.isFinite(apy)) out.push({ t: ms, apy });
  }
  return out.sort((a, b) => a.t - b.t);
}
// Downsample a rate chart to one point per calendar day, capped so the combined
// overlay series stays lean in data/xrp-yield.json.
function dailyRate(chart, capDays = 260) {
  const byDay = new Map();
  for (const r of chart) {
    byDay.set(new Date(r.t).toISOString().slice(0, 10), Math.round(r.apy * 100) / 100);
  }
  return [...byDay.entries()]
    .map(([d, apy]) => ({ d, apy }))
    .sort((a, b) => (a.d < b.d ? -1 : 1))
    .slice(-capDays);
}

// Discover every stXRP market and its AMM pool address from the Spectra pool
// list, so the set stays correct as markets are added or roll off.
const poolsDoc = await getJson(`${API}/pools`);
const allMarkets = Array.isArray(poolsDoc?.data)
  ? poolsDoc.data
  : Array.isArray(poolsDoc)
    ? poolsDoc
    : [];
const activeMarkets = allMarkets
  .filter((m) => /xrp/i.test(`${m?.ibt?.symbol ?? ""}${m?.name ?? ""}`))
  .map((m) => ({
    market: String(m.address).toLowerCase(),
    pool: String(m?.pools?.[0]?.address ?? "").toLowerCase(),
    yt: String(m?.yt?.address ?? m?.yt ?? "").toLowerCase() || null,
    maturity: m.maturity ?? null,
    ibt: m?.ibt?.symbol ?? "stXRP",
  }))
  .filter((m) => m.pool);

// Expired stXRP markets drop off the Spectra /pools list, but their /activity
// and /volume endpoints still return the full trade history — and they carry the
// bulk of all-time volume, so the trading picture is badly incomplete without
// them. Pinned here (pool + YT + maturity) so they are always included.
const EXPIRED_STXRP_POOLS = [
  {
    pool: "0xa65a736bcf1f4af7a8f353027218f2d54b3048eb",
    yt: "0x46f0c7b81128e031604ecb3e8a7e28dd3f8a50c9",
    maturity: Math.floor(Date.UTC(2026, 2, 5) / 1000), // PT-stXRP 2026/03/05
    ibt: "stXRP",
  },
  {
    pool: "0x80743e896df841900803a46f6d8451e0f9ef6f4a",
    yt: "0xf8b0bafbb2e3c023c606b04296b2df73f4a0d918",
    maturity: Math.floor(Date.UTC(2026, 5, 4) / 1000), // PT-stXRP 2026/06/04
    ibt: "stXRP",
  },
];
const activePools = new Set(activeMarkets.map((m) => m.pool));
const xrpMarkets = [
  ...activeMarkets,
  ...EXPIRED_STXRP_POOLS.filter((m) => !activePools.has(m.pool)).map((m) => ({
    ...m,
    market: m.pool,
    expired: true,
  })),
];

if (!xrpMarkets.length) {
  console.error("[xrp-trading] no stXRP markets found; leaving data untouched.");
  process.exit(0);
}

const data = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
const nowMs = Date.now();

const allTraders = new Set();
const dailyMap = new Map(); // d -> {buyUsd, sellUsd}
const markets = [];

for (const m of xrpMarkets) {
  const [activity, volume, chart] = await Promise.all([
    getJson(`${API}/pools/${m.pool}/activity`),
    getJson(`${API}/pools/${m.pool}/volume`),
    getJson(`${API}/pools/${m.pool}/chart`),
  ]);
  const act = Array.isArray(activity) ? activity : [];
  const vol = Array.isArray(volume) ? volume : [];
  // Daily PT max-fixed-rate history for this maturity. Matured markets still
  // return their full chart, so overlaying every market extends the fixed-rate
  // record much further back than the two live PTs alone.
  const rateHistory = dailyRate(readChartRows(chart));

  const traders = new Set();
  let buyCount = 0,
    sellCount = 0,
    addLiqUsd = 0,
    removeLiqUsd = 0,
    addLiqCount = 0,
    removeLiqCount = 0;
  let firstTs = Infinity,
    lastTs = 0;
  for (const a of act) {
    if (a.from) {
      traders.add(a.from);
      allTraders.add(a.from);
    }
    if (Number.isFinite(a.timestamp)) {
      firstTs = Math.min(firstTs, a.timestamp);
      lastTs = Math.max(lastTs, a.timestamp);
    }
    if (a.type === "BUY_PT") buyCount++;
    else if (a.type === "SELL_PT") sellCount++;
    else if (a.type === "AMM_ADD_LIQUIDITY") {
      addLiqCount++;
      addLiqUsd += a.valueUsd || 0;
    } else if (a.type === "AMM_REMOVE_LIQUIDITY") {
      removeLiqCount++;
      removeLiqUsd += a.valueUsd || 0;
    }
  }

  let buyUsd = 0,
    sellUsd = 0;
  for (const p of vol) {
    buyUsd += p.buyUsd || 0;
    sellUsd += p.sellUsd || 0;
    const d = dstr(p.timestamp);
    const cur = dailyMap.get(d) ?? { buyUsd: 0, sellUsd: 0 };
    cur.buyUsd += p.buyUsd || 0;
    cur.sellUsd += p.sellUsd || 0;
    dailyMap.set(d, cur);
  }

  markets.push({
    maturity: m.maturity,
    maturityDate: m.maturity ? dstr(m.maturity) : null,
    expired: m.maturity ? m.maturity * 1000 < nowMs : false,
    pool: m.pool,
    market: m.market,
    yt: m.yt,
    txns: act.length,
    traders: traders.size,
    buyUsd: Math.round(buyUsd),
    sellUsd: Math.round(sellUsd),
    buyCount,
    sellCount,
    addLiqUsd: Math.round(addLiqUsd),
    removeLiqUsd: Math.round(removeLiqUsd),
    addLiqCount,
    removeLiqCount,
    firstDate: Number.isFinite(firstTs) ? dstr(firstTs) : null,
    lastDate: lastTs ? dstr(lastTs) : null,
    rateHistory,
  });
  await new Promise((res) => setTimeout(res, 200));
}

markets.sort((a, b) => b.buyUsd + b.sellUsd - (a.buyUsd + a.sellUsd));

// Combined daily volume series (chronological) for the activity chart.
const daily = [...dailyMap.entries()]
  .map(([d, v]) => ({ d, buyUsd: Math.round(v.buyUsd), sellUsd: Math.round(v.sellUsd) }))
  .sort((a, b) => (a.d < b.d ? -1 : 1));

// Monthly rollup for the prose (calendar patterns).
const monthly = new Map();
for (const p of daily) {
  const mo = p.d.slice(0, 7);
  const cur = monthly.get(mo) ?? { buyUsd: 0, sellUsd: 0 };
  cur.buyUsd += p.buyUsd;
  cur.sellUsd += p.sellUsd;
  monthly.set(mo, cur);
}

const totals = {
  buyUsd: markets.reduce((s, m) => s + m.buyUsd, 0),
  sellUsd: markets.reduce((s, m) => s + m.sellUsd, 0),
  txns: markets.reduce((s, m) => s + m.txns, 0),
  traders: allTraders.size,
  markets: markets.length,
  activeMarkets: markets.filter((m) => m.buyUsd + m.sellUsd > 0).length,
  addLiqUsd: markets.reduce((s, m) => s + m.addLiqUsd, 0),
  removeLiqUsd: markets.reduce((s, m) => s + m.removeLiqUsd, 0),
  firstDate: daily[0]?.d ?? null,
  lastDate: daily[daily.length - 1]?.d ?? null,
};

data.yieldTrading = {
  generatedAt: new Date().toISOString(),
  asset: "stXRP",
  venue: "Spectra",
  basis: "PT-market trades (buy/sell Principal Token), the tradeable leg of the fixed-yield market",
  note: "Trading activity across every Spectra stXRP fixed-yield market on Flare. Buying the Principal Token locks a fixed yield; selling it exits. Volumes and per-trade classification are Spectra's own, USD-priced. The YT (variable-yield) leg is the mirror side and is not swapped in the pool. Source: Spectra API.",
  totals,
  monthly: [...monthly.entries()].map(([mo, v]) => ({ mo, buyUsd: v.buyUsd, sellUsd: v.sellUsd })),
  daily,
  markets,
};

writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(
  `[xrp-trading] ${markets.length} stXRP markets | buy $${totals.buyUsd.toLocaleString()} · sell $${totals.sellUsd.toLocaleString()} | ${totals.txns} txns · ${totals.traders} traders | ${daily.length} days`,
);
