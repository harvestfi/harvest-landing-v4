// Acquisition section layout. Owns the boxed .uni-hub-test shell
// and the funnel sub-nav so all four sub-pages (Traffic, Clicks
// into App, App Net Worth, Deposits) share the same chrome and
// just contribute their own content area.

import "../../_styles/asset-hub.css";
import { AcquisitionFunnelNav } from "@/components/admin/acquisition-funnel-nav";
import { AcquisitionCohortFunnel } from "@/components/admin/acquisition-cohort-funnel";

export const metadata = {
  title: "Acquisition | Admin",
  robots: { index: false, follow: false },
};

export default function AcquisitionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero aq-hero-slim aq-hero-fullwidth">
        <div className="uni-hub-hero-headline">
          <div style={{ width: "100%" }}>
            <h1 className="uni-hub-h1">Acquisition</h1>
            <p className="uni-hub-sub aq-sub-full">
              Command centre for the visitor-to-depositor funnel. Each step
              below tracks one stage of how anonymous traffic on the index
              site converts into actual TVL in the Harvest app.
            </p>
          </div>
        </div>
      </header>

      <AcquisitionCohortFunnel />

      <AcquisitionFunnelNav />

      {children}
    </div>
  );
}
