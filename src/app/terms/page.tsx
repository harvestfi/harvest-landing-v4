import type { Metadata } from "next";
import Link from "next/link";
import { HomeCrumb } from "@/components/home-crumb";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { breadcrumbSchema } from "@/lib/jsonld";

const TITLE = "Terms of Use | Harvest";
const DESCRIPTION =
  "Terms of Use governing access to and use of the Harvest website and app.";
const URL = `${SITE_URL}/terms`;
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
  { id: "definitions", label: "1. Definitions and interpretation" },
  { id: "availability", label: "2. Availability, access and updates" },
  { id: "eligibility", label: "3. Eligibility" },
  { id: "user-interaction", label: "4. User interaction with the Website and the Protocol" },
  { id: "permitted-use", label: "5. Permitted use" },
  { id: "prohibited-uses", label: "6. Prohibited uses" },
  { id: "no-financial-advice", label: "7. No financial advice" },
  { id: "risk-acknowledgement", label: "8. Risk disclosure acknowledgements" },
  { id: "third-parties", label: "9. Third-party protocols, services, wallets, and content" },
  { id: "license", label: "10. Licence" },
  { id: "privacy", label: "11. Privacy policy" },
  { id: "intellectual-property", label: "12. Intellectual property" },
  { id: "indemnification", label: "13. Indemnification" },
  { id: "limitation-of-liability", label: "14. Limitation of liability" },
  { id: "warranties", label: "15. Warranties and representations" },
  { id: "fees", label: "16. Fees and transactions" },
  { id: "no-warranties", label: "17. No warranties" },
  { id: "dispute-resolution", label: "18. Dispute resolution and arbitration" },
  { id: "class-action-waiver", label: "19. Class action and jury trial waiver" },
  { id: "governing-law", label: "20. Governing law and disputes" },
  { id: "electronic-communications", label: "21. Electronic communications" },
  { id: "force-majeure", label: "22. Force majeure" },
  { id: "language", label: "23. Language" },
  { id: "validity", label: "24. Validity and enforceability" },
  { id: "entire-agreement", label: "25. Entire representation, consent, and agreement" },
];

export default function TermsPage() {
  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Terms of Use" },
  ];

  return (
    <main className="methodology-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />

      <div className="meth-header">
        <nav className="meth-crumbs mono dim">
          <HomeCrumb />
          <span className="sep">›</span>
          <span>Terms of Use</span>
        </nav>
        <h1 className="meth-title">Terms of Use</h1>
        <p className="meth-subtitle">
          These Terms of Use govern access to and use of the Harvest website
          and app. By accessing the site, you agree to be bound by them.
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
          <section className="meth-section">
            <p>
              These Terms of Use and any terms and conditions incorporated by
              reference (collectively, the &ldquo;Terms&rdquo;) govern access
              to and use of the Interface available at{" "}
              <a
                href="https://harvest.finance"
                className="meth-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                harvest.finance
              </a>{" "}
              (the &ldquo;Interface&rdquo;) and the Application/Toolset
              available at{" "}
              <a
                href="https://app.harvest.finance"
                className="meth-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                app.harvest.finance
              </a>{" "}
              (the &ldquo;App,&rdquo; and collectively with the Interface, the
              &ldquo;Website&rdquo;), by each individual, entity, group, or
              association (collectively &ldquo;User&rdquo; or
              &ldquo;Users&rdquo;) who views, interacts, links to, or
              otherwise uses or derives any benefit from the Website. The
              Website is provided by The Farmer Chad Foundation (the
              &ldquo;Operator&rdquo;).
            </p>
            <p>
              The Website includes the Interface, which provides information
              regarding the Protocol (as defined below), and the App, an
              online interface intended to enable Users to interact with the
              Protocol in a simplified and accessible way. The Protocol is
              separate and independent from the Website, and it is not
              offered, operated, or administered by the Operator.
            </p>
            <p>
              By accessing, browsing, or using the Operator&rsquo;s Website or
              by acknowledging User&rsquo;s agreement to the Terms of the
              Website, or clicking the button &ldquo;Accept&rdquo; or
              connecting User&rsquo;s Wallet (as defined below) to the App
              (collectively &ldquo;Accessing&rdquo;), the User confirms that
              the User has read, understood, and agrees to be bound by these
              Terms, the Operator&rsquo;s Privacy Policy, and the
              Operator&rsquo;s Risk Disclosures, which are incorporated by
              reference into these Terms, and any additional policies or
              guidelines incorporated by reference, which form a legally
              binding agreement between the User and the Operator. If the
              User does not agree to all of the foregoing, the User must
              refrain from accessing or using the Website or cease using the
              Website immediately.
            </p>
            <p>
              The Operator may amend or update these Terms from time to time,
              at any time by posting a revised version on the Website. If the
              Operator makes changes to these Terms, the Operator will notify
              the User of such changes by providing a notice via the Website
              and updating the &ldquo;Last Updated&rdquo; date at the top of
              these Terms. The updated Terms will become effective immediately
              upon posting. User&rsquo;s continued access or use of the
              Website constitutes User&rsquo;s acknowledgment and acceptance
              of the updated Terms. If the User does not agree to the updated
              Terms, the User must discontinue User&rsquo;s use of the
              Website.
            </p>
            <p>
              These Terms outline important points about User&rsquo;s rights
              and responsibilities. In particular, Sections 18, 19, and 20
              explain how disputes are handled, including arbitration,
              governing law, and the waiver of class actions and jury trials.
              Sections 13, 14, and 17 cover indemnification, limits on
              liability, and warranty disclaimers for the Website.
            </p>
          </section>

          <section id="definitions" className="meth-section">
            <h2 className="meth-h2">1. Definitions and interpretation</h2>
            <p>
              In these Terms, unless the context otherwise requires, the
              following terms shall have the meanings set forth below:
            </p>
            <dl className="meth-defs">
              <dt>App or Toolset</dt>
              <dd>refers to the meaning assigned to it in the preamble of these Terms.</dd>

              <dt>Blockchain</dt>
              <dd>
                a type of distributed ledger technology that records
                transactions in a secure, verifiable, and tamper-resistant
                manner through the use of cryptographic techniques and
                consensus mechanisms. A Blockchain consists of a continuously
                growing list of records (blocks) that are linked together
                chronologically and immutably, and which are collectively
                maintained by a decentralized network of participants rather
                than a single centralized authority.
              </dd>

              <dt>Digital Assets</dt>
              <dd>
                cryptocurrencies and other cryptographic tokens recorded on a
                blockchain or similar distributed ledger technology.
              </dd>

              <dt>Documentation</dt>
              <dd>
                any written, electronic, or digital materials provided,
                referenced, or made available by the Operator in connection
                with the Website, including but not limited to guides,
                manuals, whitepapers, FAQs, technical specifications,
                tutorials, educational resources, blog posts, or explanatory
                content. Documentation is provided solely for informational
                and educational purposes.
              </dd>

              <dt>Interface</dt>
              <dd>refers to the meaning assigned to it in the preamble of these Terms.</dd>

              <dt>Non-Custodial</dt>
              <dd>
                with respect to the Website (including the Interface and the
                App), that the Operator does not at any time take possession
                of, control, or have the ability to unilaterally access or
                transfer Users&rsquo; Digital Assets or Private Keys. Users
                remain exclusively responsible for managing their own Digital
                Wallets and Private Keys.
              </dd>

              <dt>Open-Source Licenses</dt>
              <dd>
                licenses that meet the open-source definition and generally
                permit software, components, or other items to be freely
                used, modified, and redistributed.
              </dd>

              <dt>Private Key</dt>
              <dd>
                a unique cryptographic code associated with a Digital Wallet
                that enables the holder to access, control, and authorize
                transactions involving the Digital Assets stored in that
                Wallet. Possession of the Private Key is required to operate
                the Digital Wallet and proves control over the corresponding
                Digital Assets.
              </dd>

              <dt>Protocol</dt>
              <dd>
                a decentralised, autonomous smart-contract system deployed on
                various blockchain networks which may be accessed by the
                Harvest Website and/or App. The Protocol is distinctly
                separate from and not governed or maintained by the Website
                and its Operator.
              </dd>

              <dt>Related Parties</dt>
              <dd>
                the Operator and Operator&rsquo;s respective shareholders,
                members, partners, directors, officers, agents, advisors,
                contractors, representatives, and permitted successors or
                assigns.
              </dd>

              <dt>Restricted Jurisdiction</dt>
              <dd>
                one of the following territories: Crimea, Cuba, Donetsk,
                Iran, Luhansk, North Korea, Syria, Sudan, China, United
                States of America (including its territories: American Samoa,
                Guam, Puerto Rico, the Northern Mariana Islands, and the U.S.
                Virgin Islands), or any other country or region to which the
                United States, the United Kingdom, the European Union or any
                of its member states or the United Nations or any of its
                member states (collectively, &ldquo;Major
                Jurisdictions&rdquo;), embargoes goods or imposes similar
                sanctions, and any jurisdiction in which the use of the
                Website is prohibited by applicable laws or regulations.
              </dd>

              <dt>Restricted Person</dt>
              <dd>
                a person, entity, or organization that is, directly or
                indirectly, owned or controlled by, or otherwise subject to,
                any sanctions administered or enforced by any country,
                government, or international authority. Or a person, entity,
                or organization that is a resident, citizen, established or
                lawfully existing under the laws of, any jurisdiction in
                which the offer, sale, and or purchase of any of Digital
                Asset accessible by the Protocol is unlawful, prohibited, or
                unauthorized. Any US Person will also be considered a
                Restricted Person.
              </dd>

              <dt>Self-Custody</dt>
              <dd>
                the practice whereby a User maintains direct control and sole
                responsibility over User&rsquo;s Digital Assets by holding
                and safeguarding User&rsquo;s own Private Keys, without
                relying on the Website, the Interface, the App, or any third
                party to hold or manage them.
              </dd>

              <dt>Third-Party Content</dt>
              <dd>
                any content, data, information, materials, or other items
                originating from third parties or derived from third-party
                sources, including but not limited to: (i) descriptions of,
                links to, or elements of Third-Party Services; (ii)
                promotional materials, advertisements, and other third-party
                publications; (iii) third-party websites, resources, and any
                links thereto; and (iv) market or blockchain-related
                information, such as the value or price of Digital Assets,
                exchange rates between Digital Assets, blockchain
                transaction data, circulating supply, total value locked,
                and similar metrics, whether or not expressly listed above.
              </dd>

              <dt>Third-Party Costs</dt>
              <dd>
                any fees, charges, or expenses imposed by independent third
                parties, including but not limited to performance,
                management, protocol, or transaction fees; blockchain
                network costs such as gas fees; fees related to Third-Party
                Services; and any other comparable third-party expenses.
              </dd>

              <dt>Third-Party Protocol</dt>
              <dd>
                any decentralized smart-contract system, blockchain protocol,
                or related products that are developed, deployed, and
                operated by entities other than the Operator, and that may
                be integrated with, or accessed through, the Protocol. Such
                protocols are autonomous and independent, and the Operator
                does not create, control, operate, or manage them in any
                manner.
              </dd>

              <dt>Third-Party Services</dt>
              <dd>
                any software, products, services, tools, or solutions
                provided by entities other than the Operator, including but
                not limited to software Wallets, analytics tools, blockchain
                smart contracts (such as automated market-making protocols
                and decentralized exchange systems), third-party mining
                pools, yield farming initiatives, and other similar
                services, as well as decentralized finance
                (&ldquo;DeFi&rdquo;) strategies, including Harvest Finance
                auto-compounding vaults, Morpho vaults, and other integrated
                protocols utilizing IPOR Technology, the rebalancing smart
                contract system, and the related software stack.
              </dd>

              <dt>US Person</dt>
              <dd>
                a citizen, resident, or green card holder, incorporated in,
                owned or controlled by a person or entity in, located in, or
                have a registered office or principal place of business in
                the United States of America.
              </dd>

              <dt>Wallet</dt>
              <dd>
                a technological tool, software, or device consisting of a
                pair of public and private cryptographic keys, used to
                store, track ownership of, receive, transfer, or otherwise
                manage Digital Assets.
              </dd>

              <dt>Website</dt>
              <dd>
                the Interface and the App, as described in the preamble of
                these Terms, together with any related software,
                applications, and components. For the avoidance of doubt,
                the Website is distinct from the Protocol, which is
                independent and not controlled, operated, or managed by the
                Operator.
              </dd>
            </dl>
            <p>
              <strong>Interpretation:</strong> Unless the context says
              otherwise: (i) words referring to one gender apply to all
              genders; (ii) words in singular also cover the plural, and vice
              versa; (iii) terms like including, for example, or similar are
              meant as examples only and don&rsquo;t limit the meaning of
              what comes before; and (iv) section headings are just for
              convenience and don&rsquo;t affect how these Terms are
              interpreted.
            </p>
          </section>

          <section id="availability" className="meth-section">
            <h2 className="meth-h2">2. Availability, access and updates</h2>
            <p>
              The Website is generally accessible without registration,
              subject to eligibility, but its continuous availability cannot
              be guaranteed. The Operator makes no warranty that it will
              always be error-free, secure, or uninterrupted, and it may be
              updated, modified, suspended, or discontinued at any time
              without notice or liability.
            </p>
            <p>
              Access may be limited or unavailable due to maintenance,
              technical issues, security incidents, force majeure events, or
              reliance on third-party or blockchain infrastructure. The
              Operator also reserves the right to restrict, suspend, or deny
              access (including through geo-blocking or similar measures)
              where required by law, sanctions, regulatory uncertainty, or
              internal risk policies.
            </p>
            <p>
              Access may further be suspended or terminated immediately if
              the User breaches, or is likely to breach, these Terms or
              applicable law, or if User&rsquo;s actions create potential
              legal or regulatory risk for the Operator or Related Parties.
            </p>
          </section>

          <section id="eligibility" className="meth-section">
            <h2 className="meth-h2">3. Eligibility</h2>
            <p>To use and access the Website, the User must:</p>
            <ol className="meth-list-alpha">
              <li>
                be able to form a legally binding agreement upon the terms
                and conditions set forth in these Terms;
              </li>
              <li>
                be at least 18 years old or the legal age required to use
                the Website, Toolset and Protocol Services according to the
                laws of the majority in the jurisdiction User resides;
              </li>
              <li>
                not be a resident, citizen, national or agent of, or an
                entity organized, incorporated or doing business in any
                Restricted Jurisdiction;
              </li>
              <li>
                not be a Restricted Person (including, any US Person) nor
                use the Website for the benefit of any Restricted Person;
              </li>
              <li>
                not intend to transact in or with any Restricted Territories
                or Restricted Persons;
              </li>
              <li>
                do so in full compliance with these Terms, with all
                applicable laws and regulations in User&rsquo;s
                jurisdiction, and with any restrictions set forth in the
                Disclosure regarding Restricted Persons or Restricted
                Jurisdictions;
              </li>
              <li>
                not have received any assets from any blockchain address
                included on any sanctions list or equivalent maintained by
                any of the Major Jurisdictions;
              </li>
              <li>
                for the purposes of accessing, represent and warrant that
                the User is not accessing it from any jurisdiction where
                the use of the Website would be unlawful or otherwise in
                violation of applicable laws or regulations;
              </li>
              <li>
                be duly authorized to represent and legally bind any legal
                entity on whose behalf the User acts in connection with
                these Terms and ensure that such legal entity is duly
                incorporated, validly existing, and in good standing under
                the laws of its jurisdiction.
              </li>
            </ol>
          </section>

          <section id="user-interaction" className="meth-section">
            <h2 className="meth-h2">
              4. User interaction with the Website and the Protocol
            </h2>
            <p>
              The Website, composed by the Interface and the App, reads
              public blockchain data, aggregates publicly available
              third-party information, and provides visualizations about the
              Protocol and Protocol Services in a convenient and
              user-friendly format. The Operator does not own, operate or
              control the Blockchain Systems, Wallets, validator nodes, the
              Protocol, Third Party Protocol or Third Party Services.
            </p>
            <p>
              The Protocol is a third party software source code, that
              consists of smart contracts deployed on the blockchain
              networks, that function in a decentralised and autonomous
              manner as an liquidity position engine that automates the
              deployment of Digital Assets across Third Parties Protocols
              for the use of Third Parties Services.
            </p>
            <p>
              Using the relevant blockchain systems, third-party supplied
              Wallets, Protocol or Services, does not require use of this
              Website. Anyone with an internet connection can connect
              directly to the Protocol or blockchain without accessing or
              using the Website. The App is merely one among numerous
              web-hosted User interfaces allowing the User to access the
              Protocol, and it does not process any transactions involving
              Digital Assets nor any other blockchain transactions.
            </p>
            <p>
              The Operator is not an agent or intermediary of the User, is
              not capable of performing transactions or sending transaction
              messages on behalf of the User, and does not hold and cannot
              purchase, sell, or trade any Digital Asset. The User hereby
              acknowledges and agrees that the Operator does not provide any
              custodial or similar services, custodial solutions or
              software, nor does the Operator act as User&rsquo;s agent or
              representative.
            </p>
            <p>
              All transactions relating to the Protocol are executed and
              recorded solely through the User&rsquo;s interactions with the
              respective blockchains. Such interactions are not under the
              control of, or affiliated with, the Website, therefore, under
              no circumstances will the Operator bear responsibility or
              liability for the Protocol, the underlying blockchain networks
              or software, or any aspect of their operation, performance,
              implementation, or use. By choosing to interact with them, the
              User acknowledges and accepts that all associated risks rest
              solely with the User.
            </p>
            <p>
              The Operator disclaims all responsibility and liability for
              any operations initiated or executed by the User, or by any
              other party, through the Website while interacting with the
              Protocol or any Third-Party Protocols or Services accessible
              through it. This includes, without limitation, the
              acquisition, transfer, storage, or disposal of Digital Assets.
            </p>
            <p>
              The Operator is not an intermediary, counterparty, or
              guarantor of any transaction executed via the App and assumes
              no obligation to ensure the settlement, execution, or
              performance of any transaction on the blockchain. The Operator
              does not control, manage, or custody any of User&rsquo;s
              Digital Assets.
            </p>
            <p>
              The User hereby acknowledges the distinction between the
              Protocol and the Website hosting the App, and that the
              Operator does not have control on, and is not in any way
              responsible for, the Protocol&rsquo;s operation, performance,
              or functioning.
            </p>
          </section>

          <section id="permitted-use" className="meth-section">
            <h2 className="meth-h2">5. Permitted use</h2>
            <p>
              The Website provides information in a simplified and
              user-friendly manner, solely as an aid to independent research
              and decision-making by technologically sophisticated Users.
              The Website does not guarantee the accuracy or suitability of
              such information, and Users must independently verify all
              information provided through the Website before executing any
              transaction on the Protocol via User&rsquo;s own Wallet.
            </p>
          </section>

          <section id="prohibited-uses" className="meth-section">
            <h2 className="meth-h2">6. Prohibited uses</h2>
            <p>
              The User may not, directly or indirectly, in connection with
              User&rsquo;s use of the Website:
            </p>
            <ul>
              <li>
                use the Website for any illegal activity or unlawful
                purpose, including without limitation, money laundering,
                terrorism financing, tax evasion, or other prohibited
                activities;
              </li>
              <li>
                rely on the Website as a basis for or a source of advice
                concerning any financial or legal decision making or
                transactions;
              </li>
              <li>
                circumvent or attempt to circumvent geoblocking or access
                controls, or functionality restrictions implemented on the
                Website;
              </li>
              <li>
                deploy malicious code, perform denial-of-service attacks,
                or attempt unauthorised access, or related systems;
              </li>
              <li>
                manipulate vault APYs, liquidity, or strategy performance,
                or any other protocol metrics through deceptive, fraudulent
                or abusive behaviour;
              </li>
              <li>
                fail to comply with any applicable provision of these Terms
                or any other terms or conditions, privacy policy, or other
                policy governing the use of the Website;
              </li>
              <li>use the Website other than for the Permitted Use;</li>
              <li>
                engage in any activity that infringes or violates
                copyrights, trademarks, service marks, patents, rights of
                publicity or privacy, or any other proprietary or
                intellectual property rights protected by law.
              </li>
            </ul>
          </section>

          <section id="no-financial-advice" className="meth-section">
            <h2 className="meth-h2">7. No financial advice</h2>
            <p>
              The User acknowledges and agrees that the Website is not
              registered, licensed, or supervised by any financial
              regulatory authority. No financial regulatory authority has
              reviewed, approved, or endorsed the Website or the Toolset.
            </p>
            <p>
              All content and data on the Website (such as APYs, position
              logic, rankings, analytics, and other performance-related
              information) are provided solely for informational purposes.
              Nothing on the Website, in the Documentation, or otherwise
              communicated by the Operator should be taken as business,
              legal, financial, investment, or tax advice.
            </p>
            <p>
              The Operator is not User&rsquo;s broker, custodian, exchange,
              agent, advisor, or any regulated financial service provider,
              and the Operator owes the User no fiduciary duties. Nothing
              contained herein or on the Website shall be considered as
              broker and or fund management services, or any intermediation
              services related thereto.
            </p>
            <p>
              The Operator is not registered with or licensed by any
              financial regulatory authority, and no regulator has reviewed
              or approved the Website. The Operator does not act as an
              investment or trading adviser, nor does the Operator offer
              securities services to U.S. persons. Nothing the Operator
              provides should be considered financial advice or a
              recommendation.
            </p>
            <p>
              The Website does not constitute an offer or solicitation to
              buy or sell securities or Digital Assets, nor is it investment
              advice. The Operator does not provide recommendations, and
              nothing here should be relied upon for investment decisions.
              The User must always do User&rsquo;s own research and consult
              User&rsquo;s legal or financial advisor before acting.
            </p>
            <p>
              Statements made on the Website or Documentation, to terms such
              as &ldquo;improved performance&rdquo; or &ldquo;optimized
              positions,&rdquo; &ldquo;smart portfolio management,&rdquo; or
              any similar expressions are descriptive of intended
              functionality or refer to historical data only. They do not
              constitute a guarantee of results, financial advice, or a
              representation that future outcomes will match past
              performance.
            </p>
          </section>

          <section id="risk-acknowledgement" className="meth-section">
            <h2 className="meth-h2">8. Risk disclosure acknowledgements</h2>
            <p>
              By using the services, the User acknowledges that the User has
              read, understood, and accepted the{" "}
              <Link href="/disclosures" className="meth-link">
                Risk Disclosures
              </Link>
              , and that the User is able to bear the risks involved.
              Neither the Operator nor any other Related Party shall be
              liable for any losses or damages arising from or connected to
              those risks. By accepting these Terms, the User releases and
              waives any present or future claims, known or unknown,
              against the Operator and Related Parties in relation to such
              risks.
            </p>
          </section>

          <section id="third-parties" className="meth-section">
            <h2 className="meth-h2">
              9. Third-party protocols, services, wallets, and content
            </h2>
            <p>
              <strong>Third Party Protocol:</strong> The Protocol, accessible
              through the Application, may rely on or integrate Third-Party
              Protocols and Services, which are operated entirely by
              independent third parties. The Operator does not own, control,
              or operate such Third Party Protocols and assumes no
              responsibility for their performance, security, or
              availability.
            </p>
            <p>
              <strong>Third Party Wallet:</strong> When using the App, the
              User may connect User&rsquo;s Digital Wallet through one of
              the compatible third-party software Wallets. Any draft
              transaction messages are transmitted by the Website through an
              API to the Wallet or device the User chooses. The User is
              solely responsible for reviewing and authorizing each
              transaction, which must be signed with User&rsquo;s private
              key. The Operator never stores, accesses, or controls
              User&rsquo;s Digital Wallet or the Digital Assets it contains.
              The User is fully responsible for safeguarding User&rsquo;s
              Wallet and all related credentials (including private keys,
              seed phrases, and passwords). Loss or compromise of these
              credentials may lead to the permanent and irreversible loss of
              User&rsquo;s Digital Assets. The User may disconnect
              User&rsquo;s Wallet from the App at any time.
            </p>
            <p>
              <strong>Third Party Services:</strong> Any Third-Party Services
              are provided and managed entirely by independent third parties
              and remain outside the Operator&rsquo;s control. The User is
              solely responsible for reviewing, understanding, and complying
              with their applicable terms, conditions, and policies.
            </p>
            <p>
              <strong>Third Party Content:</strong> When using the Platform,
              the User may encounter or interact with Third-Party Content.
              The Operator does not endorse or provide any warranties
              regarding such content, and the Operator disclaims all
              responsibility and liability arising from it. User&rsquo;s use
              of, or reliance on, Third-Party Content is entirely at
              User&rsquo;s own risk.
            </p>
            <p>
              <strong>Acknowledgment &amp; Disclaimer:</strong> The User
              acknowledges and agrees that all Third-Party Protocols,
              Services, Wallets, and Content are developed, operated, and
              provided exclusively by independent third parties. The
              Operator does not own, operate, audit, endorse, or assume
              responsibility for them, nor does the Operator make any
              representations or warranties, express or implied, regarding
              their accuracy, reliability, availability, performance,
              legality, security, or compliance with applicable law.
              User&rsquo;s use of Third-Party Protocols, Services, Wallets,
              or Content is entirely at User&rsquo;s own risk. To the
              fullest extent permitted by law, the Operator disclaims any
              liability for loss, damage, or harm of any kind related to
              User&rsquo;s access to or use of them, and the User expressly
              waives and releases the Operator from any related claims.
            </p>
          </section>

          <section id="license" className="meth-section">
            <h2 className="meth-h2">10. Licence</h2>
            <p>
              Subject to eligibility, acceptance, and compliance with these
              Terms, each User is granted a limited, personal,
              non-exclusive, non-transferable, non-sublicensable, and
              revocable licence to access and use the Website solely for its
              intended and permitted purposes (the &ldquo;License&rdquo;).
              This Licence is temporary and remains valid only while the
              User continues to meet the eligibility requirements.
              Open-source software, components, or items integrated with or
              accessible through the Website are not covered by this licence
              and remain subject to their respective Open-Source Licence
              terms.
            </p>
          </section>

          <section id="privacy" className="meth-section">
            <h2 className="meth-h2">11. Privacy policy</h2>
            <p>
              The Website may, directly or indirectly, collect and
              temporarily store certain personally identifiable information
              for operational purposes, such as detecting blockchain or IP
              addresses that suggest access from Restricted Jurisdictions,
              sanctioned individuals, or other prohibited uses. Unless
              otherwise required by applicable law, the Operator assumes no
              confidentiality obligations regarding the information
              collected through the Website.
            </p>
            <p>
              For further details on how personal data is handled, the User
              must refer to the separate{" "}
              <Link href="/privacy" className="meth-link">Privacy Policy</Link>{" "}
              document, which forms an integral part of these Terms.
            </p>
          </section>

          <section id="intellectual-property" className="meth-section">
            <h2 className="meth-h2">12. Intellectual property</h2>
            <p>
              All rights, title, and interest in and to the names
              &ldquo;Harvest,&rdquo; together with any related logos,
              trademarks, trade names, domain names, design features, and
              other distinctive brand elements (collectively, the
              &ldquo;Intellectual Property&rdquo;), are owned exclusively by
              the Operator or by the relevant rights holders. User&rsquo;s
              use of the Website does not grant the User any license or
              entitlement to the Intellectual Property, nor to any portion
              of the Website or its content. The User is prohibited from
              hiding, removing, or altering any proprietary notices,
              trademarks, or legends appearing on the Website. The User may
              not copy, reproduce, imitate, or otherwise use the Website, in
              whole or in part, without the Operator&rsquo;s prior written
              authorization.
            </p>
          </section>

          <section id="indemnification" className="meth-section">
            <h2 className="meth-h2">13. Indemnification</h2>
            <p>
              The User agrees to indemnify and hold the Operator and Related
              Parties harmless from any claims, damages, liabilities, or
              expenses arising from User&rsquo;s breach of these Terms,
              User&rsquo;s use of the Website, including User&rsquo;s breach
              of these Terms, or User&rsquo;s violation of applicable law.
              This indemnity is in addition to any other remedies available
              under law.
            </p>
          </section>

          <section id="limitation-of-liability" className="meth-section">
            <h2 className="meth-h2">14. Limitation of liability</h2>
            <p>To the fullest extent permitted by law, the Operator shall not be liable for:</p>
            <ul>
              <li>
                the Protocol, any Third-Party Protocol, their underlying
                software, blockchain infrastructure, or any Third-Party
                Services or Content;
              </li>
              <li>
                loss of assets from website or protocol bugs, exploits,
                failures, or third-party actions;
              </li>
              <li>
                malicious interference such as malware, phishing, hacking,
                or other hostile attacks;
              </li>
              <li>
                interruptions, downtime, or inability to access or use the
                Website;
              </li>
              <li>blockchain transactions or any losses arising therefrom;</li>
              <li>
                indirect, incidental, special, punitive, or consequential
                damages;
              </li>
              <li>
                any losses related to User&rsquo;s use or inability to use
                the Website, including lost profits, revenue, data,
                goodwill, or personal injury, even if foreseeable.
              </li>
            </ul>
            <p>
              The Operator&rsquo;s total aggregate liability, together with
              Related Parties, for all claims and damages arising out of or
              relating to these Terms, the Website, or User&rsquo;s
              interactions therewith, shall in no event exceed USD 1,000
              (one thousand United States dollars). To the maximum extent
              permitted by law, the User waives any right to claim or
              recover damages beyond this limit, and expressly releases the
              Operator and Related Parties from any liability, losses, or
              claims connected with User&rsquo;s use of the Website or any
              transactions User conducts through it. The User further
              waives any protections or benefits under law that would limit
              the effect of this release. Where exclusions or limitations
              of liability are restricted by applicable law, the above
              provisions shall apply to the fullest extent legally
              permissible.
            </p>
          </section>

          <section id="warranties" className="meth-section">
            <h2 className="meth-h2">15. Warranties and representations</h2>
            <p>The User represents and warrants to the Operator that:</p>
            <ul>
              <li>
                The User has sufficient knowledge and experience with
                Digital Assets, Wallets, blockchain technology,
                decentralized applications, AMMs, decentralized exchanges,
                and similar systems, and the User is able to understand and
                evaluate the risks and consequences of using them;
              </li>
              <li>
                User&rsquo;s access to and use of the Website is lawful
                under the laws and regulations applicable to the User, and
                will remain in compliance with all such requirements at all
                times;
              </li>
              <li>
                The User complies with all applicable laws and regulation,
                including without limitation, tax reporting and payment
                obligations;
              </li>
              <li>
                The User represents and warrants that the User is not
                located in, incorporated in, or otherwise subject to any
                Restricted Jurisdiction, and that the User is not a
                Restricted Person;
              </li>
              <li>
                When the User connects a Wallet to the Application, the
                User confirms that it&rsquo;s User&rsquo;s or that
                User&rsquo;s authorized to use it, and that the User&rsquo;s
                allowed to make transactions through it, and also that any
                Digital Assets or funds the User uses with the Protocol
                come from legal sources and follow applicable laws;
              </li>
              <li>
                The User will maintain sole and exclusive control of
                User&rsquo;s private keys, seed phrases and Wallet
                credentials and the User will review and verify all
                transaction details before confirming on-chain;
              </li>
              <li>
                The User acknowledges that the Operator does not act as
                User&rsquo;s trustee, agent, or fiduciary, and that the
                Operator does not hold, manage, or have custody of
                User&rsquo;s Digital Assets at any time;
              </li>
              <li>
                The User hereby expressly acknowledges, accepts, and
                assumes the risks set out in the Operator&rsquo;s Risk
                Disclosure statement.
              </li>
              <li>
                The User will conduct User&rsquo;s own independent due
                diligence and risk assessment and before making any
                financial, legal, or other decision in connection with the
                Website, the User will obtain independent advice from a
                licensed and qualified professional in the relevant field.
              </li>
            </ul>
            <p>
              The Operator has not conducted a legal or regulatory review
              of the Protocol or its integrated Third-Party Services for
              any particular jurisdiction. The User is solely responsible
              for determining the legality of interacting with the
              Protocol.
            </p>
            <p>
              The representations and warranties are, and shall remain,
              true, complete, accurate, and not misleading from the moment
              the User accepts these Terms and throughout User&rsquo;s use
              of the Website.
            </p>
          </section>

          <section id="fees" className="meth-section">
            <h2 className="meth-h2">16. Fees and transactions</h2>
            <p>
              Access to the Website is free of charge and the Operator does
              not generate profit from User&rsquo;s use of it. However, the
              Protocol, Third-Party Protocols, Third Party Wallets and
              Third-Party Services may apply Third-Party Costs (as defined
              in these Terms). Such costs are determined and collected
              exclusively by independent third parties and remain outside
              the Operator&rsquo;s control. The User is solely responsible
              for reviewing and understanding any applicable Third-Party
              Costs before initiating a transaction or creating a liquidity
              position.
            </p>
            <p>
              All blockchain transactions are final and irreversible; the
              Operator cannot reverse, refund, cancel, block, or alter
              them. The User is solely responsible for reviewing and
              authorizing each transaction, ensuring that it complies with
              all applicable laws and regulations. Every decision to
              transact rests with the User, and the User assumes all
              resulting risks and consequences, including any potential
              losses or damages.
            </p>
          </section>

          <section id="no-warranties" className="meth-section">
            <h2 className="meth-h2">17. No warranties</h2>
            <p>
              The Website is provided strictly on an &ldquo;as is&rdquo; and
              &ldquo;as available&rdquo; basis, and User&rsquo;s access and
              use are at User&rsquo;s sole risk. The Operator disclaims all
              warranties, express or implied, including but not limited to
              title, non-infringement, merchantability, fitness for a
              particular purpose, accuracy, reliability, security,
              availability, and freedom from errors, bugs, malware, or
              other harmful components. The Operator does not guarantee
              that the Website will meet User&rsquo;s expectations,
              function without interruption, or be corrected if defective.
            </p>
          </section>

          <section id="dispute-resolution" className="meth-section">
            <h2 className="meth-h2">18. Dispute resolution and arbitration</h2>
            <p>
              Any dispute, controversy, or claim arising out of or in
              connection with these Terms or the use of the Website (a
              &ldquo;Dispute&rdquo;) shall first be submitted by email to{" "}
              <a href="mailto:support@harvest.finance" className="meth-link">
                support@harvest.finance
              </a>{" "}
              for the purpose of attempting an amicable resolution through
              good-faith negotiations.
            </p>
            <p>
              If the parties are unable to resolve the matter within sixty
              (60) days from the date such notice is sent, the Dispute
              shall be referred to and finally resolved by binding
              arbitration under the UK Jurisdiction Taskforce Digital
              Dispute Resolution Rules (the &ldquo;DDRR&rdquo;), which are
              deemed to be incorporated by reference into this clause.
            </p>
            <ul>
              <li>
                <strong>Seat of Arbitration:</strong> The legal seat of the
                arbitration shall be London, England.
              </li>
              <li>
                <strong>Governing Procedural Law:</strong> The arbitration
                shall be governed by the procedural laws of England and
                Wales as set out in the Arbitration Act 1996.
              </li>
              <li>
                <strong>Appointing Authority:</strong> The appointing
                authority shall be the Society for Computers and Law (SCL),
                unless the parties agree otherwise.
              </li>
              <li>
                <strong>Language:</strong> The arbitration shall be
                conducted in the English language.
              </li>
              <li>
                <strong>Number of Arbitrators:</strong> The dispute shall be
                heard by a single arbitrator with appropriate technical and
                legal expertise in distributed ledger technology.
              </li>
            </ul>
            <p>
              The arbitral award shall be final and binding, and judgment
              upon such award may be entered in any court of competent
              jurisdiction. The User expressly waives any right of appeal
              of an award on a point of law.
            </p>
            <p>
              This clause shall remain in force notwithstanding the
              termination of these Terms, the discontinuation of the
              Website or any cessation of User&rsquo;s access to information
              obtained through the Website.
            </p>
          </section>

          <section id="class-action-waiver" className="meth-section">
            <h2 className="meth-h2">19. Class action and jury trial waiver</h2>
            <p>
              The User agrees to pursue any dispute or claim related to the
              Website solely in User&rsquo;s individual capacity, and not as
              a claimant or participant in any class, collective,
              representative, or private attorney general proceeding. In
              addition, the User expressly and irrevocably waives any right
              to a trial by jury in connection with any such dispute or
              claim.
            </p>
          </section>

          <section id="governing-law" className="meth-section">
            <h2 className="meth-h2">20. Governing law and disputes</h2>
            <p>
              These Terms are governed by the laws of the Republic of
              Panama, without regard to the principles of conflict of laws,
              govern these Terms. Any dispute that is not subject to
              arbitration will be resolved exclusively in the courts of the
              Republic of Panama.
            </p>
          </section>

          <section id="electronic-communications" className="meth-section">
            <h2 className="meth-h2">21. Electronic communications</h2>
            <p>
              The User consents to receive all communications related to
              these Terms electronically. The Operator may provide notices
              by posting them on the Website or on Operator&rsquo;s official
              channels. The User may contact the Operator electronically via
              the following designated email address:{" "}
              <a href="mailto:support@harvest.finance" className="meth-link">
                support@harvest.finance
              </a>
              .
            </p>
          </section>

          <section id="force-majeure" className="meth-section">
            <h2 className="meth-h2">22. Force majeure</h2>
            <p>
              The Operator shall not be liable for any failure or delay in
              performing Operator&rsquo;s obligations caused, directly or
              indirectly, by circumstances beyond Operator&rsquo;s
              reasonable control, including but not limited to natural
              disasters, armed conflicts, government actions or sanctions,
              court orders, labor disputes, technical failures,
              vulnerabilities or attacks on blockchain networks, smart
              contracts, or related technologies, or theft or loss of
              Digital Assets due to malicious interference (&ldquo;Force
              Majeure Events&rdquo;).
            </p>
          </section>

          <section id="language" className="meth-section">
            <h2 className="meth-h2">23. Language</h2>
            <p>
              Only the English version of these Terms, the Website,
              Documentation, and Communications shall be considered
              official and will prevail in case of inconsistencies with
              translations.
            </p>
          </section>

          <section id="validity" className="meth-section">
            <h2 className="meth-h2">24. Validity and enforceability</h2>
            <p>
              If any part of these Terms is found to be illegal, invalid,
              or unenforceable, but this does not materially affect the
              rights or obligations of either party, then: (a) that part
              will be considered removed; (b) the rest of the Terms will
              continue to apply as if the invalid part never existed; and
              (c) a valid and enforceable provision that comes as close as
              possible to the original intent will automatically apply
              instead.
            </p>
            <p>
              In any case, the invalidity or unenforceability of one part
              of these Terms will not affect the validity or enforceability
              of the rest, which will remain fully in effect.
            </p>
          </section>

          <section id="entire-agreement" className="meth-section">
            <h2 className="meth-h2">
              25. Entire representation, consent, and agreement
            </h2>
            <p>
              These Terms, together with the Privacy Policy and any
              disclosures or disclaimers incorporated by reference,
              constitute User&rsquo;s full and final representation,
              consent, and agreement with respect to the subject matter,
              including the Website. They supersede and replace any prior
              terms, agreements, communications, or understandings, whether
              written or oral, relating to the same subject matter.
            </p>
          </section>

          <section className="meth-section">
            <p>
              For any question about these Terms, contact{" "}
              <a href="mailto:support@harvest.finance" className="meth-link">
                support@harvest.finance
              </a>
              . The companion documents are the{" "}
              <Link href="/disclosures" className="meth-link">
                Risk Disclosures
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" className="meth-link">
                Privacy Policy
              </Link>
              , both of which are incorporated by reference.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
