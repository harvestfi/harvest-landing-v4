import { getVaults, getHiddenSlugs } from "@/lib/data";
import { getCanonicalDisplayName, isLpPairVault } from "@/lib/lp-pair";
import { HideManager, type HideItem } from "@/components/admin/hide-manager";
import "../../_styles/asset-hub.css";

// Admin > Products > Hide.
//
// A flat list of every product that can appear on the public ranking
// surfaces (homepage, /asset, /network) with a per-product Hide toggle.
// Hiding removes a product from ALL rankings, including the cohort
// comparisons on other product pages, but does NOT noindex it: the
// product keeps its own indexable page (just without the comparative
// ranking sections).
//
// Mechanism (static export): the toggle writes to the Supabase
// `hidden_products` table at runtime. The hourly data cron syncs that
// table into data/hidden.json (scripts/fetch-data.mjs), and the next
// build drops the hidden products from every ranking. So a change takes
// effect on the public site after the next build (~1h). The list here
// also reads Supabase on load so the operator sees the live hidden state
// immediately, even before the build catches up.

export default async function AdminHidePage() {
  const vaults = await getVaults();
  // Build-time hidden set (what's currently live on the public site).
  const hiddenAtBuild = getHiddenSlugs();

  // One row per product, sorted by asset then name for easy scanning.
  const items: HideItem[] = vaults
    .map((v) => ({
      slug: v.slug,
      name: getCanonicalDisplayName(v),
      asset: v.asset,
      chain: v.chain,
      isLp: isLpPairVault(v),
      hiddenAtBuild: hiddenAtBuild.has(v.slug.toLowerCase()),
    }))
    .sort(
      (a, b) =>
        a.asset.localeCompare(b.asset) || a.name.localeCompare(b.name),
    );

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero aq-hero-slim aq-hero-fullwidth">
        <div className="uni-hub-hero-headline">
          <div style={{ width: "100%" }}>
            <h1 className="uni-hub-h1">Hide products</h1>
            <p className="uni-hub-sub aq-sub-full">
              Hide a product from every ranking: the homepage, the asset and
              network pages, and the peer comparisons on other product pages.
              Hiding does not noindex it - the product keeps its own page.
              Changes save instantly and reach the public rankings on the next
              data build (about an hour).
            </p>
          </div>
        </div>
      </header>

      <HideManager items={items} />
    </div>
  );
}
