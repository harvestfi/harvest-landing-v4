// Master Rules: Autopilot product page. Self-contained handout for
// any AI tasked with rebuilding the single-product page for a vault
// where vaultType === "Autopilot". Includes the universal copy rules
// and section architecture (repeated from sibling handouts on purpose
// so this document stands alone).

import Link from "next/link";
import {
  Section,
  CodeBlock,
  SourceLink,
  TableOfContents,
} from "../_components";

const TOC_ITEMS = [
  ["variant", "1. Variant decision (Autopilot only)"],
  ["architecture", "2. Page architecture (render order)"],
  ["copy", "3. Universal copy rules"],
  ["title", "4. Title row and byline"],
  ["about", "5. About section"],
  ["performance", "6. Performance Overview"],
  ["benchmark", "7. Market benchmarking"],
  ["ecosystem", "8. Ecosystem context"],
  ["yield-traj", "9. Yield trajectory"],
  ["stability", "10. Strategy stability"],
  ["long-term", "11. Long-term performance"],
  ["hist-stats", "12. Historical statistics"],
  ["hist-data", "13. Historical Data table"],
  ["details", "14. Strategy details"],
  ["faq", "15. FAQ"],
  ["similar", "16. Other opportunities"],
  ["footnote", "17. Page footnote"],
  ["seo", "18. SEO and JSON-LD"],
  ["conditionals", "19. Conditional-rendering matrix"],
  ["files", "20. Implementation file map"],
  ["verify", "21. Verification checklist"],
] as const;

export const metadata = {
  title: "Master Rules: Autopilot Product Page | Admin",
  robots: { index: false, follow: false },
};

export default function MasterRulesAutopilotPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Master Rules: Autopilot Product Page
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          A handout for any AI or developer tasked with recreating the
          single-product page for an Autopilot vault. Autopilots are
          multi-protocol rebalancing vaults powered by the IPOR Labs engine -
          they have their own About template, FAQ, and byline rules distinct
          from Autocompounder vaults. See{" "}
          <Link className="underline" href="/control-room/master-rules/autocompounder">
            the Autocompounder handout
          </Link>{" "}
          for the single-asset variant and{" "}
          <Link className="underline" href="/control-room/master-rules/lp-pair">
            the LP-pair handout
          </Link>{" "}
          for LP-token Autocompounders.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          Word-level rules are enforced automatically by the post-build linter
          at <code className="rounded bg-gray-100 px-1 font-mono text-xs">scripts/check-banned-words.mjs</code>;
          everything else is editorial discipline. Repeated content (universal
          rules, render order) is duplicated across handouts so this page
          stands alone.
        </p>
      </header>

      <TableOfContents items={TOC_ITEMS} />

      <Section id="variant" title="1. Variant decision (Autopilot only)">
        <p>
          Autopilot is a flat product type with no sub-variants. The
          discriminator is <code className="font-mono text-xs">vault.vaultType === &quot;Autopilot&quot;</code>.
          Database <code className="font-mono text-xs">productName</code> is
          used as-is for the H1, breadcrumb, About intro, FAQ Q1, and every
          ranking-style render site. There is no canonical-name expansion
          (that mechanism belongs to LP-pair products).
        </p>
        <p className="mt-3">
          Per-vault hand-tuned protocol phrasing (the &quot;Aave, Morpho,
          Euler and Fluid markets, among others&quot; insert) is keyed by
          contract address in{" "}
          <code className="font-mono text-xs">PROTOCOL_INSERT_BY_ADDRESS</code>.
          When an Autopilot lands without an entry there, the fallback string{" "}
          <code className="font-mono text-xs">&quot;lending and yield venues&quot;</code>{" "}
          is used. New Autopilot vaults must add an entry to keep the FAQ
          accurate.
        </p>
        <SourceLink path="src/lib/autopilot-about.ts" symbol="PROTOCOL_INSERT_BY_ADDRESS + protocolInsertFor" />
      </Section>

      <Section id="architecture" title="2. Page architecture (render order)">
        <p>
          Sections render top to bottom in this exact order. Several are
          conditionally suppressed; see Section 19 for the full matrix.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-6">
          <li>Sticky header (asset · name · APY · TVL · CTA)</li>
          <li>Breadcrumb (Home › {`{Asset}`} Ranking › {`{Product name}`})</li>
          <li>Title row (asset icon · H1 · short address · byline chips)</li>
          <li>Detail grid (chart left, sidebar stats right)</li>
          <li>Jump nav</li>
          <li>About section (3 paragraphs)</li>
          <li>Performance Overview (numbered fact list, 1-4 lines)</li>
          <li>Market benchmarking (stats grid + ranking table + closing)</li>
          <li>Ecosystem context (intro + chart + legend + closing)</li>
          <li>Yield trajectory (numbered fact list, 1-4 lines)</li>
          <li>Strategy stability (score gauge + stats grid)</li>
          <li>Long-term performance (1-3 bullets) - suppressed if tracked_days &lt; 30</li>
          <li>Historical statistics (APY + TVL paragraphs + stats tables)</li>
          <li>Historical Data (paginated daily table)</li>
          <li>Strategy details - <strong>no Strategy row</strong> for Autopilot</li>
          <li>FAQ (7 questions)</li>
          <li>Other opportunities (cross-sell cards)</li>
          <li>Bottom links (block explorer + Harvest app)</li>
          <li>Page footnote (last updated + disclosure)</li>
        </ol>
        <SourceLink path="src/components/product-page-body.tsx" symbol="ProductPageBody" />
      </Section>

      <Section id="copy" title="3. Universal copy rules">
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Banned words
        </h3>
        <p>
          The linter blocks the build on any of the following in product-page
          prose. Single source of truth in{" "}
          <code className="font-mono text-xs">scripts/check-banned-words.mjs</code>.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Banned</th>
              <th className="py-2 pr-4">Use instead</th>
              <th className="py-2">Exception</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-2 pr-4 font-mono text-xs">returns / return (noun)</td><td className="py-2 pr-4">yield, gain, income stream</td><td className="py-2 text-xs text-gray-500">verb usage like &quot;liquidity returns&quot; allowlisted</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">deposit / deposits (noun + verb)</td><td className="py-2 pr-4">position, holdings, supply</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">deposited</td><td className="py-2 pr-4">supplied at launch</td><td className="py-2 text-xs text-gray-500">allowed inside <code>&lt;section id=&quot;yield-trajectory&quot;&gt;</code></td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">depositor / depositors</td><td className="py-2 pr-4">holders</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">invest / investment / investor</td><td className="py-2 pr-4">supply, position, holder</td><td className="py-2 text-xs text-gray-500">legal pages only</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">capital</td><td className="py-2 pr-4">TVL, holdings, pool size</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">outperform / outperforming</td><td className="py-2 pr-4">use neutral comparative phrasing</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">competes against / goes up against</td><td className="py-2 pr-4">drop the phrase</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">Harvest Finance (in prose)</td><td className="py-2 pr-4">Harvest</td><td className="py-2 text-xs text-gray-500">legal pages + copyright</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">recovered (TVL/drawdown context)</td><td className="py-2 pr-4">drop; state numbers neutrally</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">minimal / negligible / nominal returns</td><td className="py-2 pr-4">render a quantitative gain</td><td className="py-2 text-xs text-gray-500">none (placeholder ban)</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">upward/downward trend</td><td className="py-2 pr-4">state endpoints + delta neutrally</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">well above / far higher / notably ahead</td><td className="py-2 pr-4">drop the intensifier</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">your funds / your capital / your earnings</td><td className="py-2 pr-4">use neutral framing</td><td className="py-2 text-xs text-gray-500">none</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">— (em dash, U+2014)</td><td className="py-2 pr-4">comma, period, colon, or &quot; - &quot;</td><td className="py-2 text-xs text-gray-500">none</td></tr>
          </tbody>
        </table>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Coverage-claim scope
        </h3>
        <p>
          Any sentence comparing this product to a population (rankings,
          market averages, &quot;the ecosystem&quot;) must signal that the
          population is <em>what we track</em>, not the whole market. Signal
          scope once per section. Acceptable phrasings:{" "}
          <em>we monitor, we follow, we currently track, in our index, the
          cohort, in that set</em>.
        </p>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Tone
        </h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>Neutral, factual, numerate. No promotional intensifiers.</li>
          <li>Past-performance language allowed only when factual; never as forecast.</li>
          <li>
            FAQ Q1 always closes with &quot;The figures reflect the realised
            yield over the trailing window; they are not a forward guarantee.&quot;
          </li>
        </ul>
        <SourceLink path="scripts/check-banned-words.mjs" />
        <SourceLink path="AGENTS.md" />
      </Section>

      <Section id="title" title="4. Title row and byline">
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          H1
        </h3>
        <p>
          Database <code className="font-mono text-xs">vault.productName</code>
          {" "}as-is (e.g. <code>USDC Autopilot</code>,{" "}
          <code>WETH Autopilot</code>). No canonical-name expansion. The same
          string flows through the breadcrumb&apos;s last crumb, the sticky
          header, the About heading, and the About intro (paragraph 1 starts
          with{" "}
          <code className="font-mono text-xs">&lt;strong&gt;{`{productName}`}&lt;/strong&gt;</code>).
        </p>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Byline chip pattern
        </h3>
        <p>
          The byline strip under the H1 follows the Autopilot-specific
          pattern. <strong>No platform chip</strong> - the platform
          (<code className="font-mono text-xs">stripChainSuffix(vault.category, vault.chain)</code>)
          collapses to <code>&quot;Autopilot&quot;</code> for these vaults,
          which would sit redundantly next to the Type chip.
        </p>
        <CodeBlock>{`{Network} · Harvest · Autopilot`}</CodeBlock>
        <p className="mt-3">
          Concretely:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Network chip: linked to <code className="font-mono text-xs">/{`{network-slug}`}</code>, renders chain icon + display name.</li>
          <li>
            Operator chip: trimmed brand (
            <code className="font-mono text-xs">
              vault.protocol.name.replace(/\s*Finance\s*$/i, &quot;&quot;)
            </code>
            ) → always &quot;Harvest&quot;, never &quot;Harvest Finance&quot;.
          </li>
          <li>Type chip: <code className="font-mono text-xs">vault.vaultType</code> → &quot;Autopilot&quot;.</li>
        </ul>
        <SourceLink path="src/components/product-page-body.tsx" symbol="byline render block" />
      </Section>

      <Section id="about" title="5. About section">
        <p>
          Three paragraphs. Variable substitution only - do not paraphrase.
          Paragraph 1 introduces the positioning + yield sources, paragraph 2
          is a constant string about the IPOR optimisation engine, paragraph 3
          surfaces live stats.
        </p>
        <CodeBlock>{`P1: {PRODUCT_NAME} is a high-frequency rebalancing vault on {NETWORK}
    with {TICKER} as its underlying token, in which the yield is distributed.
    It sources yield from across several {PROTOCOL_INSERT} and actively
    reallocates liquidity to the best-performing sources, keeping users
    positioned to the optimal yield available at any given time.

P2 (constant - do not paraphrase):
    Allocations are handled by an optimisation engine powered by IPOR Labs
    AG and executed transparently onchain, within predefined boundaries.
    The engine rebalances between sub-vaults based on sustained rate trends,
    gas costs, and liquidity depth, and ignores short rate spikes when
    chasing them would cost more than it earns.

P3: Live since {INCEPTION_DATE}. Currently indexed at {TVL} TVL[ across
    {HOLDERS} holder(s)], with a {APY_24H} 24-hour APY and {APY_30D}
    across the trailing 30 days.`}</CodeBlock>

        <p className="mt-3">
          <strong>Critical:</strong> the phrasing in P1 reads{" "}
          <code>&quot;the optimal yield&quot;</code>, not{" "}
          <code>&quot;the most optimal yield&quot;</code> -{" "}
          <em>most optimal</em> is grammatically redundant (optimal is already
          a superlative).
        </p>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          PROTOCOL_INSERT lookup
        </h3>
        <p>
          Hand-tuned per address in{" "}
          <code className="font-mono text-xs">PROTOCOL_INSERT_BY_ADDRESS</code>.
          Closes with <code>&quot;, among others&quot;</code> unless the vault
          is locked to a single venue. Fallback string when no entry exists:{" "}
          <code className="font-mono text-xs">&quot;lending and yield venues&quot;</code>.
          Adding a new Autopilot vault to the index requires adding an entry.
        </p>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Paragraph 3 holder-count branches
        </h3>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">HOLDERS value</th>
              <th className="py-2">Rendered fragment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-2 pr-4 font-mono text-xs">0 / null / undefined</td><td className="py-2">skip the fragment entirely</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">1</td><td className="py-2 font-mono text-xs">across 1 holder</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">&gt; 1</td><td className="py-2 font-mono text-xs">across {`{HOLDERS}`} holders</td></tr>
          </tbody>
        </table>
        <SourceLink path="src/lib/autopilot-about.ts" symbol="buildAutopilotAbout" />
      </Section>

      <Section id="performance" title="6. Performance Overview (4 numbered lines)">
        <p>
          Identical algorithm to Autocompounders - the section is shared. Each
          line renders only when its data conditions hold.
        </p>
        <CodeBlock>{`Line 01 (asset-cohort rank, three rank-ratio variants):
  ratio <= 0.25 → "This vault's {APY} APY ranks #{R} among the {N} {TICKER}
    vaults we monitor, placing it in the top quarter of the cohort."
  ratio > 0.25 → "This vault's {APY} APY ranks #{R} among the {N} {TICKER}
    vaults we monitor, with {ABOVE} strategy/strategies currently delivering
    higher APY."

Line 02 (30d APY range + monthly earnings, render if trailing.length >= 2):
  ref = depositRef(vault.asset)
    stable assets (USDC/USDT/DAI/...): { amount: 1000, label: "$1,000" }
    non-stable (ETH/BTC):              { amount: 1,    label: "1 ETH" / "1 BTC" }
  earnHigh = apyToMonthly(hi, ref.amount)
  earnLow  = apyToMonthly(lo, ref.amount)
  "Over the past 30 days, APY has ranged from {LO} to {HI}, averaging {AVG}.
   At the {HI} high, {ref.label} would earn {fmtEarnings(earnHigh, asset)}
   per month; at the {LO} low, {fmtEarnings(earnLow, asset)}."
  Translates to "$1,000 would earn ~$15" for stable, "1 ETH would earn
  ~0.05 ETH" for non-stable. Never assume flat asset price for non-stable
  vaults - the USD conversion would require a price feed we don't have.

Line 03 (current vs lifetime avg, render if lifetime.length >= 5):
  "Current APY of {APY} is below|above|roughly in line with this vault's
   lifetime average of {AVG}." (±0.5pp threshold for "roughly in line")

Line 04 (TVL 30d change, render if tvlSorted >= 2 and past >= 7d old):
  Both endpoints below $50K  → suppress percentage:
    "TVL stands at {CURRENT}, compared to {PAST} 30 days ago."
  Otherwise → render percentage:
    "TVL has {increased|decreased} {PCT}% over the past 30 days, from
     {PAST} to {CURRENT}."`}</CodeBlock>
        <p className="mt-3">
          The TVL threshold check is <code>AND</code>, not <code>OR</code>:
          suppression triggers only when <strong>both</strong> endpoints are
          below $50K. The previous OR-gate hid real trends like $86K → $36K
          as if they were noise.
        </p>
        <SourceLink path="src/lib/autopilot-sections.ts" symbol="buildPerformanceOverview" />
      </Section>

      <Section id="benchmark" title="7. Market benchmarking">
        <p>
          Stats grid (4 metrics), ranking table (layout algorithm below), then
          one closing-summary paragraph. The prior duplicate intro paragraph
          was removed.
        </p>
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Ranking table layout algorithm
        </h3>
        <CodeBlock>{`Case A (current rank 1-5): show ranks 1..5 (or whole cohort if smaller)
  as a contiguous block. No separator.

Case B (current rank 6+): anchors = {1, 2, 3, rank-1, rank, rank+1, total}
  Walk anchors in order. Insert a slim "..." separator row only when the
  gap between anchors is > 1. When the gap is exactly 1, fill the missing
  row so adjacent visible rows stay contiguous.

Separator row: collapsed single-cell <span class="bt-row-sep-glyph">…</span>
  Flex-centred across full table width. Tighter vertical padding (8px),
  muted glyph color.`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Closing summary template
        </h3>
        <CodeBlock>{`ref = depositRef(vault.asset)
monthlyDelta = |apyToMonthly(vault.apy24h - avgApy, ref.amount)|
deltaPhrase  = fmtEarnings(monthlyDelta, vault.asset)

"Among the {N} {ASSET} strategies we currently monitor, this product ranks
 #{R}. Its {APY} yield runs {ABS_DELTA}% {higher|lower} than the cohort
 average of {AVG}. On a {ref.label} position, that's {deltaPhrase} per month
 {higher|lower} than the cohort average. {APY_SUMMARY_PHRASE} It currently
 holds {TVL} in TVL, ranking #{TVL_RANK} of {N} by TVL."

Stable: "On a $1,000 position, that's ~$15 per month higher..."
Non-stable: "On a 1 ETH position, that's ~0.05 ETH per month higher..."
Never translate non-stable yield to USD here.

APY_SUMMARY_PHRASE (three variants by rank/total ratio):
  <= 0.25  → "This product sits in the top quarter of the cohort by APY."
  0.25-0.75 → "{ABOVE} strategy/strategies in the cohort are currently
              delivering higher APY; {BELOW} are delivering lower."
  > 0.75    → "{ABOVE} strategy/strategies in the cohort are currently
              delivering higher APY."`}</CodeBlock>
        <p className="mt-3">
          Other rows in the table use{" "}
          <code className="font-mono text-xs">getCanonicalDisplayName(other)</code>
          {" "}+ <code>&lt;LpBadge /&gt;</code> when applicable - same as every
          other ranking view. Autopilot rows render as their bare productName
          (no LP badge, no canonical expansion).
        </p>
        <SourceLink path="src/components/market-sections.tsx" symbol="MarketBenchmark" />
      </Section>

      <Section id="ecosystem" title="8. Ecosystem context">
        <CodeBlock>{`Intro:
  "On {NETWORK}, this product's yield runs {ABS_VS_NET_AVG}% {higher|lower}
   than the network average across the {ASSET} strategies we monitor. By APY
   it ranks #{R} of {N} in that set. Yields on {NETWORK} for {ASSET} have
   averaged {NET_AVG}% in our index."

Chart: top 10 strategies on the same chain, bar-coloured per-vault,
  network average baseline. Legend: top 6 with rank, canonical name, APY.

Closer:
  isTop (rank == 1):
    "Currently the top-yielding {ASSET} opportunity on {NETWORK} across the
     {N} products we monitor."
  not top:
    "By TVL, this product ranks #{TVL_R} of {N} {ASSET} strategies on
     {NETWORK} in our index."

NO trailing "This strategy is operated by X and competes against N other..."
sentence. The previous closer was removed because operator attribution is a
no-op fact and "competes against" is blacklisted phrasing.`}</CodeBlock>
        <SourceLink path="src/components/market-sections.tsx" symbol="EcosystemContext" />
      </Section>

      <Section id="yield-traj" title="9. Yield trajectory">
        <p>
          Numbered fact list. Backward-looking $1,000-supplied values. This
          is the <strong>only</strong> section where the word{" "}
          <code className="font-mono text-xs">deposited</code> is allowed -
          the linter exempts it inside{" "}
          <code className="font-mono text-xs">&lt;section id=&quot;yield-trajectory&quot;&gt;</code>.
        </p>
        <CodeBlock>{`Render condition: sharePriceHistory.length >= 2.
ageDays = (sp[last].timestamp - sp[0].timestamp) / 86400 (this is
  tracked_days, not on-chain inception age).

stable = isStable(vault.asset.toUpperCase())   ← USDC/USDT/DAI/PYUSD/etc.

If ageDays >= 30:
  stable:
    "$1,000 deposited 30 days ago would now be worth ~\${USD30}, a
     {gain|loss} of ~\${ABS_DELTA} over that period."
  non-stable (single line, no USD line):
    "1 {TICKER} deposited 30 days ago would now be ~{RATIO} {TICKER}."

Always (ageDays >= 1):
  stable:
    "$1,000 deposited at launch ({ageDays} days ago) would now be worth
     ~\${USD_INC}, a {gain|loss} of ~\${ABS_INC_DELTA}."
  non-stable (single line, no USD line):
    "1 {TICKER} deposited at launch ({ageDays} days ago) would now be
     ~{RATIO_INC} {TICKER}."

NEVER emit a "\$1,000 deposited" line for non-stable assets. Translating
share-price growth in {TICKER} to USD requires a historical price feed
we don't have; the underlying-units line carries the same information
truthfully.`}</CodeBlock>
        <SourceLink path="src/lib/autopilot-sections.ts" symbol="buildYieldTrajectory" />
      </Section>

      <Section id="stability" title="10. Strategy stability">
        <p>
          Score 0-100 derived from coefficient-of-variation (CV) of the last
          30 days of APY readings. Label maps deterministically from score
          per the 5-zone editorial mapping.
        </p>
        <CodeBlock>{`Score formula (CV-ramp piecewise):
  cv < 0.1         → 100 - (cv/0.1) * 10            (90-100)
  0.1 <= cv < 0.2  → 89 - ((cv-0.1)/0.1) * 19       (70-89)
  0.2 <= cv < 0.4  → 69 - ((cv-0.2)/0.2) * 29       (40-69)
  0.4 <= cv        → 39 - ((min(cv,1.0)-0.4)/0.6) * 39   (0-39)

Label from score:
  >= 80 → Very consistent
  >= 60 → Consistent
  >= 40 → Moderately variable
  >= 20 → Highly variable
  <  20 → Very volatile

Fresh-vault suppression:
  if tracked_days < 30 AND readings_indexed < 14:
    Render the stats grid (Mean APY, Volatility, 30-day range, Yield Output)
    but REPLACE the score/meter/label block with:
    "Score not available - insufficient data (less than 14 daily readings
     indexed within the first 30 days of tracking)."

Both conditions must hold (AND, not OR) - established vaults with sparse
30-day snapshots keep the score.`}</CodeBlock>
        <SourceLink path="src/components/vault-stability-card.tsx" symbol="computeStability + VaultStabilityCard" />
      </Section>

      <Section id="long-term" title="11. Long-term performance">
        <p>
          Three potential bullets. Section returns <code>null</code> when{" "}
          <code className="font-mono text-xs">tracked_days &lt; 30</code> -
          too little history to make CAGR, peak/trough, or best/worst month
          informative.
        </p>
        <CodeBlock>{`Bullet 1 (share-price CAGR, render if daySpan >= 30):
  "Share price has compounded at an annualized rate of {CAGR}% over {DAYS}
   days, growing from {FIRST} to {LAST}."
  If daySpan >= 90, append:
    loss case (last < 1.0):
      "This represents a loss of ~{LOSS} {TICKER} per 1 {TICKER} supplied at
       launch."
    gain case:
      "This represents a gain of ~{GAIN} {TICKER} per 1 {TICKER} supplied at
       launch."
  NEVER render "minimal returns" - always quantitative gain in underlying
  units.

Bullet 2 (TVL story, render if tvlHistory >= 10 AND maxDrawdownPct >= 15):
  at-peak (current >= 0.9 * peak):
    daysAtPeak = days since first crossing of 0.8 * peak in upward direction
    if daysAtPeak >= 1:
      "TVL currently sits at {CURRENT}, at or near its historical peak. The
       vault has held this scale for the past {daysAtPeak} days."
    else:
      "TVL currently sits at {CURRENT}, at or near its historical peak."

  past-peak: use formatDrawdownPct(pct, trough):
    troughValue <= 0  → "100"
    pct >= 95         → "99"
    else              → Math.round(pct)
    "TVL experienced a {PCT}% drawdown from its {PEAK} peak, bottoming at
     {TROUGH} over {DAYS_DOWN} days. It currently stands at {CURRENT},
     {PCT_VS_PEAK}% of the peak value."
  No trailing "TVL had bottomed by..." sentence.

Bullet 3 (best/worst month, render if apyHistory >= 60 AND >= 3 distinct
  months with >= 5 readings each):
  "Best performing month was {BEST_MONTH} at {BEST_AVG}% average APY;
   weakest was {WORST_MONTH} at {WORST_AVG}%."
  If totalDays >= 90 AND spread >= 5pp, append:
    "The spread between best and worst months represents \${EARN} per $1,000
     per month."`}</CodeBlock>
        <SourceLink path="src/components/historical-narrative.tsx" symbol="HistoricalNarrative" />
      </Section>

      <Section id="hist-stats" title="12. Historical statistics">
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          APY narrative paragraph (three modes)
        </h3>
        <CodeBlock>{`apy_tracked_days = (latest - earliest) / 86400  (over lifetime APY)

if apy_tracked_days < 7:
  "Tracked for {N} day(s). APY data is still accumulating; the first
   meaningful summary requires at least a week of readings."

elif apyStats.dataPoints >= 60 AND |changePct| > 10:
  earlyAvg = avg of first quarter; lateAvg = avg of last quarter
  "Over the past {dataPoints} days, this vault's APY has moved from
   {earlyAvg}% to {lateAvg}%, a {ABS_CHANGE}% {increase|decrease}. At the
   start of the window, {REF} would have earned {EARLY_EARN}/mo at then-
   current rates; at recent rates, {LATE_EARN}/mo."
  (Second sentence renders unconditionally - no $1/mo gate.)

else: no APY narrative (table renders alone).`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          TVL narrative paragraph (decoupled from 30d window)
        </h3>
        <CodeBlock>{`sorted = tvlHistory.filter(p.value > 0).sort by ts
if sorted.length >= 2:
  first = sorted[0].value; last = sorted[last].value
  peak  = max-value entry; days = (last_ts - first_ts) / 86400

  if sorted.length >= 10 AND last >= 0.8 * peak.value:
    Narrative A:
      "Total value locked currently sits at {LAST}, up from {FIRST} at the
       start of tracking. The vault has been live for {DAYS} days."

  elif sorted.length >= 10:
    Narrative B (past-peak):
      "Total value locked currently sits at {LAST}, which is {PCT}% of its
       all-time peak of {PEAK} reached on {PEAK_DATE}."
      (Drop the date clause if peak.timestamp is missing/unparseable.)

  else:
    Fallback:
      "Total value locked currently sits at {LAST}. The vault has been live
       for {DAYS} days."

CRITICAL: do NOT gate this block on tvlStats. Vaults with stale (>30d old)
latest snapshots still need the lifetime narrative.`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Stats tables (rendered after narratives)
        </h3>
        <p>
          Two side-by-side blocks (APY and TVL) when both have data; either
          one splits into two columns when alone. Each row carries a{" "}
          <code className="font-mono text-xs">data-tooltip</code> attribute
          with the metric definition.
        </p>
        <SourceLink path="src/components/historical-stats.tsx" symbol="HistoricalStats" />
      </Section>

      <Section id="hist-data" title="13. Historical Data table">
        <CodeBlock>{`Dedupe: one row per UTC calendar day. For each UTC date, keep the snapshot
with the latest timestamp (end-of-day reading). Applied to all three tabs
(APY, TVL, Share Price).

Date display: locale "en-US" formatted with timeZone: "UTC". This MUST match
the dedupe key. Local-time display caused phantom duplicate rows (adjacent
UTC days collapsing to same local date in non-UTC timezones).

Lifetime summary (top right of section):
  Lifetime avg | High | Low | Data points

Formatters: render real zeros as 0.00% / $0 / 0.0000. Dash placeholder fires
only for non-finite values (NaN, Infinity, undefined).

Pagination: ROWS_PER_PAGE constant, against the deduped row count.`}</CodeBlock>
        <SourceLink path="src/components/vault-history-table.tsx" symbol="VaultHistoryTable + dedupeLatestPerDay" />
      </Section>

      <Section id="details" title="14. Strategy details (structured data)">
        <p>
          Two-column grid of label/value rows.{" "}
          <strong>The Strategy row is hidden for Autopilot.</strong> For
          Autopilot vaults the platform string from{" "}
          <code className="font-mono text-xs">stripChainSuffix(category, chain)</code>
          {" "}collapses to <code>&quot;Autopilot&quot;</code> which would
          duplicate the Type row. Single-asset autocompounders and LP-pair
          variants keep the Strategy row.
        </p>
        <CodeBlock>{`Rendered rows (Autopilot):
  Network:   {chain} link to network hub
  Type:      Autopilot
  Underlying: {asset}
  Rewards:   {reward tokens comma-separated, only if non-empty}
  Operator:  {operatorBrand}   (trimmed: "Harvest", never "Harvest Finance")
  Tracked for: {trackedDays} days
  Holders:   {holderCount} (if non-null)
  Vault contract: {address} + copy + explorer link (full-width row)
  Strategy contract: same (if vault.strategyAddress)
  Underlying token:  same (if vault.tokenAddress)

NO "Strategy: Autopilot" row.`}</CodeBlock>
        <SourceLink path="src/components/product-page-body.tsx" symbol="Strategy details block (vaultType !== 'Autopilot' gate)" />
      </Section>

      <Section id="faq" title="15. FAQ (7 questions)">
        <p>
          Each FAQ item has <code className="font-mono text-xs">question</code>,
          {" "}<code className="font-mono text-xs">answer</code> (ReactNode for
          rendering), and <code className="font-mono text-xs">answerText</code>
          {" "}(plain string for JSON-LD <code>FAQPage</code> schema). Schema
          and rendered text must match - Google flags inconsistency.
        </p>
        <CodeBlock>{`Q1: What's the current APY for {PRODUCT_NAME}?
    "...is showing a 24-hour APY of {APY_24H}, with a 30-day average of
     {APY_30D}. Rates are variable and move with market conditions, liquidity,
     and the underlying protocols' incentives. The figures reflect the
     realised yield over the trailing window; they are not a forward guarantee."

Q2: How does the Autopilot rebalance allocations?
    "The strategy uses an optimisation engine built by IPOR Labs AG that
     reallocates between sub-vaults multiple times a day. Allocation
     decisions factor in sustained rate trends, gas costs, and liquidity
     depth. Short-lived rate spikes are deliberately ignored when chasing
     them would cost more than they earn. Reallocations happen onchain
     within predefined boundaries."

Q3: Can I withdraw at any time?  → link to /risk-framework
    "There are no withdrawal periods or lockups. If the underlying strategy
     holds enough liquidity to satisfy the request, exits are instant. During
     periods of liquidity stress in the underlying sub-vaults, withdrawal
     capacity can be limited until liquidity returns. See the risk page for
     details on how this works."

Q4: Where does the yield come from?
    "The Autopilot sources yield from across several {PROTOCOL_INSERT}. The
     income stream is a combination of lending interest paid by borrowers in
     those markets and protocol-level reward emissions where applicable. The
     mix shifts over time as the engine rebalances to the best-performing
     sources."

Q5: How stable has the APY been?
    has 30d data:
      "Over the last 30 days, this vault's APY has ranged from {LO} to {HI},
       averaging {AVG}, with measured volatility of ±{VOL}%. The Strategy
       stability section above shows where this falls on the scale from very
       volatile to very consistent."
    no 30d data:
      "There isn't yet enough 30-day APY history to score stability for this
       vault. The Strategy stability section above will populate once a
       meaningful window of records is available."

Q6: How much is currently in the vault?      ← NOT "How much capital"
    holders > 0:
      "The vault currently holds {TVL} in TVL across {HOLDERS} holders. The
       Historical statistics section above shows how this compares to the
       vault's 30-day range and lifetime peak."
    holders == 0 / null:
      "The vault currently holds {TVL} in TVL. The Historical statistics
       section above shows how this compares to the vault's 30-day range
       and lifetime peak."

Q7: What are the risks?
    "Like any onchain yield strategy, this vault is exposed to smart contract
     risk in both the Harvest contracts and the underlying sub-vaults, market
     risk in the lending venues it routes to, and protocol-specific risks of
     the assets it interacts with. Harvest's core vault infrastructure was
     audited by Halborn in January 2025, and the Autopilot engine has been
     audited twice. Audits reduce but do not eliminate risk."`}</CodeBlock>
        <SourceLink path="src/lib/autopilot-faq.tsx" symbol="buildAutopilotFaqItems" />
      </Section>

      <Section id="similar" title="16. Other opportunities">
        <p>
          Cross-sell rail at the bottom of the page. Six cards max. Filters
          and orders by proximity, not yield - APY-based ranking is already
          covered upstream.
        </p>
        <CodeBlock>{`Eligible: same asset, apy24h > 0, tvl > 0, not the current product.

Ordering (Autopilot current):
  1. same-network + same-type Autopilot (by TVL desc)
  2. same-network + different-type (Autocompounder) (by TVL desc)
  3. off-network + same-type Autopilot (by TVL desc)

Take first 6.

Card content: asset icon, canonical name (for LP-pair others) + [LP] badge
if applicable, chain icon + chain name + stripped category, 24h APY, TVL.`}</CodeBlock>
        <SourceLink path="src/components/similar-vaults.tsx" />
      </Section>

      <Section id="footnote" title="17. Page footnote">
        <CodeBlock>{`Two lines, muted styling:

  Last updated <relative>
    relative = formatRelativeUpdated(max of all history series timestamps)
    "Last updated just now" / "N minutes ago" / "N hours ago" / "N days
    ago" / "Last updated on Month D, YYYY"

  Harvest is an independent onchain yield index. Performance data reflects
  historical onchain activity and is not a forecast. See the [methodology],
  [risk framework], [terms], and [disclosures] for details on how data is
  calculated and the risks associated with onchain yield strategies.`}</CodeBlock>
        <SourceLink path="src/components/product-page-body.tsx" symbol="ProductPageFootnote" />
      </Section>

      <Section id="seo" title="18. SEO and JSON-LD">
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          &lt;title&gt; and &lt;meta description&gt;
        </h3>
        <CodeBlock>{`Autopilot:
  <title>            {productPageTitle(vault, isUniqueCombo)}
  <description>      {productPageDescription(vault, trackedDays)}

The helpers handle Autopilot products generically - no special template.
The title disambiguator slot drops when the asset+protocol+chain combo
is unique in the index.`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          JSON-LD schemas (emitted in &lt;head&gt;)
        </h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>FAQPage</code> with <code>mainEntity[].name</code> +{" "}
            <code>acceptedAnswer.text</code> pulled from the{" "}
            <code className="font-mono text-xs">answerText</code> field
            (never from the rendered ReactNode).
          </li>
          <li>
            <code>BreadcrumbList</code> matching{" "}
            <code className="font-mono text-xs">productPageCrumbs(vault)</code>.
          </li>
          <li>OpenGraph <code>article:modified_time</code> from latest history timestamp.</li>
        </ul>
        <SourceLink path="src/app/[slug]/page.tsx" symbol="generateMetadata + JSON-LD blocks" />
        <SourceLink path="src/lib/seo.ts" />
      </Section>

      <Section id="conditionals" title="19. Conditional-rendering matrix">
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Condition</th>
              <th className="py-2">Effect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-2 pr-4 font-mono text-xs">holderCount === 0</td><td className="py-2">About P3 skips &quot;across N holders&quot; fragment</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">holderCount === 1</td><td className="py-2">About P3 renders singular &quot;1 holder&quot;</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 7</td><td className="py-2">Historical stats APY paragraph → minimal &quot;still accumulating&quot; notice</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 30</td><td className="py-2">Long-term performance entire section → suppressed</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 30 AND readings_indexed &lt; 14</td><td className="py-2">Stability score/meter/label → suppressed; stats grid still renders</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">sharePriceHistory.length &lt; 2</td><td className="py-2">Yield trajectory → suppressed</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">tvlHistory positive points &lt; 10</td><td className="py-2">Historical stats TVL paragraph uses fallback (current + days only)</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">TVL 30d both endpoints &lt; $50K</td><td className="py-2">Performance Overview line 4 suppresses percentage</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">vault.vaultType === &quot;Autopilot&quot;</td><td className="py-2">Strategy details Strategy row + byline platform chip dropped</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="files" title="20. Implementation file map">
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Concern</th>
              <th className="py-2">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-2 pr-4">Page assembly / section order</td><td className="py-2 font-mono text-xs">src/components/product-page-body.tsx</td></tr>
            <tr><td className="py-2 pr-4">Autopilot About + protocolInsertFor</td><td className="py-2 font-mono text-xs">src/lib/autopilot-about.ts</td></tr>
            <tr><td className="py-2 pr-4">Autopilot FAQ</td><td className="py-2 font-mono text-xs">src/lib/autopilot-faq.tsx</td></tr>
            <tr><td className="py-2 pr-4">Performance Overview + Yield Trajectory</td><td className="py-2 font-mono text-xs">src/lib/autopilot-sections.ts</td></tr>
            <tr><td className="py-2 pr-4">Market benchmarking + Ecosystem context</td><td className="py-2 font-mono text-xs">src/components/market-sections.tsx</td></tr>
            <tr><td className="py-2 pr-4">Stability card</td><td className="py-2 font-mono text-xs">src/components/vault-stability-card.tsx</td></tr>
            <tr><td className="py-2 pr-4">Long-term performance</td><td className="py-2 font-mono text-xs">src/components/historical-narrative.tsx</td></tr>
            <tr><td className="py-2 pr-4">Historical statistics</td><td className="py-2 font-mono text-xs">src/components/historical-stats.tsx</td></tr>
            <tr><td className="py-2 pr-4">Historical Data table</td><td className="py-2 font-mono text-xs">src/components/vault-history-table.tsx</td></tr>
            <tr><td className="py-2 pr-4">Other opportunities</td><td className="py-2 font-mono text-xs">src/components/similar-vaults.tsx</td></tr>
            <tr><td className="py-2 pr-4">SEO helpers + breadcrumb</td><td className="py-2 font-mono text-xs">src/lib/seo.ts</td></tr>
            <tr><td className="py-2 pr-4">Route + metadata + JSON-LD</td><td className="py-2 font-mono text-xs">src/app/[slug]/page.tsx</td></tr>
            <tr><td className="py-2 pr-4">Banned-word linter</td><td className="py-2 font-mono text-xs">scripts/check-banned-words.mjs</td></tr>
            <tr><td className="py-2 pr-4">Project-wide style rules</td><td className="py-2 font-mono text-xs">AGENTS.md</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="verify" title="21. Verification checklist">
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            <code>npm run build</code> succeeds. Banned-word linter exits 0
            (zero violations across all product pages).
          </li>
          <li>
            Test pages:
            <ul className="mt-1 list-disc pl-6">
              <li>Established: <code>usdc-autopilot-arbitrum</code> (250+ days, ~44 holders)</li>
              <li>Fresh: an Autopilot under 30 days of tracking</li>
            </ul>
          </li>
          <li>H1 reads the database <code>productName</code>; breadcrumb last crumb matches.</li>
          <li>
            Byline reads <code>{`{Network} · Harvest · Autopilot`}</code> -
            no platform chip, no duplicate <code>Autopilot · Autopilot</code>.
          </li>
          <li>
            About P1 ends with &quot;the optimal yield available at any given
            time&quot; (NOT &quot;the most optimal yield&quot;). P2 is the
            constant IPOR engine paragraph. P3 reflects holder-count branch.
          </li>
          <li>About P1 includes the correct PROTOCOL_INSERT for this vault.</li>
          <li>Strategy stability either renders a score or the suppression notice + stats; never both, never neither.</li>
          <li>Long-term performance is absent on under-30-day vaults; present otherwise.</li>
          <li>Historical statistics renders both APY and TVL paragraphs when data supports them. TVL paragraph is independent of the 30-day window.</li>
          <li>Historical Data table has zero duplicate-date rows.</li>
          <li>Market benchmarking renders the summary paragraph exactly once, after the ranking table.</li>
          <li>
            Strategy details block has <strong>no</strong> &quot;Strategy:
            Autopilot&quot; row (this is the Autopilot-specific drop).
          </li>
          <li>FAQ Q4 includes the protocol insert. FAQ Q6 reads &quot;How much is currently in the vault?&quot; (not &quot;How much capital&quot;).</li>
          <li>Operator field in Strategy details reads &quot;Harvest&quot;, never &quot;Harvest Finance&quot;.</li>
          <li>JSON-LD <code>FAQPage</code> in <code>&lt;head&gt;</code> answers match the rendered FAQ answers (compare to <code>answerText</code>).</li>
          <li>No em dashes anywhere in user-visible copy.</li>
        </ol>
      </Section>

      <footer className="mt-12 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Editorial rules are load-bearing</p>
        <p className="mt-2">
          Each rule has a specific origin (audit, regression, editorial
          decision). Changing one ripples through multiple sections. If a rule
          appears to conflict with new requirements, surface the conflict
          before changing the rule, then update this page in the same PR.
        </p>
        <p className="mt-2">
          See also:{" "}
          <Link className="underline" href="/control-room/master-rules/autocompounder">
            Autocompounder handout
          </Link>
          ,{" "}
          <Link className="underline" href="/control-room/master-rules/lp-pair">
            LP-pair handout
          </Link>
          , and{" "}
          <Link className="underline" href="/control-room/ranking-rules">
            Ranking Rules
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
