import { getVaults } from "@/lib/data";
import { loadHistoryFile, type FullVaultHistory } from "@/lib/data";
import { StudioClient, type StudioVault } from "@/components/admin/studio-client";

// Studio: lets us compose product-card images at Twitter 16:9 ratio
// using the same yellow + dotted hero treatment from the homepage.
// Vault data + sparkline come from the same cached files the live
// site reads, so any tweak to formatting on the product page
// propagates here without extra plumbing.

export const metadata = {
  title: "Studio - Admin",
  robots: { index: false, follow: false },
};

export default async function StudioPage() {
  const vaults = await getVaults();
  const history = loadHistoryFile();

  const cards: StudioVault[] = vaults
    .map((v) => {
      const h: FullVaultHistory | undefined =
        history?.[v.contractAddress] ?? history?.[v.contractAddress.toLowerCase()];
      const apySpark = downsample(
        (h?.apyHistory ?? [])
          .filter((p) => p.apy >= 0 && isFinite(p.apy))
          .map((p) => p.apy),
        24,
      );
      const tvlSpark = downsample(
        (h?.tvlHistory ?? [])
          .filter((p) => p.value > 0 && isFinite(p.value))
          .map((p) => p.value),
        24,
      );
      return {
        slug: v.slug,
        productName: v.productName,
        asset: v.asset,
        chain: v.chain,
        protocol: v.protocol.name,
        vaultType: v.vaultType ?? "",
        category: v.category ?? "",
        apy24h: v.apy24h,
        apy30d: v.apy30d,
        tvl: v.tvl,
        apySpark,
        tvlSpark,
      };
    })
    .filter((v) => v.apy24h > 0 || v.tvl > 0)
    .sort((a, b) => b.tvl - a.tvl);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="adm-header">
        <h1>Studio</h1>
        <p className="adm-sub">
          Compose social-media product cards. Outer canvas mirrors
          the homepage hero (yellow + dotted); the centerpiece is
          the same product preview card we render in that hero,
          populated with the chosen vault. Pick a ratio, vault, and
          metric, then download the PNG.
        </p>
      </div>
      <StudioClient vaults={cards} />
    </main>
  );
}

// Reduce a series down to N evenly-spaced samples so the sparkline
// renders crisply at the card size without animating 200+ points.
function downsample(values: number[], target: number): number[] {
  if (values.length <= target) return values.slice();
  const step = (values.length - 1) / (target - 1);
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    out.push(values[Math.round(i * step)]);
  }
  return out;
}
