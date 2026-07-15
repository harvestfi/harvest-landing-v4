// Sponsored placement pinned above the homepage "Top yields" ranking. It
// echoes a ranking row (asset icon + name on the left, headline APY, an action
// on the right) but is visually set apart by an animated rainbow gradient
// border and a "Sponsored" badge. Content is a paid placement, not part of the
// live indexed ranking, so it is hardcoded here rather than sourced from data.

import { AssetIcon } from "@/components/token-icons";

export function SponsoredRow({
  name = "Bitcoin Dollar USDC",
  asset = "USDC",
  apy = 17.55,
  href = "/usdc",
  exploreLabel = "Explore",
}: {
  name?: string;
  asset?: string;
  apy?: number;
  href?: string;
  exploreLabel?: string;
}) {
  return (
    <div className="uni-home-sponsor" aria-label="Sponsored placement">
      <div className="uni-home-sponsor-inner">
        <span className="uni-home-sponsor-badge">Sponsored</span>
        <span className="uni-home-sponsor-main">
          <AssetIcon asset={asset} size={30} />
          <span className="uni-home-sponsor-name">{name}</span>
        </span>
        <span className="uni-home-sponsor-apy">
          <span className="uni-home-sponsor-apy-val">{apy.toFixed(2)}%</span>
          <span className="uni-home-sponsor-apy-lbl">APY</span>
        </span>
        <a className="uni-home-sponsor-cta" href={href}>
          {exploreLabel}
        </a>
      </div>
    </div>
  );
}
