// Acquisition funnel — step 02: Clicks into App.
// Will track outbound clicks from public product pages and asset
// hubs into the Harvest app (app.harvest.finance). Each "View" /
// "Open in Harvest app" / sticky-header CTA click is a conversion
// from passive index visitor to active user. No data hookup yet.

import { AcquisitionStub } from "@/components/admin/acquisition-stub";

export default function ClicksIntoAppPage() {
  return (
    <AcquisitionStub
      step="02"
      title="Clicks into App"
      description="Outbound clicks from the public index into the Harvest app. The conversion step between passive yield browsing and an actual app session."
      comingSoon="This step will track every CTA click that leaves the index for app.harvest.finance — sticky header View, sidebar View Strategy, bottom-of-page Open in Harvest app — grouped by source page, vault, and session, so we can see which product pages drive the most engaged visitors."
    />
  );
}
