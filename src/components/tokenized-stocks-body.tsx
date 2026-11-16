// /yield-on-tokenized-stocks: Harvest's four autocompounding vaults on
// Coinbase's tokenized stocks (Nvidia, Apple, Meta, Alphabet) on Base, in the
// docs layout of the other hubs. Its own unit of account (the stock, not
// dollars), so it reads its own data file and never joins the USDC/ETH/BTC
// cohorts. Sections: answer first, ranking, how the carry works, the dated
// leverage of each position, fixed-term markets built on the vault shares,
// what the tokens are, fees, how to start, risks, questions.
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { breadcrumbSchema, reportWebPageSchema, reportItemListSchema, reportDatasetSchema, faqPageSchema } from "@/lib/jsonld";
import { qid, type Faq } from "@/lib/long-hub";
import type { EdRow } from "@/lib/editorial-hub";
import {
  loadStockData,
  stockAppUrl,
  basescan,
  rateDrift,
  dropToLiquidation,
  HARVEST_FEE_BASE,
  POSITION_SNAPSHOT,
  CARRY_TERMS,
  TOKEN_SOURCES,
  type StockVault,
} from "@/lib/tokenized-stocks";
import { RankTable } from "@/components/rank-table";
import { AssetIcon } from "@/components/token-icons";
import { DocsRails, ExploreHubs, EditorialCta } from "@/components/editorial-hub";
import { exploreHubs } from "@/lib/explore-hubs";
import { Ask, Block, Ext, KeyPoints, RiskList } from "@/components/long-hub-ui";
import { RankingDataNote } from "@/components/ranking-data-note";

export const STOCKS_URL = `${SITE_URL}/yield-on-tokenized-stocks`;

const pct = (n: number | null | undefined, d = 2) => (n == null || !Number.isFinite(n) ? "n/a" : `${n.toFixed(d)}%`);
const usd = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? "n/a"
    : n >= 1e6
      ? `$${(n / 1e6).toFixed(1)}M`
      : n >= 1e3
        ? `$${(n / 1e3).toFixed(1)}K`
        : `$${Math.round(n)}`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const listOf = (xs: string[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

const TOC: [string, string][] = [
  ["ranking", "Ranking"],
  ["how-it-works", "How the carry works"],
  ["leverage", "Leverage, position by position"],
  ["fixed-term", "Fixed-term markets"],
  ["what-we-noticed", "What we noticed"],
  ["the-tokens", "The tokens"],
  ["fees", "Fees"],
  ["how-to-start", "How to start"],
  ["risks", "Risks"],
  ["questions", "Questions"],
];

const row = (v: StockVault): EdRow => ({
  slug: v.slug,
  name: v.name,
  chain: v.chain,
  venue: `${v.token} · IPOR Fusion`,
  token: v.token,
  apy: v.apy24h,
  apy30: v.apy30d,
  tvl: v.tvlUsd,
  thin: false,
  appUrl: stockAppUrl(),
  href: stockAppUrl(),
});

export async function TokenizedStocksBody() {
  const data = loadStockData();
  const explore = await exploreHubs("");
  const vaults = [...data.vaults].sort((a, b) => b.apy24h - a.apy24h);
  const asOfIso = data.dataAsOf;
  const asOf = dateLabel(asOfIso);
  const time = asOfIso.slice(11, 16);
  const monthYear = new Date(asOfIso).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const top = vaults[0];
  const low = vaults[vaults.length - 1];
  const totalTvl = vaults.reduce((s, v) => s + v.tvlUsd, 0);
  const carryTvl = vaults.reduce((s, v) => s + (v.carryVault?.tvlUsd ?? 0), 0);
  const with30 = vaults.filter((v) => v.apy30d != null);
  const markets = vaults.flatMap((v) => v.fixedTerm.map((m) => ({ v, m })));
  const bestFixed = [...markets].sort((a, b) => (b.m.fixedApy ?? 0) - (a.m.fixedApy ?? 0))[0] ?? null;
  const maturity = markets[0] ? dateLabel(markets[0].m.maturity) : null;
  const drifts = vaults
    .map((v) => ({ v, d: rateDrift(v) }))
    .filter((x): x is { v: StockVault; d: { first: number; last: number } } => x.d !== null);
  const snap = POSITION_SNAPSHOT.rows.map((r) => ({
    ...r,
    v: vaults.find((v) => v.token === r.token),
    room: dropToLiquidation(r.health),
  }));
  const tightest = [...snap].sort((a, b) => a.health - b.health)[0];
  const company = (token: string) => vaults.find((v) => v.token === token)?.company ?? token;

  const faqs: Faq[] = [
    {
      q: "How does yield on Coinbase Tokenized Stocks work?",
      at: "top",
      a: top
        ? `Through autocompounding vaults. Each of Harvest's four vaults on Coinbase Tokenized Stocks (NVDAc, AAPLc, ` +
          `METAc and GOOGLc) on Base holds the stock, runs a carry trade on top of it and reinvests the proceeds ` +
          `as more of the same stock automatically. On ${asOf} their 24-hour APYs ranged from ${pct(low.apy24h)} ` +
          `to ${pct(top.apy24h)}, denominated in the stock, and the position stays exposed to the share price.`
        : "",
    },
    {
      q: "Where does the yield on a tokenized stock come from?",
      at: "top",
      a:
        `From a carry trade. The vault posts the stock as collateral on Aave, borrows USDC against it, lends ` +
        `that USDC where it earns more than it costs, and buys more of the stock with the difference and any ` +
        `USDC incentives. Nobody is paying interest on the stock itself.`,
    },
    {
      q: "Can a tokenized stock vault be liquidated?",
      at: "risk",
      a: tightest
        ? `The loan behind it can. On ${POSITION_SNAPSHOT.date} the tightest position, ${company(tightest.token)}, ` +
          `had a health factor of ${tightest.health.toFixed(2)}, so a fall of roughly ` +
          `${tightest.room.toFixed(0)}% in the share price with nothing else changing would reach the ` +
          `liquidation point. The vault's manager can repay part of the loan before that, but a fast gap in the ` +
          `price can outrun it.`
        : "",
    },
    {
      q: "How does a fixed rate on a tokenized stock work?",
      at: "fixed",
      a: bestFixed
        ? `Fixed-term markets split each Harvest vault share into a principal token and a yield token, maturing on ` +
          `${dateLabel(bestFixed.m.maturity)}. The principal token trades below one share and redeems for one share at ` +
          `maturity, so its discount is a fixed rate in share terms: ${pct(bestFixed.m.fixedApy)} on ` +
          `${company(bestFixed.v.token)} on ${asOf}, independent of the vault's variable rate for a position held to maturity.`
        : "",
    },
    {
      q: "Can US persons use these vaults?",
      at: "tokens",
      a:
        `No. Coinbase Tokenized Stocks are offered under Regulation S and are available only in eligible ` +
        `jurisdictions outside the US. The vaults accept only the token, so the same restriction applies to ` +
        `anyone who would need to acquire it.`,
    },
    {
      q: "Is a Coinbase Tokenized Stock the same as owning the share?",
      at: "tokens",
      a:
        `It is a token issued by Coinbase and backed 1:1 by a share held in regulated, bankruptcy-remote ` +
        `custody separate from Coinbase. What a holder is entitled to is set by Coinbase's prospectus and ` +
        `legal disclosures for each ticker, not by the company whose share backs it.`,
    },
    {
      q: "What fees do the tokenized stock vaults charge?",
      at: "fees",
      a:
        `Two layers. Harvest keeps ${HARVEST_FEE_BASE} of the yield it harvests on Base, and the IPOR carry vault ` +
        `underneath charged a ${CARRY_TERMS.performanceFee} performance fee and a ${CARRY_TERMS.managementFee} ` +
        `management fee on the Nvidia vault, read from its contracts on ${POSITION_SNAPSHOT.date}. ` +
        `Every APY on this page is already net of both.`,
    },
    {
      q: "Why is the 30-day average higher than the 24-hour APY?",
      at: "noticed",
      a: with30.length
        ? `Because the rate has been falling since launch: ${listOf(with30.map((v) => `${company(v.token)} averaged ${pct(v.apy30d)} over 30 days against ${pct(v.apy24h)} on the last day`))}. ` +
          `Part of the yield is USDC incentives, and those were larger in the first weeks.`
        : "",
    },
    {
      q: "How fast can I withdraw?",
      at: "start",
      a:
        `The IPOR carry vault has no instant-withdrawal path: it releases funds on request, inside a ` +
        `${CARRY_TERMS.withdrawWindowHours}-hour window, because USDC has to be repaid before the stock can be ` +
        `freed. Plan for an exit to take up to a day.`,
    },
  ].filter((f) => f.a) as Faq[];
  const asks = (at: string) => faqs.filter((f) => f.at === at).slice(0, 3);
  const placedAt = ["fixed", "tokens", "start", "risk", "noticed"];
  const placed = new Set(placedAt.flatMap((a) => asks(a)).map((f) => f.q));
  const restFaqs = faqs.filter((f) => !placed.has(f.q));

  const crumbs = [{ name: "Home", url: SITE_URL }, { name: "Yield on Coinbase Tokenized Stocks" }];
  const ld = (o: unknown) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(o) }} />;

  return (
    <div className="uni-hub-test uh-page ae ld">
      <DocsRails toc={TOC} token={top?.token ?? "NVDAc"} assetName="Coinbase Tokenized Stocks" appUrl={stockAppUrl()} />
      {ld(breadcrumbSchema(crumbs))}
      {ld(
        reportWebPageSchema({
          name: "Yield on Coinbase Tokenized Stocks (NVDAc, AAPLc, METAc, GOOGLc)",
          url: STOCKS_URL,
          description: `Harvest's ${vaults.length} autocompounding vaults on Coinbase Tokenized Stocks (NVDAc, AAPLc, METAc, GOOGLc) on Base, ranked by APY, with the leverage behind each and the fixed-term markets built on them.`,
          dateModified: asOfIso,
        }),
      )}
      {ld(reportItemListSchema(vaults.map((v) => ({ name: `${v.name} (${v.token})`, url: basescan(v.vaultAddress) })), STOCKS_URL))}
      {ld(
        reportDatasetSchema({
          name: "Coinbase Tokenized Stocks yield dataset",
          description: `24-hour and 30-day APY, TVL and fixed-term rates for ${vaults.length} Harvest vaults on Coinbase Tokenized Stocks (NVDAc, AAPLc, METAc, GOOGLc) on Base.`,
          url: STOCKS_URL,
          dateModified: asOfIso,
          numberOfItems: vaults.length,
          keywords: ["Coinbase Tokenized Stocks", "tokenized stocks", "NVDAc", "AAPLc", "METAc", "GOOGLc", "Base", "yield", "carry trade"],
          sources: ["https://api.harvest.finance", "https://basescan.org", "https://base.org/stocks"],
        }),
      )}
      {ld(faqPageSchema(faqs))}

      <nav className="ae-crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <svg className="ae-crumb-chev" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
        <Link href="/">Rankings</Link>
        <svg className="ae-crumb-chev" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
        <span aria-current="page" className="ae-crumb-asset">
          <AssetIcon asset="NVDAc" size={16} decorative />
          Coinbase Tokenized Stocks
        </span>
      </nav>
      <h1 className="ae-h1">Yield on Coinbase Tokenized Stocks</h1>
      <p className="ae-h1-dek">{`NVDAc, AAPLc, METAc and GOOGLc on Base, ${monthYear}`}</p>
      {top ? (
        <p className="ae-lede" data-dateline="">
          <strong>
            {`On ${asOf}, the best yield on a Coinbase Tokenized Stock that we track was ${pct(top.apy24h)} on ${top.token} (${top.company}), `}
            {`and the four vaults paid from ${pct(low.apy24h)} to ${pct(top.apy24h)}.`}
          </strong>{" "}
          The yield is denominated in the stock itself: each vault holds the share, runs a carry trade on top of
          it and automates the rest, claiming rewards and reinvesting them as more shares with no manual steps.
        </p>
      ) : null}
      <p className="ae-byline" data-dateline="">
        Harvest Research · Updated {asOf}, {time} UTC
      </p>
      <div className="ae-hero-ctas">
        <a className="ae-btn" href={stockAppUrl()} target="_blank" rel="noopener noreferrer">
          Open App
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ae-btn-ext"><path d="M5 11 11 5M6 5h5v5" /></svg>
        </a>
        <a className="ae-btn-ghost" href="#ranking">
          Jump to the ranking<span aria-hidden="true"> ↓</span>
        </a>
      </div>

      <aside className="ae-quick" aria-label="Quick answers">
        <p className="ae-kicker">Quick answers</p>
        <ul>
          {faqs
            .filter((f) => ["top", "fixed"].includes(f.at))
            .slice(0, 4)
            .map((f) => (
              <li key={f.q}>
                <p className="ae-q">{f.q}</p> <p className="ae-a">{f.a}</p>
              </li>
            ))}
        </ul>
      </aside>

      <Block
        id="ranking"
        eyebrow="Ranking"
        title="Tokenized stock vaults, by APY"
        asOf={asOf}
        asOfIso={asOfIso}
        lead={
          vaults.length
            ? `${vaults.length} vaults, one per stock, all on Base, holding ${usd(totalTvl)} between them. ` +
              `Each one deposits into an IPOR Fusion carry vault that holds ${usd(carryTvl)} in total.`
            : undefined
        }
      >
        <RankTable
          rows={vaults.map(row)}
          title={`${vaults.length} Coinbase Tokenized Stock vaults`}
          icon={{ assets: vaults.map((v) => v.token) }}
          floorLabel="$50K"
          appUrl={stockAppUrl()}
        />
      </Block>

      <Block
        id="how-it-works"
        eyebrow="Mechanics"
        title="How a stock carry trade earns yield"
        asOf={asOf}
        asOfIso={asOfIso}
        lead="A share pays no interest onchain, so the yield has to be manufactured. Each vault runs the same four steps."
      >
        <ol className="eh-steps">
          <li>
            <strong>Posting the stock as collateral comes first.</strong> The IPOR carry vault supplies the
            tokenized share to Aave v4 on Base, which accepts Coinbase&apos;s stock tokens as collateral.
          </li>
          <li>
            <strong>Borrowing USDC against it opens the carry.</strong> The vault borrows USDC at roughly half
            of the collateral&apos;s value, well under the maximum Aave allows.
          </li>
          <li>
            <strong>Lending that USDC where it pays more earns the spread.</strong> The borrowed USDC goes into
            USDC lending on Aave v3 and Morpho. The carry is the difference between that supply rate and the
            borrow rate, plus USDC incentives.
          </li>
          <li>
            <strong>Buying more of the stock compounds it.</strong> The spread and incentives are swapped back
            into the stock, so the yield arrives as more shares. Harvest&apos;s vault sits on top, claims the
            USDC rewards and compounds them back into the position without anyone claiming by hand, which is
            why the APY in the ranking includes them.
          </li>
        </ol>
        <p>
          The result is a position that tracks the share price like holding the token, with a small extra
          stream of shares, and with one new risk: a loan that has to stay healthy.
        </p>
      </Block>

      <section className="ae-section" aria-labelledby="leverage" data-asof={POSITION_SNAPSHOT.iso}>
        <h2 id="leverage">Leverage, position by position</h2>
        <p data-dateline="">
          {`Read onchain from each carry vault's Aave v4 position on ${POSITION_SNAPSHOT.date}. `}
          Loan-to-value is USDC borrowed over the value of the stock posted; a health factor of 1 is the point
          where the loan can be liquidated. The last column is how far the share price could fall, with
          nothing else changing, before that point.
        </p>
        <div className="ae-table-wrap">
          <table className="ae-table">
            <thead>
              <tr>
                <th scope="col">Stock</th>
                <th scope="col" className="num">Loan-to-value</th>
                <th scope="col" className="num">Max LTV</th>
                <th scope="col" className="num">Health factor</th>
                <th scope="col" className="num">Fall to liquidation</th>
              </tr>
            </thead>
            <tbody>
              {snap.map((r) => (
                <tr key={r.token}>
                  <th scope="row">{`${company(r.token)} (${r.token})`}</th>
                  <td className="num">{pct(r.ltv, 1)}</td>
                  <td className="num">{`${r.maxLtv}%`}</td>
                  <td className="num">{r.health.toFixed(2)}</td>
                  <td className="num">{`~${r.room.toFixed(0)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p data-dateline="">
          {tightest
            ? `On ${POSITION_SNAPSHOT.date}, ${company(tightest.token)} carried the most leverage, at a health factor of ${tightest.health.toFixed(2)}. ` +
              `The vaults are actively managed, and the manager can repay debt as the price moves, so these figures change daily.`
            : null}
        </p>
        <Ask items={asks("risk")} />
      </section>

      <section className="ae-section" aria-labelledby="fixed-term" data-asof={asOfIso}>
        <h2 id="fixed-term">Fixed-term markets built on the vaults</h2>
        <p data-dateline="">
          {`Each Harvest stock vault share (fNVDAc, fAAPLc, fMETAc, fGOOGLc) is a standard yield-bearing token, and on ${asOf} `}
          {`a fixed-term market on Spectra used each one as its base, maturing on ${maturity ?? "a set date"}. `}
          The market splits a vault share into a principal token, which redeems for one share at maturity, and
          a yield token, which collects the vault&apos;s yield until then.
        </p>
        {markets.length ? (
          <div className="ae-table-wrap">
            <table className="ae-table">
              <thead>
                <tr>
                  <th scope="col">Vault share</th>
                  <th scope="col" className="num">Fixed APY</th>
                  <th scope="col" className="num">Implied APY</th>
                  <th scope="col" className="num">LP APY</th>
                  <th scope="col">Contracts</th>
                  <th scope="col" className="num">Pool liquidity</th>
                </tr>
              </thead>
              <tbody>
                {markets.map(({ v, m }) => (
                  <tr key={m.pt}>
                    <th scope="row">{`f${v.token}`}</th>
                    <td className="num">{pct(m.fixedApy)}</td>
                    <td className="num">{pct(m.impliedApy)}</td>
                    <td className="num">{pct(m.lpApy)}</td>
                    <td>
                      <Ext href={basescan(m.pt)}>PT</Ext>
                      {m.yt ? (
                        <>
                          {" · "}
                          <Ext href={basescan(m.yt)}>YT</Ext>
                        </>
                      ) : null}
                      {m.pool ? (
                        <>
                          {" · "}
                          <Ext href={basescan(m.pool)}>Pool</Ext>
                        </>
                      ) : null}
                    </td>
                    <td className="num">{usd(m.liquidityUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No live fixed-term market is built on these vaults at the moment.</p>
        )}
        <h3>What the integration unlocks</h3>
        <KeyPoints
          items={[
            bestFixed
              ? `A fixed rate on a stock. The principal token trades below one share and redeems for one share at maturity, which sets a fixed rate in share terms: ${pct(bestFixed.m.fixedApy)} on ${company(bestFixed.v.token)} on ${asOf}. A position held to maturity is not exposed to changes in the variable vault rate, which has been falling.`
              : `A fixed rate on a stock. The principal token trades below one share and redeems for one share at maturity, which sets a fixed rate in share terms.`,
            `A market forecast of the vault rate. The implied APY is the rate the market prices in for the vault until maturity, so comparing it with the 24-hour figure in the ranking shows whether traders expect the carry to rise or fall.`,
            bestFixed?.m.ytLeverage
              ? `A leveraged view on the carry. The yield token gives roughly ${Math.round(bestFixed.m.ytLeverage)} times the yield exposure of holding the share, and expires worthless if the vault earns less than the market priced in. It is a position on the rate itself, with the risk of losing its full value.`
              : `A leveraged view on the carry. The yield token collects the vault's yield until maturity and expires worthless if the vault earns less than the market priced in.`,
            `A third way to earn. Liquidity providers in each pool hold vault shares and principal tokens, so they keep earning the vault's yield while collecting the principal token's discount as it closes toward maturity.`,
          ]}
        />
        <p>
          The pools are small, each holding a few thousand dollars, so any trade of size will move the price.
          The fixed rate is fixed in shares, not dollars: the position still rises and falls with the stock.
        </p>
        <Ask items={asks("fixed")} />
      </section>

      <section className="ae-section" aria-labelledby="what-we-noticed" data-asof={asOfIso}>
        <h2 id="what-we-noticed">What we noticed</h2>
        <p className="ae-sub" data-dateline="">
          {`Three patterns from the ${monthYear} data, each with the numbers behind it.`}
        </p>
        <article className="ae-pattern" aria-labelledby="pattern-1">
          <h3 id="pattern-1" className="ae-pattern-h">
            <span className="ae-pattern-n" aria-hidden="true">1</span>
            <span>The rate has come down since launch</span>
          </h3>
          <p>
            {drifts.length
              ? `${listOf(drifts.map(({ v, d }) => `${company(v.token)} averaged ${pct(d.first)} in its first week and ${pct(d.last)} in the last`))}. ` +
                `Early incentives were larger, and more USDC chasing the same lending markets narrows the spread.`
              : `Early incentives were larger, and more USDC chasing the same lending markets narrows the spread.`}
          </p>
        </article>
        <article className="ae-pattern" aria-labelledby="pattern-2">
          <h3 id="pattern-2" className="ae-pattern-h">
            <span className="ae-pattern-n" aria-hidden="true">2</span>
            <span>Four stocks, almost one rate</span>
          </h3>
          <p>
            {top
              ? `The 24-hour APYs sat within ${(top.apy24h - low.apy24h).toFixed(2)} percentage points of each other. ` +
                `The carry comes from the USDC side, which is the same for every vault, so the stock chosen changes the price exposure far more than the yield.`
              : null}
          </p>
        </article>
        <article className="ae-pattern" aria-labelledby="pattern-3">
          <h3 id="pattern-3" className="ae-pattern-h">
            <span className="ae-pattern-n" aria-hidden="true">3</span>
            <span>Fixed and variable rates sit close together</span>
          </h3>
          <p>
            {markets.length
              ? `${listOf(markets.map(({ v, m }) => `${company(v.token)} fixed at ${pct(m.fixedApy)} against ${pct(v.apy24h)} variable`))}. ` +
                `With the fixed rates this close to the variable ones, the market prices the carry to hold roughly where it is until ${maturity}, after the decline from launch.`
              : null}
          </p>
        </article>
        <Ask items={asks("noticed")} />
      </section>

      <Block
        id="the-tokens"
        eyebrow="The tokens"
        title="What Coinbase Tokenized Stocks are"
        lead="US company shares brought onchain by Coinbase: each token is issued 1:1 against a share Coinbase holds, as a B20 token on Base."
      >
        <p>
          The underlying shares sit in regulated, bankruptcy-remote custody separate from Coinbase, and the
          tokens themselves are held in a self-custodial wallet. Every ticker ends in a lowercase
          &quot;c&quot;, so NVDAc is the Coinbase token for one Nvidia share. Coinbase issues the tokens and
          offers them under Regulation S, available only in eligible jurisdictions outside the US (
          <Ext href={TOKEN_SOURCES.base}>base.org/stocks</Ext>).
        </p>
        <p>
          Aave on Base accepts the tokens as collateral, which is what makes the carry trade possible, and
          Chainlink provides price feeds for them. Harvest runs vaults on four of the ten tickers listed;
          the others (Amazon, Microsoft, Strategy, SanDisk, SpaceX and Tesla) have no Harvest vault.
        </p>
        <h3>Contracts</h3>
        <p data-dateline="">
          Token addresses as Coinbase lists them on base.org, and the Harvest vault for each. Match the token
          address before acquiring or depositing anything.
        </p>
        <div className="ae-table-wrap">
          <table className="ae-table">
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col">Company</th>
                <th scope="col">Token contract</th>
                <th scope="col">Harvest vault</th>
              </tr>
            </thead>
            <tbody>
              {vaults.map((v) => (
                <tr key={v.token}>
                  <th scope="row">{v.token}</th>
                  <td>{v.company}</td>
                  <td>
                    <Ext href={basescan(v.tokenAddress)}>{short(v.tokenAddress)}</Ext>
                  </td>
                  <td>
                    <Ext href={basescan(v.vaultAddress)}>{short(v.vaultAddress)}</Ext>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Ask items={asks("tokens")} />
      </Block>

      <section className="ae-section" aria-labelledby="fees" data-asof={POSITION_SNAPSHOT.iso}>
        <h2 id="fees">Fees</h2>
        <p data-dateline="">
          {`Harvest keeps ${HARVEST_FEE_BASE} of the yield its Base strategies harvest. The IPOR carry vault underneath charged a `}
          {`${CARRY_TERMS.performanceFee} performance fee on gains above its high-water mark and a ${CARRY_TERMS.managementFee} yearly management fee, `}
          {`read from the Nvidia vault's fee contract on ${POSITION_SNAPSHOT.date}. Every APY in the ranking is already net of both, and neither fee is charged on the share price itself.`}
        </p>
      </section>

      <Block
        id="how-to-start"
        eyebrow="Getting started"
        title="Getting started with the stock vaults"
        lead="Three steps, each a transaction on Base that usually costs a few cents."
      >
        <ol className="eh-steps">
          <li>
            <strong>Holding the token on Base comes first.</strong> The vaults accept Coinbase Tokenized Stocks
            only, and only holders in eligible jurisdictions outside the US can hold them. Check the token
            address against the contracts table above.
          </li>
          <li>
            <strong>Depositing the token into its vault hands the compounding to the vault.</strong> Each stock
            has its own vault in the Harvest app, and from that point the vault claims and reinvests on its own;
            the vault share is denominated in the stock.
          </li>
          <li>
            <strong>Withdrawing takes up to a day.</strong> The carry vault repays USDC before it frees the stock,
            so exits are released on request rather than instantly.
          </li>
        </ol>
        <Ask items={asks("start")} />
      </Block>

      <Block
        id="risks"
        eyebrow="Risk"
        title="Risks on tokenized stock yield"
        lead="The yield is small next to the share price's own moves, and it adds exposures that holding the token alone does not."
      >
        <RiskList
          risks={[
            { title: "Price risk", parts: [" is the stock's own. A 10% fall in the share costs far more than a year of carry pays."] },
            {
              title: "Liquidation risk",
              parts: [
                " comes from the USDC loan. A sharp fall, or a price gap when the US market opens after a weekend, can push the loan past its limit before the manager repays it.",
              ],
            },
            {
              title: "Negative carry",
              parts: [
                " appears when borrowing USDC costs more than lending it pays. The spread then eats into the position instead of adding to it.",
              ],
            },
            {
              title: "Issuer and legal risk",
              parts: [
                " sits with the special-purpose vehicle, its custodian and the terms of the token, which is a claim on a share rather than the share itself.",
              ],
            },
            {
              title: "Oracle risk",
              parts: [" sits on the price feed: stock prices move only in market hours, while the loan is open around the clock."],
            },
            {
              title: "Smart-contract risk",
              parts: [" stacks across Harvest, IPOR Fusion, Aave and Morpho, and the fixed-term contracts for anyone using those."],
            },
          ]}
        />
      </Block>

      {restFaqs.length ? (
        <section className="ae-section" aria-labelledby="questions" data-asof={asOfIso}>
          <h2 id="questions">More questions about yield on tokenized stocks</h2>
          <p className="ae-dateline" data-dateline="">
            Answers as of {asOf}
          </p>
          <div className="ae-faq">
            {restFaqs.map((f, i) => (
              <details className="ae-faq-item" key={f.q} id={qid(f.q)} open={i === 0}>
                <summary>
                  <span>{f.q}</span>
                  <span className="ae-faq-chev" aria-hidden="true">+</span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <EditorialCta
        text="Each tokenized stock vault automates the compounding: rewards are claimed and reinvested as more of the stock by the vault itself. The vaults are listed in the Harvest app."
        appUrl={stockAppUrl()}
      />
      <ExploreHubs assets={explore.assets} networks={explore.networks} />
      <p className="uni-data-note">
        This page is informational and is not an offer, solicitation or recommendation to buy or sell any
        security. Coinbase Tokenized Stocks are issued by Coinbase and offered under Regulation S, only in
        eligible jurisdictions outside the US. Harvest does not issue, sell or endorse them; its vaults accept
        the tokens from holders who already have them.
      </p>
      <RankingDataNote sortedBy="24-hour APY, highest first" />
    </div>
  );
}
