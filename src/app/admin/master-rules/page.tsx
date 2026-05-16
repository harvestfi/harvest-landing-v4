// Master Rules hub. Points at three standalone handouts - one per
// product type. Each handout is a complete reference another AI can
// read on its own and use to rebuild the corresponding product page
// from scratch; they overlap in the universal copy rules + section
// architecture, but the per-section templates (About, FAQ, byline,
// strategy details) diverge enough that splitting them into focused
// documents reads better than one giant umbrella page.

import Link from "next/link";

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
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Master Rules
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          Self-contained reference documents for rebuilding each
          single-product-page variant from scratch. Hand any one of these to a
          fresh AI and they can recreate the corresponding page with full
          editorial fidelity. The universal copy rules + render order are
          repeated in each handout on purpose - the goal is that one document
          stands alone.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          Word-level rules are enforced automatically by{" "}
          <code className="rounded bg-gray-100 px-1 font-mono text-xs">
            scripts/check-banned-words.mjs
          </code>{" "}
          on every build. Everything else is editorial discipline.
        </p>
      </header>

      <section className="space-y-4">
        {HANDOUTS.map((h) => (
          <Link
            key={h.slug}
            href={`/admin/master-rules/${h.slug}`}
            className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <h2 className="text-base font-semibold text-gray-900">
              {h.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {h.blurb}
            </p>
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="font-semibold text-gray-500">Discriminator</dt>
                <dd className="font-mono text-gray-700">{h.discriminator}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-gray-500">Examples</dt>
                <dd className="text-gray-700">{h.examples}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </section>

      <footer className="mt-10 rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
        <p className="font-semibold text-gray-800">When to update which handout</p>
        <p className="mt-2">
          A patch that changes a section that&apos;s identical across product
          types (the page architecture, the banned-word list, the render order)
          must update <strong>all three</strong> handouts. A patch that changes
          a per-variant template (About P1, FAQ Q4, byline chip rules) only
          updates the affected handout. Keep this rule load-bearing - the
          whole point of these documents is that each one stays accurate.
        </p>
      </footer>
    </main>
  );
}
