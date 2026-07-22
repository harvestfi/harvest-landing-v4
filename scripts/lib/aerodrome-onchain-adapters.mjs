// Aerodrome (Base) on-chain adapters for the /report/aerodrome ranking.
//
// Scope: the classic vAMM/sAMM pools Harvest runs auto-compounding vaults for.
// All of them are classic pools (the LP token IS the pool, UniV2-fork), NOT
// Slipstream CL — so this reads getReserves()/token0()/token1()/stable() rather
// than slot0()/sqrtPrice() (which the XRP cbXRP CL pools used).
//
// Real pool yield = emission APR (AERO gauge) + fee APR (swap volume × fee tier).
// Aggregator-free, measured on-chain, so it can be republished commercially.
//
// KEY FORMULA (validated against our first-party apyBreakdown across 22 pools):
//   emissionAPR = rewardRate × yearSeconds × AERO_USD / stakedTVL
//   stakedTVL   = (gauge.totalSupply / pool.totalSupply) × poolTVL
// Emissions accrue ONLY to LP staked in the gauge, not the whole pool — using
// full-pool TVL under-reports the APR when a chunk of LP sits unstaked.

import {
  ethCall,
  toBig,
  word,
  SEL,
  encAddr,
  call,
  getLogs,
  blockNumber,
  blockAtTimestamp,
} from "./onchain.mjs";
import { chainlink, BASE_FEEDS } from "./xrp-onchain-adapters.mjs";

const CHAIN = "base";
const VOTER = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5"; // Aerodrome Voter
const FACTORY = "0x420DD381b31aEf6683db6B902084cB0FFECe40Da"; // Aerodrome PoolFactory
const SECONDS_PER_YEAR = 31_536_000;
const ZERO = "0x0000000000000000000000000000000000000000";

// Selectors not already in the shared SEL table (verified via keccak256).
const AS = {
  token0: "0x0dfe1681",
  token1: "0xd21220a7",
  symbol: "0x95d89b41",
  stable: "0x22be3de1", // Pool.stable() -> bool
  gauges: "0xb9a09fd5", // Voter.gauges(address) -> address
  getFee: "0xcc56b2c5", // PoolFactory.getFee(address,bool) -> uint (bps, /1e4)
};
// Classic vAMM/sAMM Swap event: Swap(address,address,uint256,uint256,uint256,uint256)
// (differs from the UniV2/CL Swap topic — param order/indexing is not the same).
const CLASSIC_SWAP_TOPIC =
  "0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b";

const addr = (w) => "0x" + w.slice(-40);
const encBool = (b) => (b ? "1" : "0").padStart(64, "0");
const tryCall = async (to, data, block = "latest") => {
  try {
    return await ethCall(CHAIN, to, data, block);
  } catch {
    return null;
  }
};

// ---- token metadata (cached) --------------------------------------------
const _sym = new Map();
const _dec = new Map();
async function symbolOf(t) {
  if (_sym.has(t)) return _sym.get(t);
  const r = await tryCall(t, AS.symbol);
  let s = "?";
  if (r) {
    try {
      const len = Number(toBig(word(r, 1)));
      s = Buffer.from(r.replace(/^0x/, "").slice(128, 128 + len * 2), "hex")
        .toString("utf8")
        .replace(/\0/g, "");
    } catch {
      /* leave as ? */
    }
  }
  _sym.set(t, s);
  return s;
}
async function decOf(t) {
  if (_dec.has(t)) return _dec.get(t);
  const r = await tryCall(t, SEL.decimals);
  const d = r ? Number(toBig(r)) : 18;
  _dec.set(t, d);
  return d;
}

// ---- price resolver ------------------------------------------------------
// Anchors are read from Chainlink; correlated legs (msETH, tBTC, ...) borrow the
// anchor price directly (a stable-pool reserve ratio is NOT a spot price, so we
// must not pool-derive those); everything else is an exotic priced from the
// pool's own reserve ratio against the anchored leg.
const USD_STABLE = new Set(["usdc", "usdbc", "usdt", "dai", "usdz", "usd+", "dola"]);
const ETH_LIKE = new Set(["weth", "eth", "mseth", "wsteth", "cbeth", "weeth"]);
const BTC_LIKE = new Set(["cbbtc", "wbtc", "tbtc", "btc", "lbtc"]);

export function knownUsd(sym, px) {
  const s = (sym || "").toLowerCase();
  if (USD_STABLE.has(s)) return 1;
  if (ETH_LIKE.has(s)) return px.eth;
  if (BTC_LIKE.has(s)) return px.btc;
  if (s === "aero") return px.aero;
  return null; // exotic -> pool-derived
}

export async function getPrices() {
  const [eth, btc, aero] = await Promise.all([
    chainlink(CHAIN, BASE_FEEDS.eth),
    chainlink(CHAIN, BASE_FEEDS.btc),
    chainlink(CHAIN, BASE_FEEDS.aero),
  ]);
  return { eth, btc, aero };
}

// ---- read one classic Aerodrome pool ------------------------------------
export async function readPool(pool, block = "latest") {
  const [t0r, t1r, resR, stR, tsR] = await Promise.all([
    ethCall(CHAIN, pool, AS.token0, block),
    ethCall(CHAIN, pool, AS.token1, block),
    ethCall(CHAIN, pool, SEL.getReserves, block),
    tryCall(pool, AS.stable, block),
    ethCall(CHAIN, pool, SEL.totalSupply, block),
  ]);
  const t0 = addr(word(t0r, 0));
  const t1 = addr(word(t1r, 0));
  const [s0, s1, d0, d1] = await Promise.all([
    symbolOf(t0),
    symbolOf(t1),
    decOf(t0),
    decOf(t1),
  ]);
  return {
    t0,
    t1,
    s0,
    s1,
    d0,
    d1,
    r0: Number(toBig(word(resR, 0))) / 10 ** d0,
    r1: Number(toBig(word(resR, 1))) / 10 ** d1,
    stable: stR ? Number(toBig(stR)) === 1 : false,
    poolTS: Number(toBig(tsR)),
  };
}

export async function gaugeOf(pool) {
  const r = await tryCall(VOTER, call(AS.gauges, encAddr(pool)));
  const g = r ? addr(word(r, 0)) : ZERO;
  return g === ZERO ? null : g;
}

// Price both legs. Known/correlated first; the remaining exotic leg is derived
// from the pool ratio against the anchored leg (valid for volatile pools).
export function priceLegs(p, px) {
  let p0 = knownUsd(p.s0, px);
  let p1 = knownUsd(p.s1, px);
  if (p0 == null && p1 != null) p0 = (p.r1 * p1) / p.r0;
  if (p1 == null && p0 != null) p1 = (p.r0 * p0) / p.r1;
  return { p0, p1 };
}

const _fee = new Map();
export async function feeFrac(pool, stable) {
  const k = pool + stable;
  if (_fee.has(k)) return _fee.get(k);
  const r = await tryCall(FACTORY, call(AS.getFee, encAddr(pool), encBool(stable)));
  const f = r ? Number(toBig(r)) / 10000 : 0.003; // getFee is in bps (30 = 0.30%)
  _fee.set(k, f);
  return f;
}

// Fee APR from classic vAMM swap logs over a trailing window. token0 throughput
// (amount0In + amount0Out) priced in USD is the pool's total volume.
export async function classicFeeApr({
  pool,
  dec0,
  price0,
  tvlUsd,
  feeFrac: ff,
  windowDays,
  toBlock,
  endTs,
}) {
  const toB = toBlock ?? (await blockNumber(CHAIN));
  const now = endTs ?? Math.floor(Date.now() / 1000);
  const fromB = await blockAtTimestamp(CHAIN, now - windowDays * 86400);
  const logs = await getLogs(CHAIN, pool, CLASSIC_SWAP_TOPIC, fromB, toB);
  let vol0 = 0;
  for (const l of logs) {
    vol0 +=
      (Number(toBig(word(l.data, 0))) + Number(toBig(word(l.data, 2)))) /
      10 ** dec0;
  }
  const feesUsd = vol0 * price0 * ff;
  return tvlUsd > 0 ? (feesUsd * (365 / windowDays)) / tvlUsd * 100 : 0;
}

// Full pool yield at a block: emission APR (staked denominator) + fee APR + TVL.
export async function aeroPoolYield({
  pool,
  gauge,
  px,
  skipFee = false,
  feeWindowDays = 7,
  block = "latest",
}) {
  const p = await readPool(pool, block);
  const { p0, p1 } = priceLegs(p, px);
  if (p0 == null || p1 == null)
    return { error: "no price anchor", pair: `${p.s0}/${p.s1}` };
  const tvlUsd = p.r0 * p0 + p.r1 * p1;
  const g = gauge ?? (await gaugeOf(pool));
  let emissionApr = 0;
  let stakedPct = null;
  let stakedTvl = tvlUsd;
  if (g) {
    const [rateR, gTS] = await Promise.all([
      tryCall(g, SEL.rewardRate, block),
      tryCall(g, SEL.totalSupply, block),
    ]);
    stakedPct = p.poolTS > 0 ? Number(toBig(gTS)) / p.poolTS : 0;
    stakedTvl = tvlUsd * stakedPct;
    if (rateR && stakedTvl > 0)
      emissionApr =
        ((Number(toBig(rateR)) / 1e18) * SECONDS_PER_YEAR * px.aero) /
        stakedTvl *
        100;
  }
  let feeApr = 0;
  if (!skipFee) {
    try {
      const ff = await feeFrac(pool, p.stable);
      feeApr = await classicFeeApr({
        pool,
        dec0: p.d0,
        price0: p0,
        tvlUsd,
        feeFrac: ff,
        windowDays: feeWindowDays,
        toBlock: block === "latest" ? undefined : block,
      });
    } catch {
      /* fee leg optional */
    }
  }
  return {
    pair: `${p.s0}/${p.s1}`,
    s0: p.s0,
    s1: p.s1,
    stable: p.stable,
    pairType: p.stable ? "correlated" : "volatile",
    tvlUsd: Math.round(tvlUsd),
    stakedPct,
    gauge: g,
    emissionApr,
    feeApr,
    apy: emissionApr + feeApr,
    p0,
    p1,
  };
}

// 30-day mean: emissions reset weekly (votes), so sample the emission APR at ~4
// weekly blocks (each with that week's rate + TVL + staked share) and mean them,
// then add one trailing-7d fee window. Mirrors the XRP aerodromeMean30d shape but
// with the staked-TVL denominator and the classic-pool reads.
const BASE_BLOCK_SEC = 2;
export async function aeroPoolMean30d({ pool, gauge, px, now, weeks = 4, feeWindowDays = 7 }) {
  const g = gauge ?? (await gaugeOf(pool));
  const head = await blockNumber(CHAIN);
  const emissions = [];
  for (let w = 0; w < weeks; w++) {
    // Estimate the block a week back rather than binary-searching for it — the
    // emission rate is constant within an epoch, so being a few hundred blocks
    // off is immaterial and this avoids ~25 sequential calls per sample.
    const block =
      w === 0 ? "latest" : Math.max(1, head - Math.round((w * 7 * 86400) / BASE_BLOCK_SEC));
    const r = await aeroPoolYield({ pool, gauge: g, px, skipFee: true, block });
    if (!r.error) emissions.push(r.emissionApr);
  }
  const meanEmission = emissions.length
    ? emissions.reduce((a, b) => a + b, 0) / emissions.length
    : 0;
  const latest = await aeroPoolYield({ pool, gauge: g, px, feeWindowDays });
  return {
    ...latest,
    emissionApr: meanEmission,
    emissionSpot: latest.emissionApr,
    apy: meanEmission + (latest.feeApr || 0),
    _weeks: emissions.length,
  };
}
