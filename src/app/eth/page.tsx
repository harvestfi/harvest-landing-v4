import type { Metadata } from "next";
import { getLiveVaults, loadHistoryFile } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { buildEthCohort, networkPicks } from "@/lib/eth-hub";
import { EthHubBody } from "@/components/eth-hub-body";
import "../_styles/asset-hub.css";
import "../_styles/usdc-hub.css";
import "../_styles/eth-hub.css";
import "../_styles/eth-institutional.css";
import "../_styles/asset-editorial.css";
import "../_styles/asset-ld.css";

const ASSET = "ETH" as const;
const URL = `${SITE_URL}/eth`;

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const c = buildEthCohort(
    vaults.filter((v) => v.asset === ASSET),
    loadHistoryFile(),
  );

  // The head terms people search ("ethereum yield", "eth apy") were missing
  // from the title, and Ahrefs files them all under one parent topic, so one
  // page can carry them. The title stays under ~600px (about 60 characters
  // with " | Harvest"), past which Google rewrites titles far more often
  // (46% vs 29% in Ahrefs' title study). "Live" matches the wording of the
  // pages that rank for these terms; the month and year of the data stay, as
  // the year is the modifier ChatGPT's query fan-out adds most often (22.9%).
  const monthYear = c.asOfIso
    ? new Date(c.asOfIso).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : "";
  const title = monthYear
    ? `Ethereum Yield & ETH APY: Live Rates (${monthYear})`
    : "Ethereum Yield & ETH APY: Live Rates";

  // No live rate in the description: Google rewrites about 63% of them anyway,
  // and a one-day spike on a small vault (110% on 31 Oct) once reached the
  // snippet. The live figures sit in the visible hero and table instead.
  const description = c.best
    ? `Live ETH APY and Ethereum yield across ${c.count} ETH and WETH strategies on Base, ` +
      `Arbitrum and Ethereum, ranked by 24-hour rate and steadiness and compared with staking.`
    : `Compare ETH and WETH yield strategies by 24-hour APY, TVL and 30-day steadiness, updated several times a day.`;

  return {
    title,
    description,
    openGraph: { title, description, url: URL, siteName: SITE_NAME, type: "website" },
    // The markdown twin, linked so agents that follow links can find it.
    alternates: { canonical: URL, types: { "text/markdown": `${URL}.md` } },
  };
}

export default async function EthPage() {
  return <EthHubBody />;
}
