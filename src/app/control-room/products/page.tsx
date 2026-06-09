import { getVaults, isBrokenLowTvlVault, isStaleApyVault, hasMissingMetrics } from "@/lib/data";
import { getCanonicalSlugs, getDuplicateGroupKey } from "@/lib/canonical-vaults";
import { AdminProductsTable, type AdminRow } from "@/components/admin-products-table";
import "../../_styles/asset-hub.css";

// Admin > Products. Sits inside the canonical .uni-hub-test shell
// (the same one /eth, /usdc, /admin/acquisition, /admin SEO use)
// so every admin surface speaks one visual language.
//
// The `indexed` flag matches what the slug-page generateMetadata
// actually emits: a vault is indexable when it's the canonical slug
// in its duplicate group AND not broken AND not stale (APY frozen
// for 14+ days) AND has both 24h APY and TVL data. The table
// surfaces the reason via the noindex pill + a Reason column.

export default async function AdminProductsPage() {
  const vaults = await getVaults();
  const canonical = await getCanonicalSlugs();

  const groupSizes = new Map<string, number>();
  for (const v of vaults) {
    const k = getDuplicateGroupKey(v.slug);
    groupSizes.set(k, (groupSizes.get(k) ?? 0) + 1);
  }

  const rows: AdminRow[] = vaults
    .map((v) => {
      const groupKey = getDuplicateGroupKey(v.slug);
      const isCanonical = canonical.has(v.slug);
      const broken = isBrokenLowTvlVault(v);
      const stale = isStaleApyVault(v);
      const missing = hasMissingMetrics(v);
      const reasons: AdminRow["noindexReasons"] = [];
      if (!isCanonical) reasons.push("duplicate");
      if (broken) reasons.push("broken");
      if (stale) reasons.push("stale");
      if (missing) reasons.push("no-data");
      return {
        slug: v.slug,
        productName: v.productName,
        chain: v.chain,
        asset: v.asset,
        apy24h: v.apy24h,
        tvl: v.tvl,
        indexed: reasons.length === 0,
        noindexReasons: reasons,
        groupKey,
        groupSize: groupSizes.get(groupKey) ?? 1,
      };
    })
    .sort((a, b) => {
      if (a.groupKey !== b.groupKey) return a.groupKey.localeCompare(b.groupKey);
      return b.tvl - a.tvl;
    });

  const indexedCount = rows.filter((r) => r.indexed).length;
  const noindexCount = rows.length - indexedCount;
  const duplicateGroups = [...groupSizes.values()].filter((s) => s > 1).length;

  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">Products</h1>
            <p className="uni-hub-sub">
              Every vault returned by the indexer. A product is marked
              noindex (in code, not just visually) when it duplicates a
              higher-TVL sibling, when its APY has been frozen for 14+ days
              ({"stale"}), when its TVL is under $10K with a flat history
              ({"broken"}), or when its 24h APY / TVL column shows no data.
              The slug page emits robots noindex and the sitemap drops it,
              so crawlers stop wasting budget.
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Products summary"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          <Stat label="Total products" value={rows.length.toLocaleString("en-US")} />
          <Stat label="Indexed" value={indexedCount.toLocaleString("en-US")} />
          <Stat label="Noindex" value={noindexCount.toLocaleString("en-US")} />
          <Stat
            label="Duplicate groups"
            value={duplicateGroups.toLocaleString("en-US")}
          />
        </div>
      </header>

      <section className="uni-hub-section" style={{ marginTop: 0 }}>
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">Inventory</h2>
          <span className="uni-hub-section-meta">
            {indexedCount} of {rows.length} indexable
            {noindexCount > 0 ? ` · ${noindexCount} noindex` : ""}
          </span>
        </header>
        <AdminProductsTable rows={rows} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div className="uni-hub-stat-value">{value}</div>
    </div>
  );
}
