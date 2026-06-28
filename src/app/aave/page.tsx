import type { Metadata } from "next";
import { getLiveVaults } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { platformHubTitle, platformHubDescription } from "@/lib/seo";
import { PlatformHubBody } from "@/components/platform-hub-body";
import {
  getPlatform,
  platformVaults,
  LIVE_PLATFORM_SLUGS,
} from "@/lib/platforms";
import "../_styles/asset-hub.css";

const PLATFORM_SLUG = "aave";

export async function generateMetadata(): Promise<Metadata> {
  const platform = getPlatform(PLATFORM_SLUG)!;
  const vaults = await getLiveVaults();
  const count = platformVaults(vaults, platform).length;
  const title = platformHubTitle(platform.display);
  const description = platformHubDescription(platform.display, count);
  const url = `${SITE_URL}/${PLATFORM_SLUG}`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: url },
  };
}

export default async function AavePlatformPage() {
  return (
    <PlatformHubBody
      platformSlug={PLATFORM_SLUG}
      livePlatformSlugs={LIVE_PLATFORM_SLUGS}
    />
  );
}
