// Data and facts for /yield-on-tokenized-stocks: Harvest's four vaults on
// Coinbase's tokenized stocks (NVDAc, AAPLc, METAc, GOOGLc) on Base, each
// depositing into an IPOR Fusion "carry trade" vault.
//
// Live figures come from data/tokenized-stocks.json (scripts/fetch-tokenized-
// stocks.mjs). The position snapshot below is read onchain with IPOR's vault
// reader and is dated: leverage moves with the share price, so it is shown as
// "on <date>", never as a current figure.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface StockVault {
  id: string;
  slug: string;
  token: string;
  company: string;
  ticker: string;
  name: string;
  chain: string;
  platform: string;
  vaultAddress: string;
  strategyAddress: string | null;
  tokenAddress: string;
  decimals: number;
  tokenPriceUsd: number | null;
  apy24h: number;
  apy30d: number | null;
  tvlUsd: number;
  sharePrice: number | null;
  carryVault: {
    address: string;
    name: string;
    tvlUsd: number | null;
    netApy: number | null;
    rewardsApy: number | null;
  } | null;
  /** Fixed-term markets built on this vault's share (Spectra on Base). */
  fixedTerm: FixedTermMarket[];
  apyHistory: { apy: number; timestamp: number }[];
  dataAsOf: string | null;
}

export interface FixedTermMarket {
  /** Principal token: redeems for one vault share at maturity. */
  pt: string;
  /** Yield token: collects the vault's yield until maturity. */
  yt: string | null;
  pool: string | null;
  maturity: string;
  createdAt: string | null;
  /** Percent: the rate locked by buying the principal token now. */
  fixedApy: number | null;
  /** Percent: the vault rate the market prices in until maturity. */
  impliedApy: number | null;
  /** Percent: what the pool pays a liquidity provider. */
  lpApy: number | null;
  ptPrice: number | null;
  ytLeverage: number | null;
  liquidityUsd: number | null;
  ptTvlUsd: number | null;
}

export const basescan = (address: string) => `https://basescan.org/address/${address}`;

export interface StockData {
  fetchedAt: string;
  dataAsOf: string;
  vaults: StockVault[];
}

export function loadStockData(): StockData {
  const f = join(process.cwd(), "data", "tokenized-stocks.json");
  if (!existsSync(f)) return { fetchedAt: new Date().toISOString(), dataAsOf: new Date().toISOString(), vaults: [] };
  return JSON.parse(readFileSync(f, "utf-8")) as StockData;
}

/** The app, filtered to the stock vaults (the filter the app itself uses). */
export const stockAppUrl = () => "https://app.harvest.finance/?asset=stocks";

// Harvest's fee on Base, read from the strategy contracts (see
// network-hub-copy.ts): already deducted from every Harvest APY shown.
export const HARVEST_FEE_BASE = "10%";

// The borrowing side of each carry vault on Aave v4 (Base), read onchain with
// IPOR's vault reader on November 15, 2026, 18:51 UTC. LTV = USDC borrowed /
// value of the stock posted. A health factor of 1 is the liquidation point.
export const POSITION_SNAPSHOT = {
  date: "November 15, 2026",
  iso: "2026-11-15T18:51:00Z",
  rows: [
    { token: "NVDAc", ltv: 50.0, maxLtv: 70, health: 1.4 },
    { token: "AAPLc", ltv: 53.1, maxLtv: 78, health: 1.47 },
    { token: "METAc", ltv: 49.1, maxLtv: 65, health: 1.32 },
    { token: "GOOGLc", ltv: 65.0, maxLtv: 76, health: 1.17 },
  ],
} as const;

// Fees and exits of the IPOR carry vault, read from the Nvidia Carry Trade
// vault's FeeManager and WithdrawManager on November 15, 2026.
export const CARRY_TERMS = {
  performanceFee: "7%",
  managementFee: "0.4%",
  withdrawWindowHours: 24,
};

// What Coinbase's tokens are, from published sources (linked on the page).
export const TOKEN_SOURCES = {
  base: "https://base.org/stocks",
  galaxy:
    "https://www.galaxy.com/insights/research/coinbase-tokenized-stocks-base-third-party-issuer-sec-innovation-exemption",
  cryptoNews: "https://crypto.news/coinbase-tokenized-stocks-go-live-on-base-with-backing/",
  ipor: "https://app.ipor.io/fusion/base",
};

/** Mean APY over the first and the last `days` days of the history. */
export function rateDrift(v: StockVault, days = 7): { first: number; last: number } | null {
  const h = v.apyHistory;
  if (h.length < days * 2) return null;
  const mean = (xs: { apy: number }[]) => xs.reduce((s, p) => s + p.apy, 0) / xs.length;
  return { first: mean(h.slice(0, days)), last: mean(h.slice(-days)) };
}

/**
 * How far the share price can fall before a position with this health factor
 * reaches liquidation, all else equal (debt in USDC fixed): 1 - 1/HF.
 */
export const dropToLiquidation = (health: number) => (1 - 1 / health) * 100;
