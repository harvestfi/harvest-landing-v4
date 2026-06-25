// Control room > Deposit Activity (server wrapper).
//
// Loads vault metadata at build time (address -> product name / asset /
// slug) so the client feed can render the real product name + asset icon
// per row, then hands off to the client component which fetches
// vault_events_prod live. See deposit-activity-client.tsx for the UI.
//
// A USD-denominated deposit / withdraw feed across every network we index,
// sourced from the Harvest subgraph (userTransactions) and isolated from the
// RPC indexer's rows by reading only amount_usd IS NOT NULL.

import { getVaults } from "@/lib/data";
import DepositActivityClient, {
  type VaultMeta,
} from "./deposit-activity-client";

export default async function DepositActivityPage() {
  const vaults = await getVaults();
  const vaultMeta: VaultMeta = {};
  for (const v of vaults) {
    if (!v.contractAddress) continue;
    vaultMeta[v.contractAddress.toLowerCase()] = {
      name: v.productName,
      asset: v.asset,
      slug: v.slug,
    };
  }
  return <DepositActivityClient vaultMeta={vaultMeta} />;
}
