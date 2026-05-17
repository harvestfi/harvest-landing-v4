// Acquisition funnel — step 03: App Net Worth.
// Will track the aggregate net worth held by users currently
// connected in the Harvest app. Sits between "click-into-app" and
// "actually deposited"; a connected wallet with non-zero balance is
// a near-conversion. No data hookup yet.

import { AcquisitionStub } from "@/components/admin/acquisition-stub";

export default function AppNetWorthPage() {
  return (
    <AcquisitionStub
      step="03"
      title="User Networth"
      description="Aggregate net worth held by wallets currently connected to the Harvest app. The bridge metric between an engaged session and a committed depositor."
      comingSoon="This step will track the rolling total net worth of wallets that arrived from the index and are currently connected in the app — by wallet age, by chain, by source. Source of truth: app.harvest.finance analytics feed (to be wired up)."
    />
  );
}
