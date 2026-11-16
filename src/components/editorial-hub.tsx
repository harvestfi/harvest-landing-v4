// The editorial layout for the asset hubs (see lib/editorial-hub.ts).
// EditorialTop renders everything from the header to "How we measure";
// each hub then renders its own deeper sections inside EditorialSection
// shells, then EditorialQuestions, the full index and EditorialCta.
import Link from "next/link";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { RankTable } from "@/components/rank-table";
import { qid, type Faq } from "@/lib/long-hub";
import type { EditorialModel, EdCell, EdTable, Rich } from "@/lib/editorial-hub";
import type { ExploreCard } from "@/lib/explore-hubs";

function CrumbChevron() {
  return (
    <svg className="ae-crumb-chev" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m6 4 4 4-4 4" />
    </svg>
  );
}

function RichText({ parts }: { parts: Rich }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          p
        ) : p.href.startsWith("/") ? (
          <Link key={i} href={p.href}>
            {p.text}
          </Link>
        ) : (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
            {p.text}
          </a>
        ),
      )}
    </>
  );
}

function Cell({ cell }: { cell: EdCell }) {
  if (typeof cell === "string") return <>{cell}</>;
  return (
    <span className={cell.dim ? "ae-dim" : undefined}>
      <strong>{cell.strong}</strong>
      {cell.rest ? <span className="ae-cell-rest"> {cell.rest}</span> : null}
    </span>
  );
}

function PatternTable({ t }: { t: EdTable }) {
  // One alignment per column, shared by the header and every cell: a column
  // holding text (a rate with its strategy name, a list of networks) reads
  // left, a column of bare figures reads right.
  const textCol = t.head.map(
    (_, i) =>
      i === 0 ||
      t.rows.some((r) => {
        const cell = r.cells[i - 1];
        return typeof cell !== "string" || !/^[\s\d.,$%±<>KMB–-]+(?: pts)?$/.test(cell);
      }),
  );
  return (
    <figure className="ae-figure">
      <div className="ae-card ae-scroll">
        <table className="ae-table ae-ptable">
          <thead>
            <tr>
              {t.head.map((h, i) => (
                <th key={h} scope="col" className={textCol[i] ? "txt" : "num"}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.lead.title}>
                <th scope="row" className="txt">
                  <span className="ae-lead">
                    {r.lead.chain ? <ChainIcon chain={r.lead.chain} size={16} decorative /> : null}
                    {r.lead.token ? <AssetIcon asset={r.lead.token} size={16} decorative /> : null}
                    {r.lead.href ? (
                      <Link href={r.lead.href} className="ae-lead-t">
                        {r.lead.title}
                      </Link>
                    ) : (
                      <span className="ae-lead-t">{r.lead.title}</span>
                    )}
                  </span>
                  {r.lead.sub ? <span className="ae-lead-s">{r.lead.sub}</span> : null}
                </th>
                {r.cells.map((cell, i) => (
                  <td key={i} className={textCol[i + 1] ? "txt" : "num"}>
                    <Cell cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="ae-caption">{t.caption}</figcaption>
    </figure>
  );
}

export function EditorialTop({
  m,
  assetIcon,
  afterRanking,
}: {
  m: EditorialModel;
  assetIcon: string;
  /** A hub section placed straight after the ranking, e.g. the calculator. */
  afterRanking?: React.ReactNode;
}) {
  return (
    <>
      <nav className="ae-crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <CrumbChevron />
        <Link href="/">Rankings</Link>
        <CrumbChevron />
        <span aria-current="page" className="ae-crumb-asset">
          {m.chainIcon ? (
            <ChainIcon chain={m.chainIcon} size={16} decorative />
          ) : (
            <AssetIcon asset={assetIcon} size={16} decorative priority />
          )}
          {`${m.asset} yield`}
        </span>
      </nav>

      <h1 className="ae-h1">{m.h1}</h1>
      <p className="ae-h1-dek">{m.dek}</p>
      <p className="ae-lede">{m.lede}</p>
      <p className="ae-byline" data-dateline="">
        Harvest Research · Updated {m.asOf}, {m.asOfTime} UTC
      </p>
      <div className="ae-hero-ctas">
        <a className="ae-btn" href={m.appUrl} target="_blank" rel="noopener noreferrer">
          Open App
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ae-btn-ext"><path d="M5 11 11 5M6 5h5v5" /></svg>
        </a>
        <a className="ae-btn-ghost" href="#top-10">
          {`Jump to Top ${m.top.length}`}
          <span aria-hidden="true"> ↓</span>
        </a>
      </div>

      <aside className="ae-quick" aria-label="Quick answers">
        <p className="ae-kicker">Quick answers</p>
        <ul>
          {m.quick.map((x) => (
            // Question and answer in separate paragraphs: the question is not a
            // claim, and the answer carries its own date.
            <li key={x.q}>
              <p className="ae-q">{x.q}</p> <p className="ae-a">{x.a}</p>
            </li>
          ))}
        </ul>
      </aside>

      {/* The ranking sits straight under the quick answers; the intro that
          explains why rates differ between apps follows the table. */}
      <section className="ae-section ae-section-first" aria-labelledby="top-10" data-asof={m.asOfIso}>
        <h2 id="top-10">{m.topTitle}</h2>
        <p className="ae-sub">{m.topLead}</p>
        <RankTable
          rows={m.top}
          tvl={false}
          title={`${m.asset} Ranking`}
          icon={m.chainIcon ? { chain: m.chainIcon } : { asset: assetIcon }}
          floorLabel={m.floorLabel}
          appUrl={m.appUrl}
        />
        <p className="ae-caption" data-dateline="">
          {m.topCaption}
        </p>
        <p>{m.topNotes[0]}</p>
        <div className="ae-intro">
          {m.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p className="ae-muted">{m.disclaimer}</p>
        </div>
        {afterRanking
          ? null
          : m.topNotes.slice(1).map((t) => (
              <p key={t}>{t}</p>
            ))}
      </section>

      {afterRanking}

      <section className="ae-section" aria-labelledby="what-we-noticed" data-asof={m.asOfIso}>
        <h2 id="what-we-noticed">What we noticed</h2>
        <p className="ae-sub" data-dateline="">
          {m.noticedLead}
        </p>
        {m.patterns.map((p, i) => (
          <article className="ae-pattern" key={p.title} aria-labelledby={`pattern-${i + 1}`}>
            <h3 id={`pattern-${i + 1}`} className="ae-pattern-h">
              <span className="ae-pattern-n" aria-hidden="true">
                {i + 1}
              </span>
              <span>{p.title}</span>
            </h3>
            <p>{p.body}</p>
            {p.table ? <PatternTable t={p.table} /> : null}
          </article>
        ))}
      </section>

      <section className="ae-section" aria-labelledby="key-takeaways" data-asof={m.asOfIso}>
        <h2 id="key-takeaways">Key takeaways</h2>
        <table className="ae-takeaways">
          <caption className="ae-sr">{`Key takeaways as of ${m.asOf}`}</caption>
          <tbody>
            {m.takeaways.map((t) => (
              <tr key={t.k}>
                <th scope="row">{t.k}</th>
                <td>
                  <strong>{t.strong}</strong> {t.rest}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ae-section" aria-labelledby="how-we-measure" data-asof={m.asOfIso}>
        <h2 id="how-we-measure">{m.measureTitle}</h2>
        {m.measure.map((p, i) => (
          <p key={i} data-dateline={i === 1 ? "" : undefined}>
            <RichText parts={p} />
          </p>
        ))}
      </section>
    </>
  );
}

/** Shell for a hub's own deeper sections, in the same typographic system. */
export function EditorialSection({
  id,
  title,
  lead,
  asOf,
  asOfIso,
  children,
}: {
  id: string;
  title: string;
  lead?: React.ReactNode;
  asOf?: string;
  asOfIso?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="ae-section" aria-labelledby={id} data-asof={asOfIso}>
      <h2 id={id}>{title}</h2>
      {asOf ? (
        <p className="ae-dateline" data-dateline="">
          Data as of {asOf}
        </p>
      ) : null}
      {lead ? <p className="ae-sub">{lead}</p> : null}
      {children}
    </section>
  );
}

/** Every question on the page, answered in place, one list. */
export function EditorialQuestions({
  faqs,
  title,
  asOf,
  asOfIso,
}: {
  faqs: Faq[] | { q: string; a: string }[];
  title: string;
  asOf: string;
  asOfIso: string;
}) {
  return (
    <section className="ae-section" aria-labelledby="questions" data-asof={asOfIso}>
      <h2 id="questions">{title}</h2>
      <p className="ae-dateline" data-dateline="">
        Answers as of {asOf}
      </p>
      <div className="ae-faq">
        {faqs.map((f, i) => (
          <details className="ae-faq-item" key={f.q} id={qid(f.q)} open={i === 0}>
            <summary>
              <span>{f.q}</span>
              <span className="ae-faq-chev" aria-hidden="true">
                +
              </span>
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Cards linking to the other asset hubs and to the network hubs. */
export function ExploreHubs({ assets, networks }: { assets: ExploreCard[]; networks: ExploreCard[] }) {
  const card = (c: ExploreCard) => (
    <Link key={c.href} href={c.href} className="ex-card">
      <span className="ex-ico">
        {c.kind === "asset" ? (
          <AssetIcon asset={c.icon} size={24} decorative />
        ) : (
          <ChainIcon chain={c.icon} size={22} decorative />
        )}
      </span>
      <span className="ex-txt">
        <span className="ex-title">{c.title}</span>
        <span className="ex-meta">
          {`${c.count} ${c.count === 1 ? "strategy" : "strategies"}`}
          {c.bestFunded != null ? ` · up to ${c.bestFunded.toFixed(2)}%` : ""}
        </span>
      </span>
      <svg className="ex-arrow" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 4 4 4-4 4" />
      </svg>
    </Link>
  );
  return (
    <nav className="ex" aria-label="Explore other rankings">
      <p className="ex-h">Explore other assets</p>
      <div className="ex-grid">{assets.map(card)}</div>
      <p className="ex-h">Explore by network</p>
      <div className="ex-grid">{networks.map(card)}</div>
    </nav>
  );
}

/** Marks the rail entry for the section being read. Plain script, no bundle. */
const TOC_SPY =
  "(function(){var q=0;function u(){q=0;var l=[].slice.call(document.querySelectorAll('.ld-toc a'));" +
  "var y=innerHeight*0.3,k=0;l.forEach(function(a,i){var e=document.getElementById(a.getAttribute('href').slice(1));" +
  "if(e&&e.getBoundingClientRect().top<=y)k=i});" +
  "l.forEach(function(a,i){a.setAttribute('aria-current',i===k?'true':'false')})}" +
  "function t(){if(!q)q=requestAnimationFrame(u)}" +
  "addEventListener('scroll',t,{passive:true});addEventListener('resize',t);addEventListener('hashchange',t);" +
  "if(document.readyState==='loading')addEventListener('DOMContentLoaded',u);else u();addEventListener('load',u);})();";

/**
 * The docs layout's two rails: "On this page" on the left and the app promo
 * on the right. Both run the article's height and stick inside it (asset-ld.css).
 */
export function DocsRails({
  toc,
  token,
  assetName,
  appUrl,
  chain,
}: {
  chain?: string;
  toc: [string, string][];
  token: string;
  assetName: string;
  appUrl: string;
}) {
  return (
    <>
      <nav className="ld-toc" aria-label="On this page">
        <div className="ld-toc-in">
          <p className="ld-toc-h">On this page</p>
          <ul>
            {toc.map(([id, label]) => (
              <li key={id}>
                {/* The scroll-spy script marks the current entry before React
                    hydrates, so this attribute is allowed to differ. */}
                <a href={`#${id}`} suppressHydrationWarning>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <script dangerouslySetInnerHTML={{ __html: TOC_SPY }} />
      </nav>
      <div className="ld-promo">
        <div className="ld-promo-in">
          <AppPromo token={token} assetName={assetName} appUrl={appUrl} chain={chain} />
        </div>
      </div>
    </>
  );
}

/**
 * The app, advertised beside the article: a phone drawn in CSS showing the
 * asset only (no rate: an ad must not quote a yield), one line of copy and
 * one way in.
 */
export function AppPromo({
  token,
  assetName,
  appUrl,
  chain,
}: {
  /** Network pages show the network's mark instead of an asset. */
  chain?: string;
  /** Icon key, e.g. "BTC". */
  token: string;
  /** Reader-facing name, e.g. "Bitcoin". */
  assetName: string;
  appUrl: string;
}) {
  return (
    <aside className="ap" aria-label="Harvest app">
      <div className="ap-stage" aria-hidden="true">
        <div className="ap-phone">
          <div className="ap-notch" />
          <div className="ap-screen">
            <p className="ap-app">Harvest</p>
            <div className="ap-asset">
              {chain ? <ChainIcon chain={chain} size={56} decorative /> : <AssetIcon asset={token} size={56} decorative />}
            </div>
            <p className="ap-name">{assetName}</p>
            <p className="ap-ticker">{chain ? "Network" : token}</p>
            <div className="ap-btn">Automate</div>
          </div>
        </div>
      </div>
      {/* Spans, not paragraphs: an ad is not article prose, so the prose gates skip it. */}
      <span className="ap-h">{`Automate your ${assetName} with Harvest vaults`}</span>
      <a className="ap-cta" href={appUrl} target="_blank" rel="noopener noreferrer">
        Open App
      </a>
      <span className="ap-note">Opens app.harvest.finance</span>
    </aside>
  );
}

export function EditorialCta({ text, appUrl }: { text: string; appUrl: string }) {
  return (
    <div className="ae-cta">
      <p>{text}</p>
      <a className="ae-btn" href={appUrl} target="_blank" rel="noopener noreferrer">
        Open the Harvest app
      </a>
    </div>
  );
}
