import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getVaults } from "@/lib/data";
import { loadHistoryFile, type FullVaultHistory } from "@/lib/data";
import { StudioClient, type StudioVault } from "@/components/admin/studio-client";
// The studio reuses HomeHeroPreview, whose .uni-home-test .prevcard-*
// styling lives in the homepage stylesheet. Pulling it in here gives
// the studio page the same card chrome without copying CSS.
import "@/app/_styles/home.css";

// Studio: lets us compose product-card images at Twitter 16:9 ratio
// using the same yellow + dotted hero treatment from the homepage.
// Vault data + sparkline come from the same cached files the live
// site reads, so any tweak to formatting on the product page
// propagates here without extra plumbing.

export const metadata = {
  title: "Studio - Admin",
  robots: { index: false, follow: false },
};

// Off-catalogue vaults (assets outside USDC/USDT/ETH/BTC, e.g. EURC) that the
// public site doesn't list but Studio should still be able to compose cards
// for. Emitted by scripts/fetch-data.mjs into data/studio-vaults.json; absent
// until the next data refresh runs, in which case Studio just shows the
// catalogue. Same element shape as getVaults() for the fields Studio reads.
type CatalogueVault = Awaited<ReturnType<typeof getVaults>>[number];
function loadStudioExtras(): CatalogueVault[] {
  try {
    const p = join(process.cwd(), "data", "studio-vaults.json");
    if (!existsSync(p)) return [];
    const parsed = JSON.parse(readFileSync(p, "utf-8"));
    return Array.isArray(parsed) ? (parsed as CatalogueVault[]) : [];
  } catch {
    return [];
  }
}

export default async function StudioPage() {
  const vaults = await getVaults();
  const history = loadHistoryFile();

  const cards: StudioVault[] = [...vaults, ...loadStudioExtras()]
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
      // Share price climbs smoothly as the vault compounds; plot it on its own
      // series so the sharePrice tab shows that trend, not the APY series.
      const sharePriceSpark = downsample(
        (h?.sharePriceHistory ?? [])
          .filter((p) => p.sharePrice > 0 && isFinite(p.sharePrice))
          .map((p) => p.sharePrice),
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
        sharePriceSpark,
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
