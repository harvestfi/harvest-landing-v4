// Dedicated body for /btc, on the /eth formula (see long-hub.ts).
//
// /btc used to render through asset-hub-body.tsx: a table, a stat strip and a
// few definitions, with no sentence an answer engine could lift. Search
// Console has the page around position 15 to 18 for "bitcoin yield", "btc
// yield" and "btc apy", and surfaces it for questions it never answered: what
// Bitcoin yield is, how to earn it, which blockchain pays best, what cbBTC
// yields and what suits a large holder. Each gets a section or an answer in
// place, opening with the figure, the scope and the date.
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { assetHubCrumbs } from "@/lib/seo";
import { RankingDataNote } from "@/components/ranking-data-note";
import { UsdcCalculator, type CalcProduct } from "@/components/usdc-calculator";
import { harvestAppUrl } from "@/lib/harvest-app";
import { proseName, plural, apy, apyFloorLabel, tvl } from "@/lib/usdc-hub";
import { cap, countOf, strategyTypeOf } from "@/lib/long-hub";
import { buildEditorial } from "@/lib/editorial-hub";
import { btcSpecial } from "@/lib/editorial-specials";
import {
  EditorialTop,
  EditorialQuestions,
  EditorialCta,
  ExploreHubs,
  DocsRails,
} from "@/components/editorial-hub";
import { exploreHubs } from "@/lib/explore-hubs";
import { RateSparkTable } from "@/components/rate-spark-table";
import { RankTable } from "@/components/rank-table";
import { rateSeries } from "@/lib/rate-series";
import {
  btcPageModel,
  wrapperLine,
  venueLine,
  BTC_HUB_H1,
  BTC_FEE_TEXT,
  BTC_RISKS,
  BTC_RISKS_LEAD,
  BTC_SOURCE_LEAD,
  BTC_APP_URL,
  WRAPPER_ABOUT,
} from "@/lib/btc-hub-copy";
import {
  Em,
  Ask,
  KeyPoints,
  StatPair,
  Block,
  Ext,
  HubSchemas,
  EvidenceTable,
  VenueTable,
  RiskList,
} from "@/components/long-hub-ui";

const HUB_URL = `${SITE_URL}/btc`;

/** Section anchors for the docs-style rail, in page order. */
const LD_TOC: [string, string][] = [
  ["top-10", "Top ranking"],
  ["calculator", "Calculator"],
  ["what-we-noticed", "What we noticed"],
  ["key-takeaways", "Key takeaways"],
  ["how-we-measure", "How we measure"],
  ["wbtc-vs-cbbtc", "WBTC vs cbBTC"],
  ["safest", "Safety evidence"],
  ["how-to-start", "How to start"],
  ["rate-stability", "Rate stability"],
  ["by-venue", "By protocol"],
  ["risk-surfaces", "Risks"],
  ["questions", "Questions"],
  ["full-index", "Full index"],
];


export async function BtcHubBody() {
  const [m, explore] = await Promise.all([btcPageModel(), exploreHubs("BTC")]);

  if (!m) {
    return (
      <div className="uni-hub-test">
        <h1 className="uni-hub-h1">{BTC_HUB_H1}</h1>
        <p className="uni-hub-sub">BTC yield strategies are populating, check back shortly.</p>
      </div>
    );
  }

  const { c, best, ev, venues, wrappers, faqs } = m;
  // Questions are spread through the page: up to three under the section they
  // belong to, as "Readers often ask", and the rest collected at the foot.
  const SPOTS = ["compare", "safety", "calc", "stability", "risk"] as const;
  const inline = Object.fromEntries(
    SPOTS.map((at) => [at, faqs.filter((f) => f.at === at).slice(0, 3)]),
  ) as Record<(typeof SPOTS)[number], typeof faqs>;
  const placed = new Set(Object.values(inline).flat().map((f) => f.q));
  const restFaqs = faqs.filter((f) => !placed.has(f.q));
  const ed = buildEditorial(
    {
      asset: "BTC",
      unit: "BTC",
      tokens: "WBTC and cbBTC",
      h1: BTC_HUB_H1,
      appUrl: BTC_APP_URL,
      feeText: BTC_FEE_TEXT,
      related: { lead: "ETH yields measured the same way are on our", text: "ETH yield ranking", href: "/eth" },
    },
    c,
    btcSpecial(c, wrappers),
  );
  const largest = ev.rows[0] ?? null;
  const st = c.stability;
  const calcProducts: CalcProduct[] = c.all.map((v) => ({
    slug: v.slug,
    name: v.productName,
    apy: v.apy24h,
    chain: v.chain,
    appUrl: harvestAppUrl(v.chain, v.contractAddress),
  }));
  // The calculator sits straight under the ranking (see EditorialTop's
  // afterRanking slot), where a reader who has just compared rates wants it.
  const calcBlock = (
        <Block
          id="calculator"
          eyebrow="Calculator"
          title="How much can 1 BTC earn in a year?"
          asOf={c.asOf}
          asOfIso={c.asOfIso}
          lead={
            `Pick an amount of BTC and any of the ${c.count} tracked BTC strategies, and the ` +
            `calculator works out a year of earnings in BTC from the rate on record.`
          }
        >
          <UsdcCalculator products={calcProducts} asOf={c.asOf} asset="BTC" defaultAmount={1} />
          <p>
            <Em
              text={
                `At the top funded rate of ${apy(best.apy24h)}, 1 BTC works out to ` +
                `about ${((best.apy24h / 100)).toFixed(5)} BTC over a year. The table runs the same ` +
                `sum for every strategy, at the rate it paid on each of the last 90 days.`
              }
            />
          </p>
          <RateSparkTable
            series={rateSeries(c.all, m.history, c.asOfIso)}
            amount={1}
            unit="BTC"
            digits={5}
            caption="A year of earnings on 1 BTC at each strategy's daily rate, before any rate change. Hover or use the arrow keys to move through the last 90 days."
          />
          <p>
            Every figure assumes the rate holds for a full year, which no onchain rate does, and the
            yield is paid in BTC, so its dollar value moves with the Bitcoin price.
          </p>
          <Ask items={inline.calc} />
        </Block>
  );

  return (
    <div className="uni-hub-test uh-page ae ld">
      <DocsRails toc={LD_TOC} token="BTC" assetName="Bitcoin" appUrl={BTC_APP_URL} />
      <HubSchemas
        c={c}
        url={HUB_URL}
        crumbs={assetHubCrumbs("BTC")}
        faqs={faqs}
        listName="BTC yield strategies ranked by 24-hour APY"
        pageName="Best Bitcoin yield: live ranking of BTC lending and vault rates"
        datasetName="BTC yield strategies tracked by Harvest"
        datasetDescription={
          `Live 24-hour APY, 30-day mean APY and tracked value for the ${c.count} WBTC and cbBTC ` +
          `yield strategies Harvest indexes across ${c.chainCount} networks, measured from ` +
          `first-party vault contract readings and refreshed several times a day.`
        }
        keywords={["BTC", "Bitcoin", "WBTC", "cbBTC", "yield", "APY", "Base", "Arbitrum", "DeFi"]}
      />

      {ed ? <EditorialTop m={ed} assetIcon="BTC" afterRanking={calcBlock} /> : null}

      <Block
        id="wbtc-vs-cbbtc"
        eyebrow="Mechanism"
        title="WBTC vs cbBTC: where Bitcoin yield comes from"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={BTC_SOURCE_LEAD}
      >
        <KeyPoints items={wrappers.map((w) => wrapperLine(w, c))} />
        {wrappers.map((w) =>
          WRAPPER_ABOUT[w.token] ? (
            <p key={w.token}>
              <strong>{`${w.token} rests on ${WRAPPER_ABOUT[w.token].issuer}.`}</strong>{" "}
              {WRAPPER_ABOUT[w.token].line}{" "}
              <Ext href={WRAPPER_ABOUT[w.token].href}>{`${w.token} issuer page`}</Ext>.
            </p>
          ) : null,
        )}
        <p>
          A wrapped token is only as good as the Bitcoin behind it, so the choice between WBTC
          and cbBTC is a choice of custodian first and of rate second. Both lend into the same
          kinds of markets, and the rate gap between them comes from how much borrowers want
          each token on each network.
        </p>
        <p>
          Borrowers pay little for Bitcoin. Most BTC on lending markets is posted as collateral to
          borrow stablecoins, so BTC markets run at low utilisation, and the rate climbs only when
          traders borrow BTC to sell it short. The{" "}
          <Link href="/usdt">USDT</Link> and <Link href="/usdc">USDC</Link> rankings show the other
          side of that trade.
        </p>
        <Ask items={inline.compare} />
      </Block>

      <Block
        id="safest"
        eyebrow="Safety evidence"
        title="Which Bitcoin yield options are the safest?"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `This page does not score or rank BTC strategies for safety, and no strategy is free of ` +
          `risk. What can be measured is size, track record, rate steadiness and strategy type, ` +
          `and the table lists all four for ` +
          (ev.fundedOnly
            ? `the ${c.fundedCount} BTC strategies holding at least ${tvl(c.fundedFloor)}.`
            : `all ${c.count} BTC strategies.`)
        }
      >
        <EvidenceTable rows={ev.rows} />
        {largest ? (
          <p>
            {`The largest BTC strategy was `}
            <Link href={`/${largest.vault.slug}`}>{proseName(largest.vault)}</Link>
            {`, holding ${tvl(largest.vault.tvl)} and tracked for ${largest.ageLabel}. A large ` +
              `position matters most to a large holder, because entering a small vault dilutes ` +
              `its rate.`}
          </p>
        ) : null}
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
          <dt>Type</dt>
          <dd>
            Shows how many contracts sit between the BTC and the borrower, and the{" "}
            <Link href="/risk-framework">risk framework page</Link> covers every exposure.
          </dd>
        </dl>
        <p>
          None of these columns is a safety score, and none of them measures the custodian behind
          the wrapped token. The contracts behind every vault are listed with their audits on the{" "}
          <Link href="/security">security and audits page</Link>.
        </p>
        <Ask items={inline.safety} />
      </Block>


      <Block
        id="how-to-start"
        eyebrow="Getting started"
        title="How to earn yield on Bitcoin"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `Starting takes a handful of transactions, and the first decision is which wrapped ` +
          `Bitcoin to hold, since ${countOf(c.all.filter((v) => v.chain === "Base").length, c.count)} ` +
          `BTC strategies here run on Base with cbBTC.`
        }
      >
        <ol className="eh-steps">
          <li>
            <strong>Choosing a wrapper comes first.</strong> cbBTC can be bought on Coinbase and
            sent to <Link href="/base">Base</Link>; WBTC is swapped for on Arbitrum or Ethereum.
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
            BTC to pay out, with no lockup or exit queue.
          </li>
        </ol>
        <p>
          <strong>What it costs.</strong>{" "}
          {`Harvest keeps a share of the yield each strategy harvests, ${BTC_FEE_TEXT}, split ` +
            `between a performance fee and a platform fee set in each strategy contract. Every rate ` +
            `on this page is after that fee, and there is no fee to enter or leave a vault.`}
        </p>
      </Block>

      <Block
        id="rate-stability"
        eyebrow="Stability"
        title="How steady BTC rates have been"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          st.measuredCount
            ? `Across the ${st.measuredCount} BTC strategies with a month of readings behind them, ` +
              `${st.steadyCount} had a 30-day swing (the standard deviation of the daily rate) ` +
              `under one point over the last 30 days.`
            : undefined
        }
      >
        {st.steadiest && st.mostVolatile && st.steadiest.slug !== st.mostVolatile.slug ? (
          <>
            <StatPair
              title={`30-day swing, strategies holding at least ${tvl(c.fundedFloor)}`}
              items={[
                {
                  label: "Steadiest",
                  value: `±${st.steadiest.stdev.toFixed(2)} pts`,
                  sub: `${st.steadiest.name}, mean ${apy(st.steadiest.mean)}`,
                },
                {
                  label: "Least steady",
                  value: `±${st.mostVolatile.stdev.toFixed(2)} pts`,
                  sub: `${st.mostVolatile.name}, mean ${apy(st.mostVolatile.mean)}`,
                },
              ]}
              note={`Standard deviation of the daily rate over the last 30 days.`}
            />
            <p>
              {`Among strategies holding at least ${tvl(c.fundedFloor)}, the steadiest over the ` +
                `trailing 30 days was ${st.steadiest.name}, with a standard deviation of ` +
                `${st.steadiest.stdev.toFixed(2)} points around a mean of ${apy(st.steadiest.mean)}. ` +
                `The least steady was ${st.mostVolatile.name}, at ` +
                `${st.mostVolatile.stdev.toFixed(2)} points around ${apy(st.mostVolatile.mean)}.`}
            </p>
          </>
        ) : null}
        <p>
          Bitcoin lending rates sit low and move little, because borrowing demand for BTC is thin.
          A rate that jumps for a day usually means a short seller borrowed a large amount at once,
          and the 30-day column shows whether that happened.
        </p>
        <Ask items={inline.stability} />
      </Block>

      <Block
        id="by-venue"
        eyebrow="By venue"
        title="BTC lending rates by protocol"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `Grouped by the protocol they lend into, the BTC vaults in this index paid medians from ` +
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

      <Block id="risk-surfaces" eyebrow="Risk" asOf={c.asOf} asOfIso={c.asOfIso} title="Risks on every Bitcoin yield strategy" lead={BTC_RISKS_LEAD}>
        <RiskList risks={BTC_RISKS} />
        <p>
          Bridge, operator and governance risk, along with the tiers and exclusions, are on the{" "}
          <Link href="/risk-framework">risk framework page</Link>. The vault page for any row names
          the contracts a position touches.
        </p>
        <Ask items={inline.risk} />
      </Block>

      <EditorialQuestions faqs={restFaqs} title="More Bitcoin yield questions" asOf={c.asOf} asOfIso={c.asOfIso} />

      <Block
        id="full-index"
        eyebrow="Full index"
        title={`Full BTC index: all ${c.count} strategies`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={`All ${c.count} BTC strategies tracked here, sorted by 24-hour APY. Click a column to re-sort.`}
      >
        {ed ? (
          <RankTable rows={ed.all} title={`All ${c.count} BTC strategies`} icon={{ asset: "BTC" }} floorLabel={ed.floorLabel} appUrl={BTC_APP_URL} />
        ) : null}
      </Block>

      <Block
        id="scope"
        eyebrow="Scope"
        title="Which strategies this ranking includes"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead="The ranking covers the BTC yield strategies Harvest has vetted and integrated, which is a subset of the places Bitcoin can earn yield."
      >
        <p>
          Strategies are added as they are vetted and integrated, and dropped when the product
          behind them retires or fails the risk framework. Native Bitcoin staking protocols, tBTC
          and other wrappers not integrated here, and centralised exchange products are outside
          it. The inclusion rules are on the <Link href="/methodology">methodology page</Link>.
        </p>
        <p className="eh-whose">
          {`Every rate here is the APY of a Harvest vault built on the named protocol, after the ` +
            `fee on harvested yield, which was ${BTC_FEE_TEXT}, so it can differ ` +
            `from the rate in that protocol's own app.`}
        </p>
        <p className="eh-whose">
          {`${cap(countOf(c.all.filter((v) => strategyTypeOf(v) === "allocator").length, c.count))} ` +
            `strategies are allocators. Autopilot is Harvest's own, and the IPOR row lends through ` +
            `an IPOR Fusion vault.`}
        </p>
      </Block>

      {ed ? <EditorialCta text={ed.cta} appUrl={BTC_APP_URL} /> : null}

      <ExploreHubs assets={explore.assets} networks={explore.networks} />

      <RankingDataNote sortedBy="24-hour APY, highest first" />
    </div>
  );
}
