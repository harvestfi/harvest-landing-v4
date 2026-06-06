import { YieldVault } from "./types";
import { fetchHarvestVaults } from "./harvest-api";
import {
  fetchFullVaultHistory,
  chainNameToKey,
  type FullVaultHistory,
  type ApyHistoryPoint,
} from "./history-api";
import { sanitizeTvlSeries } from "./contextualize";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const VAULTS_FILE = join(process.cwd(), "data", "vaults.json");
const HISTORY_FILE = join(process.cwd(), "data", "history.json");
const HOLDERS_FILE = join(process.cwd(), "data", "holders.json");
const HIDDEN_FILE = join(process.cwd(), "data", "hidden.json");

// Operator hide-list. Slugs the admin Hide panel has marked as hidden;
// synced from the Supabase `hidden_products` table into data/hidden.json
// by the hourly cron (scripts/fetch-data.mjs). A hidden product is
// removed from every ranking surface (homepage, /asset, /network, and
// the cohort comparisons on other product pages) but keeps its own page
// indexable - this is a ranking opt-out, NOT a noindex. Mirrors the
// getStaleAddresses() exclusion-set pattern below.
let _hiddenSetCache: Set<string> | null = null;

export function getHiddenSlugs(): Set<string> {
  if (_hiddenSetCache) return _hiddenSetCache;
  const set = new Set<string>();
  try {
    if (existsSync(HIDDEN_FILE)) {
      const raw = JSON.parse(readFileSync(HIDDEN_FILE, "utf-8"));
      if (Array.isArray(raw)) {
        for (const s of raw) {
          if (typeof s === "string" && s.trim()) set.add(s.trim().toLowerCase());
        }
      }
    }
  } catch {
    // missing / malformed file = nothing hidden; never break the build.
  }
  _hiddenSetCache = set;
  return set;
}

export function isHiddenProduct(v: YieldVault): boolean {
  return getHiddenSlugs().has(v.slug.toLowerCase());
}

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
    const parsed = JSON.parse(raw) as Record<string, FullVaultHistory>;
    // Strip transient indexer glitches from TVL once, at load, so every
    // consumer (product grid, chart, narrative, JSON-LD, sparklines)
    // reads the same clean series rather than each re-deriving guards.
    for (const entry of Object.values(parsed)) {
      if (entry?.tvlHistory) {
        entry.tvlHistory = sanitizeTvlSeries(entry.tvlHistory);
      }
    }
    return parsed;
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

  // Reconcile TVL with cached daily history (see below). APY is taken
  // straight from the listing API (vaults.json), which is the same
  // source app.harvest.finance reads, so the headline 24h/30d numbers
  // match the app. We previously overrode APY with a value derived from
  // the cached apyHistory tail to match the chart, but for Autopilot /
  // plasma vaults that history series swings day-to-day and diverges
  // from the API (e.g. API 4.46% vs history tail 1.2%), which made the
  // product page disagree with the app. History now drives the chart
  // only; the API drives the headline. Fallback: if the API hands us no
  // usable APY (0 / missing), derive from history so the field isn't
  // blank.
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
          // apy24h stays the listing spot value (the app's Live APY);
          // only fall back to the history-latest when the feed gives
          // nothing usable.
          if (!(v.apy24h > 0)) next.apy24h = derived.apy24h;
          // apy30d ALWAYS comes from the realized trailing-30d mean of
          // the same history the page's Strategy stability / Performance
          // Overview use. The listing feed has no real 30d figure for
          // Autopilot vaults and falls back to the spot value, which
          // then disagreed with the page (sidebar "30d avg APY" 8.76%
          // vs the page's own 30-day mean 9.46%). Single source now.
          next.apy30d = derived.apy30d;
        }
      }
      // TVL comes straight from the listing API (vault.tvl =
      // totalValueLocked), the same source app.harvest.finance shows.
      // We used to override it with the latest tvlHistory point (from the
      // subgraph) to match the on-page chart, but that diverged from the
      // app (e.g. listing $1.32M vs subgraph tail $1.29M) - the same
      // spot-vs-history split we removed for APY. The app is the source
      // of truth, so the listing value drives the headline / sidebar /
      // ranking; the history series feeds only the chart (whose trailing
      // bar is already pinned to vault.tvl). Fall back to the latest
      // history point only when the listing API gives no usable TVL.
      if (!(v.tvl > 0)) {
        const latestTvl = latestTvlPoint(h.tvlHistory);
        if (latestTvl !== null) next.tvl = latestTvl;
      }
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
  // Filter apy >= 0 so the 30-day mean matches the Strategy stability
  // card and Performance Overview, which both drop negative readings.
  const valid = history.filter((p) => Number.isFinite(p.apy) && p.apy >= 0);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => b.timestamp - a.timestamp);
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

// A vault with effectively zero TVL is dead: no real capital, so rank
// superlatives ("ranks #1, top quarter") and per-deposit earnings
// projections on it are misleading (you cannot meaningfully deposit).
// Prose generators suppress those claims when this is true; the headline
// APY/TVL numbers still render. Threshold is a dollar or less, which
// covers $0 / $1 dust balances without touching small-but-real pools.
export function isDeadVault(v: YieldVault): boolean {
  return !(v.tvl > 1);
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
  HIDE_LP_PAIR,
  isAerodromeName,
} from "./admin-rules";
import { isLpPairVault } from "./lp-pair";

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

// Catches every vault that would render the [LP] badge in rankings -
// Aerodrome pairs, Stake DAO OnlyBoost, Quickswap, Baseswap, Uniswap V3,
// any future LP-pair platform. Single rule, zero per-name maintenance.
function isHiddenLpPairVault(v: YieldVault): boolean {
  return HIDE_LP_PAIR && isLpPairVault(v);
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

// Per-vault wrapper around isStaleApyHistory that hits the cached
// indexed history. Exported so the slug-page metadata builder and
// the admin Products table can both consult the same staleness
// signal that already drives the public rankings.
export function isStaleApyVault(v: YieldVault): boolean {
  if (!_historyCache) _historyCache = loadHistoryFromFile();
  const h =
    _historyCache?.[v.contractAddress] ??
    _historyCache?.[v.contractAddress.toLowerCase()];
  if (!h) return false;
  return isStaleApyHistory(h.apyHistory);
}

// True when the public surface would render a "—" for either of the
// two KPIs - useful both as a noindex signal (no point burning crawl
// budget on a page whose headline numbers are empty) and as a flag
// in the admin Products view so the operator sees which vaults are
// effectively dead.
export function hasMissingMetrics(v: YieldVault): boolean {
  return !(v.apy24h > 0) || !(v.tvl > 0);
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
      !isAerodromeVault(v) &&
      !isHiddenLpPairVault(v) &&
      !isHiddenProduct(v),
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
