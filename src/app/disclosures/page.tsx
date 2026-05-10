import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { breadcrumbSchema } from "@/lib/jsonld";

const TITLE = "Disclosures: Operator Status & Conflicts | Harvest";
const DESCRIPTION =
  "Harvest Finance operator disclosures, conflict of interest statement, monetization model, and editorial discretion policy.";
const URL = `${SITE_URL}/disclosures`;
const LAST_UPDATED = "May 3, 2026";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: SITE_NAME,
    type: "article",
  },
  alternates: { canonical: URL },
};

const SECTIONS = [
  { id: "summary", label: "Important risk summary" },
  { id: "warranties", label: "1. Disclaimer of warranties" },
  { id: "operational", label: "2. Operational risks" },
  { id: "blockchain", label: "3. Blockchain risks" },
  { id: "third-party", label: "4. Third-party risks" },
  { id: "no-insurance", label: "5. No insurance or government backing" },
  { id: "audits", label: "6. Audit status" },
  { id: "market", label: "7. Market risks" },
  { id: "regulatory", label: "8. Regulatory risks" },
  { id: "incident-reporting", label: "9. Incident reporting and transparency" },
  { id: "mitigation", label: "10. Mitigation measures" },
];

export default function DisclosuresPage() {
  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Risk Disclosures" },
  ];

  return (
    <main className="methodology-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />

      <div className="meth-header">
        <nav className="meth-crumbs mono dim">
          <Link href="/">Home</Link>
          <span className="sep">›</span>
          <span>Risk Disclosures</span>
        </nav>
        <h1 className="meth-title">Disclosures</h1>
        <p className="meth-subtitle">
          Operator status, monetization model, conflicts of interest,
          and editorial discretion policy.
        </p>
        <p className="meth-version mono dim">Last updated: {LAST_UPDATED}</p>
      </div>

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
          <section id="summary" className="meth-section">
            <h2 className="meth-h2">Important risk summary</h2>
            <p>
              The Harvest website, and all related services are experimental
              technologies and are provided &ldquo;AS IS.&rdquo; They may carry
              significant risks including but not limited to:
            </p>
            <ul>
              <li>
                Bugs, vulnerabilities, or operational failures in smart
                contracts or the underlying blockchain.
              </li>
              <li>
                Total and irreversible loss of digital assets from
                cyberattacks, loss of wallet credentials, or website errors.
              </li>
              <li>
                No insurance, guarantee, or compensation is provided by any
                party associated with this website.
              </li>
              <li>
                Regulatory, tax, or legal risks may apply depending on the
                User&rsquo;s location.
              </li>
            </ul>
            <p>
              This information is provided for User awareness and does not
              constitute financial, legal, or other professional advice. The
              User should conduct their own due diligence before using the
              website. Do not use the website unless you fully understand and
              accept these risks.
            </p>
            <p>
              This Risk Disclosure statement (the &ldquo;Disclosure&rdquo;) is
              incorporated by reference into, and forms an integral part of,
              the Terms of Service. All of the terms used in the Disclosure
              have the same meaning assigned to them in the Terms.
            </p>
            <p>
              The Operator and any Related Parties (as defined in the Terms)
              expressly disclaim all liability for any losses or damages
              arising from or connected to these risks. By accepting the Terms
              and this Disclosure, you expressly waive and release any present
              or future claims, known or unknown, against the Operator and its
              Related Parties in relation to such risks, including claims
              arising from the Operator&rsquo;s own negligence.
            </p>
          </section>

          <section id="warranties" className="meth-section">
            <h2 className="meth-h2">1. Disclaimer of warranties</h2>
            <p>
              The Platform (including the Website, its App/Toolset and all
              integrated Third-Party Protocols and Services) is experimental
              and is provided &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE.&rdquo;
              The Operator makes no warranty, express or implied, regarding
              the Platform or its use. Without limiting the foregoing, the
              Operator and its Related Parties specifically disclaim all
              warranties, including:
            </p>
            <ul>
              <li>
                That the Platform or any related software will be free from
                defects, vulnerabilities, bugs, exploits, interruptions,
                errors, or security breaches.
              </li>
              <li>
                The implied warranties of merchantability, fitness for a
                particular purpose, and non-infringement.
              </li>
            </ul>
          </section>

          <section id="operational" className="meth-section">
            <h2 className="meth-h2">2. Operational risks</h2>
            <p>
              The Operator does not warrant that the Website or related
              software are secure or free from vulnerabilities, defects,
              errors, or malware. Events outside the Operator&rsquo;s
              reasonable control (including, but not limited to, cyberattacks,
              regulatory actions, natural disasters, and technical failures)
              may impair or prevent access to the Website or Toolset. The
              Operator reserves the right to modify, suspend, or discontinue
              the Website or Toolset at any time, without prior notice or
              liability. No warranty is provided regarding uninterrupted
              availability. The User is solely responsible for ensuring access
              to the genuine Website Interface at Harvest.Finance or its
              official subdomains. Interacting through a compromised or
              fraudulent interface may result in total and unrecoverable loss
              of assets or data, and the User hereby waives and releases the
              Operator from any claim or liability associated therewith, even
              if caused by the Operator&rsquo;s negligence.
            </p>
          </section>

          <section id="blockchain" className="meth-section">
            <h2 className="meth-h2">3. Blockchain risks</h2>
            <p>
              <strong>Third-Party Protocol and Service Risks:</strong>{" "}
              Third-Party Protocols, Wallets, or Services may undergo updates
              or changes that materially affect their performance,
              availability, or security. In addition, these components are
              highly susceptible to hacking, exploits, or other malicious
              attacks including lack of liquidity, preventing a user from
              withdrawing their assets.
            </p>
            <p>
              <strong>Smart Contract Vulnerabilities:</strong> The Harvest
              website is an ease of use tool that allows users to access
              public blockchain based smart contracts. Smart contracts and
              blockchain-based software may contain vulnerabilities, design
              flaws, or coding errors that could result in the partial or
              total loss of Digital Assets. Exploits may be discovered at any
              time.
            </p>
            <p>
              <strong>Blockchain Forks and Congestion:</strong> Blockchain
              networks may experience forks that create changes or alternative
              versions of the Toolset. The Operator has no ability or duty to
              predict, control, or notify Users of such events, nor does it
              guarantee which version will be supported. Users are solely
              responsible for staying informed about forks and managing any
              risks that may arise. Blockchain networks may also experience
              congestion, delays, or transaction failures, resulting in higher
              costs (gas fees) or unsuccessful transactions. Blockchain
              validators or consensus mechanisms may fail, be attacked, or act
              maliciously, resulting in disruption, manipulation, or loss.
            </p>
            <p>
              <strong>Systemic Failure:</strong> Any malfunction, failure, or
              abandonment of underlying blockchains (including EVM-compatible
              chains) may materially affect the operation of the Website and
              Third-Party Protocols and Services, and consequently impact the
              availability or functionality of the Website.
            </p>
            <p>
              <strong>Transaction Finality:</strong> All blockchain
              transactions are final, irreversible, and cannot be cancelled,
              reversed, refunded, blocked, or altered by the Operator or any
              third party.
            </p>
            <p>
              <strong>Advanced and Undisclosed Risks:</strong> Technical
              advances such as the development of quantum computers may
              present risks to blockchain systems, the Website, Third-Party
              Protocols, Wallets, or tokens, including the theft, loss, or
              inaccessibility of assets.
            </p>
            <p>
              The Operator disclaims all liability and responsibility
              regarding these events, as they are outside the Operator&rsquo;s
              control and may adversely impact User Digital Assets. There is
              no guarantee that Digital Assets will not be stolen or lost due
              to hacking, advanced cyber-attacks, denial-of-service incidents,
              double-spend or flash-loan exploits, programming errors,
              vulnerabilities in the Website, or flaws in the underlying
              blockchain networks. Such events may result in the partial or
              total loss of Digital Assets involved in transactions through
              the App, and the User hereby waives and releases the Operator
              from any claim or liability associated therewith, even if caused
              by the Operator&rsquo;s own negligence.
            </p>
          </section>

          <section id="third-party" className="meth-section">
            <h2 className="meth-h2">4. Third-party risks</h2>

            <h3 className="meth-h3">4.1. Protocol risk</h3>
            <p>
              The Operator does not endorse, control, or assume responsibility
              for any third-party content, services, or promotions that may be
              linked to or accessible through this Website. If a User chooses
              to engage with such third-party offerings, the User does so
              entirely at their own risk. By accessing them, you hereby waive
              and release the Operator from any liability arising from such
              use or participation, even if caused by the Operator&rsquo;s
              negligence.
            </p>
            <p>
              The Website provides access to the Harvest toolset. Accordingly,
              when using the toolset, the User may be exposed to certain risks
              related to the operation and functioning of the toolset and the
              Third-Party Protocols with which the Harvest website interacts.
            </p>
            <p>
              The website is experimental and high-risk, and the Operator
              disclaims all warranties that its components will function as
              expected. The User represents and warrants that the User will
              not use the website to interact with the toolset or Third-Party
              Services unless the User fully understands their operation and
              the consequences of the transactions initiated. The website may
              contain errors or vulnerabilities, fail to meet expectations, or
              result in financial loss. The website consists of autonomous,
              decentralized smart contracts deployed on blockchain networks,
              and is not owned, operated, or controlled by the Operator.
            </p>
            <p>
              <strong>Specific Protocol Dependencies:</strong> the
              website&rsquo;s performance relies on timely and accurate data
              from but not limited to IPOR Technology, Morpho, and other
              Third-Party Services. Delays, errors, manipulation, or
              unavailability of these inputs can lead to suboptimal or harmful
              liquidity positions. In particular:
            </p>
            <ul>
              <li>
                Harvest auto-compounding vaults, or any other integrated
                auto-compounding solutions, depend on scheduled
                &ldquo;harvest&rdquo; transactions to accrue and compound
                yield. Network congestion, failed transactions, or changes to
                underlying strategies in any of these systems may reduce
                expected performance.
              </li>
              <li>
                Morpho vaults are curated and managed by independent third
                parties. Re-position parameters, risk profiles, and liquidity
                conditions may change without notice. In rare circumstances,
                withdrawals may be delayed or restricted due to liquidity
                shortfalls, market freezes, or governance decisions.
              </li>
              <li>
                Supplying USDC, ETH, or any asset into a vault, autocompounder,
                optimizer, or allocation smart contract, exchanges assets for
                a vault receipt token (e.g., hUSDC, aMorphoUSDC, vault share
                tokens), which represents a claim on the underlying strategy
                and its performance. Access to the underlying asset depends
                entirely on vault liquidity, strategy solvency, and protocol
                conditions. If the vault becomes illiquid, paused, or
                impaired, you may be unable to redeem your vault token,
                temporarily or permanently.
              </li>
              <li>
                Frequent repositions via Harvest may incur transaction costs,
                slippage, or missed yield if vault entry and exit timing is
                suboptimal. Past performance of the toolset is not indicative
                of future results. Positions may underperform compared to
                holding assets in a single vault or other strategy.
              </li>
            </ul>
            <p>
              The User hereby waives and releases the Operator from any claim
              or liability arising from any of the risks described in this
              Section 4, even if such claim is based on the Operator&rsquo;s
              negligence.
            </p>

            <h3 className="meth-h3">4.2. Third-party content</h3>
            <p>
              Third-Party Content made available through the Website is
              provided solely for informational purposes and originates from
              independent third-party sources that are outside the
              Operator&rsquo;s control. Such content may be delayed,
              inaccurate, incomplete, manipulated, or otherwise misleading.
              The Operator is hereby released from all liability arising from
              the User&rsquo;s reliance on or use of Third-Party Content, even
              if caused by the Operator&rsquo;s negligence. The User shall
              independently verify such data and decide whether to transact
              with the Website.
            </p>

            <h3 className="meth-h3">4.3. Third-party wallets</h3>
            <p>
              To interact with the toolset through the Website, the User must
              utilize compatible third-party software or hardware Wallets.
              These wallets are developed, operated, and maintained solely by
              independent third parties; the Operator does not own, control,
              manage, or provide them. The User&rsquo;s use of any third-party
              wallet is entirely at the User&rsquo;s own risk, and the User is
              solely responsible for reviewing and complying with their
              applicable terms, conditions, and policies.
            </p>
            <p>
              The User is solely responsible for safeguarding wallet
              credentials, including private keys, seed phrases, and
              passwords. Loss, compromise, or theft of these credentials may
              result in the permanent and unrecoverable loss of Digital
              Assets. The Operator does not provide custodial services. The
              User retains sole control over the wallet and Digital Assets. If
              the User loses access to the wallet, no recovery mechanism
              exists.
            </p>
            <p>
              Not all wallets may be compatible with the Website or toolset.
              Using unsupported, insecure, or outdated wallets may result in
              failed transactions, loss of assets, or inability to access the
              website and/or toolset, and the User hereby waives and releases
              the Operator from any claim or liability associated therewith,
              even if caused by the Operator&rsquo;s negligence.
            </p>

            <h3 className="meth-h3">4.4. Third-party costs</h3>
            <p>
              The User&rsquo;s utilization of the toolset or Wallets is
              subject to Third-Party Costs, which may include, but are not
              limited to: performance, management, protocol, or transaction
              fees; blockchain network costs such as gas fees; fees related to
              Third-Party Services; and any other comparable third-party
              expenses.
            </p>
            <p>
              Changes in Third-Party Costs represent a financial risk that may
              materially reduce expected performance or returns. The Operator
              is not responsible for controlling, calculating, or notifying
              the User of any Third-Party Costs.
            </p>
            <p>
              The User hereby waives and releases the Operator from any claim
              or liability arising from or related to the imposition of any
              Third-Party Costs or the resulting reduction in financial
              performance, even if such claim is based on the Operator&rsquo;s
              negligence.
            </p>
          </section>

          <section id="no-insurance" className="meth-section">
            <h2 className="meth-h2">5. No insurance or government backing</h2>
            <p>
              Digital assets and transactions made through the website are not
              protected by any deposit insurance or by any government-backed
              program, agency, or authority.
            </p>
          </section>

          <section id="audits" className="meth-section">
            <h2 className="meth-h2">6. Audit status</h2>
            <p>
              Some of the toolset&rsquo;s utilized smart contracts have been
              reviewed by independent security auditors. These audit reports
              are available at{" "}
              <a
                href="https://github.com/harvestfi/audits/blob/main/Halborn-Harvest-2025.pdf"
                className="meth-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/harvestfi/audits
              </a>
              . However, an audit does not guarantee the absence of bugs or
              vulnerabilities.
            </p>
            <p>
              The User acknowledges and accepts that an audit is only one
              measure of due diligence, and the Operator provides no warranty
              regarding the completeness, accuracy, or efficacy of any audit.
              The User assumes all risk associated with the use of the website
              and/or application, regardless of the audit status.
            </p>
            <p>
              Smart contract risks remain, and the User could lose all their
              Digital Assets. The Operator is hereby released from any claim
              or liability arising from or related to vulnerabilities, errors,
              or bugs in the applications code, even if such loss is caused by
              the Operator&rsquo;s negligence.
            </p>
          </section>

          <section id="market" className="meth-section">
            <h2 className="meth-h2">7. Market risks</h2>
            <p>
              Digital Assets are highly volatile and subject to sudden
              fluctuations in value. Significant losses may occur in short
              periods of time. The Operator expressly disclaims any guarantee
              or warranty that any Digital Asset will retain its value,
              achieve a particular price, or generate profits. The value of
              Digital Assets depends on external factors beyond the
              Operator&rsquo;s control, which may negatively impact their
              stability or desirability.
            </p>
            <p>
              Certain assets or protocols may lack sufficient liquidity,
              making it difficult or impossible to exit a position without
              incurring significant losses.
            </p>
            <p>
              References to &ldquo;optimized positions,&rdquo; &ldquo;improved
              performance,&rdquo; or similar descriptions reflect historical
              or intended functionality only and do not guarantee results.
              Past performance is not indicative of future outcomes.
            </p>
            <p>
              The User hereby accepts and assumes all financial and market
              risk associated with the use of the website, and waives and
              releases the Operator from any claim or liability for financial
              losses resulting from market conditions or volatility, even if
              such loss is caused by the Operator&rsquo;s negligence.
            </p>
          </section>

          <section id="regulatory" className="meth-section">
            <h2 className="meth-h2">8. Regulatory risks</h2>
            <p>
              The legal and regulatory status of blockchain technologies,
              digital assets, and decentralized finance is uncertain in many
              jurisdictions and subject to change. Changes in law or
              enforcement could restrict or prevent the User&rsquo;s use of
              the Website, and Third-Party Protocols, Wallets, or other
              Third-Party Services. The User is solely responsible for
              ensuring their use complies with applicable laws in the
              User&rsquo;s relevant jurisdictions.
            </p>
            <p>
              Access to the Website is prohibited for residents, citizens, or
              entities from Restricted Jurisdictions or Restricted Persons (as
              defined in the Terms). Use in violation of these restrictions
              may expose the User to significant legal, regulatory, or
              enforcement risks, for which the Operator bears no
              responsibility.
            </p>
            <p>
              Transactions involving Digital Assets may trigger tax
              consequences, such as income taxes, capital gains, VAT, or other
              fiscal obligations. The User is solely responsible for
              evaluating, declaring, and paying all applicable taxes. The
              Operator does not provide tax advice, has not assessed potential
              tax outcomes, and expressly disclaims all responsibility and
              liability for the User&rsquo;s tax burdens or compliance.
            </p>
          </section>

          <section id="incident-reporting" className="meth-section">
            <h2 className="meth-h2">9. Incident reporting and transparency</h2>
            <p>
              The Website aims to maintain transparency and may disclose
              material incidents affecting the toolset or its integrated
              Third-Party Services. Such disclosure does not constitute an
              acceptance or admission of responsibility or liability on the
              part of the Operator for any resulting losses.
            </p>
          </section>

          <section id="mitigation" className="meth-section">
            <h2 className="meth-h2">10. Mitigation measures</h2>
            <p>
              The website utilizes internal mitigation measures, such as
              integrating audited smart contracts (where available) and
              sourcing from reputable protocols. The User acknowledges and
              accepts that these measures cannot eliminate all risks. The User
              represents and warrants that they shall remain vigilant and
              fully informed regarding all risks.
            </p>
            <p>
              The Operator makes no warranty or guarantee that these
              mitigation measures are effective or complete, and the User
              assumes all risk of loss regardless of their implementation.
            </p>
          </section>

          <section className="meth-section">
            <p>
              This Disclosure is incorporated by reference into, and forms
              part of, the{" "}
              <Link href="/terms" className="meth-link">Terms of Use</Link>.
              For a higher-level overview of how risk categories are
              communicated on individual product pages, see the{" "}
              <Link href="/risk-framework" className="meth-link">
                Risk Framework
              </Link>
              . For the methodology behind APY, TVL and ranking, see the{" "}
              <Link href="/methodology" className="meth-link">methodology</Link>{" "}
              page. Questions about this document can be sent to{" "}
              <a href="mailto:support@harvest.finance" className="meth-link">
                support@harvest.finance
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
