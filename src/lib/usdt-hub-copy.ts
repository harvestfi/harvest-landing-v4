// The words on /usdt, as data.
//
// /usdt and /usdt.md say the same things, built here without JSX from one
// cohort, the way /eth does it (eth-hub-copy.ts). The questions come from
// Search Console for the page: "usdt yield" and "usdt apy" carry most of the
// impressions around position 10 to 12, "usdt farm" already sits near
// position 4, and the rest ask whether USDT farming is real, how USDT
// compares with USDC and whether the rate is available in a given country.
//
// What /usdt has that /eth does not is a thin cohort: most USDT vaults in the
// index hold a few dollars. The page says so in its first lines, names the
// headline rate from the funded rows, and answers "USDT or USDC" from the
// venues that list both, where a vault's size matters less because a pooled
// market pays every supplier the same rate.
import { getLiveVaults, loadHistoryFile } from "./data";
import { buildUsdcCohort, proseName, listOf, plural, apy, apyFloorLabel, tvl, venueOf } from "./usdc-hub";
import {
  buildHubCohort,
  byType,
  networks,
  evidence,
  venues,
  strategyTypeOf,
  medianOf,
  article,
  yearOf,
  SINGULAR,
  DUST_TVL,
  type HubCohort,
  type Faq,
  type Takeaway,
  type Risk,
  type Venue,
} from "./long-hub";
import type { YieldVault } from "./types";

// Read from every USDT strategy contract on November 15, 2026
// (profitSharingNumerator + platformFeeNumerator over feeDenominator 10000):
// 700 + 300 on Arbitrum and HyperEVM, 1000 + 500 on Ethereum, 500 + 300 on
// Polygon. Every rate on the page is already net of it.
export const USDT_FEE_TEXT =
  "10% on Arbitrum and HyperEVM, 15% on Ethereum mainnet and 8% on Polygon";

// "USDT yield" and "USDT APY" are the two head terms; the H1 carries both so a
// title rewritten from it still names them.
export const USDT_HUB_H1 = "Best USDT Yield & APY";

export const USDT_APP_URL = "https://app.harvest.finance/?search=usdt&asset=singlestakes";

/** One venue on one network that lists both USDT and USDC strategies. */
export interface PairRow {
  venue: string;
  chain: string;
  usdt: number;
  usdc: number;
  usdtTvl: number;
  usdtSlug: string;
}

export interface UsdcComparison {
  usdcCount: number;
  usdcMedian: number;
  usdcFundedMedian: number;
  usdcBest: { name: string; apy: number; slug: string } | null;
  pairs: PairRow[];
  /** Pairs where USDT paid more than USDC. */
  usdtAhead: number;
  pairUsdtMedian: number;
  pairUsdcMedian: number;
}

const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = s.length / 2;
  return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2;
};

function compareWithUsdc(c: HubCohort, usdc: HubCohort): UsdcComparison {
  const key = (v: YieldVault) => `${venueOf(v)}|${v.chain}`;
  const usdcBy = new Map<string, number[]>();
  // Pooled money markets only. Two Morpho vaults on one network are different
  // curators lending into different markets, so pairing them compares curators,
  // not assets; two Aave or Fluid pools on one network differ only in the asset.
  const pooled = (v: YieldVault) => strategyTypeOf(v) === "money-market";
  for (const v of usdc.all.filter(pooled)) usdcBy.set(key(v), [...(usdcBy.get(key(v)) ?? []), v.apy24h]);
  const pairs: PairRow[] = [];
  for (const v of c.all.filter(pooled)) {
    const u = usdcBy.get(key(v));
    if (!u) continue;
    pairs.push({
      venue: venueOf(v),
      chain: v.chain,
      usdt: v.apy24h,
      usdc: med(u),
      usdtTvl: v.tvl,
      usdtSlug: v.slug,
    });
  }
  pairs.sort((a, b) => b.usdt - a.usdt);
  return {
    usdcCount: usdc.count,
    usdcMedian: usdc.medianApy,
    usdcFundedMedian: medianOf(usdc.funded),
    usdcBest: usdc.best
      ? { name: proseName(usdc.best), apy: usdc.best.apy24h, slug: usdc.best.slug }
      : null,
    pairs,
    usdtAhead: pairs.filter((p) => p.usdt > p.usdc).length,
    pairUsdtMedian: med(pairs.map((p) => p.usdt)),
    pairUsdcMedian: med(pairs.map((p) => p.usdc)),
  };
}

export function venueLine(v: Venue): string {
  if (v.count === 1) {
    return `The ${v.venue} USDT vault held ${tvl(v.tvl)} on ${listOf(v.chains)} and paid ${apy(v.medianApy)}.`;
  }
  return (
    `The ${v.count} ${v.venue} USDT vaults held ${tvl(v.tvl)} on ${listOf(v.chains)} ` +
    `and paid a median of ${apy(v.medianApy)}` +
    (v.minApy.toFixed(2) === v.maxApy.toFixed(2)
      ? "."
      : `, within ${apyFloorLabel(v.minApy)} to ${apy(v.maxApy)}.`)
  );
}

/** The headline sentence's subject, honest about how many rows qualify. */
function bestScope(c: HubCohort): string {
  return c.fundedCount === 1
    ? `the only USDT strategy here holding at least ${tvl(c.fundedFloor)}`
    : `the highest rate among USDT strategies holding at least ${tvl(c.fundedFloor)}`;
}

export const USDT_RISKS_LEAD =
  "Every USDT rate on this page pays for a specific set of exposures, and six of them apply across the index: issuer, freeze, contract, cross-chain, oracle and liquidity risk.";

export const USDT_RISKS: Risk[] = [
  {
    title: "Issuer risk",
    parts: [
      " comes first for any stablecoin. USDT is worth a dollar because Tether says it holds reserves to redeem it, and it publishes them on its ",
      { text: "transparency page", href: "https://tether.to/en/transparency/" },
      ". If the market doubts the reserves, USDT can trade below a dollar whatever the vault does.",
    ],
  },
  {
    title: "Freeze risk",
    parts: [
      " is specific to issuer-controlled tokens. Tether can freeze the USDT held at an address, and has done so at the request of law enforcement, so a balance can be stopped by a decision made off the chain.",
    ],
  },
  {
    title: "Smart-contract risk",
    parts: [
      " sits on the vault and on the lending protocol under it, for as long as a position stays open.",
    ],
  },
  {
    title: "Cross-chain risk",
    parts: [
      " applies to the HyperEVM rows. USDT there is ",
      { text: "USDT0", href: "https://usdt0.to/" },
      ", which is backed one-to-one by USDT on Ethereum and moved between networks by its own contracts, so those contracts add a layer the Ethereum rows do not carry.",
    ],
  },
  {
    title: "Oracle risk",
    parts: [
      " sits on the price feeds that decide when a borrower gets liquidated. A feed that lags or is manipulated lets a loan go under water before the liquidation that should protect the lender fires.",
    ],
  },
  {
    title: "Liquidity risk",
    parts: [
      " shows up first when borrowing spikes. A market keeps only its unborrowed USDT available to withdraw, so the exit narrows for every supplier at once until borrowers repay or the rising rate pulls new supply in.",
    ],
  },
];

export function buildFaqs(
  c: HubCohort,
  cmp: UsdcComparison,
  nets: ReturnType<typeof networks>,
): Faq[] {
  if (!c.best) return [];
  const top = c.all[0];
  const smallCount = c.count - c.fundedCount;
  const st = c.stability;
  const aave = c.all.filter((v) => venueOf(v) === "Aave");
  const hyper = nets.find((n) => n.chain === "HyperEVM");
  const bestNetRaw = [...nets].sort((a, b) => b.medianApy - a.medianApy)[0];

  const list: Faq[] = [
    {
      q: "What is the best USDT yield right now?",
      at: "top",
      a:
        `${apy(c.best.apy24h)} APY on ${proseName(c.best)}, ${bestScope(c)}, ` +
        `holding ${tvl(c.best.tvl)}.` +
        (top.slug !== c.best.slug
          ? ` The highest rate on any row was ${apy(top.apy24h)} on ${proseName(top)}, which ` +
            `held ${tvl(top.tvl)}.`
          : ""),
    },
    {
      q: "Where can I farm USDT?",
      at: "types",
      a:
        `On lending markets that pay USDT interest from borrowers. This index ` +
        `tracked ${c.count} USDT strategies on ${listOf([...c.chains].sort())}, lending into ` +
        `${listOf([...new Set(c.all.map(venueOf))].slice(0, 4))}, and every one autocompounds, ` +
        `so the farming happens inside the vault.`,
    },
    {
      q: "Is USDT farming real?",
      at: "risk",
      a:
        `Yes, when the rate has a borrower behind it. A lending market pays USDT suppliers the ` +
        `interest that borrowers pay, which put the median across the ` +
        `${c.count} USDT strategies here at ${apy(c.medianApy)}. A site promising a fixed daily ` +
        `return far above lending rates, with no named market or contract behind it, has no ` +
        `borrower paying for it.`,
    },
    {
      q: "Does USDT pay more than USDC?",
      at: "compare",
      a: cmp.pairs.length
        ? `On the same venue and network, USDT paid more than USDC in ${cmp.usdtAhead} of ` +
          `${cmp.pairs.length} cases, with a median of ${apy(cmp.pairUsdtMedian)} ` +
          `against ${apy(cmp.pairUsdcMedian)}. Across the whole index, the ${cmp.usdcCount} USDC ` +
          `strategies paid a median of ${apy(cmp.usdcMedian)} and the ${c.count} USDT strategies ` +
          `${apy(c.medianApy)}.`
        : "",
    },
    {
      q: "Which network pays the best USDT yield?",
      at: "network",
      // The highest median can sit on a network whose vaults hold a few
      // dollars, so the answer names the funded rate next to it and says
      // which one has liquidity behind it.
      a: bestNetRaw
        ? `On rate alone, ${bestNetRaw.chain}: its ${bestNetRaw.count} USDT ` +
          `${plural(bestNetRaw.count, "strategy", "strategies")} paid a median of ` +
          `${apy(bestNetRaw.medianApy)}, but held ${tvl(bestNetRaw.tvl)} between ` +
          `them. ` +
          (bestNetRaw.chain === c.best.chain
            ? `The best rate on a strategy holding at least ${tvl(c.fundedFloor)} was also there, `
            : `The best rate on a strategy holding at least ${tvl(c.fundedFloor)} was on ` +
              `${c.best.chain}, `) +
          `${apy(c.best.apy24h)} on ${proseName(c.best)}.`
        : "",
    },
    {
      q: "What is USDT0?",
      at: "network",
      a: hyper
        ? `USDT0 is USDT issued on networks other than Ethereum, backed one-to-one by USDT held ` +
          `on Ethereum. HyperEVM uses it, and the ${hyper.count} HyperEVM strategies tracked here ` +
          `held ${tvl(hyper.tvl)}.`
        : "",
    },
    {
      q: "What does Aave pay on USDT?",
      at: "compare",
      a: aave.length
        ? `${listOf(aave.map((v) => `${apy(v.apy24h)} on ${v.chain}`))}, through ` +
          `the ${plural(aave.length, "vault", "vaults")} tracked here, after the vault's fee. ` +
          `Aave sets one rate for every lender in a market, so the vault's size does not change it.`
        : "",
    },
    {
      q: "How much can I earn on 1,000 USDT?",
      at: "calc",
      a:
        `At ${apy(c.best.apy24h)}, the rate on ${proseName(c.best)}, 1,000 USDT ` +
        `works out to about ${yearOf(1000, c.best.apy24h, 2)} USDT over a year, before any rate ` +
        `change. At the median of ${apy(c.medianApy)}, it works out to about ` +
        `${yearOf(1000, c.medianApy, 2)} USDT.`,
    },
    {
      q: "Is the APY paid in USDT?",
      at: "calc",
      a:
        `Yes. Every rate on this page is earned on a USDT balance and paid in USDT, and any ` +
        `reward token a strategy harvests is sold back into USDT inside the vault, so the ` +
        `balance is the only thing that grows.`,
    },
    {
      q: "Why do most USDT vaults here hold so little?",
      at: "safety",
      a:
        `Most of them are small integrations that few people have entered. ` +
        `${smallCount} of the ${c.count} USDT strategies held under ${tvl(c.fundedFloor)}, and ` +
        `${c.all.filter((v) => v.tvl < DUST_TVL).length} held under ${tvl(DUST_TVL)}. A small ` +
        `vault on a pooled market still earns that market's rate, but its own figure can move ` +
        `more from one harvest to the next.`,
    },
    {
      q: "Why do USDT yields change every day?",
      at: "stability",
      a:
        `A lending rate is set by how much of a market's USDT is borrowed, and borrowing demand ` +
        `for dollars rises when traders lever up and falls when they repay.` +
        (st.measuredCount
          ? ` ${st.steadyCount} of the ${st.measuredCount} USDT strategies with a ` +
            `month of readings had a 30-day swing under one point.`
          : ""),
    },
    {
      q: "What fees do USDT yield vaults charge?",
      at: "calc",
      a:
        `A share of the yield, not of the balance. The vaults on this page keep ${USDT_FEE_TEXT} ` +
        `of the yield each strategy harvests, read from the strategy contracts, and every APY ` +
        `shown is already after that fee. There is no fee to enter or leave a vault; gas is paid ` +
        `on each transaction.`,
    },
    {
      q: "Is USDT yield safe?",
      at: "risk",
      a:
        `No USDT yield is free of risk. A USDT strategy carries Tether's issuer and freeze risk ` +
        `on top of smart-contract, oracle and liquidity risk on the vault and the market under ` +
        `it. ${smallCount} of the ${c.count} USDT strategies held under ` +
        `${tvl(c.fundedFloor)}, so their rates have not been tested by much liquidity.`,
    },
  ];
  return list.filter((f) => f.a);
}

export async function usdtPageModel() {
  const history = loadHistoryFile();
  const live = await getLiveVaults();
  const c = buildHubCohort(live.filter((v) => v.asset === "USDT"), history);
  if (!c.best) return null;
  const usdc = buildUsdcCohort(live.filter((v) => v.asset === "USDC"), history);
  const best = c.best;
  const nets = networks(c);
  const types = byType(c);
  const ev = evidence(c, history);
  const vs = venues(c);
  const cmp = compareWithUsdc(c, usdc);
  const faqs = buildFaqs(c, cmp, nets);
  const dustCount = c.all.filter((v) => v.tvl < DUST_TVL).length;
  const top = c.all[0];

  const heroAnswer =
    `The best USDT yield is ${apy(best.apy24h)} APY on ${proseName(best)}, ${bestScope(c)}` +
    (top.slug === best.slug
      ? `.`
      : `. The highest rate on any row was ${apy(top.apy24h)} on ${proseName(top)}, ` +
        `${article(SINGULAR[strategyTypeOf(top)])} ${SINGULAR[strategyTypeOf(top)]} holding ` +
        `${tvl(top.tvl)}.`);

  const takeaways: Takeaway[] = [
    {
      k: "Best USDT yield now",
      a: `${apy(best.apy24h)} APY on ${proseName(best)}, ${bestScope(c)}.`,
    },
    ...(top.slug !== best.slug
      ? [
          {
            k: "Highest rate on any row",
            a:
              `${apy(top.apy24h)} on ${proseName(top)}, which held ${tvl(top.tvl)}, so the rate ` +
              `has not been tested by much liquidity.`,
          },
        ]
      : []),
    ...(cmp.pairs.length
      ? [
          {
            k: "USDT vs USDC",
            a:
              `On the same venue and network, USDT paid more in ${cmp.usdtAhead} of ` +
              `${cmp.pairs.length} cases, with a median of ${apy(cmp.pairUsdtMedian)} against ` +
              `${apy(cmp.pairUsdcMedian)} for USDC.`,
          },
        ]
      : []),
    {
      k: "Typical rate",
      a:
        `The median was ${apy(c.medianApy)} across all ${c.count} USDT strategies, ` +
        `${dustCount} of which held under ${tvl(DUST_TVL)}.`,
    },
    {
      k: "1,000 USDT for a year",
      a:
        `About ${yearOf(1000, best.apy24h, 2)} USDT at ${apy(best.apy24h)}, paid in USDT, before ` +
        `any change in the rate.`,
    },
    {
      k: "Lockups",
      a:
        `None. A withdrawal needs unborrowed USDT in the market underneath, which is nearly ` +
        `always there and not guaranteed.`,
    },
  ];

  const intro =
    `This page ranks the ${c.count} USDT lending strategies Harvest tracks on ` +
    `${listOf([...c.chains].sort())} by their 24-hour APY. Rates are read from the vault ` +
    `contracts several times a day, are net of fees and are paid in USDT. Most rows are small ` +
    `vaults, so the headline figure uses a ${tvl(c.fundedFloor)} floor: ${c.fundedCount} of the ` +
    `${c.count} strategies cleared it.`;

  const findings = [
    `The ${c.count} USDT strategies tracked here held ${tvl(c.totalTvl)} between them across ` +
      `${c.chainCount} ${plural(c.chainCount, "network", "networks")}, and ${c.fundedCount} of ` +
      `them held at least ${tvl(c.fundedFloor)}.`,
    `The median USDT rate was ${apy(c.medianApy)} across all ${c.count}, of which ${dustCount} ` +
      `held under ${tvl(DUST_TVL)}. The average weighted by TVL was ${apy(c.tvlWeightedApy)}.`,
    ...(cmp.pairs.length
      ? [
          `On the ${cmp.pairs.length} venue and network pairs that list both, USDT paid a median ` +
            `of ${apy(cmp.pairUsdtMedian)} and USDC ${apy(cmp.pairUsdcMedian)}.`,
        ]
      : []),
  ];

  return {
    c,
    best,
    history,
    nets,
    types,
    ev,
    venues: vs,
    cmp,
    faqs,
    dustCount,
    heroAnswer,
    takeaways,
    intro,
    findings,
  };
}

export type UsdtPageModel = NonNullable<Awaited<ReturnType<typeof usdtPageModel>>>;
