// Admin > Live Feed (server wrapper). Builds the slug + contract-address
// -> front-end product-name map from the vaults API so the client feed
// can label an app event with its human-readable product name, then
// hands off to the client component that streams visits + app events
// from Supabase.

import { getVaults } from "@/lib/data";
import { getCanonicalDisplayName } from "@/lib/lp-pair";
import { LiveFeed } from "./live-feed";

export const metadata = {
  title: "Live Feed | Admin",
  robots: { index: false, follow: false },
};

export default async function LiveFeedPage() {
  const vaults = await getVaults();
  const productNames: Record<string, string> = {};
  for (const v of vaults) {
    const name = getCanonicalDisplayName(v);
    if (v.slug) productNames[v.slug.toLowerCase()] = name;
    if (v.contractAddress) productNames[v.contractAddress.toLowerCase()] = name;
  }
  return <LiveFeed productNames={productNames} />;
}
