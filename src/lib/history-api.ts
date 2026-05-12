import { writeFileSync } from "fs";

const BASE_URL = "https://clownfish-app-2dsdk.ondigitalocean.app";

const CHAIN_IDS: Record<string, string> = {
  eth: "1",
  matic: "137",
  arbitrum: "42161",
  base: "8453",
  zksync: "324",
};

function log(msg: string) {
  try {
    writeFileSync("/dev/stderr", msg + "\n");
  } catch {
    console.log(msg);
  }
}

async function queryGraphQL(
  chainId: string,
  query: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${BASE_URL}/${chainId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      // Read body so we surface the schema error ("Cannot query
      // field X on type Y") rather than just the status code.
      let body = "";
      try {
        body = (await res.text()).slice(0, 400).replace(/\s+/g, " ");
      } catch {
        body = "(body unreadable)";
      }
      log(`[history] chain=${chainId} failed: ${res.status} body=${body}`);
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

export interface ApyHistoryPoint {
  apy: number;
  timestamp: number;
}

export interface TvlHistoryPoint {
  value: number;
  timestamp: number;
}

export interface VaultHistoryData {
  apyHistory: ApyHistoryPoint[];
  tvlHistory: TvlHistoryPoint[];
  apy24h: number | null;
  apy30d: number | null;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function fetchVaultHistory(
  vaultAddress: string,
  chainKey: string,
): Promise<VaultHistoryData> {
  const chainId = CHAIN_IDS[chainKey];
  if (!chainId) {
    return { apyHistory: [], tvlHistory: [], apy24h: null, apy30d: null };
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
    tvls(
      where: { vault: "${addr}", timestamp_gte: "${thirtyDaysAgo}" }
      orderBy: timestamp
      orderDirection: desc
      first: 500
    ) {
      value
      timestamp
    }
  }`;

  const data = await queryGraphQL(chainId, query);
  if (!data) {
    return { apyHistory: [], tvlHistory: [], apy24h: null, apy30d: null };
  }

  const rawApy = data.apyAutoCompounds as { apy: string; timestamp: string }[] | undefined;
  const rawTvl = data.tvls as { value: string; timestamp: string }[] | undefined;

  log(`[history] vault=${addr} chain=${chainKey} apyRecords=${rawApy?.length ?? 0} tvlRecords=${rawTvl?.length ?? 0}`);

  const apyHistory: ApyHistoryPoint[] = (rawApy ?? [])
    .map((r) => ({
      apy: parseFloat(r.apy),
      timestamp: parseInt(r.timestamp, 10),
    }))
    .filter((p) => p.apy >= 0 && p.apy <= 100 && isFinite(p.apy));

  const tvlHistory: TvlHistoryPoint[] = (rawTvl ?? []).map((r) => ({
    value: parseFloat(r.value),
    timestamp: parseInt(r.timestamp, 10),
  }));

  const now = nowSeconds();
  const oneDayAgo = now - 24 * 60 * 60;

  // 24h APY: average of APY records from last 24 hours
  const recentApy = apyHistory.filter((p) => p.timestamp >= oneDayAgo && p.apy >= 0);
  const apy24h =
    recentApy.length > 0
      ? recentApy.reduce((sum, p) => sum + p.apy, 0) / recentApy.length
      : apyHistory.find((p) => p.apy >= 0)?.apy ?? null;

  // 30d APY: average of all APY records (already filtered to 30d window)
  const validApy = apyHistory.filter((p) => p.apy >= 0);
  const apy30d =
    validApy.length > 0
      ? validApy.reduce((sum, p) => sum + p.apy, 0) / validApy.length
      : null;

  if (apy24h !== null || apy30d !== null) {
    log(`[history] vault=${addr} apy24h=${apy24h?.toFixed(2)} apy30d=${apy30d?.toFixed(2)}`);
  }

  return { apyHistory, tvlHistory, apy24h, apy30d };
}

/**
 * Reverse mapping from chain display name (e.g. "Base") to chain key (e.g. "base").
 */
const CHAIN_NAME_TO_KEY: Record<string, string> = {
  Ethereum: "eth",
  Polygon: "matic",
  Arbitrum: "arbitrum",
  Base: "base",
  zkSync: "zksync",
  HyperEVM: "hyperevm",
};

export function chainNameToKey(chainDisplayName: string): string | null {
  return CHAIN_NAME_TO_KEY[chainDisplayName] ?? null;
}

export interface SharePriceHistoryPoint {
  sharePrice: number;
  timestamp: number;
}

export interface FullVaultHistory {
  tvlHistory: TvlHistoryPoint[];
  sharePriceHistory: SharePriceHistoryPoint[];
  apyHistory: ApyHistoryPoint[];
}

/**
 * Deduplicate data points to one per day, keeping the last value for each day.
 */
function deduplicateByDay<T extends { timestamp: number }>(points: T[]): T[] {
  const byDay = new Map<string, T>();
  for (const p of points) {
    const day = new Date(p.timestamp * 1000).toISOString().slice(0, 10);
    byDay.set(day, p);
  }
  return Array.from(byDay.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Plasma history fetch for Autopilot vaults. Autopilots live under
 * separate plasma* entities in the subgraph and return zero results
 * from the standard tvls/vaultHistories/apyAutoCompounds query, so
 * we route them through plasmaVaultHistories. The where clause uses
 * The Graph's nested-relationship syntax (plasmaVault_: { id }) to
 * filter on the referenced PlasmaVault entity's id.
 */
async function fetchPlasmaVaultHistory(
  chainId: string,
  addr: string,
): Promise<FullVaultHistory> {
  const empty: FullVaultHistory = {
    tvlHistory: [],
    sharePriceHistory: [],
    apyHistory: [],
  };
  const query = `{
    plasmaVaultHistories(
      where: { plasmaVault_: { id: "${addr}" } }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      timestamp
      tvl
      sharePrice
      apy
    }
  }`;
  const data = await queryGraphQL(chainId, query);
  if (!data) return empty;

  const raw = ((data.plasmaVaultHistories as { timestamp: string; tvl: string; sharePrice: string; apy: string }[]) || []).map(
    (r) => ({
      timestamp: parseInt(r.timestamp, 10),
      tvl: parseFloat(r.tvl),
      sharePrice: parseFloat(r.sharePrice),
      apy: parseFloat(r.apy),
    }),
  );
  log(`[plasma] vault=${addr} chain=${chainId} records=${raw.length}`);
  if (raw.length === 0) return empty;

  const byDay = new Map<string, typeof raw[number]>();
  for (const p of raw) {
    const day = new Date(p.timestamp * 1000).toISOString().slice(0, 10);
    byDay.set(day, p);
  }
  const daily = [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);

  const tvlHistory: TvlHistoryPoint[] = daily
    .filter((p) => Number.isFinite(p.tvl) && p.tvl >= 0)
    .map((p) => ({ value: p.tvl, timestamp: p.timestamp }));

  let sharePriceHistory: SharePriceHistoryPoint[] = [];
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

  // APY comes straight from the subgraph (already a percent, e.g.
  // 7.59 for 7.59%) - no derivation needed. Filter [0, 100] to drop
  // the rare spike on a freshly deployed or migrated vault.
  const apyHistory: ApyHistoryPoint[] = daily
    .filter((p) => Number.isFinite(p.apy) && p.apy >= 0 && p.apy <= 100)
    .map((p) => ({ apy: p.apy, timestamp: p.timestamp }));

  return { tvlHistory, sharePriceHistory, apyHistory };
}

/**
 * Fetch full vault history (up to 1000 records each) for TVL, share price, and APY.
 * Returns one data point per day (last value of each day).
 */
export async function fetchFullVaultHistory(
  vaultAddress: string,
  chainKey: string,
  vaultType?: string,
): Promise<FullVaultHistory> {
  const empty: FullVaultHistory = {
    tvlHistory: [],
    sharePriceHistory: [],
    apyHistory: [],
  };

  const chainId = CHAIN_IDS[chainKey];
  if (!chainId) {
    log(`[history-full] SKIP: no chainId for chainKey="${chainKey}"`);
    return empty;
  }

  const addr = vaultAddress.toLowerCase();
  log(`[history-full] FETCHING vault=${addr} chainKey=${chainKey} chainId=${chainId} type=${vaultType ?? "?"}`);

  if (vaultType === "Autopilot") {
    const plasma = await fetchPlasmaVaultHistory(chainId, addr);
    if (plasma.tvlHistory.length > 0 || plasma.sharePriceHistory.length > 0) {
      return plasma;
    }
    log(`[history-full] plasma empty for ${addr}, falling through to standard query`);
  }

  const query = `{
    tvls(
      where: { vault: "${addr}" }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      value
      timestamp
    }
    vaultHistories(
      where: { vault: "${addr}" }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      sharePrice
      timestamp
    }
    apyAutoCompounds(
      where: { vault: "${addr}" }
      orderBy: timestamp
      orderDirection: asc
      first: 1000
    ) {
      apy
      timestamp
    }
  }`;

  const data = await queryGraphQL(chainId, query);
  if (!data) return empty;

  const rawTvl = data.tvls as { value: string; timestamp: string }[] | undefined;
  const rawSharePrice = data.vaultHistories as { sharePrice: string; timestamp: string }[] | undefined;
  const rawApy = data.apyAutoCompounds as { apy: string; timestamp: string }[] | undefined;

  log(
    `[history-full] vault=${addr} chain=${chainKey} tvl=${rawTvl?.length ?? 0} sharePrice=${rawSharePrice?.length ?? 0} apy=${rawApy?.length ?? 0}`,
  );

  const tvlHistory = deduplicateByDay(
    (rawTvl ?? []).map((r) => ({
      value: parseFloat(r.value),
      timestamp: parseInt(r.timestamp, 10),
    })),
  );

  const rawSharePriceParsed = deduplicateByDay(
    (rawSharePrice ?? []).map((r) => ({
      sharePrice: parseFloat(r.sharePrice),
      timestamp: parseInt(r.timestamp, 10),
    })),
  );

  // Normalize: divide all values by the first value so chart starts at 1.0
  let sharePriceHistory: { sharePrice: number; timestamp: number }[] = [];
  if (rawSharePriceParsed.length > 0) {
    const base = rawSharePriceParsed[0].sharePrice;
    if (base > 0) {
      sharePriceHistory = rawSharePriceParsed.map((p) => ({
        sharePrice: p.sharePrice / base,
        timestamp: p.timestamp,
      }));
    }
  }

  const MAX_REASONABLE_APY = 100;
  const apyHistory = deduplicateByDay(
    (rawApy ?? [])
      .map((r) => ({
        apy: parseFloat(r.apy),
        timestamp: parseInt(r.timestamp, 10),
      }))
      .filter((p) => p.apy >= 0 && p.apy <= MAX_REASONABLE_APY && isFinite(p.apy)),
  );

  return { tvlHistory, sharePriceHistory, apyHistory };
}
