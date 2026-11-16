// One version of the facts. Every surface that states a count, an APY or a
// date reads it from here: the HTML pages through getLiveVaults, and the
// post-export scripts (data JSON, llms.txt) through /facts.json, which the
// build emits from this same function, so the JSON files, llms.txt and the
// pages always agree.
//
// dataAsOf is the newest indexed reading, never the build time, so the
// sitemap's lastmod moves only when the data does.
import { getLiveVaults, getVaults, getVaultHistory, isVaultPageIndexable } from "@/lib/data";
import { getCanonicalSlugs } from "@/lib/canonical-vaults";
import { freshness } from "@/lib/freshness";
import { NETWORKS } from "@/lib/networks";

export interface VaultFact {
  slug: string;
  asset: string;
  chain: string;
  /** In the live set the rankings, hubs and footer count. */
  live: boolean;
  /** Listed in the sitemap (same gate as the page's robots tag). */
  indexable: boolean;
  apy24h: number;
  /** The 30-day figure the page shows (derived from history, see data.ts). */
  apy30d: number;
  tvl: number;
  /** ISO time of the vault's newest indexed reading, or null without history. */
  dataAsOf: string | null;
}

export interface SiteFacts {
  /** Newest reading across the live set. */
  dataAsOf: string | null;
  /** Live strategies: the number the footer, llms.txt and index.json state. */
  strategies: number;
  /** Networks with at least one live strategy. */
  networks: string[];
  byAsset: Record<string, { strategies: number; dataAsOf: string | null }>;
  byChain: Record<string, { strategies: number; dataAsOf: string | null }>;
  vaults: VaultFact[];
}

let _facts: Promise<SiteFacts> | null = null;

const iso = (ts: number) => (ts > 0 ? new Date(ts * 1000).toISOString() : null);
const newest = (xs: (string | null)[]) =>
  xs.reduce<string | null>((m, x) => (x && (!m || x > m) ? x : m), null);

async function build(): Promise<SiteFacts> {
  const [all, live, canonical] = await Promise.all([getVaults(), getLiveVaults(), getCanonicalSlugs()]);
  const liveSet = new Set(live.map((v) => v.slug));
  // Live vaults carry the derived figures the pages print; the rest keep
  // the listing values (their pages show those).
  const bySlug = new Map(all.map((v) => [v.slug, v]));
  for (const v of live) bySlug.set(v.slug, v);

  const vaults: VaultFact[] = [];
  for (const v of bySlug.values()) {
    if (!v.slug) continue;
    const h = await getVaultHistory(v.contractAddress);
    vaults.push({
      slug: v.slug,
      asset: v.asset,
      chain: v.chain,
      live: liveSet.has(v.slug),
      indexable: isVaultPageIndexable(v, canonical.has(v.slug)),
      apy24h: v.apy24h,
      apy30d: v.apy30d,
      tvl: v.tvl,
      dataAsOf: iso(freshness(h).freshestTs),
    });
  }

  const liveFacts = vaults.filter((v) => v.live);
  const group = (key: "asset" | "chain") => {
    const out: Record<string, { strategies: number; dataAsOf: string | null }> = {};
    for (const v of liveFacts) {
      const g = (out[v[key]] ??= { strategies: 0, dataAsOf: null });
      g.strategies++;
      g.dataAsOf = newest([g.dataAsOf, v.dataAsOf]);
    }
    return out;
  };
  const byChain = group("chain");

  return {
    dataAsOf: newest(liveFacts.map((v) => v.dataAsOf)),
    strategies: liveFacts.length,
    networks: NETWORKS.filter((n) => byChain[n.chain]?.strategies).map((n) => n.display),
    byAsset: group("asset"),
    byChain,
    vaults,
  };
}

export function getSiteFacts(): Promise<SiteFacts> {
  return (_facts ??= build());
}
