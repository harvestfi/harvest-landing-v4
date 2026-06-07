import type { Metadata } from "next";
import Link from "next/link";
import { HomeCrumb } from "@/components/home-crumb";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { breadcrumbSchema } from "@/lib/jsonld";

const TITLE = "Security & Audits: Smart Contract Reports | Harvest";
const DESCRIPTION =
  "Independent audits of Harvest smart contracts by Haechi, PeckShield, CertiK, Least Authority, and Halborn. Reports published in full on GitHub.";
const URL = `${SITE_URL}/security`;

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

interface Audit {
  id: string;
  firm: string;
  reportUrl: string;
  summary: string;
}

const AUDITS: Audit[] = [
  {
    id: "haechi",
    firm: "Haechi",
    reportUrl:
      "https://github.com/harvest-finance/harvest/blob/master/audits/Haechi-Harvest.pdf",
    summary:
      "One major-severity finding and five minor findings. The major finding had been independently surfaced and remediated prior to publication. Of the five minor findings, four were classified as intentional design properties of the protocol's decentralization model rather than defects; the remaining item was remediated.",
  },
  {
    id: "peckshield",
    firm: "PeckShield",
    reportUrl:
      "https://github.com/harvest-finance/harvest/blob/master/audits/PeckShield-Harvest.pdf",
    summary:
      "Primary finding addressed the privileged role of the 0xf00d deployer address. A timelock mechanism was introduced in response, providing depositors with a guaranteed exit window before any deployer action takes effect. A separate issue in CRVStrategyStable.depositArbCheck() was identified independently and patched prior to publication of the final report. Remaining items were informational or reflected explicit design decisions in the protocol architecture.",
  },
  {
    id: "certik",
    firm: "CertiK",
    reportUrl:
      "https://github.com/harvest-finance/harvest/blob/master/audits/CertiK-Harvest.pdf",
    summary:
      "One minor-severity finding, classified as a false positive after review: the described conditions are not reachable under the production deployment and configuration. Remaining items were optimization recommendations and language-level alternatives with no security impact.",
  },
  {
    id: "least-authority",
    firm: "Least Authority",
    reportUrl:
      "https://github.com/harvest-finance/harvest/blob/master/audits/LeastAuthority-Harvest.pdf",
    summary:
      "No new findings beyond issues already disclosed or remediated at the time of engagement. The review also covered the proposed vault redesign and informed subsequent architectural direction.",
  },
  {
    id: "halborn",
    firm: "Halborn",
    reportUrl:
      "https://github.com/harvestfi/audits/blob/main/Halborn-Harvest-2025.pdf",
    summary:
      "January 2025 review of Harvest's core vault infrastructure. The full report is published on GitHub.",
  },
];

export default function SecurityPage() {
  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Security & Audits" },
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
          <span>Security &amp; Audits</span>
        </nav>
        <h1 className="meth-title">Security &amp; Audits</h1>
        <p className="meth-subtitle">
          Smart-contract audits, ongoing security practices, and
          responsible disclosure.
        </p>
      </div>

      <div className="meth-layout">
        <aside className="meth-toc" aria-label="Page sections">
          <p className="meth-toc-label mono">On this page</p>
          <ul className="meth-toc-list">
            <li><a href="#approach" className="meth-toc-link">Approach to security</a></li>
            <li><a href="#audits" className="meth-toc-link">Audit reports</a></li>
            {AUDITS.map((a) => (
              <li key={a.id}>
                <a href={`#${a.id}`} className="meth-toc-link" style={{ paddingLeft: 14 }}>
                  {a.firm}
                </a>
              </li>
            ))}
            <li><a href="#reporting" className="meth-toc-link">Reporting an issue</a></li>
            <li><a href="#scope-and-caveats" className="meth-toc-link">Scope and caveats</a></li>
          </ul>
        </aside>

        <article className="meth-body">
          <section id="approach" className="meth-section">
            <h2 className="meth-h2">Approach to security</h2>
            <p>
              The Harvest contract system has been deployed onchain
              continuously since 2020. Across that period the codebase
              has been reviewed by four independent security firms. Each
              report is published in full at the source, linked below
              alongside a concise summary of the substantive findings.
            </p>
            <p>
              Audits provide point-in-time assurance and are an input to
              the security posture of a system, not a guarantee of it.
              Smart-contract risk persists in audited systems and is
              treated as a standing category on the{" "}
              <Link href="/risk-framework" className="meth-link">
                risk framework
              </Link>{" "}
              page.
            </p>
          </section>

          <section id="audits" className="meth-section">
            <h2 className="meth-h2">Audit reports</h2>
            <p>
              All reports are published at{" "}
              <a
                href="https://github.com/harvest-finance/harvest/tree/master/audits"
                className="meth-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                harvest-finance/harvest/audits
              </a>
              . Summaries below cover substantive findings; refer to the
              source PDF for the full scope, methodology and severity
              classification used by each firm.
            </p>

            {AUDITS.map((a) => (
              <div key={a.id} id={a.id} style={{ paddingTop: 12 }}>
                <h3 className="meth-h3">{a.firm}</h3>
                <p>{a.summary}</p>
                <p>
                  <a
                    href={a.reportUrl}
                    className="meth-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read the {a.firm} report (PDF)
                  </a>
                </p>
              </div>
            ))}
          </section>

          <section id="reporting" className="meth-section">
            <h2 className="meth-h2">Reporting an issue</h2>
            <p>
              Security disclosures, suspected vulnerabilities, and
              responsible-disclosure inquiries should be sent to{" "}
              <a href="mailto:support@harvest.finance" className="meth-link">
                support@harvest.finance
              </a>
              . Please include reproduction steps, the affected contract
              address or interface, and a contact channel for follow-up.
            </p>
            <p>
              We aim to acknowledge verified reports within two business
              days. Coordinated disclosure is appreciated where the
              vulnerability could be exploited before a remediation lands.
            </p>
          </section>

          <section id="scope-and-caveats" className="meth-section">
            <h2 className="meth-h2">Scope and caveats</h2>
            <p>
              The audits listed above cover the Harvest smart-contract
              system at the points in time when each engagement was
              conducted. Subsequent contract deployments, vault redesigns,
              and integrations with third-party protocols are not
              automatically in scope. Where a third-party protocol is
              integrated (for example a lending market or AMM that a
              Harvest vault deposits into), the security of that
              third-party protocol is governed by its own audit history,
              not by ours.
            </p>
            <p>
              The full set of risks that can affect a Harvest deposit, and
              the categories we use to communicate them on individual
              product pages, are documented on the{" "}
              <Link href="/risk-framework" className="meth-link">
                risk framework
              </Link>{" "}
              page. The legal disclaimer that accompanies all of this is
              the{" "}
              <Link href="/disclosures" className="meth-link">
                Risk Disclosures
              </Link>{" "}
              statement.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
