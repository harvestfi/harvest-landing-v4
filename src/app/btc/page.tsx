import type { Metadata } from "next";
import { getLiveVaults } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  assetHubTitle,
  assetHubDescription,
} from "@/lib/seo";
import { getSubAsset } from "@/lib/sub-asset";
import { AssetHubBody } from "@/components/asset-hub-body";
import "../_styles/asset-hub.css";

const ASSET = "BTC" as const;

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const assetVaults = vaults.filter((v) => v.asset === ASSET);
  const subAssets = [...new Set(assetVaults.map((v) => getSubAsset(v)))].sort();
  const title = assetHubTitle(ASSET);
  const description = assetHubDescription(ASSET, assetVaults.length, subAssets);
  const url = `${SITE_URL}/btc`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: url },
  };
}

export default async function BtcPage() {
  return <AssetHubBody asset={ASSET} />;
}
