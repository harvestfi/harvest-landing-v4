// Network hubs (/base, /arbitrum, /ethereum, /hyperevm) on the /eth formula
// and the docs layout the asset hubs use: answer first, the ranking, patterns
// from the data, then the network's own sections (assets, protocols, safety
// evidence, how to start, steadiness, risks), questions in place, the full
// index and links to the other rankings. Title, H1 and URL are unchanged.
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { networkHubCrumbs, networkHubH1 } from "@/lib/seo";
import { RankingDataNote } from "@/components/ranking-data-note";
import { NETWORK_BLURBS } from "@/lib/networks";
import { proseName, apy, apyFloorLabel, tvl, plural } from "@/lib/usdc-hub";
import { buildEditorial, edRows } from "@/lib/editorial-hub";
import {
  networkPageModel,
  assetLine,
  venueLine,
  assetHubHref,
  type NetSpot,
} from "@/lib/network-hub-copy";
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
  Em,
  Ask,
  KeyPoints,
  Block,
  HubSchemas,
  EvidenceTable,
  VenueTable,
  RiskList,
} from "@/components/long-hub-ui";

const TOC: [string, string][] = [
  ["top-10", "Top ranking"],
  ["what-we-noticed", "What we noticed"],
  ["key-takeaways", "Key takeaways"],
  ["how-we-measure", "How we measure"],
  ["about-network", "About the network"],
  ["by-asset", "By asset"],
  ["by-venue", "By protocol"],
  ["safest", "Safety evidence"],
  ["how-to-start", "How to start"],
  ["rate-stability", "Rate stability"],
  ["risk-surfaces", "Risks"],
  ["questions", "Questions"],
  ["full-index", "Full index"],
];

export async function NetworkLongBody({ chain }: { chain: string }) {
  const [m, explore] = await Promise.all([networkPageModel(chain), exploreHubs("")]);
  if (!m) {
    return (
      <div className="uni-hub-test">
        <h1 className="uni-hub-h1">{networkHubH1(chain)}</h1>
        <p className="uni-hub-sub">Strategies on this network are populating, check back shortly.</p>
      </div>
    );
  }
  const { f, c, assets, venues, ev, faqs, autopilotCount } = m;
  const d = f.display;
  const url = `${SITE_URL}/${f.slug}`;
  const appUrl = "https://app.harvest.finance/";
  const st = c.stability;

  const ed = buildEditorial(
    {
      asset: d,
      unit: d,
      kind: "network",
      tokens: `${assets.map((a) => a.asset).join(", ").replace(/, ([^,]*)$/, " and $1")}`,
      h1: networkHubH1(d),
      appUrl,
      feeText: f.feeText,
      related: { lead: "The same rates by asset are on our", text: "USDC yield ranking", href: "/usdc" },
    },
    c,
    { quick: null, pattern: null, takeaway: null },
  );

  // Questions in place: up to three under their section, the rest at the foot.
  const SPOTS: NetSpot[] = ["assets", "venue", "safety", "start", "stability", "risk"];
  const inline = Object.fromEntries(
    SPOTS.map((at) => [at, faqs.filter((q) => q.at === at).slice(0, 3)]),
  ) as Record<NetSpot, typeof faqs>;
  const placed = new Set(Object.values(inline).flat().map((q) => q.q));
  const restFaqs = faqs.filter((q) => !placed.has(q.q));
  const largest = ev.rows[0] ?? null;

  return (
    <div className="uni-hub-test uh-page ae ld">
      <DocsRails toc={TOC} token="USDC" assetName={`assets on ${d}`} appUrl={appUrl} chain={chain} />
      <HubSchemas
        c={c}
        url={url}
        crumbs={networkHubCrumbs(d)}
        faqs={faqs}
        listName={`Yield strategies on ${d} ranked by 24-hour APY`}
        pageName={`Best ${d} yields: live ranking of lending and vault rates on ${d}`}
        datasetName={`Yield strategies on ${d} tracked by Harvest`}
        datasetDescription={
          `Live 24-hour APY, 30-day mean APY and tracked value for the ${c.count} yield strategies ` +
          `Harvest indexes on ${d}, measured from first-party vault contract readings and refreshed ` +
          `several times a day.`
        }
        keywords={[d, "yield", "APY", "TVL", "DeFi", ...assets.map((a) => a.asset)]}
      />

      {ed ? (
        <EditorialTop
          m={ed}
          assetIcon="USDC"
        />
      ) : null}

      <Block
        id="about-network"
        eyebrow="The network"
        title={`What ${d} is and what it costs to use`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={NETWORK_BLURBS[chain] ? f.gasLine : `${d} is ${f.kindLine}. ${f.gasLine}`}
      >
        {NETWORK_BLURBS[chain] ? <p>{NETWORK_BLURBS[chain]}</p> : null}
        <p>{f.arriveLine}</p>
        <p>
          The same strategies on other networks are on the{" "}
          {["base", "arbitrum", "ethereum", "hyperevm"]
            .filter((s) => s !== f.slug)
            .map((s, i, arr) => (
              <span key={s}>
                <Link href={`/${s}`}>{s === "hyperevm" ? "HyperEVM" : s.charAt(0).toUpperCase() + s.slice(1)}</Link>
                {i < arr.length - 2 ? ", " : i === arr.length - 2 ? " and " : ""}
              </span>
            ))}{" "}
          rankings.
        </p>
        {f.slug === "base" ? (
          <p>
            Base also hosts the vaults on Coinbase Tokenized Stocks (NVDAc, AAPLc, METAc and GOOGLc). They
            pay yield in the stock rather than in dollars, so they are ranked separately, on the page about{" "}
            <Link href="/yield-on-tokenized-stocks">yield on Coinbase Tokenized Stocks</Link>.
          </p>
        ) : null}
      </Block>

      <Block
        id="by-asset"
        eyebrow="By asset"
        title={`Yield on ${d} by asset: ${assets.map((a) => a.asset).join(" vs ")}`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `The ${c.count} strategies on ${d} lend ${assets.length} ` +
          `${plural(assets.length, "asset", "assets")}, and ${assets[0].asset} carries the most, ` +
          `${tvl(assets[0].tvl)} of ${tvl(c.totalTvl)}.`
        }
      >
        <KeyPoints items={assets.map((a) => assetLine(a, c, d))} />
        <p>
          Stablecoin rates usually sit above ETH and BTC rates on the same network, because most
          borrowing on lending markets is for dollars while ETH and BTC are mostly posted as
          collateral. Each asset has its own ranking across every network:{" "}
          {assets
            .filter((a) => assetHubHref(a.asset))
            .map((a, i, arr) => (
              <span key={a.asset}>
                <Link href={assetHubHref(a.asset)!}>{`${a.asset} yield`}</Link>
                {i < arr.length - 2 ? ", " : i === arr.length - 2 ? " and " : ""}
              </span>
            ))}
          .
        </p>
        <Ask items={inline.assets} />
      </Block>

      <Block
        id="by-venue"
        eyebrow="By protocol"
        title={`Lending rates on ${d} by protocol`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          venues.length
            ? `Grouped by the protocol they lend into, vaults on ${d} paid medians from ` +
              `${apyFloorLabel(Math.min(...venues.map((v) => v.medianApy)))} to ` +
              `${apy(Math.max(...venues.map((v) => v.medianApy)))}, across ${venues.length} ` +
              `${plural(venues.length, "protocol", "protocols")}.`
            : undefined
        }
      >
        {venues.length ? <VenueTable venues={venues} /> : null}
        {venues.slice(0, 3).map((v) => (
          <p key={v.venue}>
            <Em text={venueLine(v, d)} />
          </p>
        ))}
        {autopilotCount ? (
          <p>
            {`${autopilotCount} ${plural(autopilotCount, "strategy is", "strategies are")} Harvest ` +
              `Autopilot, Harvest's own allocator, which moves funds between these protocols and ` +
              `is not counted as one of them.`}
          </p>
        ) : null}
        <Ask items={inline.venue} />
      </Block>

      <Block
        id="safest"
        eyebrow="Safety evidence"
        title={`Which strategies on ${d} are the safest?`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          `This page does not score or rank strategies for safety, and no strategy is free of ` +
          `risk. What can be measured is size, track record, rate steadiness and strategy type, ` +
          `and the table lists all four for ` +
          (ev.fundedOnly
            ? `the ${c.fundedCount} strategies on ${d} holding at least ${tvl(c.fundedFloor)}.`
            : `all ${c.count} strategies on ${d}.`)
        }
      >
        <EvidenceTable rows={ev.rows} />
        {largest ? (
          <p>
            {`The largest strategy on ${d} was `}
            <Link href={`/${largest.vault.slug}`}>{proseName(largest.vault)}</Link>
            {`, holding ${tvl(largest.vault.tvl)} and tracked for ${largest.ageLabel}.`}
          </p>
        ) : null}
        <p>
          None of these columns is a safety score. The contracts behind every vault are listed with
          their audits on the <Link href="/security">security and audits page</Link>, and the{" "}
          <Link href="/risk-framework">risk framework</Link> sets out every exposure.
        </p>
        <Ask items={inline.safety} />
      </Block>

      <Block
        id="how-to-start"
        eyebrow="Getting started"
        title={`How to start earning yield on ${d}`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={`Starting takes a handful of transactions. ${f.gasLine}`}
      >
        <ol className="eh-steps">
          <li>
            <strong>Getting funds onto {d} comes first.</strong> {f.arriveLine}
          </li>
          <li>
            <strong>Picking a strategy sets the rate and the risk.</strong> The{" "}
            <a href="#safest">safety table</a> shows each strategy&rsquo;s size, history and 30-day
            swing.
          </li>
          <li>
            <strong>Entering the position is one transaction in the Harvest app</strong>, which
            issues vault shares that grow as the strategy compounds.
          </li>
          <li>
            <strong>Withdrawing is open at any time</strong> the market underneath has funds to pay
            out, with no lockup.
          </li>
        </ol>
        <p>
          <strong>What it costs.</strong>{" "}
          {`The strategy vaults on ${d} keep ${f.feeText} of the yield they harvest, and every rate ` +
            `on this page is after that fee. There is no fee to enter or leave a vault.`}
        </p>
        <Ask items={inline.start} />
      </Block>

      <Block
        id="rate-stability"
        eyebrow="Stability"
        title={`How steady rates on ${d} have been`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={
          st.measuredCount
            ? `Across the ${st.measuredCount} strategies on ${d} with a month of readings, ` +
              `${st.steadyCount} had a 30-day swing (the standard deviation of the daily rate) under ` +
              `one point.`
            : undefined
        }
      >
        {st.steadiest && st.mostVolatile && st.steadiest.slug !== st.mostVolatile.slug ? (
          <p>
            {`Among strategies holding at least ${tvl(c.fundedFloor)}, the steadiest was ` +
              `${st.steadiest.name}, at ${st.steadiest.stdev.toFixed(2)} points around a mean of ` +
              `${apy(st.steadiest.mean)}, and the least steady was ${st.mostVolatile.name}, at ` +
              `${st.mostVolatile.stdev.toFixed(2)} points around ${apy(st.mostVolatile.mean)}.`}
          </p>
        ) : null}
        <p>
          A steady rate is the more useful property for a position meant to sit, and the 30-day
          average beside each rate in the ranking shows whether the 24-hour figure is a level or a
          spike.
        </p>
        <Ask items={inline.stability} />
      </Block>

      <Block
        id="risk-surfaces"
        eyebrow="Risk"
        title={`Risks on every strategy on ${d}`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={`Every rate on ${d} pays for a set of exposures: the network's own, and the ones every lending strategy carries.`}
      >
        <RiskList risks={f.risks} />
        <p>
          Bridge, operator and governance risk, along with the tiers and exclusions, are on the{" "}
          <Link href="/risk-framework">risk framework page</Link>.
        </p>
        <Ask items={inline.risk} />
      </Block>

      <EditorialQuestions
        faqs={restFaqs}
        title={`More questions about yield on ${d}`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
      />

      <Block
        id="full-index"
        eyebrow="Full index"
        title={`Full ${d} index: all ${c.count} strategies`}
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={`All ${c.count} strategies tracked on ${d}, sorted by 24-hour APY. Click a column to re-sort.`}
      >
        <RankTable
          rows={edRows(c.all, "USDC", c.fundedFloor)}
          title={`All ${c.count} strategies on ${d}`}
          icon={{ chain }}
          floorLabel={tvl(c.fundedFloor)}
          appUrl={appUrl}
        />
      </Block>

      <Block
        id="scope"
        eyebrow="Scope"
        title="Which strategies this ranking includes"
        asOf={c.asOf}
        asOfIso={c.asOfIso}
        lead={`The ranking covers the strategies on ${d} that Harvest has vetted and integrated, which is a subset of the places to earn yield on ${d}.`}
      >
        <p>
          Strategies are added as they are vetted and integrated, and dropped when the product
          behind them retires or fails the risk framework. The inclusion rules are on the{" "}
          <Link href="/methodology">methodology page</Link>.
        </p>
      </Block>

      {ed ? <EditorialCta text={ed.cta} appUrl={appUrl} /> : null}

      <ExploreHubs assets={explore.assets} networks={explore.networks.filter((n) => n.href !== `/${f.slug}`)} />

      <RankingDataNote sortedBy="24-hour APY, highest first" />
    </div>
  );
}
