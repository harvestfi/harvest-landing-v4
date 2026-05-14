import { YieldVault } from "./types";
import { fetchHarvestVaults } from "./harvest-api";
import {
  fetchFullVaultHistory,
  chainNameToKey,
  type FullVaultHistory,
  type ApyHistoryPoint,
} from "./history-api";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const VAULTS_FILE = join(process.cwd(), "data", "vaults.json");
const HISTORY_FILE = join(process.cwd(), "data", "history.json");
const HOLDERS_FILE = join(process.cwd(), "data", "holders.json");

const FALLBACK_VAULT: YieldVault = {
  id: "fallback",
  slug: "usdc-autocompounder-ethereum",
  asset: "USDC",
  productName: "USDC Autocompounder",
  protocol: { name: "Harvest Finance", slug: "harvest-finance" },
  vaultType: "Autocompounder",
  apy24h: 0,
  apy30d: 0,
  tvl: 0,
  description:
    "Harvest's USDC Autocompounder automatically compounds lending yields across top DeFi protocols.",
  chain: "Ethereum",
  contractAddress: "",
  riskLevel: "low",
  category: "Yield Optimization",
  launchDate: "",
  apyBreakdown: [],
  boostedApy: null,
};

let _vaultCache: YieldVault[] | null = null;
let _historyCache: Record<string, FullVaultHistory> | null = null;

function loadVaultsFromFile(): YieldVault[] | null {
  try {
    if (!existsSync(VAULTS_FILE)) return null;
    const raw = readFileSync(VAULTS_FILE, "utf-8");
    const vaults = JSON.parse(raw) as YieldVault[];
    return vaults.length > 0 ? vaults : null;
  } catch {
    return null;
  }
}

function loadHistoryFromFile(): Record<string, FullVaultHistory> | null {
  try {
    if (!existsSync(HISTORY_FILE)) return null;
    const raw = readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, FullVaultHistory>;
  } catch {
    return null;
  }
}

// Public alias for callers (like /admin/studio) that need the raw
// keyed history map without going through getVaultHistory's
// per-address lookup.
export function loadHistoryFile(): Record<string, FullVaultHistory> | null {
  if (!_historyCache) _historyCache = loadHistoryFromFile();
  return _historyCache;
}
export type { FullVaultHistory };

export async function getVaults(): Promise<YieldVault[]> {
  if (_vaultCache) return _vaultCache;

  let vaults: YieldVault[];
  const fromFile = loadVaultsFromFile();
  if (fromFile) {
    vaults = fromFile;
  } else {
    const live = await fetchHarvestVaults();
    vaults = live.length > 0 ? live : [FALLBACK_VAULT];
  }

  // Reconcile each vault's headline APY with the cached daily history
  // so the displayed 24h/30d numbers always match the chart on the
  // product page. Upstream sometimes hands us a stale spot value (or
  // falls back to a single shared "current" reading for both fields,
  // which made the broken-vault detector trip on healthy entries).
  if (!_historyCache) _historyCache = loadHistoryFromFile();
  if (_historyCache) {
    const cache = _historyCache;
    vaults = vaults.map((v) => {
      const h = cache[v.contractAddress] ?? cache[v.contractAddress.toLowerCase()];
      if (!h) return v;
      const next = { ...v };
      if (h.apyHistory.length > 0) {
        const derived = deriveApyMetrics(h.apyHistory);
        if (derived) {
          // Sanity check: the upstream indexer derives APY from realized
          // share-price growth, so deposit/withdraw/migration spikes can
          // pollute it for days. If the derived value is > 2.5x the
          // protocol's published apyBreakdown sum, trust the breakdown
          // (what the protocol UI itself shows) instead.
          const breakdownSum = (v.apyBreakdown ?? []).reduce(
            (s, b) => s + (Number.isFinite(b.apy) ? b.apy : 0),
            0,
          );
          const trusted =
            breakdownSum > 0 && derived.apy24h > breakdownSum * 2.5
              ? { apy24h: breakdownSum, apy30d: breakdownSum }
              : derived;
          next.apy24h = trusted.apy24h;
          next.apy30d = trusted.apy30d;
        }
      }
      // Same drift problem on TVL: the upstream value can lag what the
      // chart renders (which reads from cached daily history). Use the
      // latest tvlHistory point if it's recent enough, so hero +
      // ranking always agree with the on-page chart.
      const latestTvl = latestTvlPoint(h.tvlHistory);
      if (latestTvl !== null) next.tvl = latestTvl;
      return next;
    });
  }

  _vaultCache = vaults;
  return _vaultCache;
}

function latestTvlPoint(history: { value: number; timestamp: number }[]): number | null {
  if (!history || history.length === 0) return null;
  let best = history[0];
  for (const p of history) if (p.timestamp > best.timestamp) best = p;
  return Number.isFinite(best.value) && best.value >= 0 ? best.value : null;
}

function deriveApyMetrics(history: ApyHistoryPoint[]): { apy24h: number; apy30d: number } | null {
  if (history.length === 0) return null;
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  const apy24h = latest.apy;
  const cutoff = latest.timestamp - 30 * 86400;
  const recent = sorted.filter((p) => p.timestamp >= cutoff);
  const apy30d =
    recent.length > 0
      ? recent.reduce((s, p) => s + p.apy, 0) / recent.length
      : apy24h;
  return { apy24h, apy30d };
}

export function isLiveVault(v: YieldVault): boolean {
  return v.apy24h > 0 && v.tvl > 0;
}

// Sub-$10k TVL with a flat 30-day APY history is a strong signal the
// vault is broken (paused harvest, oracle stuck, or never bootstrapped).
// We require at least 14 distinct daily observations so brand-new
// vaults aren't false-flagged, then check that every reading inside the
// 30-day window holds the same exact value. The check resolves false
// the moment the APY moves, so a recovered vault returns automatically.
import {
  BROKEN_TVL_THRESHOLD,
  BROKEN_MIN_OBSERVATIONS,
  STALE_APY_DAYS,
  HIDE_AERODROME,
  isAerodromeName,
} from "./admin-rules";

export function isBrokenLowTvlVault(v: YieldVault): boolean {
  if (v.tvl <= 0 || v.tvl >= BROKEN_TVL_THRESHOLD) return false;
  if (!_historyCache) _historyCache = loadHistoryFromFile();
  const h =
    _historyCache?.[v.contractAddress] ??
    _historyCache?.[v.contractAddress.toLowerCase()];
  if (!h || h.apyHistory.length < BROKEN_MIN_OBSERVATIONS) return false;
  const sorted = [...h.apyHistory].sort((a, b) => b.timestamp - a.timestamp);
  const cutoff = sorted[0].timestamp - 30 * 86400;
  const recent = sorted.filter((p) => p.timestamp >= cutoff);
  if (recent.length < BROKEN_MIN_OBSERVATIONS) return false;
  return new Set(recent.map((p) => p.apy)).size === 1;
}

function isAerodromeVault(v: YieldVault): boolean {
  return HIDE_AERODROME && isAerodromeName(v.productName, v.category);
}

function isStaleApyHistory(history: ApyHistoryPoint[]): boolean {
  if (history.length < 2) return false;
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  const cutoff = latest.timestamp - STALE_APY_DAYS * 86400;
  for (const p of sorted) {
    if (p.apy !== latest.apy) {
      return p.timestamp <= cutoff;
    }
  }
  const oldest = sorted[sorted.length - 1];
  return latest.timestamp - oldest.timestamp >= STALE_APY_DAYS * 86400;
}

let _staleSetCache: Set<string> | null = null;

function getStaleAddresses(): Set<string> {
  if (_staleSetCache) return _staleSetCache;
  if (!_historyCache) _historyCache = loadHistoryFromFile();
  const stale = new Set<string>();
  if (_historyCache) {
    for (const [addr, h] of Object.entries(_historyCache)) {
      if (isStaleApyHistory(h.apyHistory)) stale.add(addr.toLowerCase());
    }
  }
  _staleSetCache = stale;
  return stale;
}

export async function getLiveVaults(): Promise<YieldVault[]> {
  const all = await getVaults();
  const stale = getStaleAddresses();
  return all.filter(
    (v) =>
      isLiveVault(v) &&
      !stale.has(v.contractAddress.toLowerCase()) &&
      !isBrokenLowTvlVault(v) &&
      !isAerodromeVault(v),
  );
}

export async function getVaultHistory(contractAddress: string): Promise<FullVaultHistory> {
  const empty: FullVaultHistory = { tvlHistory: [], sharePriceHistory: [], apyHistory: [] };

  // Try file-based cache first
  if (!_historyCache) {
    _historyCache = loadHistoryFromFile();
  }

  if (_historyCache) {
    return _historyCache[contractAddress] ?? empty;
  }

  // Fallback to live API (local dev without data files)
  const vault = (await getVaults()).find((v) => v.contractAddress === contractAddress);
  if (!vault) return empty;

  const chainKey = chainNameToKey(vault.chain);
  if (!chainKey) return empty;

  try {
    return await fetchFullVaultHistory(contractAddress, chainKey, vault.vaultType);
  } catch {
    return empty;
  }
}

export async function getVaultBySlug(
  slug: string,
): Promise<YieldVault | undefined> {
  const vaults = await getVaults();
  return vaults.find((v) => v.slug === slug);
}

export async function getAllSlugs(): Promise<string[]> {
  const vaults = await getVaults();
  return vaults.map((v) => v.slug);
}

export async function getAllSparklines(): Promise<Record<string, number[]>> {
  if (!_historyCache) {
    _historyCache = loadHistoryFromFile();
  }
  if (!_historyCache) return {};

  const result: Record<string, number[]> = {};

  for (const [addr, h] of Object.entries(_historyCache)) {
    // Take the last 30 valid APY entries chronologically (was: filter
    // to `>= 30 days ago` then downsample). Many vaults only have a
    // handful of records within the trailing 30 days, which read as
    // visually flat sparklines; using the most recent 30 entries
    // regardless of date range keeps each row's mini-chart densely
    // populated and the trend more legible.
    const recent = h.apyHistory
      .filter((p) => p.apy >= 0)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-30)
      .map((p) => p.apy);

    if (recent.length >= 2) {
      result[addr] = recent;
    }
  }

  return result;
}

// Holder counts, keyed by lowercased contract address. Sourced from
// scripts/fetch-holders.mjs (Blockscout v2). Missing chains/contracts
// (e.g. HyperEVM) simply don't appear in the map; the page renders the
// row only when a count exists.
let _holdersCache: Record<string, number> | null | undefined;

export async function getHoldersMap(): Promise<Record<string, number>> {
  if (_holdersCache !== undefined) return _holdersCache ?? {};
  try {
    if (!existsSync(HOLDERS_FILE)) {
      _holdersCache = null;
      return {};
    }
    const raw = readFileSync(HOLDERS_FILE, "utf-8");
    _holdersCache = JSON.parse(raw) as Record<string, number>;
    return _holdersCache;
  } catch {
    _holdersCache = null;
    return {};
  }
}

// Lifetime tracked-days per vault, derived from the earliest valid APY
// observation in our hosted indexer. Used for "longest-tracked" footer copy
// and similar credibility surfaces. Cheap because it reuses the in-process
// history cache and runs at build time only.
export async function getTrackedDaysMap(): Promise<Record<string, number>> {
  if (!_historyCache) {
    _historyCache = loadHistoryFromFile();
  }
  if (!_historyCache) return {};

  const result: Record<string, number> = {};
  for (const [addr, h] of Object.entries(_historyCache)) {
    const valid = h.apyHistory.filter((p) => p.apy >= 0);
    if (valid.length === 0) continue;
    const sorted = [...valid].sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0].timestamp;
    const last = sorted[sorted.length - 1].timestamp;
    result[addr] = Math.round((last - first) / 86400);
  }
  return result;
}
