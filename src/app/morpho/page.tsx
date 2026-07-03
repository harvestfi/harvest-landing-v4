import type { Metadata } from "next";
import { getLiveVaults } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { platformHubTitle, platformHubDescription } from "@/lib/seo";
import { PlatformHubBody } from "@/components/platform-hub-body";
import {
  getPlatform,
  platformVaults,
  platformAssetsAndNetworks,
  LIVE_PLATFORM_SLUGS,
} from "@/lib/platforms";
import "../_styles/asset-hub.css";

const PLATFORM_SLUG = "morpho";

export async function generateMetadata(): Promise<Metadata> {
  const platform = getPlatform(PLATFORM_SLUG)!;
  const vaults = await getLiveVaults();
  const live = platformVaults(vaults, platform);
  const { assets, networks } = platformAssetsAndNetworks(live);
  const title = platformHubTitle(platform.display, platform.countFloor);
  const description = platformHubDescription(
    platform.display,
    live.length,
    assets,
    networks,
  );
  const url = `${SITE_URL}/${PLATFORM_SLUG}`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: url },
  };
}

export default async function MorphoPlatformPage() {
  return (
    <PlatformHubBody
      platformSlug={PLATFORM_SLUG}
      livePlatformSlugs={LIVE_PLATFORM_SLUGS}
    />
  );
}
