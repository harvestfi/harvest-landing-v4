// Dedicated body for /usdt, on the /eth formula (see long-hub.ts).
//
// /usdt used to render through asset-hub-body.tsx and served as part of the
// control group for the /usdc rebuild. Search Console has it around position
// 10 to 12 for "usdt yield" and "usdt apy" with almost no clicks, near
// position 4 for "usdt farm", and surfacing for questions it never answered:
// whether USDT farming is real, how USDT compares with USDC, what Aave pays.
// Most USDT vaults in the index hold a few dollars, and the page says so up
// front instead of leading with a rate no reader could use.
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { assetHubCrumbs } from "@/lib/seo";
import { RankingDataNote } from "@/components/ranking-data-note";
import { UsdcCalculator, type CalcProduct } from "@/components/usdc-calculator";
import { harvestAppUrl } from "@/lib/harvest-app";
import { proseName, listOf, plural, apy, apyFloorLabel, tvl } from "@/lib/usdc-hub";
import { buildEditorial } from "@/lib/editorial-hub";
import { usdtSpecial } from "@/lib/editorial-specials";
import {
  EditorialTop,
  EditorialQuestions,
  EditorialCta,
  ExploreHubs,
  DocsRails,
} from "@/components/editorial-hub";
import { RankTable } from "@/components/rank-table";
import { exploreHubs } from "@/lib/explore-hubs";
import {
  usdtPageModel,
  venueLine,
  USDT_HUB_H1,
  USDT_FEE_TEXT,
  USDT_RISKS,
  USDT_RISKS_LEAD,
  USDT_APP_URL,
} from "@/lib/usdt-hub-copy";
import {
  Em,
  Ask,
  StatPair,
  Block,
  HubSchemas,
  EvidenceTable,
  EarnTable,
  VenueTable,
  RiskList,
} from "@/components/long-hub-ui";

const HUB_URL = `${SITE_URL}/usdt`;

/** "On this page" entries, in page order. */
const USDT_TOC: [string, string][] = [
  ["top-10", "Top ranking"],
  ["calculator", "Calculator"],
  ["what-we-noticed", "What we noticed"],
  ["key-takeaways", "Key takeaways"],
  ["how-we-measure", "How we measure"],
  ["usdt-vs-usdc", "USDT vs USDC"],
  ["safest", "Safety evidence"],
  ["how-to-start", "How to start"],
  ["rate-stability", "Rate stability"],
  ["by-venue", "By protocol"],
  ["risk-surfaces", "Risks"],
  ["questions", "Questions"],
  ["full-index", "Full index"],
];

export async function UsdtHubBody() {
  const [m, explore] = await Promise.all([usdtPageModel(), exploreHubs("USDT")]);

  if (!m) {
    return (
      <div className="uni-hub-test">
        <h1 className="uni-hub-h1">{USDT_HUB_H1}</h1>
        <p className="uni-hub-sub">USDT yield strategies are populating, check back shortly.</p>
      </div>
    );
  }

  const { c, best, ev, venues, cmp, faqs } = m;
  // Questions are spread through the page: up to three under the section they
  // belong to, as "Readers often ask", and the rest collected at the foot.
  const SPOTS = ["compare", "safety", "calc", "stability", "risk"] as const;
  const inline = Object.fromEntries(
    SPOTS.map((at) => [at, faqs.filter((f) => f.at === at).slice(0, 3)]),
  ) as Record<(typeof SPOTS)[number], typeof faqs>;
  const placed = new Set(Object.values(inline).flat().map((f) => f.q));
  const restFaqs = faqs.filter((f) => !placed.has(f.q));
  const visibleChains = [...c.chains].sort();
  const ed = buildEditorial(
    {
      asset: "USDT",
      unit: "USDT",
      tokens: "USDT",
      h1: USDT_HUB_H1,
      appUrl: USDT_APP_URL,
      feeText: USDT_FEE_TEXT,
      related: { lead: "Stablecoin yields measured the same way are on our", text: "USDC yield ranking", href: "/usdc" },
    },
    c,
    usdtSpecial(c, cmp),
  );
  const st = c.stability;
  const calcProducts: CalcProduct[] = c.all.map((v) => ({
    slug: v.slug,
    name: v.productName,
    apy: v.apy24h,
    chain: v.chain,
    appUrl: harvestAppUrl(v.chain, v.contractAddress),
  }));
  // The calculator sits straight under the ranking (EditorialTop's slot).
  const calcBlock = (
        <Block
          id="calculator"
          eyebrow="Calculator"
          title="How much can 1,000 USDT earn in a year?"
          asOf={c.asOf}
          asOfIso={c.asOfIso}
          lead={
            `Pick an amount of USDT and any of the ${c.count} tracked USDT strategies, and the ` +
            `calculator works out a year of earnings in USDT from the rate on record.`
          }
        >
          <UsdcCalculator products={calcProducts} asOf={c.asOf} asset="USDT" defaultAmount={1000} />
          <p>
            <Em
              text={
                `At ${apy(best.apy24h)}, the rate on ${proseName(best)}, 1,000 USDT ` +
                `works out to about ${((1000 * best.apy24h) / 100).toFixed(2)} USDT over a year. The ` +
                `table runs the same sum for 10,000 and 100,000 USDT, beside the median rate.`
              }
            />
          </p>
          <EarnTable c={c} best={best} unit="USDT" amounts={[1000, 10000, 100000]} digits={2} />
          <p>
            The two columns assume the rate holds for a full year, which no onchain rate does. The
            median column draws on vaults that mostly hold a few dollars, and a larger entry into one
            of them would move its rate.
          </p>
          <Ask items={inline.calc} />
        </Block>
  );

  return (
    <div className="uni-hub-test uh-page ae ld">
      <DocsRails toc={USDT_TOC} token="USDT" assetName="USDT" appUrl={USDT_APP_URL} />
      <HubSchemas
        c={c}
        url={HUB_URL}
        crumbs={assetHubCrumbs("USDT")}
        faqs={faqs}
        listName="USDT yield strategies ranked by 24-hour APY"
        pageName="Best USDT yield: live ranking of USDT lending and vault rates"
        datasetName="USDT yield strategies tracked by Harvest"
        datasetDescription={
          `Live 24-hour APY, 30-day mean APY and tracked value for the ${c.count} USDT yield ` +
          `strategies Harvest indexes across ${c.chainCount} networks, measured from first-party ` +
          `vault contract readings and refreshed several times a day.`
        }
        keywords={["USDT", "Tether", "USDT0", "stablecoin", "yield", "APY", "Arbitrum", "HyperEVM", "DeFi"]}
      />

      {ed ? <EditorialTop m={ed} assetIcon="USDT" afterRanking={calcBlock} /> : null}

      <Block
        id="usdt-vs-usdc"
        eyebrow="Comparison"
        title="USDT vs USDC yield: which stablecoin pays more?"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          cmp.pairs.length
            ? `On the same pooled market and network, USDT paid more than USDC in ` +
              `${cmp.usdtAhead} of ${cmp.pairs.length} cases, with a median of ` +
              `${apy(cmp.pairUsdtMedian)} against ${apy(cmp.pairUsdcMedian)}.`
            : `The ${cmp.usdcCount} USDC strategies tracked here paid a median ` +
              `of ${apy(cmp.usdcMedian)} and the ${c.count} USDT strategies ${apy(c.medianApy)}.`
        }
      >
        <StatPair
          title="Median 24-hour APY across the index"
          items={[
            { label: "USDT", value: apy(c.medianApy), sub: `${c.count} strategies` },
            { label: "USDC", value: apy(cmp.usdcMedian), sub: `${cmp.usdcCount} strategies` },
          ]}
          note={`Every strategy holding the token, no floor applied.`}
        />
        {cmp.pairs.length ? (
          <div className="eh-evidence-wrap" data-nosnippet="">
            <table className="eh-evidence">
              <caption>Pooled markets that list both stablecoins, same network</caption>
              <thead>
                <tr>
                  <th scope="col">Market</th>
                  <th scope="col">USDT APY</th>
                  <th scope="col">USDC APY</th>
                  <th scope="col">USDT vault size</th>
                </tr>
              </thead>
              <tbody>
                {cmp.pairs.map((p) => (
                  <tr key={p.usdtSlug}>
                    <th scope="row">
                      <Link href={`/${p.usdtSlug}`}>{p.venue}</Link>
                      <span className="eh-netname">{p.chain}</span>
                    </th>
                    <td data-label="USDT APY">{apy(p.usdt)}</td>
                    <td data-label="USDC APY">{apyFloorLabel(p.usdc)}</td>
                    <td data-label="USDT vault size">{tvl(p.usdtTvl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p>
          A pooled market such as <Link href="/aave">Aave</Link>, Fluid or Dolomite pays every
          supplier the same rate, set by how much of that asset&rsquo;s pool is borrowed, so a
          small USDT vault there earns what the market pays. That makes these pairs a fair test of
          USDT against USDC even where the USDT vault is tiny. Curated Morpho vaults are left out,
          because two of them on one network lend into different markets.
        </p>
        <p>
          The two stablecoins trade the same dollar but carry different issuers: USDT is issued by
          Tether and USDC by Circle. The gap between their rates on a market comes from borrowing
          demand for each, and it can flip from one week to the next. Every USDC rate, with far
          more funded strategies behind it, is on the <Link href="/usdc">USDC ranking</Link>.
        </p>
        <Ask items={inline.compare} />
      </Block>

      <Block
        id="safest"
        eyebrow="Safety evidence"
        title="How big, how old and how steady each USDT strategy is"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `This page does not score or rank USDT strategies for safety, and no strategy is free of ` +
          `risk. What can be measured is size, track record, rate steadiness and strategy type, ` +
          `and the table lists all four for ` +
          (ev.fundedOnly
            ? `the ${c.fundedCount} USDT strategies holding at least ${tvl(c.fundedFloor)}.`
            : `all ${c.count} USDT strategies, since ${c.fundedCount} held at least ${tvl(c.fundedFloor)}.`)
        }
      >
        <EvidenceTable rows={ev.rows} />
        <dl className="eh-defs">
          <dt>Vault history</dt>
          <dd>
            Counts the time since the vault contract&rsquo;s first reading. Harvest vaults are
            upgradeable, so an older vault can run a newer strategy.
          </dd>
          <dt>30-day swing</dt>
          <dd>
            Measures the standard deviation of the daily rate. Under one point means the rate held
            steady all month; several points means the headline figure is a spike.
          </dd>
          <dt>Tracked value</dt>
          <dd>
            Shows how much USDT the vault holds. A vault holding a few dollars has had its rate
            tested by no withdrawals at all.
          </dd>
        </dl>
        <p>
          None of these columns is a safety score, and none of them measures Tether&rsquo;s reserves.
          The contracts behind every vault are listed with their audits on the{" "}
          <Link href="/security">security and audits page</Link>.
        </p>
        <Ask items={inline.safety} />
      </Block>


      <Block
        id="how-to-start"
        eyebrow="Getting started"
        title="How to start earning yield on USDT"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `Starting takes a handful of transactions, and the first decision is the network, since ` +
          `the USDT strategies here run on ${listOf(visibleChains)}.`
        }
      >
        <ol className="eh-steps">
          <li>
            <strong>Choosing a network comes first.</strong> Ethereum mainnet holds the largest
            USDT strategy here and costs the most per transaction; Arbitrum and Polygon cost cents.
          </li>
          <li>
            <strong>Picking a strategy sets the rate and the risk.</strong> The{" "}
            <a href="#safest">safety table</a> shows each strategy&rsquo;s size, history and
            30-day swing.
          </li>
          <li>
            <strong>Entering the position is one transaction in the Harvest app</strong>, which
            issues vault shares that grow as the strategy compounds.
          </li>
          <li>
            <strong>Withdrawing is open at any time</strong> the market underneath has unborrowed
            USDT to pay out, with no lockup or exit queue.
          </li>
        </ol>
        <p>
          <strong>What it costs.</strong>{" "}
          {`Harvest keeps a share of the yield each strategy harvests, ${USDT_FEE_TEXT}, split ` +
            `between a profit share and a platform fee set in each strategy contract. Every rate ` +
            `on this page is after that fee, and there is no fee to enter or leave a vault.`}
        </p>
      </Block>

      <Block
        id="rate-stability"
        eyebrow="Stability"
        title="How steady USDT rates have been"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          st.measuredCount
            ? `Across the ${st.measuredCount} USDT strategies with a month of readings behind ` +
              `them, ${st.steadyCount} had a 30-day swing (the standard deviation of the daily ` +
              `rate) under one point over the last 30 days.`
            : undefined
        }
      >
        {st.steadiest ? (
          <p>
            {`Among strategies holding at least ${tvl(c.fundedFloor)}, the steadiest was ` +
              `${st.steadiest.name}, which moved with a standard deviation ` +
              `of ${st.steadiest.stdev.toFixed(2)} points around a 30-day mean of ` +
              `${apy(st.steadiest.mean)}.`}
          </p>
        ) : null}
        <p>
          Stablecoin rates swing with borrowing demand for dollars, which rises when traders lever
          up and falls when they repay. A small vault adds noise of its own, because one harvest
          moves its figure more than it would move a large one.
        </p>
        <Ask items={inline.stability} />
      </Block>

      <Block
        id="by-venue"
        eyebrow="By venue"
        title="USDT lending rates by protocol: Aave, Fluid, Morpho and more"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `Grouped by the protocol they lend into, the USDT vaults in this index paid medians from ` +
          `${apyFloorLabel(Math.min(...venues.map((v) => v.medianApy)))} to ` +
          `${apy(Math.max(...venues.map((v) => v.medianApy)))}, across ` +
          `${venues.length} ${plural(venues.length, "protocol", "protocols")}.`
        }
      >
        <VenueTable venues={venues} />
        {venues.slice(0, 3).map((v) => (
          <p key={v.venue}>
            <Em text={venueLine(v)} />
          </p>
        ))}
      </Block>

      <Block id="risk-surfaces" eyebrow="Risk" asOf={c.asOf} asOfIso={c.asOfIso} title="Risks on every USDT yield strategy" lead={USDT_RISKS_LEAD}>
        <RiskList risks={USDT_RISKS} />
        <p>
          Bridge, operator and governance risk, along with the tiers and exclusions, are on the{" "}
          <Link href="/risk-framework">risk framework page</Link>. The vault page for any row names
          the contracts a position touches.
        </p>
        <Ask items={inline.risk} />
      </Block>

      <EditorialQuestions faqs={restFaqs} title="More USDT yield questions" asOf={c.asOf} asOfIso={c.asOfIso} />

      <Block
        id="full-index"
        eyebrow="Full index"
        title={`Full USDT index: all ${c.count} strategies`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={`All ${c.count} USDT strategies tracked here, sorted by 24-hour APY. Click a column to re-sort.`}
      >
        {ed ? (
          <RankTable rows={ed.all} title={`All ${c.count} USDT strategies`} icon={{ asset: "USDT" }} floorLabel={ed.floorLabel} appUrl={USDT_APP_URL} />
        ) : null}
      </Block>

      <Block
        id="scope"
        eyebrow="Scope"
        title="Which strategies this ranking includes"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead="The ranking covers the USDT yield strategies Harvest has vetted and integrated, which is a subset of the places USDT can earn yield."
      >
        <p>
          Strategies are added as they are vetted and integrated, and dropped when the product
          behind them retires or fails the risk framework. Centralised exchange savings products
          and platforms that do not name the market behind their rate are outside it. The
          inclusion rules are on the <Link href="/methodology">methodology page</Link>.
        </p>
        <p className="eh-whose">
          {`Every rate here is the APY of a Harvest vault built on the named protocol, after the ` +
            `fee on harvested yield, which was ${USDT_FEE_TEXT}, so it can differ ` +
            `from the rate in that protocol's own app.`}
        </p>
      </Block>

      {ed ? <EditorialCta text={ed.cta} appUrl={USDT_APP_URL} /> : null}

      <ExploreHubs assets={explore.assets} networks={explore.networks} />

      <RankingDataNote sortedBy="24-hour APY, highest first" />
    </div>
  );
}
