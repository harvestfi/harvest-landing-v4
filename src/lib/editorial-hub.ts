// The editorial layout shared by the asset hubs (/eth, /btc, /usdt, /usdc).
//
// One reading order for all four, from the design direction of November 2026:
// a dated header, five quick answers, a short intro that says why rates differ
// between apps, the top 10 as a table, five patterns from the data with the
// numbers behind each, a key-takeaways table, how the figures are measured,
// then each hub's own deeper sections, its questions and the full index.
//
// Everything here is built from the hub's cohort, so the words and the tables
// cannot disagree with the ranking. The fifth pattern, the fifth quick answer
// and the last takeaway are the asset's own comparison (staking for ETH, the
// wrapper for BTC, USDC for USDT, the wider market for USDC), passed in.
import type { YieldVault } from "./types";
import { harvestAppUrl } from "./harvest-app";
import { apy, apyFloorLabel, listOf, plural, tvl, venueOf } from "./usdc-hub";
import {
  bare,
  byType,
  medianOf,
  networks,
  strategyTypeOf,
  typeBlurb,
  SINGULAR,
  article,
  displayVenue,
  type HubCohort,
} from "./long-hub";

/** Text with links in place, for paragraphs that point elsewhere on the site. */
export type Rich = (string | { text: string; href: string })[];

export type EdCell = string | { strong: string; rest?: string; dim?: boolean };

export interface EdTable {
  head: string[];
  rows: {
    lead: { title: string; sub?: string; chain?: string; token?: string; href?: string; tag?: string };
    cells: EdCell[];
  }[];
  caption: string;
}

export interface EdPattern {
  title: string;
  body: string;
  table?: EdTable;
}

export interface EdRow {
  slug: string;
  name: string;
  chain: string;
  venue: string;
  token: string;
  apy: number;
  /** Null where no 30-day figure exists yet. */
  apy30: number | null;
  tvl: number;
  thin: boolean;
  appUrl: string;
  /** Where the name links when the row has no product page of its own
   *  (an absolute URL opens in a new tab). Defaults to /<slug>. */
  href?: string;
}

export interface EdTakeaway {
  k: string;
  strong: string;
  rest: string;
}

export interface EditorialModel {
  asset: string;
  /** Network hubs: the chain whose mark leads the breadcrumb. */
  chainIcon?: string;
  h1: string;
  dek: string;
  lede: string;
  asOf: string;
  asOfIso: string;
  asOfTime: string;
  quick: { q: string; a: string }[];
  intro: string[];
  disclaimer: string;
  topTitle: string;
  topLead: string;
  top: EdRow[];
  /** Every strategy in the cohort, same shape, for the full index. */
  all: EdRow[];
  topCaption: string;
  /** The liquidity floor as printed, "$50K". */
  floorLabel: string;
  topNotes: string[];
  noticedLead: string;
  patterns: EdPattern[];
  takeaways: EdTakeaway[];
  measureTitle: string;
  measure: Rich[];
  cta: string;
  appUrl: string;
}

/** The asset's own comparison: one quick answer, one pattern, one takeaway. */
export interface EdSpecial {
  quick: { q: string; a: string } | null;
  pattern: EdPattern | null;
  takeaway: EdTakeaway | null;
}

export interface EdConfig {
  asset: string;
  /** "ETH", "BTC": the word used before "yield" and "strategies". */
  unit: string;
  /** "ETH and WETH", "WBTC and cbBTC", "USDT", "USDC". */
  tokens: string;
  h1: string;
  appUrl: string;
  feeText?: string;
  /** The sister ranking named at the end of "How we measure". */
  related: { lead: string; text: string; href: string };
  /** "asset" (default) writes "BTC yield"; "network" writes "yield on Base". */
  kind?: "asset" | "network";
}

const TOKEN = /^(WETH|ETH|WBTC|cbBTC|USDT0|USDT|USDC)$/;
const tokenOf = (v: YieldVault, asset: string) =>
  v.productName.split(/\s+/).find((w) => TOKEN.test(w)) ?? asset;

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => NUMBER_WORDS[n] ?? String(n);
const capWord = (n: number) => {
  const w = word(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
};
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** How the top-rate strategy earns, in one clause, by type. */
function howItEarns(v: YieldVault, unit: string): string {
  switch (strategyTypeOf(v)) {
    case "looping":
      return (
        ` by borrowing ${unit} against supplied ${unit} and supplying it again. Looping ` +
        `multiplies the rate, and it is the only ${unit} strategy type that can be liquidated`
      );
    case "allocator":
      return ` by moving ${unit} between lending venues as their rates change`;
    case "curated":
      return ` through a curator's choice of isolated lending markets on ${venueOf(v)}`;
    default:
      return ` by lending straight into one pooled market on ${venueOf(v)}`;
  }
}

/** Ranking rows for the rank table, for hubs that keep their own copy. */
export function edRows(vaults: YieldVault[], asset: string, floor: number): EdRow[] {
  return vaults.map((v) => ({
    slug: v.slug,
    name: bare(v),
    chain: v.chain,
    venue: displayVenue(v),
    token: tokenOf(v, asset),
    apy: v.apy24h,
    apy30: v.apy30d,
    tvl: v.tvl,
    thin: v.tvl < floor,
    appUrl: harvestAppUrl(v.chain, v.contractAddress),
  }));
}

export function buildEditorial(cfg: EdConfig, c: HubCohort, special: EdSpecial): EditorialModel | null {
  if (!c.best || !c.bestRaw) return null;
  const { unit } = cfg;
  const N = cfg.kind === "network";
  // One vocabulary for both kinds of hub.
  const yld = N ? `yield on ${unit}` : `${unit} yield`;
  const strat = N ? `strategies on ${unit}` : `${unit} strategies`;
  const stratOne = N ? `strategy on ${unit}` : `${unit} strategy`;
  const rates = N ? `rates on ${unit}` : `${unit} rates`;
  const rateOne = N ? `rate on ${unit}` : `${unit} rate`;
  const assetsOf = (rows: YieldVault[]) => [...new Set(rows.map((v) => v.asset))];
  const top = c.bestRaw;
  const best = c.best;
  const topIsFunded = top.slug === best.slug;
  const chains = [...c.chains].sort();
  const monthYear = new Date(c.asOfIso).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const nameOf = (v: YieldVault) => `${bare(v)} on ${v.chain}`;
  const typeOf = (v: YieldVault) => SINGULAR[strategyTypeOf(v)];
  const top10 = c.top10;
  const fundedInTop = top10.filter((v) => v.tvl >= c.fundedFloor).length;
  const nets = networks(c);
  const types = byType(c);

  // ---- quick answers -------------------------------------------------------
  const quick: { q: string; a: string }[] = [
    {
      q: `What is the best ${yld} right now?`,
      a:
        `${apy(top.apy24h)} APY from ${nameOf(top)} (${displayVenue(top)}), ` +
        `${article(typeOf(top))} ${typeOf(top)} holding ${tvl(top.tvl)}.`,
    },
    {
      q: N ? `Which strategy on ${unit} has real money behind it?` : `Which ${unit} option has real money behind it?`,
      a:
        c.fundedCount === 1
          ? `${nameOf(best)} pays ${apy(best.apy24h)} APY with ${tvl(best.tvl)} in the vault, ` +
            `the only ${stratOne} here holding ${tvl(c.fundedFloor)} or more.`
          : `${nameOf(best)} pays ${apy(best.apy24h)} APY with ${tvl(best.tvl)} in the vault, the ` +
            `best rate among the ${c.fundedCount} ${strat} holding ${tvl(c.fundedFloor)} or more.`,
    },
    ...(special.quick ? [special.quick] : []),
    {
      q: `Are these ${rates} after fees?`,
      a:
        `Yes, every ${rateOne} here is read from the vault contracts net of fees` +
        (cfg.feeText ? `. The vaults keep ${cfg.feeText} of the yield they harvest.` : `.`),
    },
    {
      q: N ? `Which assets earn yield on ${unit}?` : `Where can I earn ${unit} yield?`,
      a: N
        ? `We track ${c.count} ${strat} across ${listOf(assetsOf(c.all))}, holding ` +
          `${tvl(c.totalTvl)} in total.`
        : `We track ${c.count} ${unit} strategies on ${listOf(chains)}, holding ${tvl(c.totalTvl)} ` +
          `in total.`,
    },
  ];

  // ---- intro -----------------------------------------------------------------
  const intro = [
    `Different DeFi apps often quote different numbers for the best ${yld}. ` +
      `The reasons are mechanical. Some are quoted before fees, some are averaged over different windows, and some ` +
      `come from vaults that hold almost nothing.`,
    `We read every rate straight from the vault contracts, net of fees, and rank what each ` +
      `${stratOne} paid over the last 24 hours. This page covers the ${c.count} ${strat} ` +
      `we track, holding ${tvl(c.totalTvl)} between them.`,
    topIsFunded
      ? `The short version: the top ${rateOne} also has real money behind it, so the headline ` +
        `and the rate worth a closer look are the same.`
      : `The short version: the very top of the table is thin. The ${rateOne} worth a closer ` +
        `look sits a little lower, where the money is.`,
  ];

  // ---- top 10 ------------------------------------------------------------------
  const toRow = (v: YieldVault): EdRow => ({
    slug: v.slug,
    name: bare(v),
    chain: v.chain,
    venue: displayVenue(v),
    token: tokenOf(v, cfg.asset),
    apy: v.apy24h,
    apy30: v.apy30d,
    tvl: v.tvl,
    thin: v.tvl < c.fundedFloor,
    appUrl: harvestAppUrl(v.chain, v.contractAddress),
  });
  const rows: EdRow[] = top10.map(toRow);
  const lead10 = top10.length;
  const topChain = nets
    .map((n) => ({ chain: n.chain, k: top10.filter((v) => v.chain === n.chain).length }))
    .sort((a, b) => b.k - a.k)[0];
  const topAsset = assetsOf(top10)
    .map((a) => ({ a, k: top10.filter((v) => v.asset === a).length }))
    .sort((x, y) => y.k - x.k)[0];
  const topNotes = [
    (N
      ? `${capWord(topAsset.k)} of the ${lead10} highest ${rates} are ${topAsset.a} strategies. `
      : `${capWord(topChain.k)} of the ${lead10} highest ${unit} rates are on ${topChain.chain}. `) +
      (fundedInTop === lead10
        ? `All ${word(lead10)} hold more than ${tvl(c.fundedFloor)}.`
        : `Only ${word(fundedInTop)} of the ${lead10} hold more than ${tvl(c.fundedFloor)}` +
          (topIsFunded
            ? `.`
            : `, which is why we headline ${bare(best)} rather than the rate at the very top.`)),
    `Here is what stood out to us.`,
  ];

  // ---- what we noticed -----------------------------------------------------------
  const patterns: EdPattern[] = [];

  patterns.push(
    topIsFunded
      ? {
          title: `The highest ${rateOne} also has real money behind it`,
          body:
            `${nameOf(top)} pays ${apy(top.apy24h)} APY${howItEarns(top, N ? tokenOf(top, top.asset) : unit)}. It holds ` +
            `${tvl(top.tvl)}, enough that one large entry or withdrawal moves its rate less than ` +
            `it would on a small vault.`,
        }
      : {
          title: `The highest ${rateOne} comes from ${article(typeOf(top))} ${typeOf(top)} holding ${tvl(top.tvl)}`,
          body:
            `${nameOf(top)} pays ${apy(top.apy24h)} APY${howItEarns(top, N ? tokenOf(top, top.asset) : unit)}. With ` +
            `${tvl(top.tvl)} in the vault, a single large entry or withdrawal can move that rate.`,
        },
  );

  if (!topIsFunded) {
    const ratio = top.tvl > 0 ? Math.round(best.tvl / top.tvl) : 0;
    const vs30 =
      Math.abs(best.apy24h - best.apy30d) < 0.05
        ? `in line with`
        : best.apy24h > best.apy30d
          ? `above`
          : `below`;
    patterns.push({
      title: `Real money sits a step lower, at ${apy(best.apy24h)}`,
      body:
        `${nameOf(best)} pays ${apy(best.apy24h)} APY with ${tvl(best.tvl)} in the vault` +
        (ratio >= 2 ? `, roughly ${ratio.toLocaleString("en-US")} times the size of the top rate's vault` : ``) +
        `. Its 24-hour rate is running ${vs30} its 30-day average of ${apy(best.apy30d)}. ` +
        (c.fundedCount === 1
          ? `It is the only ${stratOne} here holding at least ${tvl(c.fundedFloor)}.`
          : fundedInTop === c.fundedCount
            ? `All ${word(c.fundedCount)} ${strat} holding at least ${tvl(c.fundedFloor)} made the top ${lead10}.`
            : `${capWord(fundedInTop)} of the ${c.fundedCount} ${strat} holding at least ` +
              `${tvl(c.fundedFloor)} made the top ${lead10}.`),
    });
  }

  const bigType = [...types].sort((a, b) => b.tvl - a.tvl)[0];
  if (bigType) {
    patterns.push({
      title: N ? `${bigType.label} hold most of what we track on ${unit}` : `${bigType.label} hold most of the ${unit} we track`,
      body:
        `${bigType.label} hold ${tvl(bigType.tvl)} of the ${tvl(c.totalTvl)} in ${strat} ` +
        `we track, about ${pct(bigType.tvl, c.totalTvl)}%. ${typeBlurb(bigType.type, N ? "funds" : unit)}`,
      table: {
        head: ["Strategy type", "Median APY", "Strategies", "Tracked"],
        rows: types.map((t) => ({
          lead: { title: t.label },
          cells: [apy(t.medianApy), String(t.count), tvl(t.tvl)],
        })),
        caption: `${N ? `Strategies on ${unit}` : `${unit} strategies`} by type. Median APY across the strategies of each type.`,
      },
    });
  }

  const byAsset = assetsOf(c.all)
    .map((a) => {
      const rows = c.all.filter((v) => v.asset === a);
      const funded = rows.filter((v) => v.tvl >= c.fundedFloor);
      return { a, rows, funded, tvl: rows.reduce((x, v) => x + v.tvl, 0) };
    })
    .sort((x, y) => y.tvl - x.tvl);
  const bigAsset = byAsset[0];
  if (N && bigAsset) {
    patterns.push({
      title: `${bigAsset.a} carries most of what we track on ${unit}`,
      body:
        `${bigAsset.rows.length} of the ${c.count} ${strat} we track are ${bigAsset.a} strategies, ` +
        `holding ${tvl(bigAsset.tvl)}, about ${pct(bigAsset.tvl, c.totalTvl)}% of the total. ` +
        (byAsset.length > 1
          ? `The rest is spread across ${listOf(byAsset.slice(1).map((x) => x.a))}.`
          : `No other asset is tracked here.`),
      table: {
        head: ["Asset", "Median APY", "Best funded", "Strategies", "Tracked"],
        rows: byAsset.map((x) => ({
          lead: {
            title: x.a,
            token: x.a,
            href: ["USDC", "USDT", "ETH", "BTC"].includes(x.a) ? `/${x.a.toLowerCase()}` : undefined,
          },
          cells: [
            apy(medianOf(x.rows)),
            x.funded[0] ? { strong: apy(x.funded[0].apy24h) } : { strong: "None", dim: true },
            String(x.rows.length),
            tvl(x.tvl),
          ],
        })),
        caption: `Strategies on ${unit} by asset. Best funded counts strategies holding at least ${tvl(c.fundedFloor)}.`,
      },
    });
  }

  const bigNet = N ? undefined : nets[0];
  if (bigNet) {
    const inTop = top10.filter((v) => v.chain === bigNet.chain).length;
    patterns.push({
      title: `${bigNet.chain} is where most ${unit} yield lives`,
      body:
        `${bigNet.count} of the ${c.count} ${unit} strategies we track run on ${bigNet.chain}, ` +
        `holding ${tvl(bigNet.tvl)}, and ${word(inTop)} of them made the top ${lead10}. ` +
        (nets.length === 2
          ? `${nets[1].chain}, the other network, holds ${tvl(nets[1].tvl)}.`
          : nets.length > 2
            ? `The other ${word(nets.length - 1)} networks hold ${tvl(c.totalTvl - bigNet.tvl)} between them.`
            : ``),
      table: {
        head: ["Network", "Best funded", "Strategies", "Tracked"],
        rows: nets.map((n) => ({
          lead: { title: n.chain, chain: n.chain, href: `/${n.chain.toLowerCase()}` },
          cells: [
            n.picks[0]
              ? { strong: apy(n.picks[0].apy24h), rest: bare(n.picks[0]) }
              : { strong: "None", rest: `no strategy holds ${tvl(c.fundedFloor)} or more`, dim: true },
            String(n.count),
            tvl(n.tvl),
          ],
        })),
        caption: `${unit} strategies by network. Best funded rate counts strategies holding at least ${tvl(c.fundedFloor)}.`,
      },
    });
  }

  if (special.pattern) patterns.push(special.pattern);

  // ---- key takeaways ----------------------------------------------------------------
  const lo = top10[top10.length - 1];
  const takeaways: EdTakeaway[] = [
    {
      k: `Best ${yld}`,
      strong: `${apy(top.apy24h)} APY`,
      rest: `from ${nameOf(top)}, ${article(typeOf(top))} ${typeOf(top)} holding ${tvl(top.tvl)}.`,
    },
    ...(topIsFunded
      ? []
      : [
          {
            k: `Best with ${tvl(c.fundedFloor)}+ in the vault`,
            strong: `${apy(best.apy24h)} APY`,
            rest: `from ${nameOf(best)}, holding ${tvl(best.tvl)}.`,
          },
        ]),
    {
      k: `Top ${lead10} range`,
      strong: `${apyFloorLabel(lo.apy24h)} to ${apy(top.apy24h)}`,
      rest: N
        ? `across ${listOf(assetsOf(top10))} strategies.`
        : `across ${listOf([...new Set(top10.map((v) => v.chain))])}.`,
    },
    {
      k: "Tracked by Harvest",
      strong: tvl(c.totalTvl),
      rest: N
        ? `in ${c.count} ${strat} across ${assetsOf(c.all).length} ${plural(assetsOf(c.all).length, "asset", "assets")}.`
        : `in ${c.count} ${unit} strategies on ${c.chainCount} ${plural(c.chainCount, "network", "networks")}.`,
    },
    {
      k: "Typical rate",
      strong: `${apy(medianOf(c.funded))} median`,
      rest:
        c.fundedCount === 1
          ? `on the one strategy holding ${tvl(c.fundedFloor)} or more, and ${apy(c.medianApy)} across all ${c.count}.`
          : `across the ${c.fundedCount} strategies holding ${tvl(c.fundedFloor)} or more, and ${apy(c.medianApy)} across all ${c.count}.`,
    },
    ...(special.takeaway ? [special.takeaway] : []),
  ];

  // ---- how we measure -------------------------------------------------------------------
  const measure: Rich[] = [
    [
      (N
        ? `We read every yield on ${unit} directly from the vault contracts, net of `
        : `We read ${unit} yields directly from the vault contracts on ${listOf(chains)}, net of `) +
        `fees, and refresh them several times a day. The full process is in our `,
      { text: "methodology", href: "/methodology" },
      ".",
    ],
    [
      `We sort on the 24-hour APY with no minimum, so a vault near the top can hold only a few ` +
        `hundred dollars${N ? "" : ` of ${unit}`}. That is why our headline ${yld} uses a ` +
        `${tvl(c.fundedFloor)} floor, which ${c.fundedCount} of the ${c.count} strategies clear ` +
        `as of ${c.asOf}.`,
    ],
    [`${cfg.related.lead} `, { text: cfg.related.text, href: cfg.related.href }, "."],
  ];

  return {
    asset: cfg.asset,
    chainIcon: N ? unit : undefined,
    h1: cfg.h1,
    dek: `${cfg.tokens} lending rates, ${monthYear}`,
    lede: N
      ? `We rank the ${c.count} ${strat} we track, across ${listOf(assetsOf(c.all))}, by what ` +
        `they actually paid in the last 24 hours, after fees.`
      : `We rank ${c.count} ${cfg.tokens} strategies on ${listOf(chains)} by what they actually ` +
        `paid in the last 24 hours, after fees.`,
    asOf: c.asOf,
    asOfIso: c.asOfIso,
    asOfTime: new Date(c.asOfIso).toISOString().slice(11, 16),
    quick,
    intro,
    disclaimer:
      `This ranking is not a recommendation. It covers ${N ? strat : `${cfg.tokens} strategies`} only, and a high ` +
      `rate on a small vault can change quickly.`,
    topTitle: N ? `The top ${lead10} yields on ${unit} right now` : `The top ${lead10} ${unit} yields right now`,
    topLead:
      `The ${lead10} highest-paying ${strat} we track range from ` +
      `${apyFloorLabel(lo.apy24h)} to ${apy(top.apy24h)} APY.`,
    top: rows,
    all: c.all.map(toRow),
    floorLabel: tvl(c.fundedFloor),
    topCaption:
      `Sorted by 24-hour APY, net of fees, with rates as of ${c.asOf}. Click a column to re-sort.`,
    topNotes,
    noticedLead:
      `${capWord(patterns.length)} patterns from the ${monthYear} ${unit} data, ` +
      `each with the numbers behind it.`,
    patterns,
    takeaways,
    measureTitle: `How we measure ${yld}`,
    measure,
    cta: N
      ? `Every vault in this ranking is an autocompounder: it claims rewards and reinvests them into the position automatically, with no manual harvesting. All of them are listed in the Harvest app.`
      : `Every ${unit} vault in this ranking is an autocompounder: it claims rewards and reinvests them into the position automatically, with no manual harvesting. All of them are listed in the Harvest app.`,
    appUrl: cfg.appUrl,
  };
}
