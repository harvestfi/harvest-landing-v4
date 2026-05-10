import type { Metadata } from "next";
import Link from "next/link";
import { HomeCrumb } from "@/components/home-crumb";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { breadcrumbSchema } from "@/lib/jsonld";

const TITLE = "About Harvest: Onchain Yield Index Since 2020 | Harvest";
const DESCRIPTION =
  "Harvest is an onchain DeFi yield index operating since September 2020. Methodology, transparent data, fair-launch protocol since day one.";
const URL = `${SITE_URL}/about`;

// Founding day. Used for the structured-data foundingDate and to compute the
// continuously-operational days figure that appears in the body and the
// "team" section. Recomputing at build time keeps the figure evergreen
// without needing an editor to revisit the copy.
const FOUNDING_DATE_ISO = "2020-09-01";

// Social handles - replace # with the real URLs when available. They're
// surfaced via Organization.sameAs and in the body of the "What's next"
// section.
const TWITTER_URL = "#";
const DISCORD_URL = "#";
const GITHUB_URL = "#";

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

function aboutPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Harvest",
    url: URL,
    description: DESCRIPTION,
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

function organizationSchema() {
  const sameAs: string[] = [];
  if (TWITTER_URL.startsWith("http")) sameAs.push(TWITTER_URL);
  if (DISCORD_URL.startsWith("http")) sameAs.push(DISCORD_URL);
  if (GITHUB_URL.startsWith("http")) sameAs.push(GITHUB_URL);

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    foundingDate: FOUNDING_DATE_ISO,
    description:
      "Independent onchain yield index tracking DeFi yield strategies since 2020.",
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export default function AboutPage() {
  const crumbs = [
    { name: "Home", url: SITE_URL },
    { name: "About" },
  ];

  // Continuously-operational days as of the build. Recomputed on every
  // build so the figure stays current without copy edits.
  const daysOperating = Math.floor(
    (Date.now() - new Date(FOUNDING_DATE_ISO).getTime()) / 86400000,
  );
  // Conservative floor (rounded down to the nearest hundred) used in
  // the body where a "+" range reads better than a precise number.
  const daysFloor = Math.floor(daysOperating / 100) * 100;

  return (
    <main className="methodology-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
      />

      <div className="meth-header">
        <nav className="meth-crumbs mono dim">
          <HomeCrumb />
          <span className="sep">›</span>
          <span>About</span>
        </nav>
        <h1 className="meth-title">About Harvest</h1>
        <p className="meth-subtitle">
          Independent onchain yield index. Operating since 2020.
        </p>
      </div>

      <div className="meth-layout">
        <aside className="meth-toc" aria-label="Page sections">
          <p className="meth-toc-label mono">On this page</p>
          <ul className="meth-toc-list">
            <li><a href="#what-we-do" className="meth-toc-link">What we do</a></li>
            <li><a href="#origins" className="meth-toc-link">Origins</a></li>
            <li><a href="#what-changed" className="meth-toc-link">What changed</a></li>
            <li><a href="#how-we-operate" className="meth-toc-link">How we operate today</a></li>
            <li><a href="#the-team" className="meth-toc-link">The team</a></li>
            <li><a href="#whats-next" className="meth-toc-link">What&rsquo;s next</a></li>
          </ul>
        </aside>

        <article className="meth-body">
          <section id="what-we-do" className="meth-section">
            <h2 className="meth-h2">What we do</h2>
            <p>
              Harvest is an onchain yield index tracking DeFi yield strategies
              across major networks. We collect APY, TVL, share price, and
              performance data daily, derive 30-day averages and consistency
              scores from our own indexer, and publish the results as open
              data via this site.
            </p>
          </section>

          <section id="origins" className="meth-section">
            <h2 className="meth-h2">Origins</h2>
            <p>
              We started building Harvest on September 1, 2020, at the height
              of DeFi summer, when yield farming was emerging as a category
              but the tools to navigate it didn&rsquo;t exist. Our goal was
              specific: automate the moving parts that made yield farming
              inaccessible to most users. Manual harvesting, gas costs,
              strategy switching, reward conversion. We built smart-contract
              vaults that handled all of it, and within a month of launch we
              were operating one of the largest yield aggregators in DeFi.
            </p>
            <p>
              That core product still runs. The vaults we deployed in 2020
              are still deployed, still compounding, still onchain. Some have
              been continuously operational for over {daysFloor.toLocaleString()}{" "}
              days. The strategies have evolved across hundreds of vault
              deployments on Ethereum, Polygon, Arbitrum, Base, and other
              networks, integrating with Aave, Morpho, Aerodrome, Compound,
              Curve, Uniswap, and most of the major DeFi protocols of the
              past five years. The operational model itself has stayed the
              same: deposits go into a vault, the vault deploys to a yield
              source, our infrastructure compounds the rewards, depositors
              withdraw whenever they want.
            </p>
          </section>

          <section id="what-changed" className="meth-section">
            <h2 className="meth-h2">What changed</h2>
            <p>
              What&rsquo;s changed is what we&rsquo;ve learned operating that
              infrastructure for half a decade.
            </p>
            <p>
              We&rsquo;ve watched protocols launch, accumulate TVL,
              deprecate, fork, redeploy, and disappear. We&rsquo;ve seen APY
              claims that didn&rsquo;t match reality and audit reports that
              didn&rsquo;t predict failures. We&rsquo;ve operated through
              bull cycles, bear cycles, exploit waves, and migration phases.
              Most of all, we&rsquo;ve accumulated something most yield
              platforms don&rsquo;t have: continuous time-series data on
              what yield strategies actually delivered, day after day,
              across multiple market regimes.
            </p>
            <p>That data is what this site is built around now.</p>
            <p>
              The product you&rsquo;re looking at, the index, the rankings,
              the{" "}
              <Link href="/methodology" className="meth-link">methodology</Link>
              , represents a deliberate convergence. We&rsquo;ve operated
              yield strategies since 2020. Now we&rsquo;re publishing what
              we&rsquo;ve learned from operating them, in a format anyone
              can read or cite. The goal is fewer black boxes in DeFi yield
              and more transparency about what actually works, what
              doesn&rsquo;t, and over what time frames.
            </p>
          </section>

          <section id="how-we-operate" className="meth-section">
            <h2 className="meth-h2">How we operate today</h2>
            <p>
              The current index covers strategies operated by Harvest. We
              disclose this explicitly because positioning as a
              &ldquo;neutral aggregator&rdquo; while only listing our own
              products would be misleading. The{" "}
              <Link href="/methodology" className="meth-link">methodology</Link>
              ,{" "}
              <Link href="/risk-framework" className="meth-link">risk framework</Link>
              , and ranking logic are designed to apply equally to
              third-party operators, and expansion to cover them is in
              development. When that ships, we&rsquo;ll publish the same
              data with the same calculations across all operators in scope.
            </p>
            <p>
              In the meantime, what we publish is honest about its scope:
              data on Harvest-operated strategies, derived from our own
              indexer monitoring our own vault contracts, with the
              calculation methodology fully documented.
            </p>
            <p>
              We don&rsquo;t take advertising. We don&rsquo;t sell premium
              access to data. We don&rsquo;t accept payment from protocols
              to be listed or ranked higher. Operations are funded by
              performance fees on Harvest-operated vaults, the same model
              we&rsquo;ve run under since 2020.
            </p>
          </section>

          <section id="the-team" className="meth-section">
            <h2 className="meth-h2">The team</h2>
            <p>
              Harvest is built and operated by a distributed group of
              contributors working across multiple time zones. The protocol
              launched in 2020 under fair-launch principles: no presale, no
              venture capital, no pre-mine, no investor allocation. That
              principle held. Operations have been funded entirely by
              protocol revenue since day one.
            </p>
            <p>
              Contributors are identifiable to partners, auditors, and
              integrators who need to know who they&rsquo;re working with.
              Publicly, we communicate through the protocol, the
              documentation, and the published track record. The credibility
              we offer is the work itself: {daysFloor.toLocaleString()}+
              days of continuous operation, transparent methodology, open
              data, and a public record of what we&rsquo;ve shipped.
            </p>
          </section>

          <section id="whats-next" className="meth-section">
            <h2 className="meth-h2">What&rsquo;s next</h2>
            <p>
              The direction is visible from the public commits and
              integrations: continued expansion of the indexer to cover
              third-party operators, deeper historical data exposure, and
              more analytical tooling around the data we already have. We
              don&rsquo;t operate on quarterly milestones. We ship as the
              work matures.
            </p>
            <p>
              If you&rsquo;re a journalist, integrator, or DeFi participant
              interested in how we calculate, what we cover, or where the
              project is headed, see the{" "}
              <Link href="/methodology" className="meth-link">methodology</Link>
              , or reach out via{" "}
              <a
                href={TWITTER_URL}
                className="meth-link"
                target={TWITTER_URL.startsWith("http") ? "_blank" : undefined}
                rel={TWITTER_URL.startsWith("http") ? "me noopener noreferrer" : undefined}
              >
                Twitter
              </a>{" "}
              or{" "}
              <a
                href={DISCORD_URL}
                className="meth-link"
                target={DISCORD_URL.startsWith("http") ? "_blank" : undefined}
                rel={DISCORD_URL.startsWith("http") ? "me noopener noreferrer" : undefined}
              >
                Discord
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
