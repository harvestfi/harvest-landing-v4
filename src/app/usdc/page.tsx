import type { Metadata } from "next";
import { getLiveVaults, loadHistoryFile } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { assetHubTitle } from "@/lib/seo";
import { buildUsdcCohort } from "@/lib/usdc-hub";
import { UsdcHubBody } from "@/components/usdc-hub-body";
import "../_styles/asset-hub.css";
import "../_styles/usdc-hub.css";

const ASSET = "USDC" as const;
const URL = `${SITE_URL}/usdc`;

export async function generateMetadata(): Promise<Metadata> {
  const vaults = await getLiveVaults();
  const c = buildUsdcCohort(
    vaults.filter((v) => v.asset === ASSET),
    loadHistoryFile(),
  );

  // The title keeps its `usdc yield` vocabulary: it has ranking history and
  // the rebuild adds the interest-rate and staking vocabulary through H2s and
  // the FAQ instead.
  const title = assetHubTitle(ASSET);

  // Built here rather than through assetHubDescription(). That helper's
  // single-subAsset branch claimed coverage "across DeFi" while the page
  // indexes one operator, and the same branch serves /usdt, which is part of
  // the control group for this change and must not move.
  const description =
    `Compare ${c.count} USDC yield strategies on ${c.chainCount} networks, ranked by 24-hour ` +
    `APY. Live rates, 30-day averages and TVL for every strategy Harvest indexes, updated hourly.`;

  return {
    title,
    description,
    openGraph: { title, description, url: URL, siteName: SITE_NAME, type: "website" },
    alternates: { canonical: URL },
  };
}

export default async function UsdcPage() {
  return <UsdcHubBody />;
}
