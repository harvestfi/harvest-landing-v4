// Acquisition funnel — step 04: Deposits (TVL).
// The end state: actual TVL contributed by visitors who came from
// the index. Closes the loop from anonymous traffic to committed
// onchain capital. No data hookup yet.

import { AcquisitionStub } from "@/components/admin/acquisition-stub";

export default function DepositsPage() {
  return (
    <AcquisitionStub
      step="04"
      title="Deposits (TVL)"
      description="TVL contributed by users who came from the index. The terminal step of the funnel — anonymous visit converted into a real onchain position."
      comingSoon="This step will surface the net TVL movement attributable to index-sourced sessions: deposits in vs withdrawals out, by vault, by chain, by source page. Source of truth: app.harvest.finance + onchain indexer (to be wired up). Once live, the four steps will compose a single end-to-end conversion ratio."
    />
  );
}
