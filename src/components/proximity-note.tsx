// Per-section "this is historical indexer data, not a forecast" anchor.
// Sits directly under the dynamic dollar-figure blocks (Performance
// Overview, Yield trajectory) so the observational framing is local to
// where the numbers are, reinforcing the page-level footnote. Muted
// micro-copy: a single tertiary-ink line, no box or icon, so it reads as
// an orientation note for human raters / semantic scrapers rather than a
// compliance banner (over-hedging reads as anxious and hurts E-E-A-T).
export function ProximityNote() {
  return (
    <p className="pp-proximity-note">
      Historical indexer data. Past onchain performance is not a predictive
      forecast.
    </p>
  );
}
