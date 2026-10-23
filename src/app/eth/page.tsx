import type { Metadata } from "next";
import { getLiveVaults, loadHistoryFile } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { formatAPY } from "@/lib/format";
import { buildEthCohort, networkPicks } from "@/lib/eth-hub";
import { EthHubBody } from "@/components/eth-hub-body";
import "../_styles/asset-hub.css";
import "../_styles/usdc-hub.css";
import "../_styles/eth-hub.css";

const ASSET = "ETH" as const;
const URL = `${SITE_URL}/eth`;

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const c = buildEthCohort(
    vaults.filter((v) => v.asset === ASSET),
    loadHistoryFile(),
  );

  // The queries reaching this page name a network ("on Base", "on an L2"), so
  // the title carries the networks and keeps the "best ETH yield" head term.
  // It also carries the month and year of the data: in Ahrefs' study of
  // ChatGPT's query fan-out, the year was the modifier added most often to
  // the searches it runs (22.9% of them), and a dated title matches those.
  const monthYear = c.asOfIso
    ? new Date(c.asOfIso).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : "";
  const title = monthYear
    ? `Best ETH Yield (${monthYear}): Live APY on Base, Arbitrum & Ethereum`
    : "Best ETH Yield on Base, Arbitrum & Ethereum: Live APY";

  // The description leads with the answer, the way the page does: the top
  // 24-hour rate first, then the best rate above the liquidity floor, so the
  // snippet and the intro name the same figures.
  const top = c.all[0];
  const name = (v: typeof top) => v.productName.replace(/\s*\([^)]*\)$/, "");
  const description = c.best
    ? `Best ETH yield${monthYear ? `, ${monthYear}` : ""}: ${formatAPY(top.apy24h)} APY on ` +
      `${name(top)} (${top.chain})` +
      (top.slug !== c.best.slug
        ? `; ${formatAPY(c.best.apy24h)} on ${name(c.best)} is the best above $50K`
        : "") +
      `. Compare ${c.count} ETH and WETH strategies by 24-hour APY, TVL and 30-day steadiness.`
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
