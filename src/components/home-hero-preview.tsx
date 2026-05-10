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
// a 1-month daily view. Last bar gets a noticeable bump so the rate
// reads as "trending up to today".
const BAR_HEIGHTS = [
  62, 71, 58, 84, 76, 90, 88, 95, 82, 78, 70, 92, 86, 81, 74, 88,
  79, 84, 90, 76, 83, 87, 84, 100,
];

export function HomeHeroPreview() {
  return (
    <aside className="uni-home-hero-preview" aria-hidden="true">
      <div className="uni-home-hero-preview-card">
        {/* Floating View CTA in the top-right corner */}
        <span className="prevcard-cta" aria-hidden="true">
          View
          <span className="prevcard-cta-arrow">↗</span>
        </span>

        {/* Title row: icon + product name + byline */}
        <header className="prevcard-head">
          <span className="prevcard-icon">
            <AssetIcon asset="USDC" size={36} />
          </span>
          <div className="prevcard-id">
            <h3 className="prevcard-name">USDC Alpha V2</h3>
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

        {/* Tabs row + chart-style selector */}
        <div className="prevcard-foot" aria-hidden="true">
          <div className="prevcard-tabs">
            <span className="prevcard-tab active">TVL</span>
            <span className="prevcard-tab">APY</span>
            <span className="prevcard-tab">Share price</span>
          </div>
          <div className="prevcard-style">
            {/* Bars (active) */}
            <span className="prevcard-style-btn active" aria-label="Bars">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="7" width="2" height="5" rx="0.5" fill="currentColor" />
                <rect x="6" y="4" width="2" height="8" rx="0.5" fill="currentColor" />
                <rect x="10" y="6" width="2" height="6" rx="0.5" fill="currentColor" />
              </svg>
            </span>
            {/* Line */}
            <span className="prevcard-style-btn" aria-label="Line">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 10 5 6 8 8 12 3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            {/* Step */}
            <span className="prevcard-style-btn" aria-label="Step">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 10 5 10 5 6 8 6 8 8 12 8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
