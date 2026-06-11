// Master Rules: a self-contained handout for any AI tasked with
// rebuilding the autocompounder product page from scratch. Every
// section below answers a different question:
//   - What sections appear, in what order?
//   - What text renders inside each section, with what variables?
//   - What conditions suppress / reshape each section?
//   - Where in the codebase is each rule enforced?
//
// Read top to bottom; nothing here is shorthand. If two sources
// disagree, this page wins - it represents the current editorial
// truth as of the last patch.

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
  ["footnote", "17. Page footnote"],
  ["seo", "18. SEO and JSON-LD"],
  ["conditionals", "19. Conditional-rendering matrix"],
  ["files", "20. Implementation file map"],
  ["verify", "21. Verification checklist"],
] as const;

export const metadata = {
  title: "Master Rules: Autocompounder Product Page | Admin",
  robots: { index: false, follow: false },
};

export default function MasterRulesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Master Rules: Autocompounder Product Page
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          A handout for any AI or developer tasked with recreating the
          single-product page for an autocompounder vault. Covers all three
          variants (single-asset, LP-pair, OnlyBoost) plus the universal copy
          rules that apply across every product page on the site. Each section
          names the source files where the rule is enforced so the reader can
          jump straight into code.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600">
          The rules here exist because audits keep catching the same regressions.
          Treat them as load-bearing: changing one ripples through several
          sections. The post-build linter at{" "}
          <code className="rounded bg-gray-100 px-1 font-mono text-xs">
            scripts/check-banned-words.mjs
          </code>{" "}
          enforces the word-level rules automatically; everything else is
          editorial discipline.
        </p>
      </header>

      <TableOfContents items={TOC_ITEMS} />

      <Section id="variant" title="1. Variant decision">
        <p>
          Autocompounder is a single <code>vaultType</code> value in the data
          model, but renders three distinct variants based on auxiliary fields.
          Decide which variant a vault belongs to <strong>before</strong> any
          template selection happens.
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Variant</th>
              <th className="py-2 pr-4">Discriminator</th>
              <th className="py-2">Canonical name</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4 font-medium">Single-asset</td>
              <td className="py-2 pr-4">
                <code className="font-mono text-xs">
                  underlyingLogos.length &le; 1
                </code>
              </td>
              <td className="py-2">
                <code className="font-mono text-xs">vault.productName</code> as-is
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">LP-pair</td>
              <td className="py-2 pr-4">
                <code className="font-mono text-xs">
                  underlyingLogos.length &gt; 1
                </code>
              </td>
              <td className="py-2">
                <code className="font-mono text-xs">
                  {`{ASSET}/{COUNTERPART} {PLATFORM}`}
                </code>
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">OnlyBoost (exception)</td>
              <td className="py-2 pr-4">
                <code className="font-mono text-xs">
                  productName.toLowerCase().includes(&quot;onlyboost&quot;)
                </code>
              </td>
              <td className="py-2">
                <code className="font-mono text-xs">vault.productName</code> as-is
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4">
          The OnlyBoost exception exists because Stake DAO OnlyBoost vaults
          carry boost-component icons (CVX, alt-BTC variants) that trip the
          LP-pair discriminator, but the product name is already disambiguated
          by the asset prefix + OnlyBoost suffix. Honor productName as-is rather
          than generating <code>ETH/CVX Stake DAO</code>.
        </p>
        <SourceLink path="src/lib/lp-pair.ts" symbol="getCanonicalDisplayName" />
      </Section>

      <Section id="architecture" title="2. Page architecture (render order)">
        <p>
          Sections render top to bottom in this exact order. Several are
          conditionally suppressed; see Section 12 for the conditional matrix.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-6">
          <li>Sticky header (asset · name · APY · TVL · CTA)</li>
          <li>Breadcrumb (Home › {`{Asset}`} Ranking › {`{Canonical name}`})</li>
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
          <li>Strategy details (structured-data block)</li>
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
          The linter at <code>scripts/check-banned-words.mjs</code> blocks the
          build on any of the following in product-page prose. The list is the
          single source of truth; new bans land there too.
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
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">returns / return (noun)</td>
              <td className="py-2 pr-4">yield, gain, income stream</td>
              <td className="py-2 text-xs text-gray-500">verb usage like &quot;liquidity returns&quot; allowlisted</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">deposit / deposits (noun + verb)</td>
              <td className="py-2 pr-4">position, holdings, supply</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">deposited</td>
              <td className="py-2 pr-4">supplied at launch</td>
              <td className="py-2 text-xs text-gray-500">
                allowed inside <code>&lt;section id=&quot;yield-trajectory&quot;&gt;</code>
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">depositor / depositors</td>
              <td className="py-2 pr-4">holders</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">invest / investment / investor</td>
              <td className="py-2 pr-4">supply, position, holder</td>
              <td className="py-2 text-xs text-gray-500">legal pages only</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">capital</td>
              <td className="py-2 pr-4">TVL, holdings, pool size</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">outperform / outperforming</td>
              <td className="py-2 pr-4">use neutral comparative phrasing</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">competes against / goes up against</td>
              <td className="py-2 pr-4">drop the phrase</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">Harvest Finance (in prose)</td>
              <td className="py-2 pr-4">Harvest</td>
              <td className="py-2 text-xs text-gray-500">legal pages + copyright</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">recovered (TVL/drawdown context)</td>
              <td className="py-2 pr-4">drop; state numbers neutrally</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">minimal / negligible / nominal returns</td>
              <td className="py-2 pr-4">render a quantitative gain</td>
              <td className="py-2 text-xs text-gray-500">none (placeholder ban)</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">upward/downward trend, trending up/down</td>
              <td className="py-2 pr-4">state endpoints + delta neutrally</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">well above / far higher / notably ahead</td>
              <td className="py-2 pr-4">drop the intensifier</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">your funds / your capital / your earnings</td>
              <td className="py-2 pr-4">use neutral framing</td>
              <td className="py-2 text-xs text-gray-500">none</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">— (em dash, U+2014)</td>
              <td className="py-2 pr-4">comma, period, colon, or &quot; - &quot;</td>
              <td className="py-2 text-xs text-gray-500">none (project-wide)</td>
            </tr>
          </tbody>
        </table>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Coverage-claim scope
        </h3>
        <p>
          Any sentence comparing this product to a population (rankings, market
          averages, &quot;the ecosystem&quot;, outperformance %, etc.) must
          signal that the population is <em>what we track</em>, not the entire
          market. Signal scope once per section. Acceptable phrasings:{" "}
          <em>we monitor, we follow, we currently track, in our index, the
          cohort, in that set</em>. Avoid stacking the same qualifier across
          one paragraph.
        </p>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Tone
        </h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>Neutral, factual, numerate. No promotional intensifiers.</li>
          <li>
            Past performance language is allowed in product-page prose only
            when factual (&quot;APY has moved from X to Y&quot;); never as a
            forecast.
          </li>
          <li>
            FAQ Q1 always reads &quot;The figures reflect the realised yield
            over the trailing window; they are not a forward guarantee.&quot;
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
          Single-asset: <code>vault.productName</code>. LP-pair:{" "}
          <code>{`{ASSET}/{COUNTERPART} {PLATFORM}`}</code>. OnlyBoost: keep
          productName. All three are produced by{" "}
          <code>getCanonicalDisplayName(vault)</code> in{" "}
          <code>src/lib/lp-pair.ts</code>.
        </p>
        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Byline chip pattern
        </h3>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Variant</th>
              <th className="py-2">Byline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2 pr-4">Single-asset Autocompounder</td>
              <td className="py-2 font-mono text-xs">
                {`{Network} · Harvest · {Platform} · Autocompounder`}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">LP-pair Autocompounder</td>
              <td className="py-2 font-mono text-xs">
                {`{Network} · Harvest · Autocompounder`}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">OnlyBoost (LP-pair variant)</td>
              <td className="py-2 font-mono text-xs">
                {`{Network} · Harvest · Autocompounder`}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3">
          The platform chip is dropped for LP-pair products because the
          canonical name (&quot;ETH/VVV Aerodrome&quot;) already states it.
          Single-asset Autocompounders keep the chip because the product name
          doesn&apos;t always make the platform self-evident.
        </p>
        <p className="mt-3">
          Network chip links to{" "}
          <code className="font-mono text-xs">/{`{network-slug}`}</code> (hub
          page). Operator brand is{" "}
          <code className="font-mono text-xs">
            vault.protocol.name.replace(/\s*Finance\s*$/i, &quot;&quot;)
          </code>{" "}
          so the legal entity name never leaks into the byline.
        </p>
        <SourceLink path="src/components/product-page-body.tsx" symbol="byline render" />
      </Section>

      <Section id="about" title="5. About section">
        <p>
          Three paragraphs. Variable substitution only - do not paraphrase the
          template. Paragraph 1 introduces the product, paragraph 2 explains
          the autocompounding mechanic, paragraph 3 surfaces live stats.
        </p>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Single-asset Autocompounder
        </h3>
        <CodeBlock>{`P1: {DISPLAY_NAME} is a single-asset autocompounder on {NETWORK} with {TICKER}
    as its underlying token. The strategy supplies into {UNDERLYING_VENUE}
    and continually compounds the yield earned there back into the vault.

P2 (reward == ticker):
    Yield earned by the strategy is added back to the vault on a recurring
    basis. Autocompounding events run when economically feasible, anywhere
    from hourly to several days apart, with gas costs socialised across all
    holders rather than borne by each user individually.

P2 (reward != ticker):
    Rewards earned by the strategy ({REWARD}) are periodically converted into
    {TICKER} and added back to the vault. Autocompounding events run when
    economically feasible, anywhere from hourly to several days apart, with
    gas costs socialised across all holders rather than borne by each user
    individually.

P3: Live since {INCEPTION_DATE}. Currently indexed at {TVL} TVL[ across
    {HOLDERS} holder(s)], with a {APY_24H} 24-hour APY and {APY_30D} across
    the trailing 30 days.`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          LP-pair Autocompounder
        </h3>
        <CodeBlock>{`P1: {DISPLAY_NAME} is an LP-token autocompounder on {NETWORK}, with {TICKER}
    paired with {COUNTERPART} in the underlying LP position. The strategy
    provides liquidity to the {TICKER}/{COUNTERPART} pool on {PLATFORM} and
    earns yield from both trading fees on the pair and {REWARD} emissions
    distributed to liquidity providers.

P2: Any claimed {REWARD} rewards are automatically converted into more of
    the underlying LP position and added back to the vault, removing the
    manual claim and conversion steps a user would otherwise need to perform
    on their own. Autocompounding events run when economically feasible,
    anywhere from hourly to several days apart, with gas costs socialised
    across all holders rather than borne by each user individually.

P3: Live since {INCEPTION_DATE}. Currently indexed at {TVL} TVL[ across
    {HOLDERS} holder(s)], with a {APY_24H} 24-hour APY and {APY_30D} across
    the trailing 30 days.`}</CodeBlock>

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
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">0 / null / undefined</td>
              <td className="py-2">skip the fragment entirely</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">1</td>
              <td className="py-2 font-mono text-xs">across 1 holder</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">&gt; 1</td>
              <td className="py-2 font-mono text-xs">across {`{HOLDERS}`} holders</td>
            </tr>
          </tbody>
        </table>
        <SourceLink path="src/lib/autocompounder-about.ts" />
        <SourceLink path="src/lib/lp-pair-about.ts" />
      </Section>

      <Section id="performance" title="6. Performance Overview (4 numbered lines)">
        <p>
          Each line is one fact rendered as a numbered tile. Lines render only
          when their data conditions hold.
        </p>
        <CodeBlock>{`Line 01 (asset-cohort rank, three rank-ratio variants):
  rank/total <= 0.25 → "This vault's {APY} APY ranks #{R} among the {N}
    {TICKER} vaults we monitor, placing it in the top quarter of the cohort."
  ratio > 0.25       → "This vault's {APY} APY ranks #{R} among the {N}
    {TICKER} vaults we monitor, with {ABOVE} strategy/strategies currently
    delivering higher APY."

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
  ~0.05 ETH" for non-stable - never assume flat asset price.

Line 03 (current vs lifetime avg, render if lifetime.length >= 5):
  "Current APY of {APY} is below|above|roughly in line with this vault's
   lifetime average of {AVG}." (±0.5pp threshold for "roughly in line")

Line 04 (TVL 30d change, render if tvlSorted >= 2 and past >= 7d old):
  Both endpoints below $50K  → suppress percentage, render values only:
    "TVL stands at {CURRENT}, compared to {PAST} 30 days ago."
  Otherwise → render percentage:
    "TVL has {increased|decreased} {PCT}% over the past 30 days, from
     {PAST} to {CURRENT}."`}</CodeBlock>
        <p className="mt-3">
          <strong>Critical:</strong> the TVL threshold check is{" "}
          <code>AND</code>, not <code>OR</code>. Suppression triggers only when
          both endpoints are below $50K. The previous OR-gate hid real trends
          like $86K → $36K as if they were noise.
        </p>
        <SourceLink path="src/lib/autopilot-sections.ts" symbol="buildPerformanceOverview" />
      </Section>

      <Section id="benchmark" title="7. Market benchmarking">
        <p>
          Stats grid (4 metrics), ranking table (layout algorithm below), then
          a single closing-summary paragraph. The prior duplicate intro
          paragraph was removed.
        </p>
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Ranking table layout algorithm
        </h3>
        <CodeBlock>{`Case A (current rank 1-5): show ranks 1..5 (or whole cohort if smaller)
  as a contiguous block. No separator, no tail row.

Case B (current rank 6+): anchors = {1, 2, 3, rank-1, rank, rank+1, total}
  Walk anchors in order. Insert a slim "..." separator row only when the
  gap between anchors is > 1. When the gap is exactly 1, fill the missing
  row so adjacent visible rows stay contiguous.

Separator row: collapsed single-cell <span class="bt-row-sep-glyph">…</span>
  Flex-centred across full table width. Tighter vertical padding (8px),
  muted glyph color, no border-bottom override.`}</CodeBlock>

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
          LP-pair products in the ranking table use the canonical name +{" "}
          <code>&lt;LpBadge /&gt;</code>. Single-asset rows have no badge.
        </p>
        <SourceLink path="src/components/market-sections.tsx" symbol="MarketBenchmark" />
      </Section>

      <Section id="ecosystem" title="8. Ecosystem context">
        <p>
          Intro paragraph stating network-relative rank, then a bar chart of
          the top 10 same-asset strategies on the same chain, then a one-line
          closer with TVL rank.
        </p>
        <CodeBlock>{`Intro:
  "On {NETWORK}, this product's yield runs {ABS_VS_NET_AVG}% {higher|lower}
   than the network average across the {ASSET} strategies we monitor. By APY
   it ranks #{R} of {N} in that set. Yields on {NETWORK} for {ASSET} have
   averaged {NET_AVG}% in our index."

Chart: top 10 strategies, bar-coloured per-vault, network average baseline.
Legend: top 6 with rank, name (canonical + [LP] badge for LP-pair), APY.

Closer:
  isTop (rank == 1):
    "Currently the top-yielding {ASSET} opportunity on {NETWORK} across the
     {N} products we monitor."
  isTop == false:
    "By TVL, this product ranks #{TVL_R} of {N} {ASSET} strategies on
     {NETWORK} in our index."

NO trailing "This strategy is operated by X and competes against N other..."
sentence. The previous closer was removed because operator attribution is a
no-op fact (everything's operated by Harvest) and "competes against" is
blacklisted phrasing.`}</CodeBlock>
        <SourceLink path="src/components/market-sections.tsx" symbol="EcosystemContext" />
      </Section>

      <Section id="yield-traj" title="9. Yield trajectory">
        <p>
          Numbered fact list. Renders backward-looking $1,000-deposited values.
          This is the <strong>only</strong> section where the word{" "}
          <code>deposited</code> is allowed (linter exempts it inside{" "}
          <code>&lt;section id=&quot;yield-trajectory&quot;&gt;</code>).
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
          30 days of APY. Label maps deterministically from score per the
          5-zone editorial mapping.
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

Established vaults with sparse snapshots keep the score (the gate is AND,
not OR).`}</CodeBlock>
        <SourceLink path="src/components/vault-stability-card.tsx" symbol="computeStability + VaultStabilityCard" />
      </Section>

      <Section id="long-term" title="11. Long-term performance">
        <p>
          Three potential bullets. The section is suppressed entirely (returns{" "}
          <code>null</code>) when <code>tracked_days &lt; 30</code> - too
          little history to make annualised CAGR, peak/trough, or best/worst
          month informative.
        </p>
        <p>
          Data-quality guards (src/lib/contextualize.ts): bullet 1 is
          suppressed when the share-price series has a discontinuity (a single
          step implying &gt; 5%/day growth, i.e. a re-index / migration
          artifact, not realised yield - it would annualise to a CAGR that
          contradicts the indexed APY). Bullet 2 is suppressed when the TVL
          series is erratic (max &gt; 50x the median of positive readings),
          since a transient one-day spike is not a real peak. The same guards
          drop the "deposited at launch worth $X" line in Yield trajectory and
          fall the Historical-statistics TVL paragraph back to its peak-free
          form.
        </p>
        <CodeBlock>{`Bullet 1 (share-price CAGR, render if daySpan >= 30 AND no discontinuity):
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

Bullet 2 (TVL story, render if tvlHistory >= 10 AND maxDrawdownPct >= 15
  AND NOT erratic):
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
     {TROUGH}[ over {DAYS_DOWN} days]. It currently stands at {CURRENT},
     {PCT_VS_PEAK}% of the peak value."
  Drop the " over N days" clause when DAYS_DOWN rounds to 0 (peak and
  trough on the same indexed day) so it never reads "over 0 days".
  PCT_VS_PEAK renders "<1" instead of "0" when current is a non-zero
  sub-percent of the peak.
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
  NB: this is a DAY SPAN, not the reading COUNT (apyStats.dataPoints).
  The "(Nd)" suffix on the Lifetime-avg rows and the "over N days"
  sentence below both use this span. Using dataPoints (count) as days
  was the "138d vs 371 days" contradiction.

if apy_tracked_days < 7:
  "Tracked for {N} day(s). APY data is still accumulating; the first
   meaningful summary requires at least a week of readings."

elif apyStats.dataPoints >= 60 AND |changePct| > 10:
  earlyAvg = avg of first quarter
  lateAvg  = avg of last quarter
  "Over the past {trackedDays} days, this vault's APY has moved from
   {earlyAvg}% to {lateAvg}%, a {ABS_CHANGE}% {increase|decrease}. At the
   start of the window, {REF} would have earned {EARLY_EARN}/mo at then-
   current rates; at recent rates, {LATE_EARN}/mo."
  (Gate is on the reading count >= 60; the displayed number is the day
   span. Second sentence renders unconditionally - no $1/mo gate.)

else: no APY narrative paragraph (table renders alone).

30-day stat windows (30D Low/High/Average, Best/Worst day) anchor to
the latest indexed reading (latest_ts - 30d), NOT wall-clock now, so
they agree with the stability card / hero KPIs on stale vaults.`}</CodeBlock>

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
    Fallback (< 10 positive TVL points):
      "Total value locked currently sits at {LAST}. The vault has been live
       for {DAYS} days."

CRITICAL: do NOT gate this block on tvlStats (the 30-day stats object).
Vaults with no TVL snapshot in the trailing 30 days (latest snapshot >30d
old) still need the lifetime narrative.`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Stats tables (rendered after narratives)
        </h3>
        <p>
          Two side-by-side blocks (APY and TVL) when both have data; either
          one splits into two columns when alone. Each row has a
          <code>data-tooltip</code> attribute with the metric definition.
        </p>
        <SourceLink path="src/components/historical-stats.tsx" symbol="HistoricalStats" />
      </Section>

      <Section id="hist-data" title="13. Historical Data table">
        <CodeBlock>{`Dedupe: one row per UTC calendar day. For each UTC date, keep the snapshot
with the latest timestamp (end-of-day reading). Applied to all three tabs
(APY, TVL, Share Price).

Date display: locale "en-US" formatted with timeZone: "UTC". This must
match the dedupe key. Local-time display caused phantom duplicate rows
(adjacent UTC days collapsing to same local date).

Lifetime summary (top right of section):
  Lifetime avg | High | Low | Data points

Formatters: render real zeros as 0.00% / $0 / 0.0000. Dash placeholder fires
only for non-finite values (NaN, Infinity, undefined). The previous
"if (value === 0) return '-'" branch hid legitimate "Low: 0.00%" entries.

Pagination: ROWS_PER_PAGE constant, against the deduped row count.`}</CodeBlock>
        <SourceLink path="src/components/vault-history-table.tsx" symbol="VaultHistoryTable + dedupeLatestPerDay" />
      </Section>

      <Section id="details" title="14. Strategy details (structured data)">
        <p>
          Structured data block. Two-column grid of label/value rows. The
          Strategy row is hidden for Autopilot products (collapses to{" "}
          <code>Strategy: Autopilot</code> which duplicates the Type row).
          For autocompounders the Strategy row stays.
        </p>
        <CodeBlock>{`Rendered rows (Autocompounder):
  Strategy:  {protocolName}    (e.g. "Morpho", "Aerodrome")
  Network:   {chain} link to network hub
  Type:      Autocompounder
  Underlying: {asset}
  Rewards:   {reward tokens comma-separated, only if non-empty}
  Operator:  {operatorBrand}   (trimmed: never "Harvest Finance")
  Tracked for: {trackedDays} days
  Holders:   {holderCount} (if non-null)
  Vault contract: {address} + copy + explorer link (full-width row)
  Strategy contract: same (if vault.strategyAddress)
  Underlying token:  same (if vault.tokenAddress)`}</CodeBlock>
        <SourceLink path="src/components/product-page-body.tsx" symbol="Strategy details block" />
      </Section>

      <Section id="faq" title="15. FAQ (7 questions)">
        <p>
          Each FAQ item has <code>question</code>, <code>answer</code>{" "}
          (ReactNode for rendering), and <code>answerText</code> (plain string
          for JSON-LD <code>FAQPage</code> schema). Schema and rendered text
          must match - Google flags inconsistency.
        </p>
        <h3 className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          Single-asset Autocompounder
        </h3>
        <CodeBlock>{`Q1: What's the current APY for {DISPLAY_NAME}?
Q2: How does the autocompounding work?
    (reward == ticker: simpler version; reward != ticker: explains conversion)
Q3: Can I withdraw at any time?  → link to /risk-framework
Q4: Where does the yield come from?
    (reward == ticker: "interest paid by the underlying market"; else:
     "combination of interest paid by the underlying market and reward
      emissions in {REWARD}")
Q5: How stable has the APY been?
    (has 30d data: cites range/avg/volatility; no data: placeholder)
Q6: How much is currently in the vault?  (NOT "How much capital...")
Q7: What are the risks?
    Includes Halborn audit reference. No Autopilot engine mention.`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          LP-pair Autocompounder (Q2, Q4, Q7 differ)
        </h3>
        <CodeBlock>{`Q1: What's the current APY for {DISPLAY_NAME}?   (canonical name)
Q2: How does the autocompounding work?
    Explains LP-add flow: rewards converted in pair proportions, added back
    as liquidity, increases each holder's share.
Q3: Can I withdraw at any time?  → link to /risk-framework
Q4: Where does the yield come from?
    Two sources: trading fees on the pair + {REWARD} emissions.
Q5: How stable has the APY been?  (same as single-asset)
Q6: How much is currently in the vault?
Q7: What are the risks?
    Adds impermanent-loss explanation: "the value of the position also
    moves with the relative price of the two assets in the pair... when
    the two prices diverge, the LP position is worth less than holding
    the two tokens separately would have been."
    Halborn audit reference.`}</CodeBlock>
        <SourceLink path="src/lib/autocompounder-faq.tsx" />
        <SourceLink path="src/lib/lp-pair-faq.tsx" />
      </Section>

      <Section id="similar" title="16. Other opportunities">
        <p>
          Cross-sell rail at the bottom of the page. Six cards max. Filters
          and orders by proximity, not yield - APY-based ranking is already
          covered upstream.
        </p>
        <CodeBlock>{`Eligible: same asset, apy24h > 0, tvl > 0, not the current product.

Ordering (LP-pair current):
  1. same-network LP-pair (by TVL desc)
  2. same-network single-asset (by TVL desc)
  3. off-network LP-pair (by TVL desc)

Ordering (single-asset / autopilot current):
  1. same-network + same-type (by TVL desc)
  2. same-network + different-type (by TVL desc)
  3. off-network + same-type (by TVL desc)

Take first 6.

Card content: asset icon, canonical name + [LP] badge if LP-pair, chain
icon + chain name + stripped category, 24h APY, TVL.`}</CodeBlock>
        <SourceLink path="src/components/similar-vaults.tsx" />
      </Section>

      <Section id="footnote" title="17. Page footnote">
        <CodeBlock>{`Two lines, muted styling:

  Last updated <relative>
    relative = formatRelativeUpdated(max(history.tvlHistory[].timestamp,
                                         history.apyHistory[].timestamp,
                                         history.sharePriceHistory[].timestamp))
    Phrases: "Last updated just now" / "N minutes ago" / "N hours ago" /
             "N days ago" / "Last updated on Month D, YYYY"

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
        <CodeBlock>{`Single-asset:
  <title>            {productPageTitle(vault, isUniqueCombo)}
  <description>      {productPageDescription(vault)}

LP-pair:
  <title>            {ASSET}/{COUNTERPART} {PLATFORM} Yield on {CHAIN} | Harvest
  <description>      Autocompounding LP yield on the {ASSET}/{COUNTERPART}
                     pair on {PLATFORM} ({CHAIN}). {REWARD} rewards are claimed
                     and added back to the position automatically.

Titles and descriptions carry no APY %, TVL, or month/year - every
product's SEO copy is stable across the hourly rebuilds, so a cached
SERP snippet never drifts from the live page.`}</CodeBlock>

        <h3 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
          JSON-LD schemas (emitted in &lt;head&gt;)
        </h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <code>FAQPage</code> with <code>mainEntity[].name</code> +{" "}
            <code>acceptedAnswer.text</code> pulled from{" "}
            <code>answerText</code> field (never from the rendered ReactNode).
          </li>
          <li>
            <code>BreadcrumbList</code> matching{" "}
            <code>productPageCrumbs(vault)</code>.
          </li>
          <li>
            <code>Dataset</code> (or similar) for the financial product
            metadata.
          </li>
          <li>
            OpenGraph <code>article:modified_time</code> from latest history
            timestamp.
          </li>
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
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">holderCount === 0</td>
              <td className="py-2">About P3 skips &quot;across N holders&quot; fragment</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">holderCount === 1</td>
              <td className="py-2">About P3 renders singular &quot;1 holder&quot;</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 7</td>
              <td className="py-2">Historical stats APY paragraph → minimal &quot;still accumulating&quot; notice</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 30</td>
              <td className="py-2">Long-term performance entire section → suppressed</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">tracked_days &lt; 30 AND readings_indexed &lt; 14</td>
              <td className="py-2">Stability score/meter/label → suppressed; stats grid still renders</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">sharePriceHistory.length &lt; 2</td>
              <td className="py-2">Yield trajectory → suppressed</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">tvlHistory positive points &lt; 10</td>
              <td className="py-2">Historical stats TVL paragraph uses fallback (current + days only)</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">TVL 30d both endpoints &lt; $50K</td>
              <td className="py-2">Performance Overview line 4 suppresses percentage</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">vault.vaultType === &quot;Autopilot&quot;</td>
              <td className="py-2">Strategy details Strategy row + byline platform chip dropped</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">isLpPairVault(vault) === true</td>
              <td className="py-2">Byline platform chip dropped; LP badge rendered in rankings</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs">productName includes &quot;onlyboost&quot;</td>
              <td className="py-2">getCanonicalDisplayName returns productName as-is</td>
            </tr>
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
            <tr><td className="py-2 pr-4">Single-asset About</td><td className="py-2 font-mono text-xs">src/lib/autocompounder-about.ts</td></tr>
            <tr><td className="py-2 pr-4">LP-pair About</td><td className="py-2 font-mono text-xs">src/lib/lp-pair-about.ts</td></tr>
            <tr><td className="py-2 pr-4">Single-asset FAQ</td><td className="py-2 font-mono text-xs">src/lib/autocompounder-faq.tsx</td></tr>
            <tr><td className="py-2 pr-4">LP-pair FAQ</td><td className="py-2 font-mono text-xs">src/lib/lp-pair-faq.tsx</td></tr>
            <tr><td className="py-2 pr-4">Performance Overview + Yield Trajectory</td><td className="py-2 font-mono text-xs">src/lib/autopilot-sections.ts</td></tr>
            <tr><td className="py-2 pr-4">Market benchmarking + Ecosystem context</td><td className="py-2 font-mono text-xs">src/components/market-sections.tsx</td></tr>
            <tr><td className="py-2 pr-4">Stability card</td><td className="py-2 font-mono text-xs">src/components/vault-stability-card.tsx</td></tr>
            <tr><td className="py-2 pr-4">Long-term performance</td><td className="py-2 font-mono text-xs">src/components/historical-narrative.tsx</td></tr>
            <tr><td className="py-2 pr-4">Historical statistics</td><td className="py-2 font-mono text-xs">src/components/historical-stats.tsx</td></tr>
            <tr><td className="py-2 pr-4">Historical Data table</td><td className="py-2 font-mono text-xs">src/components/vault-history-table.tsx</td></tr>
            <tr><td className="py-2 pr-4">Other opportunities</td><td className="py-2 font-mono text-xs">src/components/similar-vaults.tsx</td></tr>
            <tr><td className="py-2 pr-4">LP-pair helpers + canonical name</td><td className="py-2 font-mono text-xs">src/lib/lp-pair.ts</td></tr>
            <tr><td className="py-2 pr-4">LP badge component</td><td className="py-2 font-mono text-xs">src/components/lp-badge.tsx</td></tr>
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
            <code>npm run build</code> succeeds. The banned-word linter at the
            tail of the build script must exit 0 (zero violations across all
            product pages).
          </li>
          <li>
            Pick one of each variant and load the page:
            <ul className="mt-1 list-disc pl-6">
              <li>Single-asset: <code>usdc-morpho-clearstar-core-v2-ethereum</code> (established with drawdown)</li>
              <li>LP-pair: <code>eth-aerodrome-vvv-base</code> (canonical name expansion)</li>
              <li>OnlyBoost: <code>eth-stake-dao-onlyboost-ethereum</code> (productName preserved)</li>
              <li>Fresh: any vault with under 30 days of tracking history</li>
            </ul>
          </li>
          <li>
            H1 reads the canonical name; breadcrumb&apos;s last crumb matches.
          </li>
          <li>
            About paragraph 3 holder fragment is correct for the vault&apos;s
            holder count (skip / singular / plural).
          </li>
          <li>
            Strategy stability either renders a score or the suppression
            notice + stats; never both, never neither.
          </li>
          <li>
            Long-term performance is absent on under-30-day vaults; present
            otherwise.
          </li>
          <li>
            Historical statistics renders both APY and TVL paragraphs when
            data supports them. TVL paragraph is independent of the 30-day
            window.
          </li>
          <li>
            Historical Data table has zero duplicate-date rows.
          </li>
          <li>
            Market benchmarking renders the summary paragraph exactly once,
            after the ranking table.
          </li>
          <li>
            Ranking views (hub table, benchmark table, ecosystem legend,
            Other opportunities, search dropdown) all use the canonical name
            and render the <code>&lt;LpBadge /&gt;</code> for LP-pair products
            with a visible gap.
          </li>
          <li>
            Header byline doesn&apos;t duplicate the platform when it&apos;s
            already in the canonical name (LP-pair) or equals the type
            (Autopilot).
          </li>
          <li>
            Operator field in Strategy details and the byline brand chip both
            read &quot;Harvest&quot;, never &quot;Harvest Finance&quot;.
          </li>
          <li>
            JSON-LD <code>FAQPage</code> in <code>&lt;head&gt;</code> answers
            match the rendered FAQ answers (compare to <code>answerText</code>).
          </li>
          <li>
            No em dashes anywhere in user-visible copy (
            <code>grep -c &apos;—&apos;</code> on any product page output is
            0).
          </li>
        </ol>
      </Section>

      <footer className="mt-12 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Editorial rules are load-bearing</p>
        <p className="mt-2">
          The rules above each have a specific origin (audit, regression,
          editorial decision). Changing one ripples through multiple sections,
          and the linter enforces the word-level rules so deploys fail loudly
          on regressions. If a rule appears to conflict with new requirements,
          surface the conflict before changing the rule, then update this
          page in the same PR. The whole point of consolidating here is that
          this is the single document a future operator can hand to a fresh
          AI and trust them to rebuild the page correctly.
        </p>
        <p className="mt-2">
          See also{" "}
          <Link className="underline" href="/control-room/ranking-rules">
            Ranking Rules
          </Link>{" "}
          for the editorial filters applied before any vault even reaches
          this page.
        </p>
      </footer>
    </main>
  );
}

