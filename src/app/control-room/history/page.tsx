// Control room > Wallet history (server wrapper).
//
// A per-wallet interaction timeline reached by clicking a wallet anywhere in
// the control room (Deposit Activity feed, etc.). The address is read
// client-side from ?address=0x... so a single static page serves any wallet
// (Next static export can't pre-render an arbitrary [address] segment).
//
// Loads vault metadata at build time so on-chain rows render the real
// product name + asset icon, then hands off to the client component which
// stitches together the subgraph (deposits / withdrawals), the in-app wallet
// connections, and the front-end visits / clicks for that wallet's sessions.

import { Suspense } from "react";
import { getVaults } from "@/lib/data";
import WalletHistoryClient, {
  type VaultMeta,
} from "./history-client";

export default async function WalletHistoryPage() {
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
  return (
    <Suspense
      fallback={
        <div className="uni-hub-test">
          <div className="uni-hub-empty">Loading wallet history…</div>
        </div>
      }
    >
      <WalletHistoryClient vaultMeta={vaultMeta} />
    </Suspense>
  );
}
