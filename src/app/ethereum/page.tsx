import type { Metadata } from "next";
import { getLiveVaults } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { networkHubTitle, networkHubDescription } from "@/lib/seo";
import { NetworkHubBody } from "@/components/network-hub-body";
import "../_styles/asset-hub.css";

const NETWORK_SLUG = "ethereum";
const NETWORK_DISPLAY = "Ethereum";
const CHAIN = "Ethereum";

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
    alternates: { canonical: url },
  };
}

export default async function EthereumNetworkPage() {
  return (
    <NetworkHubBody
      networkSlug={NETWORK_SLUG}
      networkDisplay={NETWORK_DISPLAY}
      chain={CHAIN}
    />
  );
}
