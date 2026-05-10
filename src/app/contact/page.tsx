import type { Metadata } from "next";
import Link from "next/link";
import { HomeCrumb } from "@/components/home-crumb";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { breadcrumbSchema } from "@/lib/jsonld";

const TITLE = "Contact | Harvest";
const DESCRIPTION =
  "Get in touch with Harvest. General inquiries, support requests, security disclosures and press contacts all route through support@harvest.finance.";
const URL = `${SITE_URL}/contact`;
const CONTACT_EMAIL = "support@harvest.finance";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: SITE_NAME,
    type: "website",
  },
  alternates: { canonical: URL },
};

export default function ContactPage() {
  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "Contact" },
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
          <span>Contact</span>
        </nav>
        <h1 className="meth-title">Contact</h1>
        <p className="meth-subtitle">
          General inquiries, support requests, security disclosures and press
          contacts all route through a single mailbox.
        </p>
      </div>

      <div style={{ paddingTop: 48, maxWidth: 720 }}>
        <div className="meth-callout" style={{ padding: 24 }}>
          <div
            className="mono dim"
            style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}
          >
            Email
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="meth-link"
            style={{ fontSize: 22, fontFamily: "var(--display)", fontWeight: 600 }}
          >
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="meth-body" style={{ paddingTop: 32 }}>
          <p>
            We monitor this address for: support questions, partnership and
            integration inquiries, security vulnerability disclosures, press
            and analyst contact, and feedback on the data shown on this site.
          </p>
          <p>
            For questions about how the data on this site is calculated, see
            the <Link href="/methodology" className="meth-link">methodology</Link>{" "}
            page first; many questions are answered there. Risk and category
            framing is documented on the{" "}
            <Link href="/risk-framework" className="meth-link">risk framework</Link>{" "}
            page.
          </p>
          <p>
            Harvest does not provide investment advice, custodial services, or
            individual portfolio guidance. Inbound messages requesting any of
            those will receive a courteous decline.
          </p>
          <p>
            If you are reporting a security issue, please include reproduction
            steps and a contact channel for follow-up. We aim to respond to
            verified reports within two business days.
          </p>
        </div>
      </div>
    </main>
  );
}
