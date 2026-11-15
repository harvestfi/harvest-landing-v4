// The building blocks of the /eth formula, for the hubs that follow it (/btc,
// /usdt). Same markup and class names as eth-hub-body.tsx, so the pages share
// eth-hub.css and eth-institutional.css and read as one family. /eth keeps its
// own copies while its rebuild is in progress; it can move onto these later.
import { Fragment } from "react";
import Link from "next/link";
import { ChainIcon } from "@/components/token-icons";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  breadcrumbSchema,
  itemListSchema,
  faqPageSchema,
  reportDatasetSchema,
} from "@/lib/jsonld";
import type { Crumb } from "@/lib/seo";
import { proseName, plural, apy, apyFloorLabel, tvl } from "@/lib/usdc-hub";
import {
  bare,
  cap,
  qid,
  typeBlurb,
  SINGULAR,
  strategyTypeOf,
  type HubCohort,
  type Faq,
  type Takeaway,
  type Risk,
  type TypeRow,
  type NetworkPicks,
  type EvidenceRow,
  type Venue,
} from "@/lib/long-hub";

// Bold the figures in a generated sentence. Wrapping in <strong> leaves the
// extracted text identical, so nothing an answer engine lifts changes.
const FIGURE =
  /(\$[\d.,]+[KMB]?|\d+(?:\.\d+)?%(?: APY)?|\b\d+ of (?:the )?\d+\b|\b\d+ (?:[A-Za-z]+ )?strateg(?:y|ies)\b)/g;

export function Em({ text }: { text: string }) {
  const parts = text.split(FIGURE);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

export function Chevron() {
  return (
    <svg
      className="uh-faq-chev"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** The questions a reader tends to have at this point, answered in place. */
export function Ask({ items }: { items: Faq[] }) {
  if (!items.length) return null;
  return (
    <aside className="eh-ask" aria-label="Readers often ask">
      <p className="eh-ask-h">Readers often ask</p>
      <div className="uh-faq">
        {items.map((f, i) => (
          <details className="uh-faq-item" key={f.q} id={qid(f.q)} open={i === 0}>
            <summary className="uh-faq-q">
              <span>{f.q}</span>
              <Chevron />
            </summary>
            <p className="uh-faq-a">
              <Em text={f.a} />
            </p>
          </details>
        ))}
      </div>
    </aside>
  );
}

/** Whole sentences that survive being lifted on their own. */
export function KeyPoints({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <aside className="eh-keys" aria-label="Key points">
      <p className="eh-keys-h">Key points</p>
      <ul>
        {items.map((t) => (
          <li key={t}>
            <Em text={t} />
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function StatPair({
  title,
  items,
  note,
}: {
  title: string;
  items: { label: string; value: string; sub?: string }[];
  note: string;
}) {
  // A short list, not boxes: the figures read as a sentence each, and the
  // prose around them carries the same numbers for anyone quoting the page.
  return (
    <div className="ae-statlist">
      <p className="ae-statlist-h">{title}</p>
      <ul data-lint="chrome">
        {items.map((it) => (
          <li key={it.label}>
            <strong>{it.label}</strong> <span className="ae-statlist-v">{it.value}</span>
            {it.sub ? <span className="ae-statlist-s">{` · ${it.sub}`}</span> : null}
          </li>
        ))}
      </ul>
      <p className="ae-statlist-note">{note}</p>
    </div>
  );
}

export function Block({
  id,
  eyebrow,
  title,
  lead,
  asOf,
  asOfIso,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  asOf?: string;
  asOfIso?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="uh-block" aria-labelledby={id} data-asof={asOfIso}>
      <p className="rp-eyebrow" data-dateline={asOf ? "" : undefined}>
        {eyebrow}
        {asOf && (
          <>
            <span className="uh-eyebrow-sep" aria-hidden="true"> · </span>
            <span className="uh-eyebrow-date">{asOf}</span>
          </>
        )}
      </p>
      <h2 id={id}>{title}</h2>
      {lead && (
        <p className="uh-lead">
          <Em text={lead} />
        </p>
      )}
      {children}
    </section>
  );
}

/** A link to a primary source off the site, opened in a new tab. */
export function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** JSON-LD for a long-form hub: breadcrumb, ItemList, FAQPage, WebPage, Dataset. */
export function HubSchemas({
  c,
  url,
  crumbs,
  faqs,
  listName,
  pageName,
  datasetName,
  datasetDescription,
  keywords,
}: {
  c: HubCohort;
  url: string;
  crumbs: Crumb[];
  faqs: Faq[];
  listName: string;
  pageName: string;
  datasetName: string;
  datasetDescription: string;
  keywords: string[];
}) {
  const ld = (o: unknown) => (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(o) }} />
  );
  return (
    <>
      {ld(breadcrumbSchema(crumbs))}
      {ld({
        ...itemListSchema(c.all, url, "24h"),
        name: listName,
        numberOfItems: c.count,
        dateModified: c.asOfIso,
      })}
      {ld(faqPageSchema(faqs))}
      {ld({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": url,
        url,
        name: pageName,
        dateModified: c.asOfIso,
        inLanguage: "en",
        isBasedOn: `${SITE_URL}/methodology`,
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      })}
      {ld(
        reportDatasetSchema({
          name: datasetName,
          description: datasetDescription,
          url,
          dateModified: c.asOfIso,
          temporalCoverage: c.asOfIso,
          keywords,
          sources: [`${SITE_URL}/methodology`],
          distribution: [{ format: "application/json", url: `${SITE_URL}/data/index.json` }],
        }),
      )}
    </>
  );
}

/** Updated / strategies / networks line above the H1. */
export function TopMeta({ c }: { c: HubCohort }) {
  const asOfTime = new Date(c.asOfIso).toISOString().slice(11, 16);
  return (
    <p className="eh-topmeta" data-dateline="">
      <span>
        Updated <strong>{c.asOf}</strong>, {asOfTime} UTC
      </span>
      <span>
        Strategies <strong>{c.count}</strong>
      </span>
      <span>
        Networks <strong>{c.chainCount}</strong>
      </span>
      <span>Rates after fees</span>
    </p>
  );
}

/** Key takeaways: the most-asked questions, one dated sentence each. */
export function Takeaways({ c, items }: { c: HubCohort; items: Takeaway[] }) {
  return (
    <section className="eh-takeaways" aria-labelledby="key-takeaways" data-asof={c.asOfIso}>
      <h2 id="key-takeaways" className="eh-tk-h">
        Key takeaways{" "}
        <span className="eh-tk-date" data-dateline="">
          · {c.asOf}
        </span>
      </h2>
      <dl className="eh-tk-list">
        {items.map((t) => (
          <div key={t.k} className="eh-tk-item">
            <dt>{t.k}</dt>
            <dd>
              <Em text={t.a} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Intro({ text, appUrl }: { text: string; appUrl: string }) {
  return (
    <div className="eh-intro">
      <p>
        <Em text={text} /> How each figure is measured is set out in the{" "}
        <Link href="/methodology">methodology</Link>.
      </p>
      <a className="eh-btn eh-btn-primary" href={appUrl} target="_blank" rel="noopener noreferrer">
        Open the Harvest app
      </a>
    </div>
  );
}

/** One card per network: count, tracked value, up to three funded picks. */
export function NetworkCards({
  nets,
  unit,
  empty,
}: {
  nets: NetworkPicks[];
  unit: string;
  empty: (n: NetworkPicks) => string;
}) {
  return (
    <div className="eh-nets">
      {nets.map((n) => (
        <article className="eh-net" key={n.chain} aria-labelledby={`net-${n.chain}`}>
          <header className="eh-net-head">
            <ChainIcon chain={n.chain} size={22} />
            <h3 id={`net-${n.chain}`}>{`${unit} yield on ${n.chain}`}</h3>
          </header>
          <p className="eh-net-meta">
            {`${n.count} ${plural(n.count, "strategy", "strategies")}, ${tvl(n.tvl)} tracked`}
          </p>
          {n.picks.length ? (
            <div className="eh-picks" role="list">
              {n.picks.map((v) => (
                <div role="listitem" className="eh-pick" key={v.slug}>
                  <Link href={`/${v.slug}`} className="eh-pick-name">
                    {bare(v)}
                  </Link>
                  <span className="eh-pick-apy">{apy(v.apy24h)}</span>
                  <span className="eh-pick-sub">
                    {`${cap(SINGULAR[strategyTypeOf(v)])} · ${tvl(v.tvl)}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="eh-net-empty">{empty(n)}</p>
          )}
          <Link className="eh-net-more" href={`/${n.chain.toLowerCase()}`}>
            {`All ${n.chain} strategies`}
            <span aria-hidden="true"> →</span>
          </Link>
        </article>
      ))}
    </div>
  );
}

export function TypeCards({
  types,
  unit,
  floor,
}: {
  types: TypeRow[];
  unit: string;
  floor: number;
}) {
  return (
    <div className="eh-types">
      {types.map((t) => (
        <article className="eh-type" key={t.type} aria-labelledby={`type-${t.type}`}>
          <h3 id={`type-${t.type}`}>{t.label}</h3>
          <p className="eh-type-blurb">{typeBlurb(t.type, unit)}</p>
          <dl className="eh-type-stats">
            <div>
              <dt>Strategies</dt>
              <dd>{t.count}</dd>
            </div>
            <div>
              <dt>Median APY</dt>
              <dd>{apy(t.medianApy)}</dd>
            </div>
            <div>
              <dt>Tracked value</dt>
              <dd>{tvl(t.tvl)}</dd>
            </div>
          </dl>
          {t.bestFunded ? (
            <p className="eh-type-best">
              {`Best funded: `}
              <Link href={`/${t.bestFunded.slug}`}>{proseName(t.bestFunded)}</Link>
              {` at ${apy(t.bestFunded.apy24h)}.`}
            </p>
          ) : (
            <p className="eh-type-best">{`No ${SINGULAR[t.type]} held ${tvl(floor)} or more.`}</p>
          )}
        </article>
      ))}
    </div>
  );
}

/** "2 years and 1 month" -> "2y 1m": a table cell, not a sentence. */
const compactAge = (s: string) =>
  s
    .replace(/ and /, " ")
    .replace(/(\d+) years?/, "$1y")
    .replace(/(\d+) months?/, "$1m")
    .replace(/(\d+) days?/, "$1d");

export function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  return (
    <div className="eh-evidence-wrap" data-nosnippet="">
      <table className="eh-evidence">
        <thead>
          <tr>
            <th scope="col">Strategy</th>
            <th scope="col" className="num">24h APY</th>
            <th scope="col">Type</th>
            <th scope="col">History</th>
            <th scope="col" className="num">30d swing</th>
            <th scope="col" className="num">Tracked</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.vault.slug}>
              <th scope="row">
                <Link href={`/${r.vault.slug}`}>{bare(r.vault)}</Link>
                <span className="eh-netname">{r.vault.chain}</span>
              </th>
              <td data-label="24h APY" className="num">{apy(r.vault.apy24h)}</td>
              <td data-label="Type">{cap(SINGULAR[r.type])}</td>
              <td data-label="Vault history">{r.trackedDays ? compactAge(r.ageLabel) : "–"}</td>
              <td data-label="30-day swing" className="num">{r.stdev == null ? "–" : `±${r.stdev.toFixed(2)} pts`}</td>
              <td data-label="Tracked value" className="num">{tvl(r.vault.tvl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A year of earnings at the top funded rate and at the median. */
export function EarnTable({
  c,
  best,
  unit,
  amounts,
  digits,
}: {
  c: HubCohort;
  best: HubCohort["all"][number];
  unit: string;
  amounts: number[];
  digits: number;
}) {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (
    <table className="eh-earn">
      <caption>{`A year of earnings, in ${unit}, before any rate change`}</caption>
      <thead>
        <tr>
          <th scope="col">Amount</th>
          <th scope="col" className="num">{`At ${apy(best.apy24h)} (${bare(best)})`}</th>
          <th scope="col" className="num">{`At the ${apy(c.medianApy)} median`}</th>
        </tr>
      </thead>
      <tbody>
        {amounts.map((n) => (
          <tr key={n}>
            <th scope="row">{`${n.toLocaleString("en-US")} ${unit}`}</th>
            <td className="num">{`${fmt((n * best.apy24h) / 100)} ${unit}`}</td>
            <td className="num">{`${fmt((n * c.medianApy) / 100)} ${unit}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function VenueTable({ venues }: { venues: Venue[] }) {
  return (
    <table className="eh-rows">
      <thead>
        <tr>
          <th scope="col">Median APY</th>
          <th scope="col">Protocol</th>
          <th scope="col" className="num">24h range</th>
        </tr>
      </thead>
      <tbody>
        {venues.map((v) => (
          <tr key={v.venue}>
            <td className="eh-rows-num">
              <strong>{apy(v.medianApy)}</strong>
              <span>{v.count > 1 ? "median" : "24h APY"}</span>
            </td>
            <th scope="row">
              <span className="eh-rows-t">{v.venue}</span>
              <span className="eh-rows-s">
                {`${v.count} ${plural(v.count, "vault", "vaults")} · ${tvl(v.tvl)} tracked · ${v.chains.join(", ")}`}
              </span>
            </th>
            <td className="num">
              {v.count > 1 && v.minApy.toFixed(2) !== v.maxApy.toFixed(2) ? (
                <span className="eh-chip">{`${apyFloorLabel(v.minApy)} to ${apy(v.maxApy)}`}</span>
              ) : (
                <span className="eh-chip eh-chip-dim">single vault</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RiskList({ risks }: { risks: Risk[] }) {
  return (
    <ul className="uh-risks">
      {risks.map((r) => (
        <li key={r.title}>
          <strong>{r.title}</strong>
          {r.parts.map((part, i) =>
            typeof part === "string" ? (
              <Fragment key={i}>{part}</Fragment>
            ) : (
              <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">
                {part.text}
              </a>
            ),
          )}
        </li>
      ))}
    </ul>
  );
}

/** The index of every question on the page, each opening its answer in place. */
export function QuestionIndex({ faqs, title }: { faqs: Faq[]; title: string }) {
  return (
    <section className="uh-block eh-qindex" aria-labelledby="faq">
      <p className="rp-eyebrow">Questions</p>
      <h2 id="faq">{title}</h2>
      <nav aria-label="Questions answered on this page">
        <ol className="eh-qlist">
          {faqs.map((f) => (
            <li key={f.q}>
              <a href={`#${qid(f.q)}`}>{f.q}</a>
            </li>
          ))}
        </ol>
      </nav>
      {/* Opens the <details> a question link points at; plain script, no bundle. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){function o(){var h=location.hash.slice(1);if(!h)return;" +
            "var d=document.getElementById(h);if(d&&d.tagName==='DETAILS')d.open=true;}" +
            "addEventListener('hashchange',o);o();})();",
        }}
      />
    </section>
  );
}

export function NetworkPills({ chains }: { chains: string[] }) {
  return (
    <section className="uni-hub-cta-row">
      <p className="uni-hub-cta-meta">
        Looking for a specific chain? Network ranking pages cut the same data by network.
      </p>
      <div className="uni-hub-cta-links">
        {chains.slice(0, 6).map((chain) => (
          <Link key={chain} href={`/${chain.toLowerCase()}`} className="uni-hub-cta-pill">
            <ChainIcon chain={chain} size={14} />
            {chain}
          </Link>
        ))}
      </div>
    </section>
  );
}
