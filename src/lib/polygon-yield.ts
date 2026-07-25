// Build-time reader for the /polygon mixed ranking. Mirrors the
// readFileSync-at-build pattern in src/lib/data.ts. The venues themselves
// (which ones exist, their display copy, their source config) live in
// data/polygon-venues.json; their live rate/TVL is hydrated on top by
// scripts/fetch-polygon-yield.mjs into data/polygon-yield.json. If the
// pipeline hasn't run yet (fresh checkout), we fall back to the registry
// with every row marked rateNa so the page still builds.

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const VENUES_FILE = join(process.cwd(), "data", "polygon-venues.json");
const YIELD_FILE = join(process.cwd(), "data", "polygon-yield.json");

export interface PolygonVenue {
  id: string;
  venueSlug: string;
  chain: string;
  asset: string;
  assetGroup: string;
  detail: string | null;
  symbol: string;
  platform: string;
  platformUrl: string;
  entity: string | null;
  category: string | null;
  productType: string | null;
  operator: "external";
  exposure: "single" | "multi";
  accessNote: string | null;
  editorialNote: string | null;
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  rateNa: boolean;
  rateBasis: string;
  source?: string;
  history?: { d: string; apy: number; tvl: number }[];
}

function fallbackFromRegistry(): PolygonVenue[] {
  const doc = JSON.parse(readFileSync(VENUES_FILE, "utf-8"));
  return (doc.venues ?? []).map((v: Record<string, unknown>) => ({
    id: v.slug,
    venueSlug: v.slug,
    chain: v.chain,
    asset: v.asset,
    assetGroup: v.assetGroup,
    detail: v.detail ?? null,
    symbol: v.symbol,
    platform: v.platform,
    platformUrl: v.url,
    entity: v.entity ?? null,
    category: v.productType ?? null,
    productType: v.productType ?? null,
    operator: "external",
    exposure: v.exposure ?? "single",
    accessNote: v.accessNote ?? null,
    editorialNote: v.editorialNote ?? null,
    tvlUsd: 0,
    apy: null,
    apyBase: null,
    rateNa: true,
    rateBasis: "na",
  }));
}

export function getPolygonVenues(): PolygonVenue[] {
  if (!existsSync(YIELD_FILE)) return fallbackFromRegistry();
  try {
    const doc = JSON.parse(readFileSync(YIELD_FILE, "utf-8"));
    const rows = doc.venues;
    return Array.isArray(rows) && rows.length ? rows : fallbackFromRegistry();
  } catch {
    return fallbackFromRegistry();
  }
}

export function getPolygonVenueCount(): number {
  try {
    const doc = JSON.parse(readFileSync(VENUES_FILE, "utf-8"));
    return Array.isArray(doc.venues) ? doc.venues.length : 0;
  } catch {
    return 0;
  }
}

export interface PolygonAssetGroup {
  assetGroup: string;
  venues: PolygonVenue[];
  bestApy: number;
  totalTvlUsd: number;
}

// Groups ordered by best (max) APY across the group's rated rows, so the
// section order itself reflects "where the best rate lives," matching the
// ranking's own sort logic rather than an arbitrary asset list order.
export function groupPolygonVenuesByAsset(venues: PolygonVenue[]): PolygonAssetGroup[] {
  const byGroup = new Map<string, PolygonVenue[]>();
  for (const v of venues) {
    const list = byGroup.get(v.assetGroup) ?? [];
    list.push(v);
    byGroup.set(v.assetGroup, list);
  }
  const groups: PolygonAssetGroup[] = [...byGroup.entries()].map(([assetGroup, rows]) => {
    const sorted = [...rows].sort((a, b) => (b.apy ?? -Infinity) - (a.apy ?? -Infinity));
    return {
      assetGroup,
      venues: sorted,
      bestApy: sorted.reduce((m, v) => (v.apy != null && v.apy > m ? v.apy : m), 0),
      totalTvlUsd: sorted.reduce((s, v) => s + (v.tvlUsd || 0), 0),
    };
  });
  return groups.sort((a, b) => b.bestApy - a.bestApy);
}
