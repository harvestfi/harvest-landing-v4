import { getVaults } from "@/lib/data";
import { getCanonicalSlugs } from "@/lib/canonical-vaults";
import { formatAPY, formatTVL } from "@/lib/format";
import { productPageTitle, productPageDescription } from "@/lib/seo";
import { SeoTable } from "@/components/seo-table";
import { existsSync, statSync } from "fs";
import { join } from "path";

export default async function AdminPage() {
  const vaults = await getVaults();
  const canonical = await getCanonicalSlugs();

  const now = Date.now();
  // Mirror what /[slug]/page.tsx generateMetadata actually emits so the
  // admin preview matches production. trackedDays is approximated from
  // launchDate (we can't fetch full history per vault here without
  // multiplying build time); the seo helper uses the 30+ day branch
  // when this is >= 30 and apy30d > 0, falling back to "live since X"
  // for newly-launched products.
  const rows = vaults.map((vault) => {
    const trackedDays = vault.launchDate
      ? Math.max(
          0,
          Math.floor((now - new Date(vault.launchDate).getTime()) / 86_400_000),
        )
      : 0;
    return {
      slug: vault.slug,
      title: productPageTitle(vault),
      description: productPageDescription(vault, trackedDays),
      chain: vault.chain,
      apy: formatAPY(vault.apy24h),
      tvl: formatTVL(vault.tvl),
      indexed: canonical.has(vault.slug),
    };
  });

  let lastUpdated = new Date().toISOString();
  const vaultsFile = join(process.cwd(), "data", "vaults.json");
  if (existsSync(vaultsFile)) {
    const stat = statSync(vaultsFile);
    lastUpdated = stat.mtime.toISOString();
  }

  return (
    <main className="adm-page">
      <SeoTable
        rows={rows}
        vaultCount={vaults.length}
        lastUpdated={new Date(lastUpdated).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      />
    </main>
  );
}
