// Adapters for standalone /product/[slug] pages (see data/external-products.json).
// Two tiers, same preference order as the /polygon methodology criteria
// (methodology.tsx#inclusion): on-chain first, Portals only where no simple
// public rate-reading contract exists yet.
//
// Reuses the Aave v3 reader already verified for /polygon (same Pool
// contract, same math). New protocols in this batch (Fluid, Compound v3,
// Compound Blue/Morpho) each have their own ABI to reverse-engineer properly
// (Fluid's Liquidity Layer, Comet's getSupplyRate/getUtilization, Morpho
// Blue's market struct) -- rather than block the whole batch on writing and
// verifying three more ABI readers, they ride the generic Portals-by-address
// path today, disclosed per row as such. Swapping any one of them to
// `kind: "onchain"` later is a one-line change in the registry plus a new
// adapter function here; the page template and data model don't change.

import { aaveV3Supply } from "./polygon-onchain-adapters.mjs";

// Portals treats a lending position's receipt token (aToken, fToken, cToken,
// or an ERC4626 vault share like a Morpho vault) as just another priced
// token, so the same /v2/tokens?addresses= lookup used for Aave's RWA
// fallback works unchanged for any of them -- pass the vault/market token
// address, get back { apy, tvlUsd }.
export async function portalsVaultMetrics(address, apiKey) {
  if (!apiKey) return null;
  const key = `polygon:${address}`;
  const url = `https://api.portals.fi/v2/tokens?addresses=${encodeURIComponent(key)}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: { accept: "application/json", Authorization: `Bearer ${apiKey}` },
      });
      if (r.ok) {
        const doc = await r.json();
        const t = doc?.tokens?.[0];
        const m = t?.metrics ?? {};
        const apy = m.apy != null ? +m.apy : null;
        if (apy == null) return null;
        return {
          apy,
          apyBase: m.baseApy != null ? +m.baseApy : apy,
          tvlUsd: Math.round(t?.liquidity ?? 0),
        };
      }
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  return null;
}

// One entry point the sync script calls per product. `product` is a
// data/external-products.json row (needs .source and .vaultTokenAddress);
// `ctx` carries shared, run-once inputs (Aave pool address, resolved USD
// prices, Portals key).
export async function readExternalProduct(product, ctx) {
  const src = product.source;
  if (src.kind === "onchain" && src.protocol === "aave-v3") {
    const priceUsd = ctx.prices[src.priceRef];
    if (!Number.isFinite(priceUsd)) throw new Error(`no ${src.priceRef} price available`);
    const r = await aaveV3Supply({
      pool: ctx.aaveV3Pool,
      asset: src.asset,
      underlyingDec: src.underlyingDec,
      priceUsd,
    });
    return { apy: r.apy, apyBase: r.apyBase, tvlUsd: r.tvlUsd, source: "onchain" };
  }
  if (src.kind === "portals") {
    const r = await portalsVaultMetrics(product.vaultTokenAddress, ctx.portalsApiKey);
    if (!r) return null;
    return { ...r, source: "portals" };
  }
  throw new Error(`unknown source kind ${src.kind}`);
}
