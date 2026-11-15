// The words on /btc, as data.
//
// /btc and /btc.md say the same things, built here without JSX from one
// cohort, the way /eth does it (eth-hub-copy.ts). The questions come from
// Search Console for the page: the head terms ("bitcoin yield", "btc yield",
// "btc apy", "best apy btc") sit around position 15 to 18, and the questions
// below them ask what Bitcoin yield is, how to earn it, which network pays
// best, what cbBTC pays, how WBTC and cbBTC differ and what suits a large
// holder. Each one gets a sentence that answers it with a figure and a date.
import { getLiveVaults, loadHistoryFile } from "./data";
import { proseName, listOf, plural, apy, apyFloorLabel, tvl } from "./usdc-hub";
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

// Read from every BTC strategy contract on November 15, 2026
// (profitSharingNumerator + platformFeeNumerator over feeDenominator 10000):
// 700 + 300 on Base and Arbitrum, 1000 + 500 on Ethereum. The two Autopilot
// vaults have no strategy() to read and are covered by the same schedule in
// the app. Every rate on the page is already net of it.
export const BTC_FEE_TEXT = "10% on Base and Arbitrum and 15% on Ethereum mainnet";

// "Bitcoin yield" carries the most impressions of any BTC query and "BTC APY"
// the second head term, so a title rewritten from the H1 still names both.
export const BTC_HUB_H1 = "Best Bitcoin Yield & BTC APY";

export const BTC_APP_URL = "https://app.harvest.finance/?search=btc&asset=singlestakes";

/** WBTC, cbBTC: the wrapped token a row is denominated in, from its name. */
export const wrapperOf = (v: YieldVault): string => v.productName.split(" ")[0];

export interface Wrapper {
  token: string;
  rows: YieldVault[];
  count: number;
  fundedCount: number;
  medianApy: number;
  bestFunded: YieldVault | null;
  best: YieldVault | null;
  tvl: number;
  chains: string[];
}

export const WRAPPER_ABOUT: Record<string, { issuer: string; href: string; line: string }> = {
  WBTC: {
    issuer: "its custodians",
    href: "https://wbtc.network/",
    line:
      "WBTC is Bitcoin held by regulated custodians and minted one-to-one as an ERC-20 token, which only identity-verified merchants can mint or burn.",
  },
  cbBTC: {
    issuer: "Coinbase",
    href: "https://www.coinbase.com/cbbtc",
    line:
      "cbBTC is Bitcoin held by Coinbase and issued one-to-one as a token on Base and Ethereum, redeemable through a Coinbase account.",
  },
};

export function wrappers(c: HubCohort): Wrapper[] {
  const tokens = [...new Set(c.all.map(wrapperOf))];
  return tokens
    .map((token) => {
      const rows = c.all.filter((v) => wrapperOf(v) === token);
      const funded = rows.filter((v) => v.tvl >= c.fundedFloor);
      return {
        token,
        rows,
        count: rows.length,
        fundedCount: funded.length,
        medianApy: medianOf(rows),
        bestFunded: funded[0] ?? null,
        best: rows[0] ?? null,
        tvl: rows.reduce((s, v) => s + v.tvl, 0),
        chains: [...new Set(rows.map((v) => v.chain))],
      };
    })
    .sort((a, b) => b.tvl - a.tvl);
}

export function wrapperLine(w: Wrapper, c: HubCohort): string {
  return (
    `The ${w.count} ${w.token} ${plural(w.count, "strategy", "strategies")} held ${tvl(w.tvl)} ` +
    `on ${listOf(w.chains)} and paid a median of ${apy(w.medianApy)}` +
    (w.bestFunded
      ? `; the best holding at least ${tvl(c.fundedFloor)} was ${apy(w.bestFunded.apy24h)} on ` +
        `${proseName(w.bestFunded)}.`
      : `; none held ${tvl(c.fundedFloor)} or more.`)
  );
}

export function venueLine(v: Venue): string {
  if (v.count === 1) {
    return `The ${v.venue} BTC vault held ${tvl(v.tvl)} on ${listOf(v.chains)} and paid ${apy(v.medianApy)}.`;
  }
  return (
    `The ${v.count} ${v.venue} BTC vaults held ${tvl(v.tvl)} on ${listOf(v.chains)} ` +
    `and paid a median of ${apy(v.medianApy)}` +
    (v.minApy.toFixed(2) === v.maxApy.toFixed(2)
      ? "."
      : `, within ${apyFloorLabel(v.minApy)} to ${apy(v.maxApy)}.`)
  );
}

export const BTC_RISKS_LEAD =
  "Every BTC rate on this page pays for a specific set of exposures, and six of them apply across the index: custodian, contract, layered contract, oracle, liquidity and size risk.";

export const BTC_RISKS: Risk[] = [
  {
    title: "Custodian risk",
    parts: [
      " comes first for Bitcoin, because no strategy here holds native BTC. Each one holds a wrapped token whose value rests on the Bitcoin a custodian keeps behind it: ",
      { text: "WBTC", href: "https://wbtc.network/" },
      " on a group of regulated custodians and merchants, ",
      { text: "cbBTC", href: "https://www.coinbase.com/cbbtc" },
      " on Coinbase. If a custodian cannot redeem, the token can trade below Bitcoin whatever the vault does.",
    ],
  },
  {
    title: "Smart-contract risk",
    parts: [
      " sits on the vault and on the lending protocol under it, for as long as a position stays open.",
    ],
  },
  {
    title: "Layered contract risk",
    parts: [
      " grows with each wrapper. An allocator or a curated vault passes the BTC through more contracts than a plain money market, and one rate pays for all of them at once.",
    ],
  },
  {
    title: "Oracle risk",
    parts: [
      " sits on the price feeds that decide when a borrower gets liquidated. BTC is mostly posted as collateral, so a feed that lags in a fast market is the path by which a loan goes under water.",
    ],
  },
  {
    title: "Liquidity risk",
    parts: [
      " shows up when borrowing runs close to the limit. A market keeps only its unborrowed BTC available to withdraw, so the exit narrows for every supplier at once until borrowers repay.",
    ],
  },
  {
    title: "Size risk",
    parts: [
      " applies to the smaller rows. A vault holding a few hundred dollars can print a rate that one larger position would dilute, so the page names its headline figure from strategies above a liquidity floor.",
    ],
  },
];

export const BTC_SOURCE_LEAD =
  "Bitcoin pays no yield of its own: there is no staking reward on the Bitcoin network, so every BTC rate on this page is interest that borrowers pay to use wrapped Bitcoin on Ethereum and its layer 2 networks.";

export function buildFaqs(
  c: HubCohort,
  ws: Wrapper[],
  nets: ReturnType<typeof networks>,
  ev: ReturnType<typeof evidence>,
): Faq[] {
  if (!c.best) return [];
  const top = c.all[0];
  const cb = ws.find((w) => w.token === "cbBTC");
  const wb = ws.find((w) => w.token === "WBTC");
  const bestNet = [...nets].filter((n) => n.picks.length).sort((a, b) => b.picks[0].apy24h - a.picks[0].apy24h)[0] ?? null;
  const largest = ev.rows[0] ?? null;
  const smallCount = c.count - c.fundedCount;
  const st = c.stability;

  const list: Faq[] = [
    {
      q: "What is the best Bitcoin yield right now?",
      at: "top",
      a:
        `${apy(c.best.apy24h)} APY, paid in BTC by ${proseName(c.best)}, the ` +
        `highest rate among BTC strategies holding at least ${tvl(c.fundedFloor)}` +
        (top.slug === c.best.slug
          ? `, holding ${tvl(top.tvl)}.`
          : `. The highest rate on any row was ${apy(top.apy24h)} on ${proseName(top)}, which ` +
            `held ${tvl(top.tvl)}.`),
    },
    {
      q: "What is Bitcoin yield?",
      at: "compare",
      a:
        `Bitcoin yield is interest earned on a Bitcoin balance, paid in Bitcoin. Bitcoin itself ` +
        `pays nothing to hold, so the yield comes from lending wrapped Bitcoin, such as WBTC or ` +
        `cbBTC, to borrowers on lending markets. The ${c.count} BTC strategies ` +
        `tracked here paid a median of ${apy(c.medianApy)}.`,
    },
    {
      q: "How do I earn yield on Bitcoin?",
      at: "calc",
      a:
        `Swap or bridge BTC into a wrapped token (cbBTC on Base, WBTC on Arbitrum or Ethereum), ` +
        `then supply it to a lending strategy, which pays interest in the same token. ` +
        `${c.fundedCount} of the ${c.count} BTC strategies tracked here held at least ` +
        `${tvl(c.fundedFloor)}, and the best of them paid ${apy(c.best.apy24h)}.`,
    },
    {
      q: "Which blockchain pays the best Bitcoin yield?",
      at: "network",
      a: bestNet
        ? `${bestNet.chain}: ${proseName(bestNet.picks[0])} paid ` +
          `${apy(bestNet.picks[0].apy24h)}, the highest rate among BTC strategies holding at least ` +
          `${tvl(c.fundedFloor)}. ` +
          listOf(
            nets
              .filter((n) => n.chain !== bestNet.chain)
              .map((n) =>
                n.picks[0]
                  ? `${n.chain}'s best funded rate was ${apy(n.picks[0].apy24h)}`
                  : `no ${n.chain} strategy held ${tvl(c.fundedFloor)} or more`,
              ),
          ) +
          `.`
        : "",
    },
    {
      q: "What is the difference between WBTC and cbBTC?",
      at: "compare",
      a:
        `The custodian. WBTC is backed by Bitcoin held by a group of regulated custodians, and ` +
        `cbBTC by Bitcoin held by Coinbase. Both are one-to-one tokens that lending markets can ` +
        `hold.` +
        (wb && cb
          ? ` The ${wb.count} WBTC strategies tracked here paid a median of ` +
            `${apy(wb.medianApy)} and the ${cb.count} cbBTC strategies ${apy(cb.medianApy)}.`
          : ""),
    },
    {
      q: "What does cbBTC yield?",
      at: "compare",
      a: cb?.best
        ? `${apy((cb.bestFunded ?? cb.best).apy24h)} APY on ${proseName(cb.bestFunded ?? cb.best)}` +
          (cb.bestFunded ? `, the best cbBTC rate among strategies holding at least ${tvl(c.fundedFloor)}` : "") +
          `. The ${cb.count} cbBTC strategies tracked here held ${tvl(cb.tvl)} ` +
          `on ${listOf(cb.chains)} and paid a median of ${apy(cb.medianApy)}.`
        : "",
    },
    {
      q: "How much is held in WBTC and cbBTC strategies?",
      at: "compare",
      a:
        `The BTC strategies tracked here held ${tvl(c.totalTvl)}: ` +
        listOf(ws.map((w) => `${tvl(w.tvl)} in ${w.count} ${w.token} ${plural(w.count, "strategy", "strategies")}`)) +
        `. tBTC and other Bitcoin wrappers are not in this index, so their totals are not measured here.`,
    },
    {
      q: "What is the best Bitcoin yield for large holders?",
      at: "safety",
      a: largest
        ? `For a large position the size of the strategy matters as much as its rate, because ` +
          `a large entry dilutes a small vault's rate. The largest BTC strategy ` +
          `tracked here was ${proseName(largest.vault)}, holding ${tvl(largest.vault.tvl)} at ` +
          `${apy(largest.vault.apy24h)}, and the best rate among strategies holding at least ` +
          `${tvl(c.fundedFloor)} was ${apy(c.best.apy24h)} on ${proseName(c.best)}.`
        : "",
    },
    {
      q: "How much can I earn on 1 BTC?",
      at: "calc",
      a:
        `At the top funded rate of ${apy(c.best.apy24h)}, 1 BTC works out to about ` +
        `${yearOf(1, c.best.apy24h, 5)} BTC over a year, before any rate change. At the median of ` +
        `${apy(c.medianApy)}, it works out to about ${yearOf(1, c.medianApy, 5)} BTC. The yield is ` +
        `paid in BTC, so its dollar value moves with the Bitcoin price.`,
    },
    {
      q: "Is the APY paid in BTC or in dollars?",
      at: "calc",
      a:
        `In BTC. Every rate on this page is earned on a wrapped-Bitcoin balance and paid in the ` +
        `same token, so a 1% APY means the BTC balance grows by about 1% over a year. Its dollar ` +
        `value depends on the Bitcoin price, which the rate says nothing about.`,
    },
    {
      q: "Why is Bitcoin lending yield so low?",
      at: "compare",
      a:
        `Few borrowers need Bitcoin. Most BTC on lending markets is posted as collateral to ` +
        `borrow stablecoins, so BTC markets run at low utilisation and pay their suppliers ` +
        `little. The median across the ${c.count} BTC strategies here was ` +
        `${apy(c.medianApy)}, and BTC rates rise when traders borrow BTC to sell it short.`,
    },
    {
      q: "Why do BTC yields change every day?",
      at: "stability",
      a:
        `A lending rate is set by how much of a market's BTC is borrowed, and that moves with ` +
        `the market.` +
        (st.measuredCount
          ? ` ${st.steadyCount} of the ${st.measuredCount} BTC strategies with a ` +
            `month of readings had a 30-day swing under one point.`
          : ""),
    },
    {
      q: "What fees do BTC yield vaults charge?",
      at: "calc",
      a:
        `A share of the yield, not of the balance. The vaults on this page keep ${BTC_FEE_TEXT} ` +
        `of the yield each strategy harvests, read from the strategy contracts, and every APY ` +
        `shown is already after that fee. There is no fee to enter or leave a vault; gas is paid ` +
        `on each transaction.`,
    },
    {
      q: "Is Bitcoin yield safe?",
      at: "risk",
      a:
        `No Bitcoin yield is free of risk. Every strategy here holds a wrapped token, so it ` +
        `carries the custodian's risk on top of smart-contract, oracle and liquidity risk on the ` +
        `vault and the market under it. ${smallCount} of the ${c.count} BTC ` +
        `strategies held under ${tvl(c.fundedFloor)}, so their rates have not been tested by ` +
        `much liquidity.`,
    },
  ];
  return list.filter((f) => f.a);
}

export async function btcPageModel() {
  const history = loadHistoryFile();
  const c = buildHubCohort(
    (await getLiveVaults()).filter((v) => v.asset === "BTC"),
    history,
  );
  if (!c.best) return null;
  const best = c.best;
  const nets = networks(c);
  const types = byType(c);
  const ev = evidence(c, history);
  const vs = venues(c);
  const ws = wrappers(c);
  const faqs = buildFaqs(c, ws, nets, ev);
  const fMedian = medianOf(c.funded);
  const dustCount = c.all.filter((v) => v.tvl < DUST_TVL).length;
  const top = c.all[0];
  const [w1, w2] = ws;
  const bestNet = [...nets].filter((n) => n.picks.length).sort((a, b) => b.picks[0].apy24h - a.picks[0].apy24h)[0] ?? null;

  const heroAnswer =
    `The best Bitcoin yield is ${apy(best.apy24h)} APY, paid in BTC by ${proseName(best)}, ` +
    `the highest rate among BTC strategies holding at least ${tvl(c.fundedFloor)}` +
    (top.slug === best.slug
      ? `.`
      : `. The highest rate on any row was ${apy(top.apy24h)} on ${proseName(top)}, ` +
        `${article(SINGULAR[strategyTypeOf(top)])} ${SINGULAR[strategyTypeOf(top)]} holding ` +
        `${tvl(top.tvl)}.`);

  const takeaways: Takeaway[] = [
    {
      k: "Best Bitcoin yield now",
      a:
        `${apy(best.apy24h)} APY on ${proseName(best)}, the highest rate among BTC strategies ` +
        `holding at least ${tvl(c.fundedFloor)}.`,
    },
    {
      k: "Where it comes from",
      a:
        `Borrowers. Bitcoin pays nothing to hold, so the rate is interest on wrapped Bitcoin ` +
        `(WBTC or cbBTC) lent on Ethereum and its layer 2 networks.`,
    },
    ...(w1 && w2
      ? [
          {
            k: "WBTC vs cbBTC",
            a:
              `The ${w1.count} ${w1.token} strategies paid a median of ${apy(w1.medianApy)} ` +
              `against ${apy(w2.medianApy)} on the ${w2.count} ${w2.token} strategies.`,
          },
        ]
      : []),
    ...(bestNet
      ? [
          {
            k: "Best network",
            a:
              `${bestNet.chain}, where ${proseName(bestNet.picks[0])} paid ` +
              `${apy(bestNet.picks[0].apy24h)} among strategies holding at least ${tvl(c.fundedFloor)}.`,
          },
        ]
      : []),
    {
      k: "Typical rate",
      a:
        `The median was ${apy(fMedian)} across the ${c.fundedCount} strategies holding at least ` +
        `${tvl(c.fundedFloor)}, and ${apy(c.medianApy)} across all ${c.count}.`,
    },
    {
      k: "1 BTC for a year",
      a:
        `About ${yearOf(1, best.apy24h, 5)} BTC at ${apy(best.apy24h)}, paid in BTC, before any ` +
        `change in the rate.`,
    },
    {
      k: "Lockups",
      a:
        `None. A withdrawal needs unborrowed BTC in the market underneath, which is nearly ` +
        `always there because few borrowers take BTC.`,
    },
  ];

  const intro =
    `This page ranks the ${c.count} BTC lending strategies Harvest tracks on ` +
    `${listOf([...c.chains].sort())} by their 24-hour APY. Rates are read from the vault ` +
    `contracts several times a day, are net of fees and are paid in the wrapped Bitcoin each ` +
    `strategy holds. The table includes small vaults, so the figures above use a ` +
    `${tvl(c.fundedFloor)} floor: ${c.fundedCount} of the ${c.count} strategies cleared it.`;

  const findings = [
    `The ${c.count} BTC strategies tracked here held ${tvl(c.totalTvl)} between them across ` +
      `${c.chainCount} ${plural(c.chainCount, "network", "networks")}, and ${c.fundedCount} of ` +
      `them held at least ${tvl(c.fundedFloor)}.`,
    `The median BTC rate was ${apy(fMedian)} across the ${c.fundedCount} strategies holding at ` +
      `least ${tvl(c.fundedFloor)}, and ${apy(c.medianApy)} across all ${c.count}, of which ` +
      `${dustCount} held under ${tvl(DUST_TVL)}. The average weighted by TVL was ` +
      `${apy(c.tvlWeightedApy)}.`,
    ...ws.map((w) => wrapperLine(w, c)),
  ];

  return {
    c,
    best,
    history,
    nets,
    types,
    ev,
    venues: vs,
    wrappers: ws,
    faqs,
    fMedian,
    dustCount,
    heroAnswer,
    takeaways,
    intro,
    findings,
  };
}

export type BtcPageModel = NonNullable<Awaited<ReturnType<typeof btcPageModel>>>;
