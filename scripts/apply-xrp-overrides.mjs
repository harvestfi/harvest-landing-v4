// Shared curated-override layer for the XRP yield report.
//
// data/xrp-venues.json holds hand-curated venues. Where a venue carries a
// `match` rule, we point the matching live DeFiLlama ranking row at the real
// product deep-link (instead of the generic platform homepage) and tag the row
// as curated. Used by:
//   - scripts/fetch-xrp-yield.mjs   (hourly, so overrides survive regeneration)
//   - scripts/rebuild-xrp-overrides.mjs (one-off, re-applies to the committed
//     snapshot without hitting the network)
//
// Matching is case-insensitive equality on the fields present in `match`
// (project, symbol, chain, and optional poolMeta). First unclaimed live row
// wins, so two curated entries can't collide onto one row.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function loadVenues(root = process.cwd()) {
  const f = join(root, "data", "xrp-venues.json");
  if (!existsSync(f)) return [];
  try {
    const doc = JSON.parse(readFileSync(f, "utf-8"));
    return Array.isArray(doc?.venues) ? doc.venues : [];
  } catch {
    return [];
  }
}

const eq = (a, b) => String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase();

function poolMatchesRule(pool, rule) {
  if (!rule) return false;
  if (rule.project != null && !eq(pool.project, rule.project)) return false;
  if (rule.symbol != null && !eq(pool.symbol, rule.symbol)) return false;
  if (rule.chain != null && !eq(pool.chain, rule.chain)) return false;
  if (rule.poolMeta != null && !eq(pool.poolMeta, rule.poolMeta)) return false;
  return true;
}

// Mutates and returns `pools`, applying curated deep-links. Returns the count
// of rows overridden so callers can log it.
export function applyOverrides(pools, venues) {
  const claimed = new Set();
  let applied = 0;
  for (const v of venues) {
    if (!v?.match || !v?.url) continue;
    const row = pools.find((p, i) => !claimed.has(i) && poolMatchesRule(p, v.match));
    if (!row) continue;
    claimed.add(pools.indexOf(row));
    row.platformUrl = v.url;
    row.curated = true;
    if (v.productType) row.productType = v.productType;
    if (v.slug) row.venueSlug = v.slug;
    applied++;
  }
  return applied;
}
