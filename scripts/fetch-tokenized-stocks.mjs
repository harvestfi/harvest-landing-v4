#!/usr/bin/env node
// Fetch the tokenized-stock vaults (Coinbase NVDAc, AAPLc, METAc, GOOGLc on
// Base) into data/tokenized-stocks.json for /yield-on-tokenized-stocks.
//
// Kept out of data/vaults.json on purpose: the main index is denominated in
// USDC, USDT, ETH and BTC, and every ranking, count and hub reads it. A stock
// is a different unit of account, so it gets its own file and its own page
// rather than leaking into the stablecoin and ETH cohorts.
//
// Three sources, all public:
//   1. Harvest vault API: the vault, its token, live APY, TVL, share price.
//   2. Harvest history subgraph: daily APY readings (90 days) for the 30-day
//      average and the rate chart, same series the product pages use.
//   3. IPOR Fusion API: the carry vault each Harvest vault deposits into,
//      for its own TVL and the split between carry and USDC incentives.
//   4. Spectra API: fixed-term markets whose yield-bearing token is the
//      Harvest vault share itself (fNVDAc, ...), split into a principal
//      token (fixed rate) and a yield token. Matched by address, not name.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "data", "tokenized-stocks.json");
const HARVEST_API = "https://api.harvest.finance/vaults?key=harvest-key";
const HISTORY_BASE_URL = "https://clownfish-app-2dsdk.ondigitalocean.app";
const IPOR_API = "https://api.ipor.io/v2/fusion/vaults";
const SPECTRA_API = "https://api.spectra.finance/v1/base/pools";
const BASE_CHAIN_ID = 8453;

// Token symbol -> company. The "c" suffix is Coinbase's ticker convention.
const STOCKS = {
  NVDAc: { company: "Nvidia", ticker: "NVDA" },
  AAPLc: { company: "Apple", ticker: "AAPL" },
  METAc: { company: "Meta", ticker: "META" },
  GOOGLc: { company: "Alphabet", ticker: "GOOGL" },
};

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : null;
};
const now = () => Math.floor(Date.now() / 1000);

async function getJson(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function apyHistory(vaultAddress) {
  const since = now() - 90 * 86400;
  const query = `{
    apyAutoCompounds(
      where: { vault: "${vaultAddress.toLowerCase()}", timestamp_gte: "${since}" }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) { apy timestamp }
  }`;
  try {
    const json = await getJson(`${HISTORY_BASE_URL}/${BASE_CHAIN_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    return (json?.data?.apyAutoCompounds ?? [])
      .map((r) => ({ apy: parseFloat(r.apy), timestamp: parseInt(r.timestamp, 10) }))
      .filter((p) => Number.isFinite(p.apy) && p.apy >= 0 && p.apy <= 100);
  } catch (err) {
    console.warn(`[stocks] history ${vaultAddress}: ${err.message}`);
    return [];
  }
}

// One reading per UTC day (the last of the day), oldest first.
function daily(points) {
  const byDay = new Map();
  for (const p of points) byDay.set(Math.floor(p.timestamp / 86400), p);
  return [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);
}

async function main() {
  const harvest = await getJson(HARVEST_API);
  const base = harvest.base ?? {};
  let ipor = [];
  try {
    ipor = await getJson(IPOR_API);
    if (!Array.isArray(ipor)) ipor = ipor?.vaults ?? [];
  } catch (err) {
    console.warn(`[stocks] IPOR API: ${err.message}`);
  }

  let spectra = [];
  try {
    spectra = await getJson(SPECTRA_API);
    if (!Array.isArray(spectra)) spectra = [];
  } catch (err) {
    console.warn(`[stocks] Spectra API: ${err.message}`);
  }
  const fixedTermFor = (vaultAddress) =>
    spectra
      .filter((p) => p.ibt?.address?.toLowerCase() === vaultAddress.toLowerCase() && p.maturity * 1000 > Date.now())
      .map((p) => {
        const pool = p.pools?.[0] ?? {};
        return {
          pt: p.address,
          yt: p.yt?.address ?? null,
          pool: pool.address ?? null,
          maturity: new Date(p.maturity * 1000).toISOString(),
          createdAt: p.createdAt ? new Date(p.createdAt * 1000).toISOString() : null,
          // Percent figures, as the API returns them (8.9 = 8.9%).
          fixedApy: num(pool.ptApy),
          impliedApy: num(pool.impliedApy),
          lpApy: num(pool.lpApy?.total),
          ptPrice: num(pool.ptPrice?.underlying),
          ytLeverage: num(pool.ytLeverage),
          liquidityUsd: num(pool.liquidity?.usd),
          ptTvlUsd: num(p.tvl?.usd),
        };
      })
      .sort((a, b) => a.maturity.localeCompare(b.maturity));

  const vaults = [];
  for (const [id, v] of Object.entries(base)) {
    const token = v.tokenNames?.[0];
    if (!token || !STOCKS[token] || v.inactive) continue;
    const meta = STOCKS[token];
    const platform = v.platform?.[0] ?? "";
    // The IPOR vault this one deposits into: the public "<Company> Carry
    // Trade" vault for the same asset (the "Tezos" twins are closed).
    const carryName = platform.replace(/^IPOR\s*-\s*/, "").trim();
    const carry = ipor.find(
      (x) =>
        Number(x.chainId) === BASE_CHAIN_ID &&
        String(x.name).trim().toLowerCase() === carryName.toLowerCase() &&
        x.publicDepositOpened !== false,
    );
    const hist = daily(await apyHistory(v.vaultAddress));
    const last30 = hist.filter((p) => p.timestamp >= now() - 30 * 86400);
    const apy30d = last30.length ? last30.reduce((s, p) => s + p.apy, 0) / last30.length : null;
    vaults.push({
      id,
      slug: `${token.toLowerCase()}-ipor-carry-trade-base`,
      token,
      company: meta.company,
      ticker: meta.ticker,
      // The vault's own name ("Google Carry Trade"), as the app shows it.
      name: carryName || `${meta.company} Carry Trade`,
      chain: "Base",
      platform,
      vaultAddress: v.vaultAddress,
      strategyAddress: v.strategyAddress ?? null,
      tokenAddress: v.tokenAddress,
      decimals: Number(v.decimals),
      tokenPriceUsd: num(v.usdPrice),
      apy24h: num(v.estimatedApy) ?? 0,
      apy30d,
      tvlUsd: num(v.totalValueLocked) ?? 0,
      sharePrice: v.pricePerFullShare && v.decimals ? Number(v.pricePerFullShare) / 10 ** Number(v.decimals) : null,
      carryVault: carry
        ? {
            address: carry.address,
            name: carry.name,
            tvlUsd: num(carry.tvl),
            netApy: num(carry.netApy),
            rewardsApy: num(carry.rewardsApy),
          }
        : null,
      fixedTerm: fixedTermFor(v.vaultAddress),
      apyHistory: hist,
      dataAsOf: hist.length ? new Date(hist.at(-1).timestamp * 1000).toISOString() : null,
    });
  }

  vaults.sort((a, b) => b.apy24h - a.apy24h);
  const dataAsOf = vaults.map((v) => v.dataAsOf).filter(Boolean).sort().at(-1) ?? new Date().toISOString();
  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), dataAsOf, vaults }, null, 2));
  console.log(`[stocks] wrote ${vaults.length} vaults to data/tokenized-stocks.json (${vaults.map((v) => v.token).join(", ")})`);
  if (vaults.length === 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`[stocks] ${err.stack ?? err}`);
  process.exit(1);
});
