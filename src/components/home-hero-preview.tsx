// Decorative preview card on the right half of the homepage hero.
// Reads as a tilted screenshot of a single-product-page hero rising
// from the bottom edge of the gold box: gives a visual cue of what a
// vault page actually looks like, anchors the empty right side of
// the hero, and reinforces the brand without a marketing image.
//
// Pure presentational component, no live data. Numbers and labels
// are static so the mock renders the same on every build.

import { AssetIcon, ChainIcon } from "./token-icons";

// Random-looking but deterministic bar heights so the chart looks
// alive without re-shuffling on every render. Indexed 0..23 to match
// a 1-month daily view.
const BAR_HEIGHTS = [
  62, 71, 58, 84, 76, 90, 88, 95, 82, 78, 70, 92, 86, 81, 74, 88,
  79, 84, 90, 76, 83, 87, 75, 81,
];

export function HomeHeroPreview() {
  return (
    <aside className="uni-home-hero-preview" aria-hidden="true">
      <div className="uni-home-hero-preview-card">
        {/* Title row: icon + product name + byline */}
        <header className="prevcard-head">
          <span className="prevcard-icon">
            <AssetIcon asset="USDC" size={36} />
          </span>
          <div className="prevcard-id">
            <h3 className="prevcard-name">USDC 40 Acres</h3>
            <p className="prevcard-byline">
              <span className="prevcard-byline-chain">
                <ChainIcon chain="Base" size={11} />
                Base
              </span>
              <span aria-hidden="true">·</span>
              <span>Harvest</span>
              <span aria-hidden="true">·</span>
              <span>Morpho</span>
            </p>
          </div>
        </header>

        {/* Big number + sub */}
        <div className="prevcard-bignum">
          <span className="prevcard-bignum-value">12.93%</span>
          <span className="prevcard-bignum-label">24h APY</span>
        </div>

        {/* Mini bar chart */}
        <div className="prevcard-chart" aria-hidden="true">
          {BAR_HEIGHTS.map((h, i) => (
            <span
              key={i}
              className="prevcard-bar"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>

        {/* Tabs row */}
        <div className="prevcard-tabs" aria-hidden="true">
          <span className="prevcard-tab active">TVL</span>
          <span className="prevcard-tab">APY</span>
          <span className="prevcard-tab">Share price</span>
        </div>
      </div>
    </aside>
  );
}
