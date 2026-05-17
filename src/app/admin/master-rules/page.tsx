// Master Rules hub. Points at three standalone handouts - one per
// product type. Each handout is a complete reference another AI can
// read on its own and use to rebuild the corresponding product page
// from scratch; they overlap in the universal copy rules + section
// architecture, but the per-section templates diverge enough that
// splitting them into focused documents reads better than one giant
// umbrella page.

import Link from "next/link";
import "../../_styles/asset-hub.css";

export const metadata = {
  title: "Master Rules | Admin",
  robots: { index: false, follow: false },
};

const HANDOUTS = [
  {
    slug: "autocompounder",
    title: "Single-asset Autocompounder",
    blurb:
      "Vaults where the underlying is a single token (USDC, ETH, BTC, etc.) compounded via an autocompounder strategy. The single-asset About + FAQ + byline templates live here; LP-pair variants get their own handout.",
    discriminator: "vaultType === \"Autocompounder\" && underlyingLogos.length <= 1",
    examples: "USDC Morpho Clearstar Core V2, ETH Euler, USDC MORPHO Gauntlet Frontier V2",
  },
  {
    slug: "autopilot",
    title: "Autopilot",
    blurb:
      "Multi-protocol rebalancing vaults powered by the IPOR Labs engine. Distinct About template (engine + reallocation language), distinct FAQ (Q2 explains rebalancing, Q4 lists underlying protocols), suppressed Strategy details Strategy-row, condensed byline.",
    discriminator: "vaultType === \"Autopilot\"",
    examples: "USDC Autopilot, WETH Autopilot, USDC Autopilot Arbitrum",
  },
  {
    slug: "lp-pair",
    title: "LP-pair Autocompounder (incl. OnlyBoost)",
    blurb:
      "Vaults whose underlying is an LP token (two-asset pair). Canonical name expansion ETH/COUNTERPART PLATFORM, LP-token About template, dual-source yield FAQ (Q4), impermanent loss FAQ (Q7), [LP] badge in rankings, platform chip dropped from byline. OnlyBoost is the documented exception that keeps its database productName.",
    discriminator:
      "vaultType === \"Autocompounder\" && underlyingLogos.length > 1",
    examples: "ETH/VVV Aerodrome, ETH OnlyBoost (Stake DAO), cbBTC/VIRTUAL Aerodrome",
  },
] as const;

export default function MasterRulesHubPage() {
  return (
    <div className="uni-hub-test">
      <header className="uni-hub-hero">
        <div className="uni-hub-hero-headline">
          <div>
            <h1 className="uni-hub-h1">Master Rules</h1>
            <p className="uni-hub-sub">
              Self-contained reference documents for rebuilding each
              single-product-page variant from scratch. Hand any one of these
              to a fresh AI and they can recreate the corresponding page with
              full editorial fidelity. Word-level rules are enforced
              automatically by{" "}
              <code className="rules-code">scripts/check-banned-words.mjs</code>{" "}
              on every build; everything else is editorial discipline.
            </p>
          </div>
        </div>

        <div
          className="uni-hub-stats"
          role="group"
          aria-label="Handouts summary"
          style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
        >
          <Stat label="Handouts" value="3" />
          <Stat label="Product variants" value="3" />
          <Stat label="Render order" value="Universal" mono={false} />
        </div>
      </header>

      <section className="uni-hub-section" style={{ marginTop: 0 }}>
        <header className="uni-hub-section-head">
          <h2 className="uni-hub-section-title">Handouts</h2>
          <span className="uni-hub-section-meta">one document per product type</span>
        </header>
        <div className="rules-cards">
          {HANDOUTS.map((h) => (
            <Link
              key={h.slug}
              href={`/admin/master-rules/${h.slug}`}
              className="rules-card"
            >
              <div className="rules-card-head">
                <h3 className="rules-card-title">{h.title}</h3>
                <span className="rules-card-arrow" aria-hidden="true">→</span>
              </div>
              <p className="rules-card-blurb">{h.blurb}</p>
              <dl className="rules-card-meta">
                <div className="rules-meta-row">
                  <dt>Discriminator</dt>
                  <dd className="mono">{h.discriminator}</dd>
                </div>
                <div className="rules-meta-row">
                  <dt>Examples</dt>
                  <dd>{h.examples}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      </section>

      <section className="uni-hub-section">
        <div className="rules-note">
          <p className="rules-note-title">When to update which handout</p>
          <p className="rules-note-body">
            A patch that changes a section that&apos;s identical across product
            types (the page architecture, the banned-word list, the render
            order) must update <strong>all three</strong> handouts. A patch
            that changes a per-variant template (About P1, FAQ Q4, byline
            chip rules) only updates the affected handout. Keep this rule
            load-bearing - the whole point of these documents is that each
            one stays accurate.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="uni-hub-stat">
      <div className="uni-hub-stat-label">{label}</div>
      <div
        className="uni-hub-stat-value"
        style={mono ? undefined : { fontSize: 15, fontWeight: 500 }}
      >
        {value}
      </div>
    </div>
  );
}
