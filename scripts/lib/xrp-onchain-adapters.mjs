// Per-venue on-chain adapters for the XRP yield report. Each returns the same
// shape the pipeline already consumes: { apy, apyBase, apyReward, tvlUsd, ... }.
// Values come from public chain state via scripts/lib/onchain.mjs.

import {
  ethCall,
  callUint,
  toBig,
  word,
  encUint,
  encAddr,
  encInt,
  call,
  SEL,
  ratePerSecToApy,
  blockAtTimestamp,
  blockNumber,
  getLogs,
  toInt,
  SWAP_TOPIC,
} from "./onchain.mjs";

const pow10 = (n) => 10n ** BigInt(n);

// Fee APR from Swap-event volume over [fromBlock,toBlock]. token0 amount is the
// first data word (int256); pricing token0 gives the pool's USD volume, and the
// fee tier × volume ÷ TVL, annualized, is the fee yield.
export async function feeAprFromSwaps({
  chain,
  pool,
  fromBlock,
  toBlock,
  dec0,
  price0,
  feeFrac,
  tvlUsd,
  windowDays,
}) {
  const logs = await getLogs(chain, pool, SWAP_TOPIC, fromBlock, toBlock);
  let vol0 = 0;
  for (const l of logs) {
    const a0 = toInt(word(l.data, 0));
    vol0 += Number(a0 < 0n ? -a0 : a0) / 10 ** dec0;
  }
  const volUsd = vol0 * price0;
  const feesUsd = volUsd * feeFrac;
  return tvlUsd > 0 ? (feesUsd * (365 / windowDays)) / tvlUsd * 100 : 0;
}

// ---- prices --------------------------------------------------------------

// Flare FTSOv2 registry + feed. XRP/USD, FLR/USD are read from the same oracle
// the venues themselves use. The single XRP/USD reference is applied to every
// XRP-denominated leg (FXRP, cbXRP, stXRP) across both chains for consistency.
const FTSOV2 = "0x7bde3df0624114edb3a67dfe6753e62f4e7c1d20";
// feedId = 0x01 + ascii category, left-aligned in a bytes21.
const feedId = (sym) => {
  const ascii = Buffer.from(sym, "ascii").toString("hex");
  return ("01" + ascii).padEnd(42, "0"); // 21 bytes = 42 hex
};
const feedArg = (sym) => feedId(sym).padEnd(64, "0"); // bytes21 left-aligned in 32-byte word

// Returns { price, decimals }. FtsoV2.getFeedById(bytes21) -> (uint256 value, int8 decimals, uint64 ts)
export async function ftsoFeed(sym) {
  const res = await ethCall("flare", FTSOV2, call(SEL.getFeedById, feedArg(sym)));
  const value = toBig(word(res, 0));
  // int8 decimals in word 1 (two's complement, but always small positive here)
  const dec = Number(toBig(word(res, 1)));
  return { price: Number(value) / 10 ** dec, decimals: dec };
}

let _xrpUsd = null;
export async function xrpUsd() {
  if (_xrpUsd == null) _xrpUsd = (await ftsoFeed("XRP/USD")).price;
  return _xrpUsd;
}
let _flrUsd = null;
export async function flrUsd() {
  if (_flrUsd == null) _flrUsd = (await ftsoFeed("FLR/USD")).price;
  return _flrUsd;
}

// Chainlink feed (Base): latestRoundData() -> (roundId, int256 answer, ...). 8-dec.
export async function chainlink(chain, feed, block = "latest") {
  const res = await ethCall(chain, feed, SEL.latestRoundData, block);
  return Number(toBig(word(res, 1))) / 1e8;
}

// XRP/USD at a historical block (FTSO archive read).
export async function xrpUsdAt(block) {
  const res = await ethCall("flare", FTSOV2, call(SEL.getFeedById, feedArg("XRP/USD")), block);
  return Number(toBig(word(res, 0))) / 10 ** Number(toBig(word(res, 1)));
}

// Base chainlink feeds used by the Aerodrome pools.
export const BASE_FEEDS = {
  eth: "0x71041dddad3595f9ced3dccfbe3d1f4b0a16bb70",
  btc: "0xccadc697c55bbb68dc5bcdf8d3cbe83cdd4e071e",
  aero: "0x4ec5970fc728c5f65ba413992cd5ff6fd70fcff0",
};

// ---- Compound-fork lending (Kinetic, Moonwell) ---------------------------

// Reads base supply APY + supplied/net TVL from a cToken market. Reward APY is
// layered on top by the protocol-specific caller (rewards differ per venue).
export async function readCompound({ chain, market, underlyingDec, block = "latest" }) {
  const [supRate, totSupply, exRate, borrows] = await Promise.all([
    callUint(chain, market, SEL.supplyRatePerTimestamp, block),
    callUint(chain, market, SEL.totalSupply, block),
    callUint(chain, market, SEL.exchangeRateStored, block),
    callUint(chain, market, SEL.totalBorrows, block).catch(() => 0n),
  ]);
  const baseApy = ratePerSecToApy(supRate);
  const suppliedSmallest = (totSupply * exRate) / pow10(18); // underlying smallest units
  const suppliedTok = Number(suppliedSmallest) / 10 ** underlyingDec;
  const borrowedTok = Number(borrows) / 10 ** underlyingDec;
  return {
    baseApy,
    suppliedTok,
    borrowedTok,
    netTok: suppliedTok - borrowedTok,
    supRate,
  };
}

// Kinetic FXRP: base + rFLR reward (reward type 3), rFLR priced as FLR.
export async function kineticFxrp({ chain = "flare", market, underlyingDec = 6, xrp, flr, block = "latest" }) {
  const c = await readCompound({ chain, market, underlyingDec, block });
  const suppliedUsd = c.suppliedTok * xrp;
  const netUsd = c.netTok * xrp;
  // rFLR reward (reward type 3), read from the COMPTROLLER (Compound stores
  // reward speeds on the comptroller, not the cToken). rFLR is priced 1:1 as FLR.
  let rewardApy = 0;
  try {
    const comptroller = "0x" + word(await ethCall(chain, market, SEL.comptroller, block), 0).slice(26);
    const speed = await callUint(
      chain,
      comptroller,
      call(SEL.supplyRewardSpeeds, encUint(3), encAddr(market)),
      block,
    );
    const rflrPerYear = (Number(speed) / 1e18) * 31_536_000;
    rewardApy = suppliedUsd > 0 ? (rflrPerYear * flr) / suppliedUsd * 100 : 0;
  } catch {
    /* reward optional */
  }
  return {
    apyBase: c.baseApy,
    apyReward: rewardApy,
    apy: c.baseApy + rewardApy,
    tvlUsd: Math.round(netUsd),
    suppliedUsd: Math.round(suppliedUsd),
    _dbg: c,
  };
}

// Moonwell cbXRP: base + WELL reward. WELL price is not on the Moonwell oracle,
// so it is passed in (sourced from a Base DEX/feed by the caller).
export async function moonwellCbxrp({
  chain = "base",
  market,
  comptroller,
  underlyingDec = 6,
  xrp,
  wellUsd,
  block = "latest",
}) {
  const c = await readCompound({ chain, market, underlyingDec, block });
  const suppliedUsd = c.suppliedTok * xrp;
  const netUsd = c.netTok * xrp;
  let rewardApy = 0;
  try {
    // MultiRewardDistributor.getAllMarketConfigs(market) -> array of configs.
    const mrd = "0x" + word(await ethCall(chain, comptroller, SEL.rewardDistributor, block), 0).slice(26);
    const res = await ethCall(chain, mrd, call(SEL.getAllMarketConfigs, encAddr(market)), block);
    // ABI: dynamic array of struct(9 fields). Layout: [offset][len][ (9 words) * len ]
    const len = Number(toBig(word(res, 1)));
    // Each config is 9 words; emissionToken is field 1, supplyEmissionsPerSec is field 7.
    let wellSpeed = 0n;
    for (let i = 0; i < len; i++) {
      const base = 2 + i * 9;
      const supplyEmis = toBig(word(res, base + 7));
      // Pick the config with a nonzero supply emission (the active WELL one).
      if (supplyEmis > 0n) wellSpeed = supplyEmis;
    }
    const wellPerYear = (Number(wellSpeed) / 1e18) * 31_536_000;
    rewardApy = suppliedUsd > 0 && wellUsd ? (wellPerYear * wellUsd) / suppliedUsd * 100 : 0;
  } catch {
    /* reward optional */
  }
  return {
    apyBase: c.baseApy,
    apyReward: rewardApy,
    apy: c.baseApy + rewardApy,
    tvlUsd: Math.round(netUsd),
    suppliedUsd: Math.round(suppliedUsd),
    _dbg: c,
  };
}

// ---- Mystic FXRP vault (Morpho VaultV2, ERC4626) -------------------------

const PPS_UNIT = 10n ** 24n; // convertToAssets(1e24) -> ~12 sig-figs of price-per-share

async function ppsAt(chain, vault, block) {
  const raw = await callUint(chain, vault, call(SEL.convertToAssets, encUint(PPS_UNIT)), block);
  return Number(raw) / Number(PPS_UNIT); // FXRP per share (~1.000x)
}
const annualize = (pNow, pPast, dtSec) =>
  dtSec > 0 && pPast > 0 ? (pNow / pPast - 1) * (31_536_000 / dtSec) * 100 : 0;

// Realized, net-of-fee holder yield from price-per-share growth. The vault's
// forward/gross number (what aggregators show) is higher; this is what holders
// actually earn. `now` is epoch seconds.
export async function mysticVault({ chain = "flare", vault, underlyingDec = 6, xrp, now }) {
  const totalAssets = await callUint(chain, vault, SEL.totalAssets);
  const tvlUsd = (Number(totalAssets) / 10 ** underlyingDec) * xrp;
  const nowB = await blockNumber(chain);
  const b7 = await blockAtTimestamp(chain, now - 7 * 86400);
  const b30 = await blockAtTimestamp(chain, now - 30 * 86400);
  const [pNow, p7, p30] = await Promise.all([
    ppsAt(chain, vault, nowB),
    ppsAt(chain, vault, b7),
    ppsAt(chain, vault, b30),
  ]);
  const apy = annualize(pNow, p7, 7 * 86400);
  const apyMean30d = annualize(pNow, p30, 30 * 86400);
  return { apy, apyBase: apy, apyReward: 0, apyMean30d, tvlUsd: Math.round(tvlUsd), pps: pNow };
}

// ---- SparkDEX stXRP/FXRP (Algebra Integral CL pool) ----------------------

const Q128 = 2n ** 128n;

// Swap-fee APR from the fee-growth accumulators over a trailing window. Both
// legs are ~XRP-priced. No farm is attached to this pool (reward APR = 0).
export async function sparkdexPool({
  chain = "flare",
  pool,
  dec0 = 6,
  dec1 = 6,
  xrp,
  now,
  windowDays = 7,
}) {
  const res = await ethCall(chain, pool, SEL.getReserves);
  const r0 = Number(toBig(word(res, 0))) / 10 ** dec0;
  const r1 = Number(toBig(word(res, 1))) / 10 ** dec1;
  const tvlUsd = (r0 + r1) * xrp;

  const nowB = await blockNumber(chain);
  const pastB = await blockAtTimestamp(chain, now - windowDays * 86400);
  // Fee tier from fee() (hundredths of a bip: 100 -> 0.01%). Fee APR from swap
  // volume over the window (token0 is ~XRP-priced). No farm attached here.
  let feeFrac = 0.0001;
  try {
    feeFrac = Number(await callUint(chain, pool, SEL.fee)) / 1e6;
  } catch {
    /* dynamic-fee pools: fall back to the 0.01% base tier */
  }
  const feeApr = await feeAprFromSwaps({
    chain,
    pool,
    fromBlock: pastB,
    toBlock: nowB,
    dec0,
    price0: xrp,
    feeFrac,
    tvlUsd,
    windowDays,
  });
  return { apy: feeApr, apyBase: feeApr, apyReward: 0, tvlUsd: Math.round(tvlUsd) };
}

// ---- Aerodrome CL pools (emission + fee APR) -----------------------------

const sqrtPriceToP1per0 = (sqrtX96, dec0, dec1) => {
  // price of token1 in token0 = (sqrtP/2^96)^2 * 10^(dec0-dec1)
  const s = Number(sqrtX96) / 2 ** 96;
  return s * s * 10 ** (dec0 - dec1);
};

// Emission APR (AERO gauge) + fee APR (from Swap logs) + TVL. cbXRP is priced
// from the pool's own sqrtPrice against the paired asset's Chainlink feed.
export async function aerodromePool({
  chain = "base",
  pool,
  gauge,
  token0,
  token1,
  dec0,
  dec1,
  cbxrpIs, // "token0" | "token1"
  pairFeed, // chainlink feed for the non-cbXRP leg
  aeroUsd,
  now,
  block = "latest",
}) {
  // reserves via balanceOf(pool)
  const bal = async (t) => Number(toBig(await ethCall(chain, t, call(SEL.balanceOf, encAddr(pool)), block)));
  const [b0, b1, slot0] = await Promise.all([
    bal(token0),
    bal(token1),
    ethCall(chain, pool, SEL.slot0, block),
  ]);
  const amt0 = b0 / 10 ** dec0;
  const amt1 = b1 / 10 ** dec1;
  const pairUsd = await chainlink(chain, pairFeed, block);
  // derive cbXRP price from pool ratio against the paired asset
  const sqrtP = toBig(word(slot0, 0));
  const p1per0 = sqrtPriceToP1per0(sqrtP, dec0, dec1); // token1 per token0
  let cbxrpUsd, tvlUsd;
  if (cbxrpIs === "token1") {
    // token0 is the priced asset (e.g. WETH). cbXRP(token1) = pairUsd / p1per0
    cbxrpUsd = pairUsd / p1per0;
    tvlUsd = amt0 * pairUsd + amt1 * cbxrpUsd;
  } else {
    // token0 is cbXRP; token1 is the priced asset (e.g. cbBTC). cbXRP = pairUsd * p1per0
    cbxrpUsd = pairUsd * p1per0;
    tvlUsd = amt0 * cbxrpUsd + amt1 * pairUsd;
  }
  // emission APR
  const rate = await callUint(chain, gauge, SEL.rewardRate, block); // AERO/sec 1e18
  const aeroPerYear = (Number(rate) / 1e18) * 31_536_000;
  const emissionApr = tvlUsd > 0 ? (aeroPerYear * aeroUsd) / tvlUsd * 100 : 0;
  return {
    tvlUsd: Math.round(tvlUsd),
    cbxrpUsd,
    emissionApr,
    _amt: { amt0, amt1, pairUsd },
  };
}
