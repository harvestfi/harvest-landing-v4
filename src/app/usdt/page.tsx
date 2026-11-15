import type { Metadata } from "next";
import { getLiveVaults, loadHistoryFile } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { listOf } from "@/lib/usdc-hub";
import { buildHubCohort } from "@/lib/long-hub";
import { UsdtHubBody } from "@/components/usdt-hub-body";
import "../_styles/asset-hub.css";
import "../_styles/usdc-hub.css";
import "../_styles/asset-editorial.css";
import "../_styles/asset-ld.css";

const ASSET = "USDT" as const;
const URL = `${SITE_URL}/usdt`;

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const c = buildHubCohort(
    vaults.filter((v) => v.asset === ASSET),
    loadHistoryFile(),
  );

  // Same shape as /eth. "USDT yield" and "USDT APY" are the head terms in
  // Search Console; "Tether" carries the issuer's name for the searches that
  // use it, and the month and year of the data stay.
  const monthYear = c.asOfIso
    ? new Date(c.asOfIso).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : "";
  const title = monthYear
    ? `Best USDT Yield & APY: Live Tether Rates (${monthYear})`
    : "Best USDT Yield & APY: Live Tether Rates";

  const description =
    `Live USDT APY and Tether yield across ${c.count} strategies on ` +
    `${listOf([...c.chains].sort())}, ranked by 24-hour rate, with TVL beside every rate and ` +
    `USDT compared with USDC.`;

  return {
    title,
    description,
    openGraph: { title, description, url: URL, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: URL, types: { "text/markdown": `${URL}.md` } },
  };
}

export default async function UsdtPage() {
  return <UsdtHubBody />;
}
