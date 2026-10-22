// Dedicated body for /eth.
//
// /eth used to render through the shared asset-hub-body.tsx: a ranking table,
// a stat strip and a few paragraphs of definitions, no answer anywhere in the
// prose and no FAQ markup. Search Console says the page is already being
// surfaced for full-sentence questions, most of them scoped to a network:
//
//   where can i earn yield on eth on base?               pos 2.4
//   which protocols pay the highest eth yield on an l2?  pos 3.0
//   which eth yield options on base are the safest?      pos 4.8
//   what can i do with wrapped eth on base to earn yield? pos 5.3
//   what are the best options for eth yield with cheap gas? pos 4.0
//
// and earning almost no clicks from them, because the page had no sentence an
// answer engine could lift. This body is built around those questions: each
// one gets a section whose heading reads like the query and whose first
// sentence is the answer, with the figure, the scope and the date in it.
//
// Same house style and the same shared pieces as /usdc (Block shell, HubTable,
// calculator, schema helpers), so the two long-form hubs read as one site.
import { Fragment } from "react";
import Link from "next/link";
import { getAllSparklines } from "@/lib/data";
import { AssetIcon, ChainIcon } from "@/components/token-icons";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { assetHubCrumbs } from "@/lib/seo";
import {
  breadcrumbSchema,
  itemListSchema,
  faqPageSchema,
  reportDatasetSchema,
} from "@/lib/jsonld";
import { HubTable } from "@/components/hub-table";
import { HomeCrumb } from "@/components/home-crumb";
import { RankingDataNote } from "@/components/ranking-data-note";
import { UsdcCalculator, type CalcProduct } from "@/components/usdc-calculator";
import { EthLoopFigure } from "@/components/eth-loop-figure";
import { harvestAppUrl } from "@/lib/harvest-app";
import { proseName, listOf, plural, apy, apyFloorLabel, tvl } from "@/lib/usdc-hub";
import { strategyTypeOf, isL2 } from "@/lib/eth-hub";
import {
  ethPageModel,
  networkSentence,
  safetyFraming,
  stakingReferenceText,
  stakingSourceUrl,
  bare,
  SINGULAR,
  PLURAL,
  TYPE_BLURB,
  HARVEST_FEE_TEXT,
  ETH_HUB_H1,
  ETH_RISKS,
  ETH_RISKS_LEAD,
  STAKING_LEAD,
  venueLead,
  venueLine,
  aboveStaking,
  aprToApy,
  countOf,
  type Faq,
  type FaqSpot,
} from "@/lib/eth-hub-copy";

const HUB_URL = `${SITE_URL}/eth`;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);


/** Stable anchor for a question, so the index at the foot can link to it. */
const qid = (q: string) =>
  "q-" +
  q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

// Bold the figures in a generated sentence. Rates, dollar sizes and counts of
// strategies are what a skimming reader's eye is hunting for, so they carry
// the weight; the words around them stay regular. Wrapping in <strong> leaves
// the extracted text identical, so nothing an answer engine lifts changes.
const FIGURE =
  /(\$[\d.,]+[KMB]?|\d+(?:\.\d+)?%(?: APY)?|\b\d+ of (?:the )?\d+\b|\b\d+ (?:ETH |WETH )?strateg(?:y|ies)\b)/g;
function Em({ text }: { text: string }) {
  const parts = text.split(FIGURE);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

/**
 * The questions a reader tends to have at this point in the page, answered in
 * place. Same <details> pattern as the FAQ on /usdc, so every answer is in the
 * HTML whether or not it is open, and the FAQPage schema still lists them all.
 */
function Ask({ items }: { items: Faq[] }) {
  if (!items.length) return null;
  return (
    <aside className="eh-ask" aria-label="Questions on this section">
      <p className="eh-ask-h">Questions readers ask here</p>
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


/**
 * A short list of the section's facts, each a whole sentence that survives
 * being lifted on its own. Readers skim it; answer engines quote it.
 */
function KeyPoints({ items }: { items: string[] }) {
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

/** Two figures side by side under one label, with a dated note below. */
function StatPair({
  title,
  items,
  note,
}: {
  title: string;
  items: { label: string; value: string; sub?: string }[];
  note: string;
}) {
  return (
    <figure className="eh-stat" data-nosnippet="">
      <figcaption className="eh-stat-h">{title}</figcaption>
      <dl className="eh-stat-row">
        {items.map((it) => (
          <div key={it.label}>
            <dt>{it.label}</dt>
            <dd className="eh-stat-v">{it.value}</dd>
            {it.sub ? <dd className="eh-stat-s">{it.sub}</dd> : null}
          </div>
        ))}
      </dl>
      <p className="eh-stat-note">{note}</p>
    </figure>
  );
}

function Block({
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
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function Chevron() {
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


export async function EthHubBody() {
  const [m, sparklines] = await Promise.all([ethPageModel(), getAllSparklines()]);

  if (!m) {
    return (
      <div className="uni-hub-test">
        <h1 className="uni-hub-h1">{ETH_HUB_H1}</h1>
        <p className="uni-hub-sub">ETH yield strategies are populating, check back shortly.</p>
      </div>
    );
  }

  const { c, best, nets, types, evidence, staking, faqs, venues, l2Count } = m;
  const crumbs = assetHubCrumbs("ETH");
  const asOfTime = new Date(c.asOfIso).toISOString().slice(11, 16);
  const monthYear = new Date(c.asOfIso).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  // Comparison wording for the protocol heading, from the largest venues.
  const venueVs = venues
    .filter((v) => !v.loop)
    .slice(0, 4)
    .map((v) => v.venue)
    .join(" vs ");
  // 0xFE09…573e is the fWETH vault Harvest launched on Ethereum in October 2020;
  // its history is real and long, and the strategy behind it is newer.
  const hasOriginalVault = evidence.some(
    (r) => r.vault.contractAddress.toLowerCase() === "0xfe09e53a81fe2808bc493ea64319109b5baa573e",
  );
  const mmFunded = c.funded.filter((v) => strategyTypeOf(v) === "money-market").length;
  const asks = (at: FaqSpot) => faqs.filter((f) => f.at === at);
  const base = nets.find((n) => n.chain === "Base");
  const visibleChains = [...c.chains].sort();

  const calcProducts: CalcProduct[] = c.all.map((v) => ({
    slug: v.slug,
    name: v.productName,
    apy: v.apy24h,
    chain: v.chain,
    appUrl: harvestAppUrl(v.chain, v.contractAddress),
  }));

  const topRaw = c.bestRaw && c.bestRaw.slug !== best.slug ? c.bestRaw : null;

  return (
    <div className="uni-hub-test uh-page eh-page eh-read">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(crumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            ...itemListSchema(c.all, HUB_URL, "24h"),
            name: "ETH yield strategies ranked by 24-hour APY",
            numberOfItems: c.count,
            dateModified: c.asOfIso,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": HUB_URL,
            url: HUB_URL,
            name: "Best ETH yield: live ranking of ETH lending and vault rates",
            dateModified: c.asOfIso,
            inLanguage: "en",
            isBasedOn: `${SITE_URL}/methodology`,
            author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
            publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            reportDatasetSchema({
              name: "ETH yield strategies tracked by Harvest",
              description:
                `Live 24-hour APY, 30-day mean APY and tracked value for the ${c.count} ETH and ` +
                `WETH yield strategies Harvest indexes across ${c.chainCount} networks, measured ` +
                `from first-party vault contract readings and refreshed several times a day.`,
              url: HUB_URL,
              dateModified: c.asOfIso,
              temporalCoverage: c.asOfIso,
              keywords: ["ETH", "WETH", "Ethereum", "yield", "APY", "Base", "Arbitrum", "DeFi"],
              sources: [`${SITE_URL}/methodology`],
              distribution: [{ format: "application/json", url: `${SITE_URL}/data/index.json` }],
            }),
          ),
        }}
      />

      <nav className="uni-hub-crumbs" aria-label="Breadcrumb">
        <HomeCrumb />
        <span className="uni-hub-crumbs-sep" aria-hidden="true">›</span>
        <span className="uni-hub-crumbs-current">ETH Ranking</span>
      </nav>

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

      <div className="uni-hub-hero uh-hero eh-hero">
        <div className="eh-hero-title">
          <AssetIcon asset="ETH" size={52} priority />
          <h1 className="uni-hub-h1">{ETH_HUB_H1}</h1>
        </div>
        <p className="eh-dek">
          Live ETH and WETH lending rates for {monthYear}{" "}
          <span className="eh-dek-accent">· read from the vault contracts</span>
        </p>
        <p className="uh-answer">
          <Em text={m.heroAnswer} />
        </p>
        <div className="eh-ctas">
          <a className="eh-btn eh-btn-primary" href="https://app.harvest.finance/?search=eth&asset=singlestakes" target="_blank" rel="noopener noreferrer">
            Open the Harvest app
          </a>
          <a className="eh-btn" href="#top-ten">
            See the top 10 ranking
            <span aria-hidden="true">&nbsp;↓</span>
          </a>
        </div>
      </div>

      {/* Four figures as text in a ruled grid: a label over a value, dated by
          the meta line above. */}
      <dl className="eh-statgrid" data-asof={c.asOfIso}>
        {topRaw ? (
          <div>
            <dt>Top rate overall</dt>
            <dd className="eh-sg-v">{apy(topRaw.apy24h)}</dd>
            <dd className="eh-sg-s">
              {bare(topRaw)} · {SINGULAR[strategyTypeOf(topRaw)]}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Best above {tvl(c.fundedFloor)}</dt>
          <dd className="eh-sg-v">{apy(best.apy24h)}</dd>
          <dd className="eh-sg-s">
            {bare(best)} · {best.chain}
          </dd>
        </div>
        <div>
          <dt>Tracked in ETH strategies</dt>
          <dd className="eh-sg-v">{tvl(c.totalTvl)}</dd>
          <dd className="eh-sg-s">
            {c.count} strategies on {c.chainCount} networks
          </dd>
        </div>
        {staking ? (
          <div>
            <dt>Staking reference</dt>
            <dd className="eh-sg-v">{`${aprToApy(staking.aprAverage).toFixed(2)}%`}</dd>
            <dd className="eh-sg-s">Lido stETH, after its fee</dd>
          </div>
        ) : null}
      </dl>

      <Block
        id="top-ten"
        eyebrow="Live ranking"
        title="Top 10 ETH yields by 24-hour APY"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `The ten highest-paying ETH strategies in this index ran from ` +
          `${apy(c.top10[c.top10.length - 1].apy24h)} to ${apy(c.maxApy)}, across ` +
          `${listOf([...new Set(c.top10.map((v) => v.chain))])}.`
        }
      >
        <HubTable
          vaults={c.top10}
          sparklines={sparklines}
          scopeLabel="ETH strategies"
          openLinks
          metrics
          venueLabel="Protocol"
        />
        <p className="uh-note">
          {`Rates are read from the vault contracts on ${listOf(visibleChains)}, net of fees, and ` +
            `refreshed several times a day, as the `}
          <Link href="/methodology">methodology</Link>
          {` sets out. ` +
            `Sorted on the 24-hour rate with no floor applied, so a row near the top can sit on a ` +
            `few hundred dollars of ETH. The headline figure uses a ${tvl(c.fundedFloor)} floor ` +
            `for that reason, and ${c.fundedCount} of the ${c.count} strategies cleared it.`}
        </p>
        <p>
          The rest of the page breaks the ranking down: <a href="#by-network">ETH yield by network</a>
          , <a href="#safest">what can be measured about safety</a>,{" "}
          <a href="#vs-staking">how lending compares with staking</a> and{" "}
          <a href="#calculator">what 1 ETH earns in a year</a>. The same rates for stablecoins are on
          the <Link href="/usdc">USDC yield ranking</Link>.
        </p>
        <Ask items={asks("top")} />
      </Block>

      <Block
        id="by-network"
        eyebrow="By network"
        title="ETH yield on Base vs Arbitrum vs Ethereum"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={base ? networkSentence(base, c) : undefined}
      >
        <KeyPoints
          items={[
            ...nets.map((n) =>
              n.picks[0]
                ? `The best funded ETH rate on ${n.chain} was ${apy(n.picks[0].apy24h)}, ` +
                  `paid by ${bare(n.picks[0])}.`
                : `No ETH strategy on ${n.chain} held ${tvl(c.fundedFloor)} or more.`,
            ),
            `Layer 2 networks carry ${l2Count} of the ${c.count} ETH strategies, and a ` +
              `transaction there costs cents.`,
          ]}
        />
        <p>
          <strong>Gas decides more than the rate on a small position.</strong>{" "}
          <Link href="/base">Base</Link> and <Link href="/arbitrum">Arbitrum</Link> are{" "}
          <Ext href="https://ethereum.org/en/layer-2/">layer 2 networks</Ext> that settle a
          transaction for cents, while <Link href="/ethereum">Ethereum mainnet</Link> can cost several
          dollars when it is busy. On a position of a few ETH, that difference decides whether
          entering and leaving is worth it at all.
        </p>
        <div className="eh-nets">
          {nets.map((n) => (
            <article className="eh-net" key={n.chain} aria-labelledby={`net-${n.chain}`}>
              <header className="eh-net-head">
                <ChainIcon chain={n.chain} size={22} />
                <h3 id={`net-${n.chain}`}>{`ETH yield on ${n.chain}`}</h3>
                <span className="eh-net-tag">{isL2(n.chain) ? "Layer 2" : "Mainnet"}</span>
              </header>
              <p className="eh-net-meta">
                {`${n.count} ${plural(n.count, "strategy", "strategies")}, ${tvl(n.tvl)} tracked`}
              </p>
              {n.picks.length ? (
                // ARIA list roles rather than <ol>/<li>: each pick is a
                // name, a rate and a size, a data row rather than a sentence,
                // and the bullet-fragment rule rightly reserves <li> for prose.
                <div className="eh-picks" role="list">
                  {n.picks.map((v) => (
                    <div role="listitem" className="eh-pick" key={v.slug}>
                      <Link href={`/${v.slug}`} className="eh-pick-name">
                        {v.productName.replace(/\s*\([^)]*\)$/, "")}
                      </Link>
                      <span className="eh-pick-apy">{apy(v.apy24h)}</span>
                      <span className="eh-pick-sub">
                        {`${cap(SINGULAR[strategyTypeOf(v)])} · ${tvl(v.tvl)}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="eh-net-empty">{networkSentence(n, c)}</p>
              )}
              <Link className="eh-net-more" href={`/${n.chain.toLowerCase()}`}>
                {`All ${n.chain} strategies`}
                <span aria-hidden="true"> →</span>
              </Link>
            </article>
          ))}
        </div>
        <p>
          <Em
            text={
              `Of the ${c.count} ETH strategies tracked, ${l2Count} run on a layer 2. Each card ` +
              `links to its network page, which cuts the full ranking down to that chain.`
            }
          />
        </p>
        <Ask items={asks("network")} />
      </Block>

      <Block
        id="strategy-types"
        eyebrow="Strategy types"
        title="What you can do with ETH or WETH to earn yield"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `ETH in this index earns yield in four ways, by lending it into a pooled market, ` +
          `handing it to a curated vault, letting an allocator move it, or looping it with ` +
          `leverage, and as of ${c.asOf} the index held ` +
          `${listOf(types.map((t) => `${t.count} ${t.count === 1 ? SINGULAR[t.type] : PLURAL[t.type]}`))}.`
        }
      >
        <KeyPoints
          items={[
            "ETH earns yield here in four ways: money markets, curated vaults, allocators and leveraged loops.",
            "WETH is ETH wrapped one-to-one, and it unwraps back to ETH at any time.",
            "Every step from a money market to a loop adds a layer of contracts, and only leveraged looping can be liquidated.",
          ]}
        />
        <p>
          <strong>WETH and ETH are the same asset in every row.</strong>{" "}
          <Ext href="https://ethereum.org/en/wrapped-eth/">Wrapped ETH</Ext> is ETH locked one-to-one
          in a contract that issues an{" "}
          <Ext href="https://eips.ethereum.org/EIPS/eip-20">ERC-20 token</Ext>, because lending
          contracts can hold ERC-20 tokens and cannot hold native ETH.
        </p>
        <div className="eh-types">
          {types.map((t) => (
            <article className="eh-type" key={t.type} aria-labelledby={`type-${t.type}`}>
              <h3 id={`type-${t.type}`}>{t.label}</h3>
              <p className="eh-type-blurb">{TYPE_BLURB[t.type]}</p>
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
                <p className="eh-type-best">
                  {`No ${SINGULAR[t.type]} held ${tvl(c.fundedFloor)} or more.`}
                </p>
              )}
            </article>
          ))}
        </div>
        <p>
          {`WETH unwraps back to ETH at any time, and on Base every strategy takes it, so ` +
            `wrapping is the first step and a single transaction.`}
        </p>
        <p>
          <strong>A money market has the fewest layers, and every step up adds one.</strong>{" "}
          A money market such as <Link href="/aave">Aave</Link> is one protocol and one rate curve.
          A curated vault on <Link href="/morpho">Morpho</Link>{" "}adds the curator&rsquo;s choice of
          markets. An allocator adds a contract that moves the position between venues.
        </p>
        <EthLoopFigure
          vaultHref={(() => {
            const loop = c.all.find((v) => strategyTypeOf(v) === "looping");
            return loop ? `/${loop.slug}` : undefined;
          })()}
        />
        <p>
          <strong>Looping adds leverage</strong>, the only one of the four with a liquidation
          path. Building the loop costs fees, so it charges an entry cost the app shows before a
          position opens.
        </p>
        <Ask items={asks("types")} />
      </Block>

      <Block
        id="safest"
        eyebrow="Safety evidence"
        title="Which ETH yield options are the safest?"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          safetyFraming(c)
        }
      >
        <div className="eh-evidence-wrap" data-nosnippet="">
          <table className="eh-evidence">
            <thead>
              <tr>
                <th scope="col">Strategy</th>
                <th scope="col">Type</th>
                <th scope="col">Tracked value</th>
                <th scope="col">Vault history</th>
                <th scope="col">30-day swing</th>
                <th scope="col">24h APY</th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((r) => (
                <tr key={r.vault.slug}>
                  <th scope="row">
                    <Link href={`/${r.vault.slug}`}>{bare(r.vault)}</Link>
                    <span className="eh-netname">{r.vault.chain}</span>
                  </th>
                  <td data-label="Type">{cap(SINGULAR[r.type])}</td>
                  <td data-label="Tracked value">{tvl(r.vault.tvl)}</td>
                  <td data-label="Vault history">{r.trackedDays ? r.ageLabel : "–"}</td>
                  <td data-label="30-day swing">
                    {r.stdev == null ? "–" : `±${r.stdev.toFixed(2)} pts`}
                  </td>
                  <td data-label="24h APY">{apy(r.vault.apy24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {evidence[0] ? (
          <p>
            {`The largest funded ETH strategy was `}
            <Link href={`/${evidence[0].vault.slug}`}>{proseName(evidence[0].vault)}</Link>
            {`, holding ` +
              `${tvl(evidence[0].vault.tvl)} and tracked for ` +
              `${evidence[0].ageLabel}. A strategy that size has had its rate ` +
              `tested by real withdrawals, and it is also a larger target for attackers.`}
          </p>
        ) : null}
        <dl className="eh-defs">
          <dt>Vault history</dt>
          <dd>
            {`Counts the time since the vault contract’s first reading. Harvest vaults are ` +
              `upgradeable, so an older vault can run a newer strategy`}
            {hasOriginalVault
              ? ": ETH KPK Yield V2 is Harvest’s original ETH vault from October 2020, which now lends through KPK’s Morpho vault."
              : "."}
          </dd>
          <dt>30-day swing</dt>
          <dd>
            Measures the standard deviation of the daily rate. Under one point means the rate held
            steady all month; several points means the headline figure is a spike.
          </dd>
          <dt>Type</dt>
          <dd>
            {`Shows how many contracts sit between the ETH and the borrower. A plain money ` +
              `market has the fewest` +
              (mmFunded === 0
                ? `, though every money market in this index held under the liquidity floor, ` +
                  `so the fewest layers here also come with the least size`
                : "") +
              `, and the `}
            <Link href="/risk-framework">risk framework page</Link> covers every exposure.
          </dd>
        </dl>
        <p>
          None of these columns is a safety score. They are the parts of risk that can be counted,
          and the contracts behind every vault are listed with their audits on the{" "}
          <Link href="/security">security and audits page</Link>.
        </p>
        <Ask items={asks("safety")} />
      </Block>

      <Block
        id="calculator"
        eyebrow="Calculator"
        title="How much can 1 ETH earn in a year?"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `Pick an amount of ETH and any of the ${c.count} tracked ETH strategies, and the ` +
          `calculator works out a year of earnings in ETH from the rate on record.`
        }
      >
        <UsdcCalculator products={calcProducts} asOf={c.asOf} asset="ETH" defaultAmount={1} />
        <p>
          <Em
            text={
              `At the top funded rate of ${apy(best.apy24h)} as of ${c.asOf}, 1 ETH would earn about ` +
              `${(best.apy24h / 100).toFixed(4)} ETH over a year. The table runs the same sum for ` +
              `10 and 32 ETH, beside the median rate.`
            }
          />
        </p>
        <table className="eh-earn">
          <caption>
            A year of earnings, in ETH, before any rate change
          </caption>
          <thead>
            <tr>
              <th scope="col">Amount</th>
              <th scope="col">{`At ${apy(best.apy24h)} (${bare(best)})`}</th>
              <th scope="col">{`At the ${apy(c.medianApy)} median`}</th>
            </tr>
          </thead>
          <tbody>
            {[1, 10, 32].map((n) => (
              <tr key={n}>
                <th scope="row">{`${n} ETH`}</th>
                <td>{`${((n * best.apy24h) / 100).toFixed(4)} ETH`}</td>
                <td>{`${((n * c.medianApy) / 100).toFixed(4)} ETH`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Both columns assume the rate holds for a full year, which no onchain rate does, and the
          yield is paid in ETH, so its dollar value moves with the ETH price.
        </p>
        <Ask items={asks("calc")} />
      </Block>

      <Block
        id="how-to-start"
        eyebrow="Getting started"
        title="How to start earning yield on ETH"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `Starting takes a handful of transactions, and on Base, where ${base?.count ?? 0} of ` +
          `the ${c.count} ETH strategies run, each one costs a few cents.`
        }
      >
        <ol className="eh-steps">
          <li>
            <strong>Choosing a network comes first.</strong> <Link href="/base">Base</Link> holds
            most of the funded ETH strategies; Ethereum mainnet costs more per transaction.
          </li>
          <li>
            <strong>Wrapping ETH into WETH takes one transaction</strong>, and it unwraps back to
            ETH at any time.
          </li>
          <li>
            <strong>Picking a strategy sets the rate and the risk.</strong>{" "}
            The <a href="#safest">safety table</a>{" "}shows each funded strategy&rsquo;s size, history
            and 30-day swing.
          </li>
          <li>
            <strong>Entering the position is one transaction in the Harvest app</strong>, which
            issues vault shares that grow as the strategy compounds.
          </li>
          <li>
            <strong>Withdrawing is open at any time</strong> the market underneath has unborrowed
            ETH to pay out, with no lockup or exit queue.
          </li>
        </ol>
        <p>
          <strong>What it costs.</strong>{" "}
          {`Harvest keeps a share of the yield each strategy harvests, ${HARVEST_FEE_TEXT}, ` +
            `split between a profit share and a platform fee set in each strategy contract.`}
        </p>
        <p>
          {`Every rate on this page is after that fee, so the APY shown is what the position ` +
            `earns. There is no fee to enter or leave a vault.`}
        </p>
        <p>
          {`Gas is paid on each transaction, and the looping strategy charges an entry cost ` +
            `the app shows before a position opens. How `}
          <Ext href="https://ethereum.org/en/developers/docs/gas/">gas</Ext>
          {` is priced is set out by the Ethereum Foundation.`}
        </p>
      </Block>

      <Block
        id="vs-staking"
        eyebrow="Mechanism"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        title="ETH yield vs staking (Lido stETH)"
        lead={STAKING_LEAD}
      >
        {staking ? (
          <KeyPoints
            items={[
              `Lido's stETH paid about ${aprToApy(staking.aprAverage).toFixed(2)}% APY, the ` +
                `staking rate this page compares against.`,
              `${cap(countOf(aboveStaking(c, staking).length, c.fundedCount))} ETH strategies ` +
                `holding at least ${tvl(c.fundedFloor)} paid more than staking.`,
              `None of the ${c.count} ETH strategies here is staked, so no withdrawal waits in ` +
                `the validator exit queue.`,
            ]}
          />
        ) : null}
        <p>
          A staked position earns from the protocol itself: new ETH issued to{" "}
          <Ext href="https://ethereum.org/en/staking/">validators</Ext> plus the fees and tips they
          collect.
        </p>
        {staking ? (
          <StatPair
            title="Staking against lending"
            items={[
              {
                label: "Lido stETH",
                value: `${aprToApy(staking.aprAverage).toFixed(2)}%`,
                sub: "Staking, after Lido's fee",
              },
              { label: `Best above ${tvl(c.fundedFloor)}`, value: apy(best.apy24h), sub: bare(best) },
            ]}
            note={`APY as of ${c.asOf}. Staking is an average of daily reports, lending a 24-hour rate.`}
          />
        ) : null}
        <p>
          Getting out goes through Ethereum&rsquo;s{" "}
          <Ext href="https://ethereum.org/en/staking/withdrawals/">validator exit queue</Ext>, which
          can take days when
          many validators leave at once. Liquid staking tokens such as stETH skip the wait by
          letting the position trade, at whatever price the market offers that day.
        </p>
        <p>
          A lending position earns from borrowers. People borrow ETH to sell it short, to pay for
          a leveraged staking position, or to fund a trade.
        </p>
        <p>
          Borrowers pay more when ETH is in demand and less when it is not.{" "}
          <strong>Nothing here is staked, so nothing waits in the exit queue.</strong>
        </p>
        <p>
          A withdrawal waits only if the market underneath has lent out all of its ETH, which
          happens rarely and briefly, and the rate climbs until supply returns.
        </p>
        {staking ? (
          <p>
            <strong>The staking reference.</strong>{" "}
            {`${stakingReferenceText(c, staking)} Source: `}
            <a
              href={stakingSourceUrl(staking)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Lido stETH TokenRebased events
            </a>
            .
          </p>
        ) : null}
        <p>
          The two sources move independently, so a lending rate can sit above or below the
          staking rate on any given day. When the lending rate is higher, it is usually because
          leveraged traders are paying up for ETH, and that demand can disappear quickly.
        </p>
        <Ask items={asks("staking")} />
      </Block>

      <Block
        id="rate-stability"
        eyebrow="Stability"
        title="How steady ETH rates have been"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          c.stability.measuredCount
            ? `Across the ${c.stability.measuredCount} ETH strategies with a month of readings ` +
              `behind them, ${c.stability.steadyCount} had a 30-day swing (the standard deviation ` +
              `of the daily rate) under one point in the 30 days to ${c.asOf}.`
            : undefined
        }
      >
        {c.stability.steadiest && c.stability.mostVolatile ? (
          <StatPair
            title={`30-day swing, strategies holding at least ${tvl(c.fundedFloor)}`}
            items={[
              {
                label: "Steadiest",
                value: `±${c.stability.steadiest.stdev.toFixed(2)} pts`,
                sub: `${c.stability.steadiest.name}, mean ${apy(c.stability.steadiest.mean)}`,
              },
              {
                label: "Least steady",
                value: `±${c.stability.mostVolatile.stdev.toFixed(2)} pts`,
                sub: `${c.stability.mostVolatile.name}, mean ${apy(c.stability.mostVolatile.mean)}`,
              },
            ]}
            note={`Standard deviation of the daily rate over the 30 days to ${c.asOf}.`}
          />
        ) : null}
        {c.stability.steadiest && c.stability.mostVolatile ? (
          <p>
            {`Among strategies holding at least ${tvl(c.fundedFloor)}, the steadiest over the ` +
              `trailing 30 days was ${c.stability.steadiest.name}, with a standard deviation of ` +
              `${c.stability.steadiest.stdev.toFixed(2)} points around a mean of ` +
              `${apy(c.stability.steadiest.mean)}. The least steady was ` +
              `${c.stability.mostVolatile.name}, with a standard deviation of ` +
              `${c.stability.mostVolatile.stdev.toFixed(2)} points around a mean of ` +
              `${apy(c.stability.mostVolatile.mean)}.`}
          </p>
        ) : null}
        <p>
          ETH lending rates swing harder than <Link href="/usdc">stablecoin rates</Link> because ETH
          borrowing demand is
          tied to market direction. When traders want to short ETH or lever up staked ETH, they
          borrow at once, and the rate jumps.
        </p>
        <p>
          A steady rate is the more useful property for a position meant to sit, and the 30-day
          column in the table shows it at a glance.
        </p>
        <Ask items={asks("stability")} />
      </Block>

      <Block
        id="by-venue"
        eyebrow="By venue"
        title={venueVs ? `ETH yield by protocol: ${venueVs}` : "ETH yield by protocol"}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={venueLead(venues)}
      >
        <table className="eh-rows">
          <thead>
            <tr>
              <th scope="col">Median APY</th>
              <th scope="col">Protocol</th>
              <th scope="col" className="num">24h range</th>
            </tr>
          </thead>
          <tbody>
            {venues
              .filter((v) => !v.loop)
              .map((v) => (
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
        {venues
          .filter((v) => v.loop)
          .map((v) => (
            <p key={`${v.venue}-loop`}>{venueLine(v)}</p>
          ))}
        <p>
          Pooled markets such as <Link href="/aave">Aave</Link> and Compound set one rate for
          every lender from one utilisation curve, so their ETH rates sit close together and move
          slowly. Isolated markets on <Link href="/morpho">Morpho</Link> and Euler price each
          collateral separately, which spreads rates wider and keeps a bad collateral asset
          contained to the market that accepted it.
        </p>
      </Block>

      <Block
        id="risk-surfaces"
        eyebrow="Risk"
        title="Risks on every ETH yield strategy"
        lead={ETH_RISKS_LEAD}
      >
        <ul className="uh-risks">
          {ETH_RISKS.map((r) => (
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
        <p>
          Bridge, operator and governance risk, along with the tiers and exclusions, are on the{" "}
          <Link href="/risk-framework">risk framework page</Link>. The vault page for any row names
          the contracts a position touches.
        </p>
        <Ask items={asks("risk")} />
      </Block>

      {/* The questions are answered in the sections they belong to, where a
          reader meets them. This is the index: one list a reader can scan, each
          link opening its answer in place. A <nav>, because it is navigation and
          the answers already sit in the page once. */}
      <section className="uh-block eh-qindex" aria-labelledby="faq">
        <p className="rp-eyebrow">Questions</p>
        <h2 id="faq">Every ETH yield question on this page</h2>
        <nav aria-label="Questions answered on this page">
          <ol className="eh-qlist">
            {faqs.map((f) => (
              <li key={f.q}>
                <a href={`#${qid(f.q)}`}>{f.q}</a>
              </li>
            ))}
          </ol>
        </nav>
        {/* Opens the <details> a question link points at; without it the page
            scrolls to a closed answer. Plain script, no client bundle. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function o(){var h=location.hash.slice(1);if(!h)return;" +
              "var d=document.getElementById(h);if(d&&d.tagName==='DETAILS')d.open=true;}" +
              "addEventListener('hashchange',o);o();})();",
          }}
        />
      </section>

      <Block
        id="full-index"
        eyebrow="Full index"
        title={`Full ETH index: all ${c.count} strategies`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `All ${c.count} ETH strategies tracked here are listed below, sorted by 24-hour APY. ` +
          `The network and protocol filters narrow rows already on the page.`
        }
      >
        <HubTable
          vaults={c.all}
          sparklines={sparklines}
          scopeLabel="ETH strategies"
          metrics
          venueLabel="Protocol"
        />
      </Block>

      <Block
        id="scope"
        eyebrow="Scope"
        title="Which strategies this ranking includes"
        lead="The ranking covers the ETH yield strategies Harvest has vetted and integrated, which is a subset of the places ETH can earn yield."
      >
        <p>
          Strategies are added as they are vetted and integrated, and dropped when the product
          behind them retires or fails the risk framework. Solo staking, liquid staking tokens
          held on their own and centralised exchange products are outside it. The inclusion rules
          are on the <Link href="/methodology">methodology page</Link>.
        </p>
        <p className="eh-whose">
          {`Every rate here is the APY of a Harvest vault built on the named protocol, after ` +
            `Harvest's fee on harvested yield, which as of ${c.asOf} was ${HARVEST_FEE_TEXT}, so ` +
            `it can differ from the rate in that protocol's own app.`}
        </p>
        <p className="eh-whose">
          <strong>Autopilot is Harvest&rsquo;s own allocator</strong>, which moves ETH between
          lending venues as their rates change. Liquid staking tokens such as stETH and rETH are
          not ranked here.
        </p>
      </Block>

      <section className="uni-hub-cta-row">
        <p className="uni-hub-cta-meta">
          Looking for a specific chain? Network ranking pages cut the same data by network.
        </p>
        <div className="uni-hub-cta-links">
          {visibleChains.slice(0, 6).map((chain) => (
            <Link key={chain} href={`/${chain.toLowerCase()}`} className="uni-hub-cta-pill">
              <ChainIcon chain={chain} size={14} />
              {chain}
            </Link>
          ))}
        </div>
      </section>

      <RankingDataNote sortedBy="24-hour APY, highest first" />
    </div>
  );
}
