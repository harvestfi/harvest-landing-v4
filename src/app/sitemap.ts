import type { MetadataRoute } from "next";
import { getVaults, isVaultPageIndexable } from "@/lib/data";
import { getCanonicalSlugs } from "@/lib/canonical-vaults";
import { SITE_URL } from "@/lib/constants";
import { NETWORKS } from "@/lib/networks";
import { LIVE_PLATFORM_SLUGS } from "@/lib/platforms";
import { getDocsPages } from "@/lib/docs";
import { getSiteFacts } from "@/lib/site-facts";
import { loadStockData } from "@/lib/tokenized-stocks";

export const dynamic = "force-static";

const ASSET_HUBS = ["usdc", "usdt", "btc", "eth"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vaults = await getVaults();
  const canonical = await getCanonicalSlugs();
  const facts = await getSiteFacts();

  // lastmod is the newest indexed reading behind the page, not the build
  // time: a rebuild with unchanged data must not tell crawlers
  // that every URL changed. Pages whose figures come from the whole index
  // use the index date.
  const siteAsOf = facts.dataAsOf ? new Date(facts.dataAsOf) : new Date();
  const asOf = (iso: string | null | undefined) => (iso ? new Date(iso) : siteAsOf);
  const vaultAsOf = new Map(facts.vaults.map((v) => [v.slug, v.dataAsOf]));
  const ASSET_KEY: Record<string, string> = { usdc: "USDC", usdt: "USDT", btc: "BTC", eth: "ETH" };

  // Mirror the per-page robots gate (app/[slug]/page.tsx) exactly so the
  // sitemap never lists a URL we noindex - canonical only, no broken /
  // stale / missing-metrics / thin-history stubs.
  const vaultPages = vaults
    .filter((v) => isVaultPageIndexable(v, canonical.has(v.slug)))
    .map((v) => ({
      url: `${SITE_URL}/${v.slug}`,
      lastModified: asOf(vaultAsOf.get(v.slug)),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  const assetHubPages = ASSET_HUBS.map((hub) => ({
    url: `${SITE_URL}/${hub}`,
    lastModified: asOf(facts.byAsset[ASSET_KEY[hub]]?.dataAsOf),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  // /zksync is noindex while it has no strategies, so it stays
  // out of the sitemap too.
  const networkHubPages = NETWORKS.filter((n) => n.slug !== "zksync").map((n) => ({
    url: `${SITE_URL}/${n.slug}`,
    lastModified: asOf(facts.byChain[n.chain]?.dataAsOf),
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  const platformHubPages = LIVE_PLATFORM_SLUGS.map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: siteAsOf,
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: siteAsOf,
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
      url: `${SITE_URL}/report/xrp-yield-ranking`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/xrp-rich-list`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
      alternates: {
        languages: {
          en: `${SITE_URL}/xrp-rich-list`,
          ko: `${SITE_URL}/ko/xrp-rich-list`,
        },
      },
    },
    {
      url: `${SITE_URL}/ko/xrp-rich-list`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
      alternates: {
        languages: {
          en: `${SITE_URL}/xrp-rich-list`,
          ko: `${SITE_URL}/ko/xrp-rich-list`,
        },
      },
    },
    ...getDocsPages().map((p) => ({
      url: `${SITE_URL}${p.path}`,
      lastModified: new Date("2026-11-01"),
      changeFrequency: "monthly" as const,
      priority: p.path === "/docs" ? 0.7 : 0.5,
    })),
    {
      url: `${SITE_URL}/yield-on-tokenized-stocks`,
      lastModified: new Date(loadStockData().dataAsOf),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    ...assetHubPages,
    ...networkHubPages,
    ...platformHubPages,
    ...vaultPages,
  ];
}
