import type { Metadata } from "next";
import { getLiveVaults } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { networkHubTitle, networkHubDescription } from "@/lib/seo";
import { NetworkLongBody } from "@/components/network-long-body";
import "../_styles/asset-hub.css";
import "../_styles/usdc-hub.css";
import "../_styles/asset-editorial.css";
import "../_styles/asset-ld.css";

const NETWORK_SLUG = "polygon";
const NETWORK_DISPLAY = "Polygon";
const CHAIN = "Polygon";

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const count = vaults.filter((v) => v.chain === CHAIN).length;
  const title = networkHubTitle(NETWORK_DISPLAY);
  const description = networkHubDescription(NETWORK_DISPLAY, count);
  const url = `${SITE_URL}/${NETWORK_SLUG}`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: url, types: { "text/markdown": `${url}.md` } },
  };
}

export default async function PolygonNetworkPage() {
  return (
    <NetworkLongBody chain={CHAIN} />
  );
}
