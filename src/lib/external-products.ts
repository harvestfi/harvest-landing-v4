// Build-time reader for /product/[slug]. Unlike src/lib/polygon-yield.ts
// (reads a git-committed JSON snapshot), this reads Supabase directly --
// supabaseSelectAll already only uses global fetch + env vars, so it works
// identically at Next build time (Node) as it does client-side; there is no
// separate "build API" to maintain. See supabase/external_products.sql and
// scripts/sync-external-products.mjs for the write side.
//
// Falls back to the bare registry (data/external-products.json) with every
// row marked rateNa when Supabase isn't configured, e.g. a fresh checkout
// with no NEXT_PUBLIC_SUPABASE_URL set yet -- same resilience the polygon
// venue reader has for its own missing-pipeline-output case.

import { readFileSync } from "fs";
import { join } from "path";
import { supabaseSelectAll } from "@/lib/supabase";

const REGISTRY_FILE = join(process.cwd(), "data", "external-products.json");

// Slugs in data/external-products.json that describe the exact same venue as
// an existing /polygon/[venue] page (same Aave v3 Pool, same asset). Until
// that overlap is deliberately resolved -- migrate /polygon onto this same
// Supabase pipeline, or keep /product to platforms outside any hub -- these
// specific /product pages canonicalize back to /polygon/[venue] and are
// excluded from the sitemap, so the two URLs never compete as duplicate
// content. See src/app/product/[slug]/page.tsx and src/app/sitemap.ts.
export const POLYGON_VENUE_OVERLAP: Record<string, string> = {
  "aave-v3-dai-polygon": "/polygon/aave-v3-dai-polygon",
  "aave-v3-usdce-polygon": "/polygon/aave-v3-usdce-polygon",
  "aave-v3-usdc-polygon": "/polygon/aave-v3-usdc-polygon",
  "aave-v3-usdt-polygon": "/polygon/aave-v3-usdt-polygon",
  "aave-v3-weth-polygon": "/polygon/aave-v3-weth-polygon",
  "aave-v3-wbtc-polygon": "/polygon/aave-v3-wbtc-polygon",
};

export interface ExternalProduct {
  slug: string;
  asset: string;
  assetGroup: string;
  platform: string;
  chain: string;
  productType: string | null;
  productUrl: string;
  vaultTokenAddress: string;
  sourceKind: "onchain" | "portals";
  apy: number | null;
  apyBase: number | null;
  tvlUsd: number;
  rateNa: boolean;
  rateBasis: string | null;
  updatedAt: string | null;
}

interface ExternalProductRow {
  slug: string;
  asset: string;
  platform: string;
  chain: string;
  product_type: string | null;
  product_url: string;
  vault_token_address: string;
  source_kind: "onchain" | "portals";
  apy: number | null;
  apy_base: number | null;
  tvl_usd: number;
  rate_na: boolean;
  rate_basis: string | null;
  updated_at: string | null;
}

interface RegistryProduct {
  slug: string;
  asset: string;
  assetGroup: string;
  platform: string;
  chain: string;
  productType?: string;
  productUrl: string;
  vaultTokenAddress: string;
  source: { kind: "onchain" | "portals" };
}

function assetGroupOf(slug: string): string {
  const doc = JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
  return (
    (doc.products as RegistryProduct[]).find((p) => p.slug === slug)?.assetGroup ?? "Other"
  );
}

function fallbackFromRegistry(): ExternalProduct[] {
  const doc = JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
  return (doc.products as RegistryProduct[]).map((p) => ({
    slug: p.slug,
    asset: p.asset,
    assetGroup: p.assetGroup,
    platform: p.platform,
    chain: p.chain,
    productType: p.productType ?? null,
    productUrl: p.productUrl,
    vaultTokenAddress: p.vaultTokenAddress,
    sourceKind: p.source.kind,
    apy: null,
    apyBase: null,
    tvlUsd: 0,
    rateNa: true,
    rateBasis: "na",
    updatedAt: null,
  }));
}

export async function getExternalProducts(): Promise<ExternalProduct[]> {
  const rows = await supabaseSelectAll<ExternalProductRow>(
    "external_products",
    "select=*&order=apy.desc",
  );
  if (!rows.length) return fallbackFromRegistry();
  return rows.map((r) => ({
    slug: r.slug,
    asset: r.asset,
    assetGroup: assetGroupOf(r.slug),
    platform: r.platform,
    chain: r.chain,
    productType: r.product_type,
    productUrl: r.product_url,
    vaultTokenAddress: r.vault_token_address,
    sourceKind: r.source_kind,
    apy: r.apy,
    apyBase: r.apy_base,
    tvlUsd: r.tvl_usd ?? 0,
    rateNa: r.rate_na,
    rateBasis: r.rate_basis,
    updatedAt: r.updated_at,
  }));
}

export async function getExternalProductBySlug(slug: string): Promise<ExternalProduct | null> {
  const products = await getExternalProducts();
  return products.find((p) => p.slug === slug) ?? null;
}

export interface ExternalProductHistoryPoint {
  d: string;
  apy: number | null;
}

export async function getExternalProductHistory(
  slug: string,
): Promise<ExternalProductHistoryPoint[]> {
  const rows = await supabaseSelectAll<{ d: string; apy: number | null }>(
    "external_product_history",
    `select=d,apy&product_slug=eq.${encodeURIComponent(slug)}&order=d.asc`,
  );
  return rows;
}

export function getExternalProductSlugsFromRegistry(): string[] {
  const doc = JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
  return (doc.products as RegistryProduct[]).map((p) => p.slug);
}
