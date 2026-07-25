import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getLiveVaults } from "@/lib/data";
import { getPolygonVenues } from "@/lib/polygon-yield";
import { PolygonHubBody } from "@/components/polygon-hub-body";
import "../_styles/asset-hub.css";
import "../_styles/report.css";
import "../_styles/polygon-hub.css";

const NETWORK_DISPLAY = "Polygon";
const URL = `${SITE_URL}/polygon`;

export async function generateMetadata(): Promise<Metadata> {
  const [vaults, venues] = await Promise.all([getLiveVaults(), Promise.resolve(getPolygonVenues())]);
  const harvestCount = vaults.filter((v) => v.chain === "Polygon").length;
  const externalCount = venues.length;
  const title = `Best ${NETWORK_DISPLAY} Yields: ${externalCount} Third-Party Venues + Harvest | ${SITE_NAME}`;
  const description = `Compare ${externalCount} third-party Polygon lending and tokenized-fund venues against ${harvestCount} Harvest-operated ${harvestCount === 1 ? "strategy" : "strategies"}, grouped by asset. Rates read directly from each venue's own contract state where possible, refreshed regularly.`;
  return {
    title,
    description,
    openGraph: { title, description, url: URL, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: URL },
  };
}

export default async function PolygonNetworkPage() {
  return <PolygonHubBody />;
}
