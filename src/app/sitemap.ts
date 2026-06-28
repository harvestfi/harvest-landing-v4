import type { MetadataRoute } from "next";
import { getVaults, isVaultPageIndexable } from "@/lib/data";
import { getCanonicalSlugs } from "@/lib/canonical-vaults";
import { SITE_URL } from "@/lib/constants";
import { NETWORKS } from "@/lib/networks";
import { LIVE_PLATFORM_SLUGS } from "@/lib/platforms";

export const dynamic = "force-static";

const ASSET_HUBS = ["usdc", "usdt", "btc", "eth"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vaults = await getVaults();
  const canonical = await getCanonicalSlugs();

  // Mirror the per-page robots gate (app/[slug]/page.tsx) exactly so the
  // sitemap never lists a URL we noindex - canonical only, no broken /
  // stale / missing-metrics / thin-history stubs.
  const vaultPages = vaults
    .filter((v) => isVaultPageIndexable(v, canonical.has(v.slug)))
    .map((v) => ({
      url: `${SITE_URL}/${v.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  const assetHubPages = ASSET_HUBS.map((hub) => ({
    url: `${SITE_URL}/${hub}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  const networkHubPages = NETWORKS.map((n) => ({
    url: `${SITE_URL}/${n.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  const platformHubPages = LIVE_PLATFORM_SLUGS.map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/methodology`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/risk-framework`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/security`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "yearly" as const,
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/disclosures`,
      lastModified: new Date("2026-05-03"),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    ...assetHubPages,
    ...networkHubPages,
    ...platformHubPages,
    ...vaultPages,
  ];
}
