#!/usr/bin/env node

/**
 * Fetch all vault and history data from Harvest Finance APIs
 * and write to data/vaults.json and data/history.json.
 *
 * Usage: node scripts/fetch-data.mjs
 *
 * Requires Node 18+ (native fetch).
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VAULTS_FILE = join(ROOT, "data", "vaults.json");
const HISTORY_FILE = join(ROOT, "data", "history.json");
const SLUGS_FILE = join(ROOT, "data", "slugs.json");

// Load persisted slug map (contractAddress -> slug) so URLs never change
function loadSlugMap() {
  try {
    if (existsSync(SLUGS_FILE)) {
      return JSON.parse(readFileSync(SLUGS_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveSlugMap(map) {
  writeFileSync(SLUGS_FILE, JSON.stringify(map, null, 2));
}

const HARVEST_API = "https://api.harvest.finance/vaults?key=harvest-key";
const HISTORY_BASE_URL = "https://clownfish-app-2dsdk.ondigitalocean.app";

const CHAIN_NAMES = {
  eth: "Ethereum",
  matic: "Polygon",
  arbitrum: "Arbitrum",
  base: "Base",
  zksync: "zkSync",
  hyperevm: "HyperEVM",
};

const CHAIN_IDS = {
  eth: "1",
  matic: "137",
  arbitrum: "42161",
  base: "8453",
  zksync: "324",
};

const CHAIN_NAME_TO_KEY = {
  Ethereum: "eth",
  Polygon: "matic",
  Arbitrum: "arbitrum",
  Base: "base",
  zkSync: "zksync",
  HyperEVM: "hyperevm",
};

function log(msg) {
  console.log(msg);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseNumber(val) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

// ─── Vault fetching (mirrors harvest-api.ts) ────────────────────────────────

async function fetchHarvestVaults() {
  log("[harvest-api] fetching vaults...");
  const res = await fetch(HARVEST_API);

  if (!res.ok) {
    throw new Error(`[harvest-api] failed: ${res.status}`);
  }

  const raw = await res.json();

  const chainKeys = Object.keys(CHAIN_NAMES);
  const allVaults = [];

  for (const key of chainKeys) {
    const chainData = raw[key];
    if (!chainData || typeof chainData !== "object") continue;

    for (const [vaultKey, vaultData] of Object.entries(chainData)) {
      if (typeof vaultData === "object" && vaultData !== null) {
        allVaults.push({
          ...vaultData,
          _sourceChain: key,
          _vaultKey: vaultKey,
        });
      }
    }
  }

  log(`[harvest-api] total vaults: ${allVaults.length}`);

  const activeVaults = allVaults.filter((v) => !v.inactive);
  log(`[harvest-api] active vaults: ${activeVaults.length}`);

  // ── Token discovery: log every unique tokenName and how many vaults use it
  const tokenCounts = new Map();
  for (const v of activeVaults) {
    for (const tn of v.tokenNames || []) {
      const key = String(tn).toUpperCase();
      tokenCounts.set(key, (tokenCounts.get(key) || 0) + 1);
    }
  }
  const sortedTokens = [...tokenCounts.entries()].sort((a, b) => b[1] - a[1]);
  log(`[harvest-api] ── TOKEN DISCOVERY (${sortedTokens.length} unique tokens) ──`);
  for (const [token, count] of sortedTokens) {
    log(`  ${token}: ${count} vaults`);
  }

  // Asset groups — each maps a YieldVault.asset enum value to the underlying
  // tokens it covers. tokenNames from the API are matched case-insensitively.
  const ASSET_GROUPS = [
    {
      asset: "USDC",
      tokens: ["USDC"],
      slugPrefix: "usdc",
    },
    {
      asset: "USDT",
      tokens: ["USDT", "USDT0"],
      slugPrefix: "usdt",
    },
    {
      asset: "ETH",
      tokens: ["ETH", "WETH", "stETH", "wstETH", "rETH", "cbETH", "weETH", "frxETH", "sfrxETH"],
      slugPrefix: "eth",
    },
    {
      asset: "BTC",
      tokens: ["BTC", "WBTC", "cbBTC", "tBTC", "LBTC", "sBTC"],
      slugPrefix: "btc",
    },
  ];

  const persistedSlugs = loadSlugMap();
  const seenSlugs = new Set(Object.values(persistedSlugs));
  const newSlugMap = { ...persistedSlugs };
  const allResults = [];
  // Track contract addresses already assigned to a group so a vault that
  // matches multiple token sets (e.g. USDC-WETH LP) only appears once.
  // First-match wins; ASSET_GROUPS order defines priority.
  const claimedAddresses = new Set();

  // Normalize a tokenName so unicode/punctuation variants of the same
  // symbol all collapse to one ASCII spelling. Eg "USD₮0" tether symbol
  // → "USDT0", "USDT-0" → "USDT0", " usdT0 " → "USDT0".
  const normalizeToken = (s) =>
    String(s ?? "")
      .toUpperCase()
      .replace(/₮/g, "T")
      .replace(/[^A-Z0-9]/g, "");

  for (const group of ASSET_GROUPS) {
    const tokenSet = new Set(group.tokens.map(normalizeToken));
    const matched = activeVaults.filter((v) => {
      if (claimedAddresses.has(v.vaultAddress)) return false;
      const names = v.tokenNames || [];
      const hit = names.some((n) => tokenSet.has(normalizeToken(n)));
      if (hit) claimedAddresses.add(v.vaultAddress);
      return hit;
    });
    log(`[harvest-api] ${group.asset} vaults: ${matched.length}`);

    if (matched.length === 0) continue;

    // Fetch historical APY data for top vaults (limit to top 20 by TVL)
    const sortedByTvl = [...matched].sort(
      (a, b) => parseNumber(b.totalValueLocked) - parseNumber(a.totalValueLocked)
    );
    const topVaults = sortedByTvl.slice(0, 20);
    const historyMap = new Map();

    const historyResults = await Promise.all(
      topVaults.map((v) => fetchVaultHistoryShort(v.vaultAddress, v._sourceChain))
    );
    topVaults.forEach((v, i) => {
      historyMap.set(v.vaultAddress, {
        apy24h: historyResults[i].apy24h,
        apy30d: historyResults[i].apy30d,
      });
    });

    const groupResults = matched.map((v) => {
      const chain = CHAIN_NAMES[v._sourceChain] || v._sourceChain;
      const platform = v.platform?.[0] || "Harvest";

      const platformParts = platform.split(" - ");
      const protocol = platformParts[0].trim();
      const strategy =
        platformParts.length > 1
          ? platformParts.slice(1).join(" - ").trim()
          : "";

      // Surface the actual underlying token (e.g. wstETH) instead of the
      // group name, so users can tell apart ETH vs wstETH vs stETH vaults.
      // USDT0 is a wrapped form of USDT we treat as plain USDT in the UI.
      const matchedTokenRaw =
        (v.tokenNames || []).find((n) => tokenSet.has(String(n).toUpperCase())) ||
        group.asset;
      const matchedToken =
        String(matchedTokenRaw).toUpperCase() === "USDT0" ? "USDT" : matchedTokenRaw;

      const productName = strategy
        ? `${matchedToken} ${strategy}`
        : `${matchedToken} ${protocol}`;
      const categoryDisplay = `${protocol} - ${chain}`;
      const currentApy = parseNumber(v.estimatedApy);
      const tvl = parseNumber(v.totalValueLocked);
      const history = historyMap.get(v.vaultAddress);

      // Spec: {asset}-{protocol}-{vault-disambiguator}-{network}
      // Always recompute the canonical base slug from current data so vaults
      // with stale persisted slugs (missing protocol name) get migrated.
      // Strategy is already split from protocol; strip leading token name from
      // disambiguator to avoid double-asset in slug (e.g. "USDC Steakhouse" -> "Steakhouse").
      const tokenUpper = matchedToken.toUpperCase();
      const strategyStripped = strategy
        .replace(new RegExp("^" + tokenUpper + "\\s+", "i"), "")
        .trim();
      let disambiguator = strategyStripped ? slugify(strategyStripped) : "";
      const protocolSlug = slugify(protocol);
      const tokenSlug = slugify(matchedToken);
      const chainSlug = slugify(chain);

      // For LP pair vaults the strategy/productName is identical across many
      // vaults (e.g. all "ETH Aerodrome" pools). Disambiguate by the OTHER
      // token in tokenNames so the slug carries pair info instead of -2/-3.
      if (!disambiguator || disambiguator === protocolSlug) {
        const others = (v.tokenNames || []).filter(
          (n) => String(n).toUpperCase() !== tokenUpper,
        );
        if (others.length > 0) {
          disambiguator = others.map((n) => slugify(n)).join("-");
        }
      }

      // Drop disambiguator when redundant (equals protocol slug) or absent
      const baseSlug =
        disambiguator && disambiguator !== protocolSlug
          ? `${tokenSlug}-${protocolSlug}-${disambiguator}-${chainSlug}`
          : `${tokenSlug}-${protocolSlug}-${chainSlug}`;

      // Honor persisted slug only if it shares the canonical base — preserves
      // URL stability for already-good slugs (including their -2/-3 suffix)
      // but forces migration for legacy slugs missing the protocol name.
      let slug;
      const persisted = persistedSlugs[v.vaultAddress];
      if (
        persisted &&
        (persisted === baseSlug || persisted.startsWith(baseSlug + "-"))
      ) {
        slug = persisted;
      } else {
        slug = baseSlug;
        let counter = 1;
        while (seenSlugs.has(slug)) {
          counter++;
          slug = `${baseSlug}-${counter}`;
        }
      }
      seenSlugs.add(slug);
      newSlugMap[v.vaultAddress] = slug;

      const breakdownValues = v.estimatedApyBreakdown || [];
      const tokenSymbols = v.apyTokenSymbols || [];
      const apyBreakdown = breakdownValues.map((val, i) => ({
        source:
          tokenSymbols[i] ||
          (breakdownValues.length === 1 ? "Base Rate" : `Source ${i + 1}`),
        apy: parseNumber(val),
      }));

      const boostedApy = v.boostedEstimatedAPY
        ? parseNumber(v.boostedEstimatedAPY)
        : null;

      const iconUrls = v.apyIconUrls || [];
      const rewardTokens = tokenSymbols
        .map((sym, i) => ({ symbol: sym, logoUrl: iconUrls[i] || "" }))
        .filter((r) => r.symbol && r.logoUrl);

      return {
        id: v.vaultAddress,
        slug,
        asset: group.asset,
        productName,
        protocol: { name: "Harvest Finance", slug: "harvest-finance" },
        vaultType: v.tags?.some((t) => t.toLowerCase().includes("pilot"))
          ? "Autopilot"
          : "Autocompounder",
        apy24h: history?.apy24h ?? currentApy,
        apy30d: history?.apy30d ?? currentApy,
        tvl,
        description: `${productName} on ${protocol} (${chain}). Yield strategy indexed by Harvest.`,
        chain,
        contractAddress: v.vaultAddress,
        riskLevel: "low",
        category: categoryDisplay,
        launchDate: "",
        apyBreakdown,
        boostedApy: boostedApy && boostedApy > 0 ? boostedApy : null,
        strategyAddress: v.strategyAddress || undefined,
        tokenAddress: v.tokenAddress || undefined,
        underlyingLogos: Array.isArray(v.logoUrl) ? v.logoUrl.filter(Boolean) : undefined,
        rewardTokens: rewardTokens.length > 0 ? rewardTokens : undefined,
      };
    });

    allResults.push(...groupResults);
  }

  allResults.sort((a, b) => b.apy24h - a.apy24h);

  log(`[harvest-api] final count: ${allResults.length}`);
  return { vaults: allResults, slugMap: newSlugMap };
}

// ─── Short history (30d APY only, for vault listing) ─────────────────────────

async function queryGraphQL(chainId, query) {
  try {
    const res = await fetch(`${HISTORY_BASE_URL}/${chainId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      log(`[history] chain=${chainId} failed: ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (json.errors) {
      log(`[history] chain=${chainId} errors: ${JSON.stringify(json.errors)}`);
      return null;
    }
    return json.data;
  } catch (err) {
    log(`[history] chain=${chainId} error: ${err}`);
    return null;
  }
}

async function fetchVaultHistoryShort(vaultAddress, chainKey) {
  const chainId = CHAIN_IDS[chainKey];
  if (!chainId) {
    return { apy24h: null, apy30d: null };
  }

  const addr = vaultAddress.toLowerCase();
  const thirtyDaysAgo = nowSeconds() - 30 * 24 * 60 * 60;

  const query = `{
    apyAutoCompounds(
      where: { vault: "${addr}", timestamp_gte: "${thirtyDaysAgo}" }
      orderBy: timestamp
      orderDirection: desc
      first: 500
    ) {
      apy
      timestamp
    }
  }`;

  const data = await queryGraphQL(chainId, query);
  if (!data) {
    return { apy24h: null, apy30d: null };
  }

  const rawApy = data.apyAutoCompounds || [];

  const apyHistory = rawApy
    .map((r) => ({
      apy: parseFloat(r.apy),
      timestamp: parseInt(r.timestamp, 10),
    }))
    .filter((p) => p.apy >= 0 && p.apy <= 100 && isFinite(p.apy));

  const now = nowSeconds();
  const oneDayAgo = now - 24 * 60 * 60;

  const recentApy = apyHistory.filter((p) => p.timestamp >= oneDayAgo && p.apy >= 0);
  const apy24h =
    recentApy.length > 0
      ? recentApy.reduce((sum, p) => sum + p.apy, 0) / recentApy.length
      : apyHistory.find((p) => p.apy >= 0)?.apy ?? null;

  const validApy = apyHistory.filter((p) => p.apy >= 0);
  const apy30d =
    validApy.length > 0
      ? validApy.reduce((sum, p) => sum + p.apy, 0) / validApy.length
      : null;

  return { apy24h, apy30d };
}

// ─── Full history (for detail pages) ─────────────────────────────────────────

function deduplicateByDay(points) {
  const byDay = new Map();
  for (const p of points) {
    const day = new Date(p.timestamp * 1000).toISOString().slice(0, 10);
    byDay.set(day, p);
  }
  return Array.from(byDay.values()).sort((a, b) => a.timestamp - b.timestamp);
}

// Autopilot vaults are indexed under separate plasma* entities. The
// schema (per the indexer team) exposes `plasmaVaultHistories` with
// tvl + sharePrice per timestamp; there is no dedicated APY entity,
// so we derive APY from the share-price growth between consecutive
// daily samples - same formula the protocol uses on /[slug] for
// vaults that lack an upstream APY feed.
//
// Schema guesses: where uses { vault: "0xaddr" }, lowercase. If the
// indexer turns out to expect `plasmaVault` instead, the GraphQL
// error gets logged and we return empty so the chart degrades to
// the snapshotSeries fallback rather than blowing up the build.
async function fetchPlasmaVaultHistory(chainId, addr) {
  const empty = { tvlHistory: [], sharePriceHistory: [], apyHistory: [] };

  const query = `{
    plasmaVaultHistories(
      where: { vault: "${addr}" }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      timestamp
      tvl
      sharePrice
    }
  }`;

  const data = await queryGraphQL(chainId, query);
  if (!data) return empty;

  const raw = (data.plasmaVaultHistories || []).map((r) => ({
    timestamp: parseInt(r.timestamp, 10),
    tvl: parseFloat(r.tvl),
    sharePrice: parseFloat(r.sharePrice),
  }));

  log(`[plasma] vault=${addr} chain=${chainId} records=${raw.length}`);

  if (raw.length === 0) return empty;

  // One sample per day (last wins) so the chart density matches the
  // standard query's output.
  const byDay = new Map();
  for (const p of raw) {
    const day = new Date(p.timestamp * 1000).toISOString().slice(0, 10);
    byDay.set(day, p);
  }
  const daily = [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);

  const tvlHistory = daily
    .filter((p) => Number.isFinite(p.tvl) && p.tvl >= 0)
    .map((p) => ({ value: p.tvl, timestamp: p.timestamp }));

  // Normalize share price so the chart starts at 1.0 (same convention
  // as the standard fetcher).
  let sharePriceHistory = [];
  const sharePriceDaily = daily.filter(
    (p) => Number.isFinite(p.sharePrice) && p.sharePrice > 0,
  );
  if (sharePriceDaily.length > 0) {
    const base = sharePriceDaily[0].sharePrice;
    sharePriceHistory = sharePriceDaily.map((p) => ({
      sharePrice: p.sharePrice / base,
      timestamp: p.timestamp,
    }));
  }

  // Derive APY from share-price growth between consecutive daily
  // samples. Cap at 100% (anything higher is almost always a
  // deposit/migration spike, not real yield).
  const apyHistory = [];
  for (let i = 1; i < sharePriceDaily.length; i++) {
    const prev = sharePriceDaily[i - 1];
    const cur = sharePriceDaily[i];
    const daysDelta = Math.max(
      0.5,
      (cur.timestamp - prev.timestamp) / 86400,
    );
    const periodReturn = cur.sharePrice / prev.sharePrice - 1;
    if (!Number.isFinite(periodReturn)) continue;
    const apy = ((1 + periodReturn) ** (365 / daysDelta) - 1) * 100;
    if (Number.isFinite(apy) && apy >= 0 && apy <= 100) {
      apyHistory.push({ apy, timestamp: cur.timestamp });
    }
  }

  return { tvlHistory, sharePriceHistory, apyHistory };
}

async function fetchFullVaultHistory(vaultAddress, chainKey, vaultType) {
  const empty = { tvlHistory: [], sharePriceHistory: [], apyHistory: [] };

  const chainId = CHAIN_IDS[chainKey];
  if (!chainId) {
    log(`[history-full] SKIP: no chainId for chainKey="${chainKey}"`);
    return empty;
  }

  const addr = vaultAddress.toLowerCase();
  log(`[history-full] FETCHING vault=${addr} chainKey=${chainKey} chainId=${chainId} type=${vaultType ?? "?"}`);

  // Autopilot vaults live under separate plasma* entities in the
  // subgraph; the standard tvls/vaultHistories/apyAutoCompounds
  // collections return zero for them. Route them directly to the
  // plasma query so the chart isn't empty for those products.
  if (vaultType === "Autopilot") {
    const plasma = await fetchPlasmaVaultHistory(chainId, addr);
    if (plasma.tvlHistory.length > 0 || plasma.sharePriceHistory.length > 0) {
      return plasma;
    }
    log(`[history-full] plasma returned empty for ${addr}, falling through to standard query`);
  }

  const query = `{
    tvls(
      where: { vault: "${addr}" }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
    ) {
      value
      timestamp
    }
    vaultHistories(
      where: { vault: "${addr}" }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
    ) {
      sharePrice
      timestamp
    }
    apyAutoCompounds(
      where: { vault: "${addr}" }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
    ) {
      apy
      timestamp
    }
  }`;

  const data = await queryGraphQL(chainId, query);
  if (!data) return empty;

  const rawTvl = data.tvls || [];
  const rawSharePrice = data.vaultHistories || [];
  const rawApy = data.apyAutoCompounds || [];

  log(
    `[history-full] vault=${addr} chain=${chainKey} tvl=${rawTvl.length} sharePrice=${rawSharePrice.length} apy=${rawApy.length}`
  );

  const tvlHistory = deduplicateByDay(
    rawTvl.map((r) => ({
      value: parseFloat(r.value),
      timestamp: parseInt(r.timestamp, 10),
    }))
  );

  const rawSharePriceParsed = deduplicateByDay(
    rawSharePrice.map((r) => ({
      sharePrice: parseFloat(r.sharePrice),
      timestamp: parseInt(r.timestamp, 10),
    }))
  );

  // Normalize: divide all values by the first value so chart starts at 1.0
  let sharePriceHistory = [];
  if (rawSharePriceParsed.length > 0) {
    const base = rawSharePriceParsed[0].sharePrice;
    if (base > 0) {
      sharePriceHistory = rawSharePriceParsed.map((p) => ({
        sharePrice: p.sharePrice / base,
        timestamp: p.timestamp,
      }));
    }
  }

  // Filter negative APY values
  const apyHistory = deduplicateByDay(
    rawApy
      .map((r) => ({
        apy: parseFloat(r.apy),
        timestamp: parseInt(r.timestamp, 10),
      }))
      .filter((p) => p.apy >= 0 && p.apy <= 100 && isFinite(p.apy))
  );

  return { tvlHistory, sharePriceHistory, apyHistory };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log("=== Harvest Data Fetch ===");
  log(`Time: ${new Date().toISOString()}`);

  // 1. Fetch vaults
  let vaults;
  try {
    const result = await fetchHarvestVaults();
    vaults = result.vaults;
    var slugMap = result.slugMap;
  } catch (err) {
    log(`[FATAL] Failed to fetch vaults: ${err}`);
    log("Keeping existing data files unchanged.");
    process.exit(1);
  }

  if (vaults.length === 0) {
    log("[WARN] No vaults returned. Keeping existing data files unchanged.");
    process.exit(1);
  }

  // 2. Fetch full history for each vault (sequential, 100ms delay)
  log(`\n=== Fetching full history for ${vaults.length} vaults ===`);
  const historyMap = {};
  const emptyHistory = { tvlHistory: [], sharePriceHistory: [], apyHistory: [] };
  let consecutiveFails = 0;

  for (let i = 0; i < vaults.length; i++) {
    const v = vaults[i];
    const chainKey = CHAIN_NAME_TO_KEY[v.chain];
    if (!chainKey || !v.contractAddress) {
      historyMap[v.contractAddress] = emptyHistory;
      continue;
    }

    log(`[${i + 1}/${vaults.length}] ${v.productName} (${v.chain})`);

    try {
      const history = await fetchFullVaultHistory(
        v.contractAddress,
        chainKey,
        v.vaultType,
      );
      const hasData =
        history.tvlHistory.length > 0 || history.apyHistory.length > 0;
      historyMap[v.contractAddress] = history;
      if (hasData) {
        consecutiveFails = 0;
      } else {
        consecutiveFails++;
      }
    } catch (err) {
      log(`[ERROR] Failed to fetch history for ${v.contractAddress}: ${err}`);
      historyMap[v.contractAddress] = emptyHistory;
      consecutiveFails++;
    }

    if (consecutiveFails >= 5) {
      log(
        `[WARN] API appears down (5 consecutive fails). Skipping remaining ${vaults.length - i - 1} vaults.`
      );
      for (let j = i + 1; j < vaults.length; j++) {
        historyMap[vaults[j].contractAddress] = emptyHistory;
      }
      break;
    }

    // Rate limit: 100ms between requests
    if (i < vaults.length - 1) {
      await sleep(100);
    }
  }

  // 3. Write data files
  mkdirSync(join(ROOT, "data"), { recursive: true });
  let withData = 0;
  for (const h of Object.values(historyMap)) {
    if (h.tvlHistory.length > 0 || h.apyHistory.length > 0) withData++;
  }
  log(`\n=== Results ===`);
  log(`Vaults: ${vaults.length}`);
  log(`Vaults with history data: ${withData}/${Object.keys(historyMap).length}`);

  writeFileSync(VAULTS_FILE, JSON.stringify(vaults, null, 2));
  log(`Wrote ${VAULTS_FILE}`);

  writeFileSync(HISTORY_FILE, JSON.stringify(historyMap, null, 2));
  log(`Wrote ${HISTORY_FILE}`);

  saveSlugMap(slugMap);
  log(`Wrote ${SLUGS_FILE} (${Object.keys(slugMap).length} slugs persisted)`);

  log("\nDone!");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
