#!/usr/bin/env node
// Build-time search-index emitter. The Header used to fetch every
// indexed vault server-side just to feed the search dropdown, which
// added an avoidable server fetch to every page render and bloated
// the SSR HTML by ~50KB of JSON embedded in props. Now we emit one
// /search-index.json at build time and SearchBox loads it lazily on
// first focus.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const VAULTS_FILE = join(ROOT, "data", "vaults.json");
const PUBLIC_DIR = join(ROOT, "public");
const OUT_FILE = join(PUBLIC_DIR, "search-index.json");

// Ticker canonicaliser - mirrors the one in src/lib/lp-pair.ts so
// the displayName written here matches what's rendered everywhere
// else (asset hubs, single product pages, ranking tables).
const TICKER_CANONICAL = {
  wbtc: "WBTC", usdc: "USDC", usdt: "USDT", usdbc: "USDbC",
  cbbtc: "cbBTC", tbtc: "tBTC", steth: "stETH", wsteth: "wstETH",
  aero: "AERO", bswap: "BSWAP", virtual: "VIRTUAL", vvv: "VVV",
  eth: "ETH", btc: "BTC", matic: "MATIC", pol: "POL",
  arb: "ARB", op: "OP", crv: "CRV", cvx: "CVX",
};

function canonicaliseTicker(raw) {
  const k = (raw ?? "").toLowerCase();
  return TICKER_CANONICAL[k] ?? (raw ?? "").toUpperCase();
}

function stripChainSuffix(category, chain) {
  if (!category || !chain) return category ?? "";
  const re = new RegExp(`\\s+on\\s+${chain}\\s*$`, "i");
  return category.replace(re, "").trim();
}

function getLpPair(vault) {
  const logos = vault.underlyingLogos;
  if (!logos || logos.length <= 1) return null;
  const symbols = logos
    .map((p) => {
      const last = (p ?? "").split("/").pop() ?? "";
      return last.replace(/\.(svg|png|jpg|jpeg|webp)$/i, "");
    })
    .map((s) => s.trim())
    .filter(Boolean);
  if (symbols.length <= 1) return null;
  const assetLc = (vault.asset ?? "").toLowerCase();
  const isBtcSibling = (s) =>
    ["btc", "wbtc", "cbbtc", "tbtc", "ubtc", "hemibtc"].includes(
      s.toLowerCase(),
    );
  const counterpartRaw =
    symbols.find((s) =>
      assetLc === "btc" ? !isBtcSibling(s) : s.toLowerCase() !== assetLc,
    ) ?? symbols[0];
  const platform = stripChainSuffix(vault.category ?? "", vault.chain ?? "");
  return { counterpart: canonicaliseTicker(counterpartRaw), platform };
}

function isLpPairVault(vault) {
  return getLpPair(vault) !== null;
}

function getCanonicalDisplayName(vault) {
  const pair = getLpPair(vault);
  if (!pair) return vault.productName;
  if ((vault.productName ?? "").toLowerCase().includes("onlyboost")) {
    return vault.productName;
  }
  const counterpart = pair.counterpart?.trim();
  const platform = pair.platform?.trim();
  if (!counterpart || !platform) return vault.productName;
  return `${(vault.asset ?? "").toUpperCase()}/${counterpart} ${platform}`;
}

if (!existsSync(VAULTS_FILE)) {
  console.error(`[search-index] vaults.json not found at ${VAULTS_FILE}`);
  process.exit(1);
}

const vaults = JSON.parse(readFileSync(VAULTS_FILE, "utf-8"));

// Mirror the live-vault filter from src/lib/data.ts isLiveVault so
// the search dropdown never surfaces vaults that aren't on public
// ranking surfaces.
const live = vaults.filter((v) => v?.apy24h > 0 && v?.tvl > 0);

const items = live.map((v) => ({
  slug: v.slug,
  productName: v.productName,
  displayName: getCanonicalDisplayName(v),
  isLpPair: isLpPairVault(v),
  asset: v.asset,
  chain: v.chain,
  protocol: v?.protocol?.name ?? "",
  category: v.category ?? "",
  apy24h: v.apy24h,
  tvl: v.tvl,
}));

if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(items));
console.log(
  `[search-index] wrote ${items.length} items to ${OUT_FILE} (${
    (JSON.stringify(items).length / 1024).toFixed(1)
  }KB)`,
);
