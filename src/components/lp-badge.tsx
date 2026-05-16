// Inline visual marker that sits next to an LP-pair vault's product
// name in ranking-style contexts (asset ranking tables, market
// benchmarking rows, ecosystem legend, "Other opportunities" cards).
// Several vaults in the index share generic names like "ETH Aerodrome"
// while actually being distinct ETH/X pairs. The badge differentiates
// LP-pair products from single-asset autopilots/autocompounders at a
// glance without disclosing the specific counterpart - the canonical
// "ETH/VVV Aerodrome" name only appears once the user clicks through
// to the single product page.

export function LpBadge() {
  return (
    <span className="lp-badge" aria-label="Liquidity-pair product">
      LP
    </span>
  );
}
