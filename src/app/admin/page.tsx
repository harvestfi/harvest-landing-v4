import { getVaults } from "@/lib/data";
import { getCanonicalSlugs } from "@/lib/canonical-vaults";
import { formatAPY, formatTVL } from "@/lib/format";
import {
  productPageTitle,
  productPageDescription,
  comboKey,
} from "@/lib/seo";
import { SeoTable } from "@/components/seo-table";
import { existsSync, statSync } from "fs";
import { join } from "path";

export default async function AdminPage() {
  const vaults = await getVaults();
  const canonical = await getCanonicalSlugs();

  const now = Date.now();

  // Tally asset+protocol+network combos so the SEO preview matches
  // what /[slug]/page.tsx renders: drop the disambiguator slot only
  // when the combo is unique across the full index.
  const comboTally = new Map<string, number>();
  for (const v of vaults) {
    const k = comboKey(v);
    comboTally.set(k, (comboTally.get(k) ?? 0) + 1);
  }

  const rows = vaults.map((vault) => {
    const trackedDays = vault.launchDate
      ? Math.max(
          0,
          Math.floor((now - new Date(vault.launchDate).getTime()) / 86_400_000),
        )
      : 0;
    const isUniqueCombo = (comboTally.get(comboKey(vault)) ?? 0) === 1;
    return {
      slug: vault.slug,
      title: productPageTitle(vault, isUniqueCombo),
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
