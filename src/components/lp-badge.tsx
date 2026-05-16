// Inline visual marker that sits next to an LP-pair vault's product
// name in ranking-style contexts (asset ranking tables, market
// benchmarking rows, ecosystem legend, "Other opportunities" cards,
// search results dropdown).
//
// Visual treatment: muted pill with explicit border so the badge
// reads as a deliberate UI element rather than text adjacent to the
// product name. The leading non-breaking space inside the component
// is a safety net: if a more-specific selector somewhere strips
// margin-left from .lp-badge, the literal NBSP still produces a
// visible gap between "Aerodrome" and the badge.

export function LpBadge() {
  return (
    <>
      {" "}
      <span className="lp-badge" aria-label="Liquidity-pair product">
        LP
      </span>
    </>
  );
}
