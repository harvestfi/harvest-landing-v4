// Row selection for the ranking pages, shared by each HTML page and its
// Markdown version so the two can never rank differently. Each function is
// the filter and order its page applied inline before; HubTable's default
// sort (24h APY, descending, stable) leaves that order unchanged.

import type { YieldVault } from "./types";
import { platformVaults, type Platform } from "./platforms";

export const byApy24hDesc = (a: YieldVault, b: YieldVault) => b.apy24h - a.apy24h;

/** Home ranking: every live vault. */
export function homeRows(live: YieldVault[]): YieldVault[] {
  return [...live].sort(byApy24hDesc);
}

/** /eth, /btc, /usdt. /usdc builds its rows with buildUsdcCohort. */
export function assetHubRows(live: YieldVault[], asset: string): YieldVault[] {
  return live.filter((v) => v.asset === asset).sort(byApy24hDesc);
}

/** Network hubs, and the Harvest rows on /polygon. */
export function networkHubRows(live: YieldVault[], chain: string): YieldVault[] {
  return live.filter((v) => v.chain === chain).sort(byApy24hDesc);
}

/** /aave, /morpho. */
export function platformHubRows(live: YieldVault[], platform: Platform): YieldVault[] {
  return platformVaults(live, platform).sort(byApy24hDesc);
}
