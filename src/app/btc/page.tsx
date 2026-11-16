import type { Metadata } from "next";
import { getLiveVaults, loadHistoryFile } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { listOf } from "@/lib/usdc-hub";
import { buildHubCohort } from "@/lib/long-hub";
import { BtcHubBody } from "@/components/btc-hub-body";
import "../_styles/asset-hub.css";
import "../_styles/usdc-hub.css";
import "../_styles/asset-editorial.css";
import "../_styles/asset-ld.css";

const ASSET = "BTC" as const;
const URL = `${SITE_URL}/btc`;

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const c = buildHubCohort(
    vaults.filter((v) => v.asset === ASSET),
    loadHistoryFile(),
  );

  // Same shape as /eth: the two head terms Search Console shows for the page
  // ("bitcoin yield", "btc apy"), "Live", and the month and year of the data,
  // kept under ~60 characters with " | Harvest" so Google keeps it.
  const monthYear = c.asOfIso
    ? new Date(c.asOfIso).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : "";
  const title = monthYear
    ? `Bitcoin Yield & BTC APY: Live Rates (${monthYear})`
    : "Bitcoin Yield & BTC APY: Live Rates";

  // No live rate in the description, as on /eth: Google rewrites most
  // descriptions anyway, and a one-day spike on a small vault would reach the
  // snippet. The live figures sit in the takeaways and the table.
  const description =
    `Live BTC APY and Bitcoin yield across ${c.count} WBTC and cbBTC strategies on ` +
    `${listOf([...c.chains].sort())}, ranked by 24-hour rate and steadiness, with WBTC and ` +
    `cbBTC compared.`;

  return {
    title,
    description,
    openGraph: { title, description, url: URL, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: URL, types: { "text/markdown": `${URL}.md` } },
  };
}

export default async function BtcPage() {
  return <BtcHubBody />;
}
