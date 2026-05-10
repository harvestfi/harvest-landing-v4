import type { Metadata } from "next";
import Link from "next/link";
import { HomeCrumb } from "@/components/home-crumb";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { breadcrumbSchema, articleSchema } from "@/lib/jsonld";
import { RISK_FRAMEWORK_VERSION, RISK_FRAMEWORK_CHANGELOG, RISK_FRAMEWORK_URL } from "@/lib/risk-framework";

const TITLE = "DeFi Yield Risk Framework: Categories Explained | Harvest";
const DESCRIPTION =
  "How to think about smart contract, oracle, liquidity, depeg, and governance risk in DeFi yield. An educational framework, not investment advice.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: RISK_FRAMEWORK_URL,
    siteName: SITE_NAME,
    type: "article",
  },
  alternates: { canonical: RISK_FRAMEWORK_URL },
};

const SECTIONS = [
  { id: "what-this-covers", label: "What this page covers" },
  { id: "smart-contract-risk", label: "Smart contract risk" },
  { id: "oracle-risk", label: "Oracle risk" },
  { id: "liquidity-risk", label: "Liquidity risk" },
  { id: "depeg-risk", label: "Depeg risk" },
  { id: "governance-risk", label: "Governance risk" },
  { id: "bridge-risk", label: "Bridge risk" },
  { id: "operator-risk", label: "Operator risk" },
  { id: "economic-risk", label: "Economic and market risk" },
  { id: "evaluate-yourself", label: "How to evaluate strategies" },
  { id: "what-harvest-does", label: "What Harvest does and doesn't do" },
  { id: "not-investment-advice", label: "Not investment advice" },
];

function StructuredData({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function RiskFrameworkPage() {
  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Risk Framework" },
  ];

  const breadcrumb = breadcrumbSchema(crumbs);
  // TODO: replace Organization author with a named Person + bio URL once
  // a team member is identified as the page author.
  const article = articleSchema({
    title: TITLE,
    description: DESCRIPTION,
    url: RISK_FRAMEWORK_URL,
    datePublished: RISK_FRAMEWORK_VERSION.date,
    dateModified: RISK_FRAMEWORK_VERSION.date,
  });

  const versionDate = new Date(RISK_FRAMEWORK_VERSION.date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <StructuredData data={breadcrumb} />
      <StructuredData data={article} />

      <main className="methodology-page">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="meth-header">
          <nav className="meth-crumbs mono dim">
            <HomeCrumb />
            <span>›</span>
            <span>Risk Framework</span>
          </nav>

          <h1 className="meth-title">DeFi Yield Risk Framework</h1>
          <p className="meth-subtitle">
            An educational overview of risk categories in DeFi yield. Not investment advice.
          </p>
          <p className="meth-version mono dim">
            v{RISK_FRAMEWORK_VERSION.version} · Updated {versionDate}
          </p>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="meth-layout">
          <aside className="meth-toc" aria-label="Page sections">
            <p className="meth-toc-label mono">On this page</p>
            <ul className="meth-toc-list">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="meth-toc-link">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>

          <article className="meth-body">

            {/* ── What this page covers ─────────────────────── */}
            <section id="what-this-covers" className="meth-section">
              <h2 className="meth-h2">What this page covers</h2>

              <div className="meth-callout">
                Harvest does not rate, score, or evaluate the risk of specific
                protocols, vaults, or strategies. This page explains risk
                categories as concepts. Applying that framework to any specific
                strategy is the user's responsibility, not ours.
              </div>

              <p>
                DeFi yield strategies involve several categories of risk that are
                distinct from ordinary market risk. Understanding those categories -
                what they are, how they typically fail, and what information you can
                examine - is a prerequisite for making informed decisions about where
                to deploy capital.
              </p>
              <p>
                This page describes each risk category in the context of yield
                strategies specifically. It references real, documented events from
                DeFi history as illustrations of how these failure modes manifest. It
                does not draw conclusions about specific protocols or vaults that are
                currently live.
              </p>
              <p>
                For what data Harvest publishes about indexed strategies, see{" "}
                <Link href="/methodology" className="meth-link">our methodology</Link>.
                For our disclosure on operator relationships, see the{" "}
                <Link href="/methodology#disclosure" className="meth-link">
                  disclosure section
                </Link>
                . Nothing here constitutes investment advice.
              </p>
            </section>

            {/* ── Smart contract risk ───────────────────────── */}
            <section id="smart-contract-risk" className="meth-section">
              <h2 className="meth-h2">Smart contract risk</h2>
              <p>
                Every DeFi yield strategy runs on smart contracts: code deployed
                on a blockchain that executes according to its logic, without the
                ability for any party to intervene once a transaction is in motion.
                Smart contract risk is the probability that a flaw in that code -
                whether in the vault itself or in a protocol the vault integrates
                with - allows an attacker to drain, lock, or permanently impair
                deposited funds.
              </p>
              <p>
                In yield context, this typically surfaces in one of three patterns.
                The first is a bug in the vault's own accounting logic: how user
                shares are tracked, how compounded yield is distributed, or how
                deposits and withdrawals interact with outstanding positions. The
                second is inherited exposure through integrations: a vault that
                deposits into protocol A inherits protocol A's smart contract
                vulnerabilities, even if the vault contract itself is flawless.
                The third is flash loan attacks, where an attacker borrows a large
                sum within a single transaction to temporarily manipulate the
                conditions that vault logic assumes are stable.
              </p>
              <p>
                The Euler Finance exploit in March 2023 illustrates the inherited
                exposure problem directly. Approximately $197 million was drained
                through a flaw in Euler's donation mechanism - a path that allowed
                an attacker to create a bad debt position and then liquidate it
                advantageously. Every strategy that had allocated to Euler was
                affected by a vulnerability that existed entirely outside the
                vault's own code.
              </p>
              <p>
                The Curve Finance reentrancy event in July 2023 illustrated a
                different vector: compiler-level bugs. Several Curve pools using
                Vyper compiler versions with a known reentrancy guard flaw were
                exploited, affecting a range of strategies that had integrated with
                those pools. The vulnerability was in the language implementation,
                not in any individual protocol's application code, and was not
                visible to application-level auditors.
              </p>
              <p>
                What you can examine: whether the vault contract and integrated
                protocols have received independent security audits; which firms
                conducted those audits; whether the audit reports are publicly
                available and cover the code currently in production; whether a
                bug bounty program exists; and how long the strategy has operated
                at meaningful TVL without a reported incident.
              </p>
              <p>
                Harvest does not rate strategies on smart contract risk. For what
                we publish, see{" "}
                <Link href="/methodology" className="meth-link">our methodology</Link>.
              </p>
            </section>

            {/* ── Oracle risk ───────────────────────────────── */}
            <section id="oracle-risk" className="meth-section">
              <h2 className="meth-h2">Oracle risk</h2>
              <p>
                Most lending and borrowing protocols that underlie yield strategies
                rely on external price feeds - oracles - to value collateral and
                determine when to trigger liquidations. When an oracle delivers a
                price that doesn't match the actual market, the protocol may lend
                against inflated collateral, fail to liquidate insolvent positions,
                or both. Yield strategies that deposit into these protocols inherit
                the oracle risk of the underlying system.
              </p>
              <p>
                The Mango Markets incident in October 2022 is the most clearly
                documented example of this attack vector at scale. An attacker
                used coordinated spot market purchases to temporarily inflate the
                price of MNGO in both the oracle and the underlying exchange,
                borrowed heavily against the inflated collateral value, and
                withdrew approximately $117 million before prices reverted. No
                bug in the code was required; the oracle design's reliance on
                spot prices in a thin market was the vulnerability.
              </p>
              <p>
                Time-weighted average price oracles (TWAPs) reduce the attack
                surface for this kind of manipulation by requiring sustained price
                distortion over a time window, but introduce a different problem:
                they lag behind actual market prices during fast moves, which can
                cause delayed or missed liquidations during genuine volatility.
                This tradeoff between manipulation resistance and price freshness
                is a fundamental tension in oracle design, not a solved problem.
              </p>
              <p>
                What you can examine: whether the underlying protocols use spot
                oracles or time-weighted pricing; whether multiple independent
                price sources are aggregated with deviation checks; whether
                circuit breakers exist that pause operations when prices move
                faster than the oracle can safely track; and whether the
                protocol's oracle architecture is documented publicly.
              </p>
              <p>
                Harvest does not rate strategies on oracle risk.
              </p>
            </section>

            {/* ── Liquidity risk ────────────────────────────── */}
            <section id="liquidity-risk" className="meth-section">
              <h2 className="meth-h2">Liquidity risk</h2>
              <p>
                Liquidity risk in DeFi yield is not about the underlying asset
                losing value - it's about whether you can exit your position,
                when you want to exit, and at what cost. These three dimensions
                are distinct, and any one of them can create problems independent
                of the others.
              </p>
              <p>
                Withdrawal queues and caps are common in lending protocols during
                periods of high utilization: if most of a pool's liquidity has
                been borrowed, depositors may not be able to withdraw until
                borrowers repay or more depositors arrive. This is an intentional
                design feature, not necessarily a warning sign, but it changes
                the effective risk profile for anyone who might need funds quickly.
                Some protocols also impose explicit per-block or per-epoch
                withdrawal limits as safety mechanisms.
              </p>
              <p>
                For LP strategies - where the vault holds positions in an
                automated market maker - exit cost can be substantial. Removing
                a large position from a pool with thin liquidity moves the price
                against the position, effectively charging a slippage fee that
                doesn't appear in APY calculations. During high-stress periods
                when multiple depositors exit simultaneously, this cost compounds.
              </p>
              <p>
                What you can examine: whether the strategy's terms specify any
                withdrawal caps, queues, or time delays; how total TVL compares
                to the liquidity available in underlying pools; whether there are
                lockup periods or vesting schedules embedded in the strategy;
                and what happened operationally during previous stress events.
              </p>
              <p>
                Harvest does not rate strategies on liquidity risk.
              </p>
            </section>

            {/* ── Depeg risk ────────────────────────────────── */}
            <section id="depeg-risk" className="meth-section">
              <h2 className="meth-h2">Depeg risk</h2>
              <p>
                Depeg risk applies specifically to strategies whose value is
                denominated in an asset that maintains a fixed relationship with
                another asset: dollar-pegged stablecoins, or tokens that wrap
                a native asset (stETH for ETH, WBTC for BTC, cbETH, and similar).
                If that relationship breaks down, the value of the strategy
                breaks down with it - independent of how well the yield mechanism
                performed. A strategy that accurately generated 9% APY on USDC
                is still a loss if USDC trades at $0.87 when you exit.
              </p>
              <p>
                The May 2022 collapse of UST illustrated how quickly algorithmic
                stablecoin mechanisms can fail. UST maintained its dollar peg
                through an arbitrage relationship with LUNA where minting one
                required burning the other. The mechanism assumed sufficient
                demand existed on both sides to absorb supply shocks. When
                confidence broke, the mechanism amplified rather than contained
                the spiral - LUNA's inflation rendered the backing worthless,
                UST lost its peg, and the currency reached effectively zero within
                days. Yield strategies denominated in UST generated their stated
                APY throughout; the APY figure was irrelevant.
              </p>
              <p>
                Fully collateralized stablecoins are not immune. In March 2023,
                USDC briefly traded at approximately $0.87 following uncertainty
                about Circle's reserve exposure to Silicon Valley Bank at the time
                of the bank's failure. The solvency concern resolved favorably and
                the peg recovered, but the event illustrated that even
                fiat-collateralized stablecoins can experience significant
                temporary depegs during information shocks.
              </p>
              <p>
                Wrapped assets carry an additional dimension of depeg risk: the
                bridge or custody mechanism that backs the wrapping. If the entity
                or contract that holds the native asset fails, the wrapped token
                loses its backing independent of what happens to the native asset.
              </p>
              <p>
                What you can examine: how the peg is maintained - algorithmic,
                overcollateralized, fiat reserve, or CDP-based; for fiat-backed
                tokens, the frequency and scope of reserve attestations and the
                transparency of the custodian; for liquid staking tokens, the
                smart contracts governing the staking queue and slashing coverage;
                and how the token has historically behaved during market stress.
              </p>
              <p>
                Harvest does not rate strategies on depeg risk.
              </p>
            </section>

            {/* ── Governance risk ───────────────────────────── */}
            <section id="governance-risk" className="meth-section">
              <h2 className="meth-h2">Governance risk</h2>
              <p>
                Most DeFi protocols can be changed by their governance - token
                holders, multisig signers, or DAOs that control the ability to
                modify parameters, upgrade contracts, or redirect funds. This
                creates a risk category where the danger isn't a bug but an
                authorized change: a parameter shift that increases required
                collateral, a fee redirect that diverts yield, or a contract
                upgrade that introduces new logic.
              </p>
              <p>
                The Beanstalk incident in April 2022 is the most documented
                extreme case: an attacker used a flash loan to temporarily acquire
                governance supermajority and pass a proposal that drained
                approximately $182 million from the protocol. No code was
                exploited in the conventional sense - the governance mechanism
                executed exactly as designed. The vulnerability was in the design
                itself: the absence of a time delay between a proposal passing
                and taking effect.
              </p>
              <p>
                The more common form of governance risk is less dramatic but more
                relevant to long-term depositors: well-intentioned governance
                decisions that adversely affect existing positions. Interest rate
                model changes, collateral factor adjustments, fee structure
                revisions, or strategy shifts can all change the risk-reward
                profile of a deposit mid-stream, without any malicious intent.
                Whether these changes are communicated clearly in advance, and
                how much time depositors have to exit before changes take effect,
                varies significantly across protocols.
              </p>
              <p>
                What you can examine: whether protocol governance operates through
                a multisig, a DAO, or a single key; what timelocks exist between
                a proposal passing and taking effect; whether token distribution
                is concentrated enough for a small number of holders to exert
                outsized control; and whether historical governance decisions are
                publicly visible and documented.
              </p>
              <p>
                Harvest does not rate strategies on governance risk.
              </p>
            </section>

            {/* ── Bridge risk ───────────────────────────────── */}
            <section id="bridge-risk" className="meth-section">
              <h2 className="meth-h2">Bridge risk</h2>
              <p>
                Strategies holding cross-chain wrapped assets - assets whose value
                is backed by tokens locked in a bridge contract on another chain -
                carry an additional failure mode: the bridge itself. A bridge
                exploit can cause a wrapped asset to lose its backing even if the
                native asset and the destination chain are both intact.
              </p>
              <p>
                The Wormhole bridge exploit in February 2022 (approximately $320
                million) involved a signature verification flaw that allowed an
                attacker to mint wrapped ETH on Solana without providing the
                corresponding native ETH as backing. The Ronin bridge exploit in
                March 2022 (approximately $625 million) involved compromised
                validator keys. In both cases, the mechanism failed at the custody
                layer, not at the application layer of the strategies using the
                bridged assets.
              </p>
              <p>
                Bridge risk is relevant wherever a strategy holds a cross-chain
                derivative of a native asset. Harvest does not rate strategies on
                bridge risk.
              </p>
            </section>

            {/* ── Operator risk ─────────────────────────────── */}
            <section id="operator-risk" className="meth-section">
              <h2 className="meth-h2">Operator and curator risk</h2>
              <p>
                Some yield strategies are managed by a named operator or curator
                who holds discretion over strategy parameters within a broader
                protocol framework. This adds a layer of risk that is distinct
                from protocol governance: the operator can act within their
                permitted parameter range without a governance vote, potentially
                quickly and with limited public notice.
              </p>
              <p>
                The relevant questions are: who the operator is and whether their
                identity is public; what the scope of their permitted actions
                covers; whether operator decisions are subject to timelocks; what
                recourse depositors have if an operator acts in a way that
                adversely affects their position; and whether the operator's
                historical decisions are visible and auditable.
              </p>
              <p>
                Harvest does not rate strategies on operator risk.
              </p>
            </section>

            {/* ── Economic risk ─────────────────────────────── */}
            <section id="economic-risk" className="meth-section">
              <h2 className="meth-h2">Economic and market risk</h2>
              <p>
                Beyond the failure modes above, yield strategies are exposed to
                economic risks that don't involve exploits, governance failures,
                or depegs: impermanent loss for liquidity provider strategies,
                MEV extraction, and correlated market drawdowns.
              </p>
              <p>
                Impermanent loss applies to LP strategies where the vault holds
                positions in an automated market maker. When the prices of the two
                pooled assets diverge, the LP position underperforms compared to
                simply holding the assets outside the pool. This underperformance
                becomes realized when the position is closed, and is "impermanent"
                only in the sense that it reverses if the price ratio returns to
                the level at which the LP entered. Yield from LP fees partially
                offsets impermanent loss, but does not always offset it fully,
                and the offset is not predictable in advance.
              </p>
              <p>
                MEV (maximal extractable value) refers to the ability of block
                producers and searchers to extract value from transactions by
                reordering, inserting, or front-running them. For yield strategies,
                the most direct exposure is through sandwich attacks on compound
                transactions: a bot detects an incoming large swap and positions
                trades before and after it to capture the price impact. The result
                is that the strategy's compound operation executes at a slightly
                worse price than the stated rate, reducing effective returns.
              </p>
              <p>
                Harvest does not rate strategies on economic or market risk. The
                observational data we publish - APY history, TVL, share price - is
                an input to this assessment but not a substitute for it. See{" "}
                <Link href="/methodology#apy-calculation" className="meth-link">
                  our methodology
                </Link>{" "}
                for how those figures are calculated.
              </p>
            </section>

            {/* ── How to evaluate ───────────────────────────── */}
            <section id="evaluate-yourself" className="meth-section">
              <h2 className="meth-h2">How to evaluate strategies yourself</h2>
              <p>
                The categories above describe types of risk. This section
                describes a sequence of questions to work through when evaluating
                any specific yield strategy. These are not criteria that Harvest
                applies; they are questions you can investigate independently
                using publicly available information.
              </p>

              <h3 className="meth-h3">Audit history</h3>
              <p>
                The relevant questions are not just "has it been audited?" but:
                how many independent firms have audited the vault contract
                specifically (not just the underlying protocol); when the most
                recent audit occurred relative to the current codebase; whether
                the audit reports are publicly available; and whether reports
                cover the code actually running in production, not an earlier
                version. A strategy audited by one firm three years ago on a
                prior codebase has different audit coverage than one audited by
                four firms within the last year following recent upgrades. Bug
                bounty programs maintained by the protocol create ongoing
                incentive for external security review after formal audits are
                complete.
              </p>

              <h3 className="meth-h3">Track record at meaningful scale</h3>
              <p>
                Time live without a reported incident is meaningful evidence,
                but not unconditionally so. A strategy that has operated with
                substantial TVL across multiple market cycles - including periods
                of high volatility, concurrent exploit events in related protocols,
                and liquidity stress - has been tested in ways that newer or
                lower-TVL strategies have not. Track record in conditions of thin
                TVL and low market stress provides weaker evidence about how the
                strategy will behave at scale during adverse conditions.
              </p>

              <h3 className="meth-h3">Mechanism transparency</h3>
              <p>
                Can you understand what the strategy actually does? A strategy
                with clear documentation of its yield sources, a readable
                codebase, and a public explanation of its compounding approach is
                easier to evaluate than one that is opaque. Opacity increases the
                information asymmetry between depositor and operator. It doesn't
                always indicate a problem - some legitimate strategies involve
                genuinely complex mechanics - but it does mean you're accepting
                more unknown unknowns.
              </p>

              <h3 className="meth-h3">Exit conditions</h3>
              <p>
                Withdrawal terms should be disclosed explicitly by the operator
                and visible in the contract's logic. The questions worth
                answering: are there withdrawal caps per block, per day, or per
                epoch? Are there lockup periods or unstaking queues? How quickly
                can you exit a position in full? A strategy that looks attractive
                on yield may look different if capital is locked for 90 days
                during which conditions, governance, and market prices can all
                change substantially.
              </p>

              <h3 className="meth-h3">Governance concentration</h3>
              <p>
                Who can change the parameters of this strategy, and how quickly?
                A protocol where a small multisig can modify interest rate models
                or collateral factors without a time delay has different governance
                risk than one with on-chain voting and 72-hour timelocks. Neither
                design is inherently problematic, but the difference matters for
                how you should think about the stability of conditions over the
                period you intend to be deposited. Historical governance activity
                - what decisions have been made, how they were communicated, and
                how depositors were affected - is usually publicly observable on
                governance forums and on-chain.
              </p>

              <h3 className="meth-h3">Documentation quality</h3>
              <p>
                Teams that maintain clear and current documentation - explaining
                how the protocol works, what assumptions it makes, and what the
                known risks and limitations are - tend to think more carefully
                about failure modes. This is a weak signal, not a determinative
                one. But protocols that actively document their own risks are more
                likely to have stress-tested those risks internally. The absence
                of documentation doesn't mean a protocol is unsafe; it does mean
                you have less information to work with.
              </p>
            </section>

            {/* ── What Harvest does / doesn't do ────────────── */}
            <section id="what-harvest-does" className="meth-section">
              <h2 className="meth-h2">What Harvest does and doesn't do</h2>
              <p>
                To be explicit about the boundary between what this site provides
                and what it does not:
              </p>
              <p>
                Harvest publishes APY history, TVL, share price history, and
                strategy metadata for indexed strategies. These are observational
                records of what has happened. We do not interpret them as
                indicators of safety or risk level.
              </p>
              <p>
                Harvest does not rate, score, or rank strategies on risk. We do
                not perform independent security assessments of vault contracts,
                oracle architectures, governance structures, or operator conduct.
                No part of this site should be read as an endorsement of any
                strategy as appropriate for any depositor.
              </p>
              <p>
                Where a risk classification appears on a product page, it is an
                operator-provided baseline designation, not an independent
                Harvest assessment. Our role is to publish the data that indexed
                protocols make available; the risk evaluation is yours to conduct.
                See{" "}
                <Link href="/methodology#risk-framework" className="meth-link">
                  our methodology
                </Link>{" "}
                for the full explanation of what those fields represent.
              </p>
              <p>
                Past performance data - APY history, TVL trajectory, share price
                growth - describes what happened. It does not predict what will
                happen. A strategy that operated without incident for three years
                can fail in the fourth. Historical track records reduce but do not
                eliminate this probability, and they provide no information about
                failure modes that have not yet been triggered.
              </p>
              <p>
                Audits do not guarantee safety. They reduce the probability of
                specific classes of vulnerabilities by subjecting code to
                independent expert review. Multiple audits, from multiple firms,
                reduce it further. No audit has ever established that a protocol
                is free of exploitable bugs; a number of audited protocols have
                subsequently been exploited. Audit reports are useful inputs to
                research; they are not binary evidence of safety.
              </p>
            </section>

            {/* ── Not investment advice ─────────────────────── */}
            <section id="not-investment-advice" className="meth-section">
              <h2 className="meth-h2">Not investment advice</h2>

              <div className="meth-disclosure">
                <p>
                  Nothing on this page or elsewhere on harvest.finance constitutes
                  financial or investment advice. DeFi participation involves risk
                  of partial or total loss of deposited capital, including through
                  the failure modes described on this page. The fact that a strategy
                  appears in Harvest's index does not indicate that it is safe,
                  suitable, or recommended for any particular user or use case.
                </p>
                <p>
                  This page is educational. It describes risk categories and offers
                  a framework for conducting your own research. It does not make
                  recommendations about specific strategies, protocols, allocations,
                  or positions. Harvest is not a financial adviser, broker, or
                  investment manager.
                </p>
                <p>
                  Users should conduct independent research, read the documentation
                  and audit reports published by the protocols they intend to use,
                  and - where appropriate - consult qualified financial, legal, or
                  technical advisers before making any financial decision. Harvest
                  assumes no responsibility for losses incurred through use of or
                  reliance on information published on this site.
                </p>
              </div>

              <div className="rf-changelog">
                <p className="meth-h3" style={{ margin: "24px 0 10px" }}>Version history</p>
                <table className="meth-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Date</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RISK_FRAMEWORK_CHANGELOG.map((entry) => (
                      <tr key={entry.version}>
                        <td className="mono">{entry.version}</td>
                        <td className="mono">{entry.date}</td>
                        <td>{entry.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </article>
        </div>
      </main>
    </>
  );
}
