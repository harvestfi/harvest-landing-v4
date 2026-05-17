// Master Rules: LP-pair Autocompounder product page. Self-contained
// handout for any AI tasked with rebuilding the single-product page
// for a vault where vaultType === "Autocompounder" AND
// underlyingLogos.length > 1. OnlyBoost is the documented exception
// (keeps database productName instead of expanding). Includes the
// universal copy rules and section architecture so this document
// stands alone.

import Link from "next/link";
import {
  Section,
  CodeBlock,
  SourceLink,
  TableOfContents,
} from "../_components";

const TOC_ITEMS = [
  ["variant", "1. Variant decision"],
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
  ["lp-badge", "17. LP badge rendering"],
  ["footnote", "18. Page footnote"],
  ["seo", "19. SEO and JSON-LD"],
  ["conditionals", "20. Conditional-rendering matrix"],
  ["files", "21. Implementation file map"],
  ["verify", "22. Verification checklist"],
] as const;

export const metadata = {
  title: "Master Rules: LP-pair Autocompounder Product Page | Admin",
  robots: { index: false, follow: false },
};

export default function MasterRulesLpPairPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Master Rules: LP-pair Autocompounder Product Page
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          A handout for any AI or developer tasked with recreating the
          single-product page for an LP-pair Autocompounder vault (any
          Aerodrome, Uniswap, Quickswap, Baseswap pair, etc.). The LP-pair
          variant differs from single-asset Autocompounders in five places:
          canonical name expansion, About template, FAQ (Q2 / Q4 / Q7),
          byline (no platform chip), and the <code>[LP]</code> badge in
          ranking views. Everything else is shared. See{" "}
          <Link className="underline" href="/admin/master-rules/autocompounder">
            the Autocompounder handout
          </Link>{" "}
          for the single-asset variant.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          OnlyBoost is the documented exception: Stake DAO OnlyBoost vaults
          carry boost-component icons that trip the LP-pair discriminator,
          but their database productName is already disambiguated. They
          honor productName as-is. See Section 1.
        </p>
      </header>

      <TableOfContents items={TOC_ITEMS} />

      <Section id="variant" title="1. Variant decision">
        <p>
          LP-pair Autocompounder is the variant of{" "}
          <code className="font-mono text-xs">vaultType === &quot;Autocompounder&quot;</code>
          {" "}where the underlying is an LP token (two or more assets in the
          pool). Detected via{" "}
          <code className="font-mono text-xs">underlyingLogos.length &gt; 1</code>.
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Sub-variant</th>
              <th className="py-2 pr-4">Discriminator</th>
              <th className="py-2">Canonical name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4 font-medium">LP-pair</td>
              <td className="py-2 pr-4 font-mono text-xs">
                underlyingLogos.length &gt; 1
              </td>
              <td className="py-2 font-mono text-xs">
                {`{ASSET}/{COUNTERPART} {PLATFORM}`}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">OnlyBoost (exception)</td>
              <td className="py-2 pr-4 font-mono text-xs">
                productName.toLowerCase().includes(&quot;onlyboost&quot;)
              </td>
              <td className="py-2 font-mono text-xs">vault.productName as-is</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4">
          <strong>Counterpart extraction.</strong> The counterpart symbol is
          parsed from <code className="font-mono text-xs">vault.underlyingLogos</code>:
          take each icon filename stem (e.g. <code>./icons/vvv.svg</code> →{" "}
          <code>vvv</code>), match against{" "}
          <code className="font-mono text-xs">TICKER_CANONICAL</code> for
          canonical casing (<code>vvv → VVV</code>, <code>cbbtc → cbBTC</code>,
          <code>wsteth → wstETH</code>), and pick the symbol that isn&apos;t
          the vault&apos;s primary asset. BTC vaults have a special case: the
          counterpart is the icon that isn&apos;t a BTC variant (cbBTC, wBTC,
          tBTC, ubtc, hemibtc all count as BTC-side).
        </p>
        <p className="mt-3">
          <strong>Platform extraction.</strong>{" "}
          <code className="font-mono text-xs">stripChainSuffix(vault.category, vault.chain)</code>
          {" "}strips the trailing <code>{` - {chain}`}</code> from the
          database category (e.g. <code>&quot;Aerodrome - Base&quot;</code> →
          <code>&quot;Aerodrome&quot;</code>).
        </p>
        <p className="mt-3">
          <strong>OnlyBoost rationale.</strong> Stake DAO OnlyBoost vaults
          have icons like <code>[eth.svg, cvx.svg]</code> (where CVX is a
          boost-component, not an LP counterpart) or three icons for
          tri-BTC pools. Auto-generating &quot;ETH/CVX Stake DAO&quot; would
          replace meaningful branding with a boost-token name. Honor the
          database productName for these vaults; they still get the{" "}
          <code>[LP]</code> badge for consistency in ranking views.
        </p>
        <p className="mt-3">
          <strong>Defensive fallback.</strong> If counterpart or platform
          parse to an empty/whitespace string, fall back to database
          productName + <code>[LP]</code> badge instead of rendering broken
          names like <code>ETH/ Aerodrome</code>.
        </p>
        <SourceLink path="src/lib/lp-pair.ts" symbol="getLpPair + getCanonicalDisplayName + TICKER_CANONICAL" />
      </Section>

      <Section id="architecture" title="2. Page architecture (render order)">
        <p>
          Identical render order to single-asset Autocompounders. Sections
          render top to bottom; the deltas vs single-asset are inside the
          per-section templates, not the section list.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-6">
          <li>Sticky header (asset · canonical name · APY · TVL · CTA)</li>
          <li>Breadcrumb (Home › {`{Asset}`} Ranking › {`{Canonical name}`})</li>
          <li>Title row (asset icon · H1 canonical · short address · byline chips)</li>
          <li>Detail grid (chart left, sidebar stats right)</li>
          <li>Jump nav</li>
          <li>About section (3 paragraphs - LP-pair template)</li>
          <li>Performance Overview (numbered fact list)</li>
          <li>Market benchmarking (stats grid + ranking table + closing)</li>
          <li>Ecosystem context (intro + chart + legend + closing)</li>
          <li>Yield trajectory (numbered fact list)</li>
          <li>Strategy stability (score gauge + stats grid)</li>
          <li>Long-term performance (1-3 bullets) - suppressed if tracked_days &lt; 30</li>
          <li>Historical statistics (APY + TVL paragraphs + stats tables)</li>
          <li>Historical Data (paginated daily table)</li>
          <li>Strategy details (Strategy field stays for LP-pair)</li>
          <li>FAQ (7 questions - LP-pair templates Q2/Q4/Q7)</li>
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
          <li>
            Impermanent loss must be acknowledged in FAQ Q7 - it&apos;s the
            single biggest risk-disclosure delta vs single-asset.
          </li>
        </ul>
        <SourceLink path="scripts/check-banned-words.mjs" />
        <SourceLink path="AGENTS.md" />
      </Section>

      <Section id="title" title="4. Title row and byline">
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          H1 (canonical name)
        </h3>
        <p>
          LP-pair H1 expands{" "}
          <code className="font-mono text-xs">vault.productName</code> via{" "}
          <code className="font-mono text-xs">getCanonicalDisplayName(vault)</code>:
        </p>
        <CodeBlock>{`getCanonicalDisplayName(vault):
  if no LP pair             → vault.productName  (single-asset fallback)
  if productName contains   → vault.productName  (OnlyBoost exception)
     "onlyboost" (ci)
  if counterpart or platform → vault.productName  (defensive fallback for
     parses empty                                  malformed icon data)
  else                       → \`\${ASSET}/\${COUNTERPART} \${PLATFORM}\``}</CodeBlock>
        <p className="mt-3">
          Rendered: <code>USDC Aerodrome</code> with USDC paired against AERO
          becomes <code>USDC/AERO Aerodrome</code>. The same string flows
          through breadcrumb, H1, sticky header, About heading, and About
          intro (P1 starts with{" "}
          <code className="font-mono text-xs">&lt;strong&gt;{`{displayName}`}&lt;/strong&gt;</code>).
        </p>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Byline chip pattern
        </h3>
        <p>
          <strong>Platform chip is dropped for LP-pair products</strong> -
          the canonical name (&quot;ETH/VVV Aerodrome&quot;) already states
          the platform, so a separate <code>Aerodrome</code> chip next to{" "}
          <code>Autocompounder</code> reads redundant.
        </p>
        <CodeBlock>{`{Network} · Harvest · Autocompounder`}</CodeBlock>
        <ul className="mt-3 list-disc space-y-1 pl-6">
          <li>Network chip: linked to <code className="font-mono text-xs">/{`{network-slug}`}</code>, chain icon + display name.</li>
          <li>
            Operator chip: trimmed brand (
            <code className="font-mono text-xs">
              vault.protocol.name.replace(/\s*Finance\s*$/i, &quot;&quot;)
            </code>
            ) → always &quot;Harvest&quot;, never &quot;Harvest Finance&quot;.
          </li>
          <li>Type chip: <code className="font-mono text-xs">vault.vaultType</code> → &quot;Autocompounder&quot;.</li>
        </ul>
        <SourceLink path="src/components/product-page-body.tsx" symbol="byline render block (isLpPair gate)" />
      </Section>

      <Section id="about" title="5. About section (LP-pair template)">
        <p>
          Three paragraphs. Variable substitution only - do not paraphrase.
          Paragraph 1 signals the LP-pair nature explicitly, paragraph 2
          explains the LP-add autocompounding mechanic, paragraph 3 surfaces
          live stats.
        </p>
        <CodeBlock>{`P1: {DISPLAY_NAME} is an LP-token autocompounder on {NETWORK}, with
    {TICKER} paired with {COUNTERPART} in the underlying LP position. The
    strategy provides liquidity to the {TICKER}/{COUNTERPART} pool on
    {PLATFORM} and earns yield from both trading fees on the pair and
    {REWARD} emissions distributed to liquidity providers.

P2: Any claimed {REWARD} rewards are automatically converted into more of
    the underlying LP position and added back to the vault, removing the
    manual claim and conversion steps a user would otherwise need to
    perform on their own. Autocompounding events run when economically
    feasible, anywhere from hourly to several days apart, with gas costs
    socialised across all holders rather than borne by each user
    individually.

P3: Live since {INCEPTION_DATE}. Currently indexed at {TVL} TVL[ across
    {HOLDERS} holder(s)], with a {APY_24H} 24-hour APY and {APY_30D}
    across the trailing 30 days.`}</CodeBlock>

        <p className="mt-3">
          <strong>REWARD lookup.</strong> Taken from{" "}
          <code className="font-mono text-xs">vault.rewardTokens[0]?.symbol</code>.
          Fallback when no reward token in data:{" "}
          <code className="font-mono text-xs">&quot;platform-native rewards&quot;</code>.
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
        <SourceLink path="src/lib/lp-pair-about.ts" symbol="buildLpPairAbout" />
      </Section>

      <Section id="performance" title="6. Performance Overview (4 numbered lines)">
        <p>
          Shared algorithm with Autocompounder + Autopilot. Each line renders
          only when its data conditions hold.
        </p>
        <CodeBlock>{`Line 01 (asset-cohort rank, three rank-ratio variants):
  ratio <= 0.25 → "...placing it in the top quarter of the cohort."
  ratio > 0.25 → "...with {ABOVE} strategy/strategies currently delivering
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
  Stable: "...$1,000 would earn ~$15..."
  Non-stable: "...1 ETH would earn ~0.05 ETH..." (no USD conversion -
  asset price feed not available).

Line 03 (current vs lifetime avg, render if lifetime.length >= 5):
  "Current APY of {APY} is {below|above|roughly in line with} this vault's
   lifetime average of {AVG}." (±0.5pp threshold for "roughly in line")

Line 04 (TVL 30d change, render if tvlSorted >= 2 and past >= 7d old):
  Both endpoints below $50K → suppress percentage; otherwise render it.`}</CodeBlock>
        <SourceLink path="src/lib/autopilot-sections.ts" symbol="buildPerformanceOverview" />
      </Section>

      <Section id="benchmark" title="7. Market benchmarking">
        <p>
          Stats grid (4 metrics), ranking table, then one closing-summary
          paragraph. LP-pair rows in the table use canonical name +{" "}
          <code>&lt;LpBadge /&gt;</code>; single-asset rows show no badge.
        </p>
        <CodeBlock>{`Ranking table layout (same algorithm as other product types):
  Case A (current rank 1-5): contiguous top 5.
  Case B (current rank 6+): {1, 2, 3, rank-1, rank, rank+1, total} anchors,
    with "..." separator rows inserted only when gaps > 1.

Closing summary:
  ref = depositRef(vault.asset)
  monthlyDelta = |apyToMonthly(vault.apy24h - avgApy, ref.amount)|
  deltaPhrase  = fmtEarnings(monthlyDelta, vault.asset)

  "Among the {N} {ASSET} strategies we currently monitor, this product
   ranks #{R}. Its {APY} yield runs {ABS_DELTA}% {higher|lower} than the
   cohort average of {AVG}. On a {ref.label} position, that's {deltaPhrase}
   per month {higher|lower} than the cohort average. {APY_SUMMARY_PHRASE}
   It currently holds {TVL} in TVL, ranking #{TVL_RANK} of {N} by TVL."

Stable: "On a $1,000 position, that's ~$15 per month higher..."
Non-stable: "On a 1 ETH position, that's ~0.05 ETH per month higher..."`}</CodeBlock>
        <SourceLink path="src/components/market-sections.tsx" symbol="MarketBenchmark" />
      </Section>

      <Section id="ecosystem" title="8. Ecosystem context">
        <CodeBlock>{`Intro:
  "On {NETWORK}, this product's yield runs {ABS_VS_NET_AVG}% {higher|lower}
   than the network average across the {ASSET} strategies we monitor. By
   APY it ranks #{R} of {N} in that set. Yields on {NETWORK} for {ASSET}
   have averaged {NET_AVG}% in our index."

Chart legend: canonical names + [LP] badge for LP-pair, plain productName
for single-asset.

Closer:
  isTop: "Currently the top-yielding {ASSET} opportunity on {NETWORK}..."
  else:  "By TVL, this product ranks #{TVL_R} of {N} {ASSET} strategies on
          {NETWORK} in our index."

NO trailing "operated by X and competes against..." sentence.`}</CodeBlock>
        <SourceLink path="src/components/market-sections.tsx" symbol="EcosystemContext" />
      </Section>

      <Section id="yield-traj" title="9. Yield trajectory">
        <p>
          Shared template across all product types. The word{" "}
          <code className="font-mono text-xs">deposited</code> is allowed here
          (linter exempts it inside the{" "}
          <code className="font-mono text-xs">&lt;section id=&quot;yield-trajectory&quot;&gt;</code>{" "}
          container).
        </p>
        <CodeBlock>{`Render: sharePriceHistory.length >= 2.
ageDays = (sp[last].ts - sp[0].ts) / 86400 (tracked_days, not on-chain age)
stable = isStable(vault.asset.toUpperCase())   ← USDC/USDT/DAI/PYUSD/etc.

If ageDays >= 30:
  stable:
    "$1,000 deposited 30 days ago would now be worth ~\${USD30}..."
  non-stable (single line, no USD line):
    "1 {TICKER} deposited 30 days ago would now be ~{RATIO} {TICKER}."

Always:
  stable:
    "$1,000 deposited at launch ({ageDays} days ago) would now be worth
     ~\${USD_INC}..."
  non-stable (single line, no USD line):
    "1 {TICKER} deposited at launch ({ageDays} days ago) would now be
     ~{RATIO_INC} {TICKER}."

NEVER emit a "\$1,000 deposited" line for non-stable assets - translating
{TICKER}-denominated share-price growth to USD requires a historical price
feed we don't have.`}</CodeBlock>
        <SourceLink path="src/lib/autopilot-sections.ts" symbol="buildYieldTrajectory" />
      </Section>

      <Section id="stability" title="10. Strategy stability">
        <CodeBlock>{`Same score formula across all product types:
  cv < 0.1         → 100 - (cv/0.1) * 10            (90-100)
  0.1 <= cv < 0.2  → 89 - ((cv-0.1)/0.1) * 19       (70-89)
  0.2 <= cv < 0.4  → 69 - ((cv-0.2)/0.2) * 29       (40-69)
  0.4 <= cv        → 39 - ((min(cv,1.0)-0.4)/0.6) * 39   (0-39)

Label from score (5-zone):
  >= 80 → Very consistent     >= 40 → Moderately variable
  >= 60 → Consistent          >= 20 → Highly variable
                              <  20 → Very volatile

Fresh-vault suppression: if tracked_days < 30 AND readings_indexed < 14,
  replace score/meter/label with the "Score not available" notice. Stats
  grid still renders.`}</CodeBlock>
        <SourceLink path="src/components/test-stability-card.tsx" symbol="computeStability + TestStabilityCard" />
      </Section>

      <Section id="long-term" title="11. Long-term performance">
        <p>
          Three potential bullets. Section returns <code>null</code> when{" "}
          <code className="font-mono text-xs">tracked_days &lt; 30</code>.
        </p>
        <CodeBlock>{`Bullet 1 (share-price CAGR, daySpan >= 30):
  "Share price has compounded at an annualized rate of {CAGR}% over {DAYS}
   days, growing from {FIRST} to {LAST}."
  If daySpan >= 90: append loss/gain in {TICKER} units (per 1 {TICKER}
   supplied at launch). NEVER "minimal returns".

Bullet 2 (TVL story, tvlHistory >= 10 AND maxDrawdownPct >= 15):
  at-peak (current >= 0.9 * peak):
    daysAtPeak >= 1: "TVL currently sits at {CURRENT}, at or near its
                     historical peak. The vault has held this scale for
                     the past {daysAtPeak} days."
    else: "TVL currently sits at {CURRENT}, at or near its historical peak."

  past-peak (drawdown formatting via formatDrawdownPct):
    troughValue <= 0 → "100"
    pct >= 95       → "99"
    else             → Math.round(pct)
    "TVL experienced a {PCT}% drawdown from its {PEAK} peak, bottoming at
     {TROUGH} over {DAYS_DOWN} days. It currently stands at {CURRENT},
     {PCT_VS_PEAK}% of the peak value."

Bullet 3 (best/worst month, apyHistory >= 60 AND >= 3 months with >= 5
  readings each):
  "Best performing month was {BEST_MONTH} at {BEST_AVG}% average APY;
   weakest was {WORST_MONTH} at {WORST_AVG}%."`}</CodeBlock>
        <SourceLink path="src/components/historical-narrative.tsx" symbol="HistoricalNarrative" />
      </Section>

      <Section id="hist-stats" title="12. Historical statistics">
        <CodeBlock>{`APY narrative (three modes):
  tracked_days < 7: minimal "still accumulating" message
  apyStats.dataPoints >= 60 AND |changePct| > 10: full template (endpoints
    + monthly earnings, both sentences always render)
  else: no APY narrative

TVL narrative (decoupled from 30d window - the gate is on lifetime
sorted.length >= 2, NOT on tvlStats):
  sorted.length >= 10 AND last >= 0.8 * peak: Narrative A (up from FIRST)
  sorted.length >= 10:                         Narrative B (PCT% of peak)
  else (< 10):                                 Fallback (current + days)

Stats tables render after narratives. Two side-by-side blocks when both
APY and TVL have data; one splits into two columns when alone.`}</CodeBlock>
        <SourceLink path="src/components/historical-stats.tsx" symbol="HistoricalStats" />
      </Section>

      <Section id="hist-data" title="13. Historical Data table">
        <CodeBlock>{`Dedupe: one row per UTC calendar day, latest snapshot kept.
Date display: locale "en-US" with timeZone: "UTC" (must match dedupe key).

Lifetime summary: Lifetime avg | High | Low | Data points
Formatters: render real zeros as 0.00% / $0 / 0.0000. Dash only for
  non-finite values.`}</CodeBlock>
        <SourceLink path="src/components/vault-history-table.tsx" symbol="VaultHistoryTable + dedupeLatestPerDay" />
      </Section>

      <Section id="details" title="14. Strategy details (structured data)">
        <p>
          LP-pair Autocompounders <strong>keep</strong> the Strategy row in
          Strategy details (unlike Autopilot which drops it).
        </p>
        <CodeBlock>{`Rendered rows (LP-pair Autocompounder):
  Strategy:  {protocolName}   (e.g. "Aerodrome", "Quickswap", "Uniswap V3")
  Network:   {chain} link to network hub
  Type:      Autocompounder
  Underlying: {asset}
  Rewards:   {reward tokens comma-separated, only if non-empty}
  Operator:  {operatorBrand}   (trimmed: "Harvest")
  Tracked for: {trackedDays} days
  Holders:   {holderCount} (if non-null)
  Vault contract: {address} + copy + explorer link
  Strategy contract: same (if vault.strategyAddress)
  Underlying token:  same (if vault.tokenAddress)`}</CodeBlock>
        <SourceLink path="src/components/product-page-body.tsx" symbol="Strategy details block" />
      </Section>

      <Section id="faq" title="15. FAQ (7 questions, LP-pair templates)">
        <p>
          Each FAQ item has{" "}
          <code className="font-mono text-xs">question</code>,{" "}
          <code className="font-mono text-xs">answer</code> (ReactNode), and{" "}
          <code className="font-mono text-xs">answerText</code> (plain string
          for JSON-LD <code>FAQPage</code>). Schema and rendered text must
          match.
        </p>
        <p className="mt-3">
          Q1 uses canonical name. Q2, Q4, Q7 differ from single-asset.
        </p>
        <CodeBlock>{`Q1: What's the current APY for {DISPLAY_NAME}?       ← canonical name
    "...showing a 24-hour APY of {APY_24H}, with a 30-day average of
     {APY_30D}. Rates are variable and move with trading volume on the
     {TICKER}/{COUNTERPART} pair, the {REWARD} emission schedule, and
     overall liquidity in the pool. The figures reflect the realised yield
     over the trailing window; they are not a forward guarantee."

Q2: How does the autocompounding work?            ← LP-add flow
    "The strategy holds an LP position in the {TICKER}/{COUNTERPART} pool
     on {PLATFORM} and periodically claims any {REWARD} rewards that
     accrue. Those rewards are then converted in the proportions needed
     to add liquidity back into the same pool, increasing the size of the
     LP position held by the vault and the value of each holder's share.
     The process repeats automatically; holders are not required to
     claim, swap, or add liquidity themselves. Autocompounding events
     run when economically feasible..."

Q3: Can I withdraw at any time?  → link to /risk-framework
    "...exits are instant. During periods of low pool liquidity,
     withdrawal capacity can be limited until liquidity returns..."

Q4: Where does the yield come from?               ← dual source
    "Yield comes from two sources. First, trading fees on the
     {TICKER}/{COUNTERPART} pool on {PLATFORM}: every swap between the
     two assets pays a fee, a share of which accrues to liquidity
     providers. Second, {REWARD} emissions distributed by {PLATFORM} to
     incentivise liquidity in the pool, which the strategy claims and
     adds back into the position. Both move with conditions: trading
     fees scale with volume, and emissions scale with the platform's
     emission schedule."

Q5: How stable has the APY been?
    Same template as single-asset (range/avg/volatility or placeholder).

Q6: How much is currently in the vault?           ← NOT "How much capital"
    Same template as single-asset.

Q7: What are the risks?                            ← adds impermanent loss
    "Like any onchain yield strategy, this vault is exposed to smart
     contract risk in both the Harvest contracts and the underlying
     {PLATFORM} pool, and protocol-specific risks of the assets it holds.
     Because the position holds both {TICKER} and {COUNTERPART}, the value
     of the position also moves with the relative price of the two assets
     in the pair: when the two prices diverge, the LP position is worth
     less than holding the two tokens separately would have been. This is
     commonly referred to as impermanent loss. {REWARD} rewards partially
     offset this, but the offset is not guaranteed and depends on emission
     rates and the magnitude of price divergence. Harvest's core vault
     infrastructure was audited by Halborn in January 2025. Audits reduce
     but do not eliminate risk."`}</CodeBlock>
        <SourceLink path="src/lib/lp-pair-faq.tsx" symbol="buildLpPairFaqItems" />
      </Section>

      <Section id="similar" title="16. Other opportunities">
        <p>
          Cross-sell rail at the bottom. Six cards max. LP-pair-specific
          ordering prefers other LP-pair candidates first because the risk
          profile (dual-asset exposure + impermanent loss) is more
          comparable.
        </p>
        <CodeBlock>{`Eligible: same asset, apy24h > 0, tvl > 0, not the current product.

Ordering (LP-pair current):
  1. same-network LP-pair (by TVL desc)
  2. same-network single-asset (by TVL desc)
  3. off-network LP-pair (by TVL desc)

Take first 6.

Card content: asset icon, canonical name + [LP] badge if LP-pair, chain
icon + chain name + stripped category, 24h APY, TVL.`}</CodeBlock>
        <SourceLink path="src/components/test-similar.tsx" />
      </Section>

      <Section id="lp-badge" title="17. LP badge rendering">
        <p>
          The <code>[LP]</code> badge is a small inline pill rendered after
          the product name in <strong>every</strong> ranking-style view. It
          is the visual cue users use to filter LP-pair products from
          single-asset products at a glance.
        </p>
        <CodeBlock>{`Render sites (always with canonical name + badge):
  1. Asset ranking pages (/eth, /usdc, /usdt, /btc)         hub-table.tsx
  2. Market benchmarking ranking table                       market-sections.tsx
  3. Ecosystem context legend                                market-sections.tsx
  4. "Other opportunities" cards                             test-similar.tsx
  5. Header search dropdown                                  search-box.tsx

NOT rendered on the destination page itself - the canonical name "ETH/VVV
Aerodrome" already disambiguates and the badge would be visual clutter.

Component: <LpBadge /> in src/components/lp-badge.tsx
  Emits: <> {" "} <span class="lp-badge">LP</span> </>
  The literal leading space is a safety net against context-specific margin
  overrides; CSS also supplies margin-left + border + muted background.

OnlyBoost note: OnlyBoost vaults DO get the [LP] badge even though their
canonical name is preserved as productName. The badge is uniform across
LP-pair variants - no [LP boost] sub-variant.`}</CodeBlock>
        <SourceLink path="src/components/lp-badge.tsx" />
        <SourceLink path="src/app/_styles/product.css" symbol=".lp-badge rule" />
      </Section>

      <Section id="footnote" title="18. Page footnote">
        <CodeBlock>{`Two lines, muted styling:

  Last updated <relative>
    relative = formatRelativeUpdated(max of all history series timestamps)

  Harvest is an independent onchain yield index. Performance data reflects
  historical onchain activity and is not a forecast. See the [methodology],
  [risk framework], [terms], and [disclosures] for details on how data is
  calculated and the risks associated with onchain yield strategies.`}</CodeBlock>
        <SourceLink path="src/components/product-page-body.tsx" symbol="ProductPageFootnote" />
      </Section>

      <Section id="seo" title="19. SEO and JSON-LD">
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          &lt;title&gt; and &lt;meta description&gt;
        </h3>
        <CodeBlock>{`LP-pair gets its own SEO templates (in src/app/[slug]/page.tsx
generateMetadata):

  <title>:
    {ASSET}/{COUNTERPART} {PLATFORM} Yield on {CHAIN} | Harvest

  <description>:
    Autocompounding LP yield on the {ASSET}/{COUNTERPART} pair on {PLATFORM}
    ({CHAIN}). {REWARD} rewards are claimed and added back to the position
    automatically. Tracked continuously by Harvest.`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          JSON-LD schemas (emitted in &lt;head&gt;)
        </h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>FAQPage</code> with{" "}
            <code className="font-mono text-xs">mainEntity[].name</code> +{" "}
            <code className="font-mono text-xs">acceptedAnswer.text</code>{" "}
            pulled from{" "}
            <code className="font-mono text-xs">answerText</code>.
          </li>
          <li>
            <code>BreadcrumbList</code> matching{" "}
            <code className="font-mono text-xs">productPageCrumbs(vault)</code>{" "}
            (uses canonical name for the last crumb).
          </li>
          <li>
            OpenGraph <code>article:modified_time</code> from latest history
            timestamp.
          </li>
        </ul>
        <SourceLink path="src/app/[slug]/page.tsx" symbol="generateMetadata LP-pair branch" />
        <SourceLink path="src/lib/seo.ts" />
      </Section>

      <Section id="conditionals" title="20. Conditional-rendering matrix">
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Condition</th>
              <th className="py-2">Effect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-2 pr-4 font-mono text-xs">holderCount === 0</td><td className="py-2">About P3 skips &quot;across N holders&quot;</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">holderCount === 1</td><td className="py-2">About P3 renders singular &quot;1 holder&quot;</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 7</td><td className="py-2">Historical stats APY → minimal &quot;still accumulating&quot; notice</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 30</td><td className="py-2">Long-term performance → suppressed entirely</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 30 AND readings &lt; 14</td><td className="py-2">Stability score/meter → suppressed; stats grid stays</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">sharePriceHistory &lt; 2</td><td className="py-2">Yield trajectory → suppressed</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">tvl positive points &lt; 10</td><td className="py-2">Historical stats TVL paragraph uses fallback</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">TVL 30d both endpoints &lt; $50K</td><td className="py-2">Performance Overview line 4 suppresses percentage</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">isLpPairVault(vault) === true</td><td className="py-2">Canonical name expansion; byline platform chip dropped; LP badge in rankings</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">productName includes &quot;onlyboost&quot;</td><td className="py-2">Canonical name expansion skipped (uses productName); LP badge still rendered</td></tr>
            <tr><td className="py-2 pr-4 font-mono text-xs">counterpart or platform parse empty</td><td className="py-2">Canonical name falls back to productName; LP badge still rendered</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="files" title="21. Implementation file map">
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Concern</th>
              <th className="py-2">File</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr><td className="py-2 pr-4">Page assembly / section order</td><td className="py-2 font-mono text-xs">src/components/product-page-body.tsx</td></tr>
            <tr><td className="py-2 pr-4">Canonical name + LP-pair discriminator + OnlyBoost exception</td><td className="py-2 font-mono text-xs">src/lib/lp-pair.ts</td></tr>
            <tr><td className="py-2 pr-4">LP-pair About template</td><td className="py-2 font-mono text-xs">src/lib/lp-pair-about.ts</td></tr>
            <tr><td className="py-2 pr-4">LP-pair FAQ (Q2, Q4, Q7 differ)</td><td className="py-2 font-mono text-xs">src/lib/lp-pair-faq.tsx</td></tr>
            <tr><td className="py-2 pr-4">LP badge component</td><td className="py-2 font-mono text-xs">src/components/lp-badge.tsx</td></tr>
            <tr><td className="py-2 pr-4">LP badge styling</td><td className="py-2 font-mono text-xs">src/app/_styles/product.css (.lp-badge)</td></tr>
            <tr><td className="py-2 pr-4">Performance Overview + Yield Trajectory</td><td className="py-2 font-mono text-xs">src/lib/autopilot-sections.ts</td></tr>
            <tr><td className="py-2 pr-4">Market benchmarking + Ecosystem context</td><td className="py-2 font-mono text-xs">src/components/market-sections.tsx</td></tr>
            <tr><td className="py-2 pr-4">Stability card</td><td className="py-2 font-mono text-xs">src/components/test-stability-card.tsx</td></tr>
            <tr><td className="py-2 pr-4">Long-term performance</td><td className="py-2 font-mono text-xs">src/components/historical-narrative.tsx</td></tr>
            <tr><td className="py-2 pr-4">Historical statistics</td><td className="py-2 font-mono text-xs">src/components/historical-stats.tsx</td></tr>
            <tr><td className="py-2 pr-4">Historical Data table</td><td className="py-2 font-mono text-xs">src/components/vault-history-table.tsx</td></tr>
            <tr><td className="py-2 pr-4">Other opportunities</td><td className="py-2 font-mono text-xs">src/components/test-similar.tsx</td></tr>
            <tr><td className="py-2 pr-4">Hub table (renders LP badge)</td><td className="py-2 font-mono text-xs">src/components/hub-table.tsx</td></tr>
            <tr><td className="py-2 pr-4">Header search dropdown</td><td className="py-2 font-mono text-xs">src/components/search-box.tsx + header.tsx</td></tr>
            <tr><td className="py-2 pr-4">SEO helpers + breadcrumb</td><td className="py-2 font-mono text-xs">src/lib/seo.ts</td></tr>
            <tr><td className="py-2 pr-4">Route + metadata + JSON-LD (LP-pair branch)</td><td className="py-2 font-mono text-xs">src/app/[slug]/page.tsx</td></tr>
            <tr><td className="py-2 pr-4">Banned-word linter</td><td className="py-2 font-mono text-xs">scripts/check-banned-words.mjs</td></tr>
            <tr><td className="py-2 pr-4">Project-wide style rules</td><td className="py-2 font-mono text-xs">AGENTS.md</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="verify" title="22. Verification checklist">
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            <code>npm run build</code> succeeds. Banned-word linter exits 0.
          </li>
          <li>
            Test pages:
            <ul className="mt-1 list-disc pl-6">
              <li>Plain LP-pair: <code>eth-aerodrome-vvv-base</code> → H1 reads <code>ETH/VVV Aerodrome</code></li>
              <li>OnlyBoost: <code>eth-stake-dao-onlyboost-ethereum</code> → H1 reads <code>ETH OnlyBoost</code> (preserved)</li>
              <li>Fresh LP-pair: any vault with under 30 days of tracking</li>
            </ul>
          </li>
          <li>H1 + breadcrumb last crumb + About heading + About P1 opener all use the same canonical name string.</li>
          <li>
            Byline reads <code>{`{Network} · Harvest · Autocompounder`}</code>{" "}
            (no platform chip).
          </li>
          <li>
            About P1 starts &quot;{`{DISPLAY_NAME}`} is an LP-token autocompounder on
            {` {NETWORK}`}, with {`{TICKER}`} paired with {`{COUNTERPART}`}...&quot;
          </li>
          <li>
            FAQ Q1 uses canonical name; Q6 reads &quot;How much is currently
            in the vault?&quot; (NOT &quot;How much capital&quot;); Q7 contains
            the impermanent-loss paragraph.
          </li>
          <li>
            Strategy details has a <strong>Strategy</strong> row (LP-pair
            keeps it, unlike Autopilot which drops it).
          </li>
          <li>
            All ranking surfaces (asset hub, benchmark table, ecosystem
            legend, Other opportunities, search dropdown) render this product
            with canonical name + <code>[LP]</code> badge with a visible gap
            between name and pill.
          </li>
          <li>
            On <code>/eth</code> hub the product appears with disambiguated
            name (not duplicate <code>ETH Aerodrome</code> rows).
          </li>
          <li>OnlyBoost product H1 reads <code>ETH OnlyBoost</code> (database name preserved).</li>
          <li>SEO <code>&lt;title&gt;</code> reads <code>{`{ASSET}/{COUNTERPART} {PLATFORM} Yield on {CHAIN} | Harvest`}</code>.</li>
          <li>Stability either renders score or suppression notice + stats.</li>
          <li>Long-term performance absent on under-30-day vaults; present otherwise.</li>
          <li>Historical statistics renders both APY and TVL paragraphs when data supports (TVL paragraph independent of 30-day window).</li>
          <li>Historical Data table has zero duplicate-date rows.</li>
          <li>Market benchmarking summary paragraph renders exactly once, after the ranking table.</li>
          <li>Operator field in Strategy details reads &quot;Harvest&quot;, never &quot;Harvest Finance&quot;.</li>
          <li>JSON-LD <code>FAQPage</code> in <code>&lt;head&gt;</code> answers match the rendered FAQ.</li>
          <li>No em dashes anywhere in user-visible copy.</li>
        </ol>
      </Section>

      <footer className="mt-12 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Editorial rules are load-bearing</p>
        <p className="mt-2">
          Each rule has a specific origin (audit, regression, editorial
          decision). LP-pair-specific rules in particular were added because
          the bare database <code>productName</code> creates several products
          called &quot;ETH Aerodrome&quot; with vastly different APYs, which
          users couldn&apos;t distinguish without clicking through. Changing
          one rule ripples through multiple sections.
        </p>
        <p className="mt-2">
          See also:{" "}
          <Link className="underline" href="/admin/master-rules/autocompounder">
            Autocompounder handout
          </Link>
          ,{" "}
          <Link className="underline" href="/admin/master-rules/autopilot">
            Autopilot handout
          </Link>
          , and{" "}
          <Link className="underline" href="/admin/ranking-rules">
            Ranking Rules
          </Link>
          .
        </p>
      </footer>
    </main>
  );
}
