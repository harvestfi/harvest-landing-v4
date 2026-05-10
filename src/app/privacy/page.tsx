import type { Metadata } from "next";
import Link from "next/link";
import { HomeCrumb } from "@/components/home-crumb";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { breadcrumbSchema } from "@/lib/jsonld";

const TITLE = "Privacy Policy | Harvest";
const DESCRIPTION =
  "How Harvest handles personal data, analytics, cookies, and third-party tools. Includes user rights and data retention.";
const URL = `${SITE_URL}/privacy`;
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
  { id: "summary", label: "Summary" },
  { id: "data-we-collect", label: "Data we collect" },
  { id: "analytics-and-cookies", label: "Analytics and cookies" },
  { id: "consent", label: "Consent" },
  { id: "third-parties", label: "Third parties" },
  { id: "wallets", label: "Wallets and on-chain data" },
  { id: "retention", label: "Retention" },
  { id: "your-rights", label: "Your rights" },
  { id: "contact", label: "Contact" },
  { id: "changes", label: "Changes to this policy" },
];

export default function PrivacyPage() {
  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Privacy Policy" },
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
          <span>Privacy Policy</span>
        </nav>
        <h1 className="meth-title">Privacy Policy</h1>
        <p className="meth-subtitle">
          How Harvest handles personal data, analytics, cookies, and third-party tools.
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
            <h2 className="meth-h2">Summary</h2>
            <p>
              Harvest is a static, read-only website that displays public
              on-chain yield data. We do not require accounts, do not take
              custody of digital assets, and do not collect data needed to
              identify you personally as a condition of use.
            </p>
            <p>
              We do use a basic analytics tool to understand which pages are
              read and how the site is performing. This collection only runs
              after you give consent through the cookie banner. You can
              withdraw consent at any time.
            </p>
          </section>

          <section id="data-we-collect" className="meth-section">
            <h2 className="meth-h2">Data we collect</h2>
            <p>
              The data we collect is limited to what a typical analytics tool
              records about a website visit:
            </p>
            <ul>
              <li>Pages visited and the time spent on each.</li>
              <li>Referring URL (the previous page you came from).</li>
              <li>
                Approximate location at the country or city level, derived
                from IP address by the analytics provider.
              </li>
              <li>
                Device, browser, and operating system characteristics (for
                example, browser version, screen size).
              </li>
              <li>
                Anonymous interaction events such as outbound link clicks and
                section anchors followed.
              </li>
            </ul>
            <p>
              We do not collect names, email addresses, phone numbers,
              postal addresses, payment details, or any other identifier
              required to log in or transact, because the site does not
              require any of those.
            </p>
            <p>
              If you contact us by email at{" "}
              <a href="mailto:support@harvest.finance" className="meth-link">
                support@harvest.finance
              </a>
              , the contents of that email and the address you sent it from
              are processed only to respond to you.
            </p>
          </section>

          <section id="analytics-and-cookies" className="meth-section">
            <h2 className="meth-h2">Analytics and cookies</h2>
            <p>
              Harvest may use Google Analytics or an equivalent privacy-
              respecting analytics tool to understand site usage in
              aggregate. The analytics tool sets cookies and similar
              identifiers on your device to attribute repeat visits to the
              same anonymous session.
            </p>
            <p>
              The cookies and identifiers we may set fall into two
              categories:
            </p>
            <ul>
              <li>
                <strong>Strictly necessary.</strong> A small number of
                cookies are required for the site to function and to record
                your consent choice. These are set without consent because
                the site cannot remember your preference otherwise.
              </li>
              <li>
                <strong>Analytics.</strong> Cookies set by the analytics
                tool to count visits and measure performance. These are set
                only after you grant consent.
              </li>
            </ul>
            <p>
              We do not use advertising cookies, retargeting pixels, or
              cross-site tracking identifiers.
            </p>
          </section>

          <section id="consent" className="meth-section">
            <h2 className="meth-h2">Consent</h2>
            <p>
              On your first visit you will see a consent banner asking
              whether you accept analytics cookies. No analytics cookies are
              set, and no analytics events are sent, until you click
              accept. If you decline, only strictly necessary cookies are
              set and the analytics tool is not loaded.
            </p>
            <p>
              You can change or withdraw your consent at any time through
              the privacy preferences link in the footer or by clearing
              cookies for this domain in your browser.
            </p>
          </section>

          <section id="third-parties" className="meth-section">
            <h2 className="meth-h2">Third parties</h2>
            <p>
              The analytics provider is the primary third-party processor of
              data collected through this site. The provider receives
              information described in the data we collect section above
              and processes it on our behalf for the purpose of generating
              aggregate usage reports. We do not sell data, do not exchange
              data with advertising networks, and do not share data with
              affiliates for marketing purposes.
            </p>
            <p>
              Embedded fonts are self-hosted at build time and do not
              involve a third-party request from your browser.
            </p>
          </section>

          <section id="wallets" className="meth-section">
            <h2 className="meth-h2">Wallets and on-chain data</h2>
            <p>
              This site is read-only and does not require connecting a
              wallet. If a future feature offers an optional wallet
              connection, the wallet connection itself is handled entirely
              by the third-party wallet software you use, which has its own
              privacy policy. Harvest does not store wallet addresses or
              link them to identity unless you provide that information
              directly through email correspondence.
            </p>
            <p>
              All information presented on the site about strategies, APYs,
              and TVL is derived from public blockchain data and public
              APIs, not from any data about individual visitors.
            </p>
          </section>

          <section id="retention" className="meth-section">
            <h2 className="meth-h2">Retention</h2>
            <p>
              Aggregate analytics data is retained for as long as required
              to produce historical usage reports, typically 14 to 26
              months depending on the analytics provider configuration.
              Email correspondence with support is retained for the period
              required to handle your request and any subsequent follow-up,
              after which it is deleted unless retention is required by
              law.
            </p>
          </section>

          <section id="your-rights" className="meth-section">
            <h2 className="meth-h2">Your rights</h2>
            <p>
              Depending on where you live, you may have rights under data
              protection law, including the right to access, correct, or
              delete personal data we hold about you, the right to object
              to or restrict processing, and the right to lodge a complaint
              with your local data protection authority.
            </p>
            <p>
              Because we do not collect personal identifiers as a condition
              of using the site, in most cases there is no record we hold
              about you specifically. If you have corresponded with us by
              email and want that record removed, write to{" "}
              <a href="mailto:support@harvest.finance" className="meth-link">
                support@harvest.finance
              </a>{" "}
              from the same address and we will action the request.
            </p>
          </section>

          <section id="contact" className="meth-section">
            <h2 className="meth-h2">Contact</h2>
            <p>
              For privacy questions or to exercise any of the rights above,
              email{" "}
              <a href="mailto:support@harvest.finance" className="meth-link">
                support@harvest.finance
              </a>
              . Please include enough detail about your request that we can
              act on it.
            </p>
          </section>

          <section id="changes" className="meth-section">
            <h2 className="meth-h2">Changes to this policy</h2>
            <p>
              We may update this policy as the site evolves or as data
              protection law changes. The Last updated date at the top of
              the page reflects the most recent revision. Material changes
              will be summarized in the Changelog section of the site when
              that page ships, and will be announced through the consent
              banner if they affect what is processed.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
