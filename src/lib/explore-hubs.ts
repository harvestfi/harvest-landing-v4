// The "Explore other assets" and "Explore by network" grids at the foot of
// the asset hubs: every other asset hub and every network hub, each with its
// strategy count and its best rate among strategies above the liquidity floor.
import { getLiveVaults } from "./data";
import { NETWORKS } from "./networks";
import { LOW_LIQUIDITY_TVL_THRESHOLD } from "./admin-rules";
import type { YieldVault } from "./types";

export interface ExploreCard {
  href: string;
  title: string;
  /** Asset ticker or chain name, for the icon. */
  icon: string;
  kind: "asset" | "network";
  count: number;
  /** Best 24h APY above the liquidity floor, null when none clears it. */
  bestFunded: number | null;
}

const ASSETS = [
  { key: "USDC", title: "USDC yield" },
  { key: "USDT", title: "USDT yield" },
  { key: "ETH", title: "ETH yield" },
  { key: "BTC", title: "Bitcoin yield" },
] as const;

const best = (rows: YieldVault[]) => {
  const funded = rows.filter((v) => v.tvl >= LOW_LIQUIDITY_TVL_THRESHOLD);
  return funded.length ? Math.max(...funded.map((v) => v.apy24h)) : null;
};

export async function exploreHubs(currentAsset: string): Promise<{
  assets: ExploreCard[];
  networks: ExploreCard[];
}> {
  const live = await getLiveVaults();
  const assets = ASSETS.filter((a) => a.key !== currentAsset).map((a) => {
    const rows = live.filter((v) => v.asset === a.key);
    return {
      href: `/${a.key.toLowerCase()}`,
      title: a.title,
      icon: a.key,
      kind: "asset" as const,
      count: rows.length,
      bestFunded: best(rows),
    };
  });
  const networks = NETWORKS.map((n) => {
    const rows = live.filter((v) => v.chain === n.chain);
    return {
      href: `/${n.slug}`,
      title: n.display,
      icon: n.chain,
      kind: "network" as const,
      count: rows.length,
      bestFunded: best(rows),
    };
  })
    .filter((n) => n.count >= 3)
    .sort((a, b) => b.count - a.count);
  return { assets, networks };
}
