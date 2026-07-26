#!/usr/bin/env node
// Syncs data/external-products.json (the curated allowlist -- see that file's
// note) into Supabase: public.external_products (latest snapshot, what the
// pages render) and public.external_product_history (one row per UTC day,
// what the pages chart). This is the scaling unlock over the git-committed
// JSON pattern used for /polygon: Postgres, not a hand-rolled capped array in
// a file the whole repo re-clones on every checkout.
//
// Mirrors scripts/index-vault-events.mjs's Supabase access pattern exactly:
// raw fetch to PostgREST, service-role key, on_conflict + Prefer header for
// upserts. Run supabase/external_products.sql once first.
//
// Usage:
//   NODE_USE_ENV_PROXY=1 node scripts/sync-external-products.mjs
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   required
//   PORTALS_API_KEY                            required for Portals-sourced
//                                               rows and for Aave's non-stable
//                                               USD pricing (ETH/BTC/MATIC/EUR)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { portalsTokenPrice } from "./lib/polygon-onchain-adapters.mjs";
import { readExternalProduct } from "./lib/external-product-adapters.mjs";

const ROOT = process.cwd();
const REGISTRY_FILE = join(ROOT, "data", "external-products.json");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORTALS_KEY = process.env.PORTALS_API_KEY || null;

const AAVE_V3_POOL_POLYGON = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";

const PRICE_TOKEN = {
  eth: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
  btc: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
  matic: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  eur: "0xe111178a87a3bff0c8d18decba5798827539ae99",
};

async function supabase(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Supabase ${path}: ${r.status} ${body}`);
  }
  if (opts.method === "POST" || opts.method === "PATCH") {
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }
  return r.json();
}

async function getPrices() {
  const out = { usd: 1 };
  for (const [ref, addr] of Object.entries(PRICE_TOKEN)) {
    out[ref] = await portalsTokenPrice(addr, PORTALS_KEY);
  }
  return out;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[sync-external-products] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const { products } = JSON.parse(readFileSync(REGISTRY_FILE, "utf-8"));
  if (!products?.length) {
    console.log("[sync-external-products] no products in registry.");
    return;
  }

  const needOnchain = products.some((p) => p.source.kind === "onchain");
  const prices = needOnchain ? await getPrices() : { usd: 1 };
  const ctx = { aaveV3Pool: AAVE_V3_POOL_POLYGON, prices, portalsApiKey: PORTALS_KEY };

  const today = new Date().toISOString().slice(0, 10);
  const snapshots = [];
  const historyRows = [];
  let failed = 0;

  for (const p of products) {
    try {
      const r = await readExternalProduct(p, ctx);
      if (!r) {
        console.error(`[sync-external-products] ${p.slug}: no rate available, skipping write`);
        failed++;
        continue;
      }
      snapshots.push({
        slug: p.slug,
        asset: p.asset,
        platform: p.platform,
        chain: p.chain,
        product_type: p.productType ?? null,
        product_url: p.productUrl,
        vault_token_address: p.vaultTokenAddress,
        source_kind: p.source.kind,
        apy: r.apy,
        apy_base: r.apyBase ?? r.apy,
        tvl_usd: r.tvlUsd,
        rate_na: false,
        rate_basis: r.source === "onchain" ? "current" : "current (third-party API)",
        updated_at: new Date().toISOString(),
      });
      historyRows.push({ product_slug: p.slug, d: today, apy: r.apy, tvl_usd: r.tvlUsd });
    } catch (e) {
      console.error(`[sync-external-products] ${p.slug} failed:`, e?.message ?? e);
      failed++;
    }
  }

  if (snapshots.length) {
    await supabase("external_products?on_conflict=slug", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(snapshots),
    });
  }
  if (historyRows.length) {
    await supabase("external_product_history?on_conflict=product_slug,d", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(historyRows),
    });
  }

  console.log(
    `[sync-external-products] synced ${snapshots.length}/${products.length} products` +
      (failed ? `, ${failed} failed (left untouched in Supabase)` : ""),
  );
}

main().catch((e) => {
  console.error("[sync-external-products] fatal:", e);
  process.exit(1);
});
