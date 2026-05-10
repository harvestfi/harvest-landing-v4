import type { Metadata } from "next";
import { getLiveVaults } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  assetHubTitle,
  assetHubDescription,
} from "@/lib/seo";
import { AssetHubBody } from "@/components/asset-hub-body";
import "../_styles/asset-hub.css";

const ASSET = "USDC" as const;

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const assetVaults = vaults.filter((v) => v.asset === ASSET);
  const title = assetHubTitle(ASSET);
  const description = assetHubDescription(ASSET, assetVaults.length);
  const url = `${SITE_URL}/usdc`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: url },
  };
}

export default async function UsdcPage() {
  return <AssetHubBody asset={ASSET} />;
}
