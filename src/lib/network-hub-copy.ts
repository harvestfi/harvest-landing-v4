// The words on the network hubs (/base, /arbitrum, /ethereum, /hyperevm), as
// data, on the /eth formula (see long-hub.ts and editorial-hub.ts).
//
// The network hubs match the depth of /usdc and /eth, open with the answer
// and carry sections for the questions people bring. Search Console shows
// what those are: the TVL
// of the network ("base tvl", "arbitrum tvl", "tvl arbitrum"), "<network>
// yield", and "the best places to earn yield on HyperEVM". Each gets an
// answer from the cohort, with the network's own facts (how it settles, what
// a transaction costs, how money gets there, what can go wrong) kept here.
import { getLiveVaults, loadHistoryFile } from "./data";
import { proseName, listOf, plural, apy, apyFloorLabel, tvl } from "./usdc-hub";
import {
  buildHubCohort,
  byType,
  evidence,
  venues,
  medianOf,
  isAutopilot,
  DUST_TVL,
  type HubCohort,
  type Faq,
  type Risk,
  type Venue,
} from "./long-hub";
import type { YieldVault } from "./types";

export interface NetworkFacts {
  chain: string;
  slug: string;
  display: string;
  /** "a layer 2 rollup" etc., for sentences. */
  kindLine: string;
  isL2: boolean;
  /** Harvest's fee on these strategies, read from the strategy contracts. */
  feeText: string;
  gasLine: string;
  /** How assets usually reach the network. */
  arriveLine: string;
  risks: Risk[];
}

const COMMON_RISKS: Risk[] = [
  {
    title: "Smart-contract risk",
    parts: [" sits on the vault and on the lending protocol under it, for as long as a position stays open."],
  },
  {
    title: "Layered contract risk",
    parts: [
      " grows with each wrapper. An allocator or a curated vault passes funds through more contracts than a plain money market, and one rate pays for all of them at once.",
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
      " shows up when borrowing runs close to the limit. A market keeps only its unborrowed funds available to withdraw, so the exit narrows for every supplier at once until borrowers repay.",
    ],
  },
];

const ROLLUP_RISK = (who: string): Risk => ({
  title: "Network risk",
  parts: [
    ` is the layer a rollup adds. Transactions are ordered by a sequencer that ${who} runs, so an outage pauses the network for everyone, and moving funds back to Ethereum through the native bridge waits out a challenge period of about a week.`,
  ],
});

export const NETWORK_FACTS: Record<string, NetworkFacts> = {
  Base: {
    chain: "Base",
    slug: "base",
    display: "Base",
    kindLine: "an Ethereum layer 2 rollup built by Coinbase on the OP Stack",
    isL2: true,
    feeText: "10%",
    gasLine: "A transaction on Base usually costs a few cents, so entering and leaving a small position is worth it.",
    arriveLine:
      "Coinbase can send USDC, ETH and cbBTC straight to Base, and the native bridge or any major bridge brings funds over from Ethereum.",
    risks: [ROLLUP_RISK("Coinbase"), ...COMMON_RISKS],
  },
  Arbitrum: {
    chain: "Arbitrum",
    slug: "arbitrum",
    display: "Arbitrum",
    kindLine: "an Ethereum optimistic rollup run by Offchain Labs",
    isL2: true,
    feeText: "10%",
    gasLine: "A transaction on Arbitrum usually costs a few cents, so entering and leaving a small position is worth it.",
    arriveLine:
      "Most large exchanges send USDC, USDT and ETH straight to Arbitrum, and the native bridge brings funds over from Ethereum.",
    risks: [ROLLUP_RISK("Offchain Labs"), ...COMMON_RISKS],
  },
  Ethereum: {
    chain: "Ethereum",
    slug: "ethereum",
    display: "Ethereum",
    kindLine: "Ethereum mainnet, the network every rollup in this index settles to",
    isL2: false,
    feeText: "15%",
    gasLine:
      "A transaction on Ethereum mainnet can cost several dollars when the network is busy, so a small position can spend more on gas than it earns in a year.",
    arriveLine: "Every major exchange sends assets straight to Ethereum mainnet; no bridge is needed.",
    risks: [
      {
        title: "Gas cost",
        parts: [
          " is the cost Ethereum mainnet adds. Entering and leaving a position costs more here than on a rollup, which matters most on a small balance.",
        ],
      },
      ...COMMON_RISKS,
    ],
  },
  HyperEVM: {
    chain: "HyperEVM",
    slug: "hyperevm",
    display: "HyperEVM",
    kindLine: "the EVM environment on Hyperliquid's own chain",
    isL2: false,
    feeText: "10%",
    gasLine: "A transaction on HyperEVM costs a fraction of a cent to a few cents.",
    arriveLine:
      "Assets reach HyperEVM through bridges: USDT arrives as USDT0, and USDC and other assets through Hyperliquid's own bridging.",
    risks: [
      {
        title: "Network risk",
        parts: [
          " is higher on a younger chain. HyperEVM has less history than Ethereum and its rollups, and most of its assets arrive through bridges, so a bridge failure can reach a position that did nothing wrong.",
        ],
      },
      ...COMMON_RISKS,
    ],
  },
  Polygon: {
    chain: "Polygon",
    slug: "polygon",
    display: "Polygon",
    kindLine: "an EVM-compatible proof-of-stake network that checkpoints to Ethereum",
    isL2: false,
    feeText: "8%",
    gasLine: "Transactions on Polygon are paid in POL and usually cost a fraction of a cent.",
    arriveLine:
      "Most large exchanges send USDC and USDT straight to Polygon, and the Polygon bridge brings funds over from Ethereum.",
    risks: [
      {
        title: "Network risk",
        parts: [
          " is Polygon's own. Polygon PoS is secured by its own validator set and checkpoints to Ethereum, and assets bridged in, such as USDC.e, also carry the bridge's risk.",
        ],
      },
      ...COMMON_RISKS,
    ],
  },
};

const ASSET_HUBS = new Set(["USDC", "USDT", "ETH", "BTC"]);

export interface AssetRow {
  asset: string;
  rows: YieldVault[];
  funded: YieldVault[];
  tvl: number;
  median: number;
}

export function byAsset(c: HubCohort): AssetRow[] {
  return [...new Set(c.all.map((v) => v.asset))]
    .map((asset) => {
      const rows = c.all.filter((v) => v.asset === asset);
      return {
        asset,
        rows,
        funded: rows.filter((v) => v.tvl >= c.fundedFloor),
        tvl: rows.reduce((s, v) => s + v.tvl, 0),
        median: medianOf(rows),
      };
    })
    .sort((a, b) => b.tvl - a.tvl);
}

export function assetLine(a: AssetRow, c: HubCohort, display: string): string {
  return (
    `${a.asset}: ${a.rows.length} ${plural(a.rows.length, "strategy", "strategies")} on ${display} ` +
    `held ${tvl(a.tvl)} and paid a median of ${apy(a.median)}` +
    (a.funded[0]
      ? `; the best holding at least ${tvl(c.fundedFloor)} was ${apy(a.funded[0].apy24h)} on ` +
        `${proseName(a.funded[0])}.`
      : `; none held ${tvl(c.fundedFloor)} or more.`)
  );
}

export function venueLine(v: Venue, display: string): string {
  if (v.count === 1) {
    return `The ${v.venue} vault on ${display} held ${tvl(v.tvl)} and paid ${apy(v.medianApy)}.`;
  }
  return (
    `The ${v.count} ${v.venue} vaults on ${display} held ${tvl(v.tvl)} and paid a median of ` +
    `${apy(v.medianApy)}` +
    (v.minApy.toFixed(2) === v.maxApy.toFixed(2)
      ? "."
      : `, within ${apyFloorLabel(v.minApy)} to ${apy(v.maxApy)}.`)
  );
}

export type NetSpot = "assets" | "venue" | "safety" | "start" | "stability" | "risk" | "top";

function buildFaqs(f: NetworkFacts, c: HubCohort, assets: AssetRow[], vs: Venue[]): Faq[] {
  if (!c.best || !c.bestRaw) return [];
  const d = f.display;
  const top = c.bestRaw;
  const best = c.best;
  const topVenue = vs[0];
  const st = c.stability;
  const small = c.count - c.fundedCount;
  const list: Faq[] = [
    {
      q: `What is the best yield on ${d} right now?`,
      at: "top",
      a:
        `${apy(best.apy24h)} APY on ${proseName(best)}, the highest rate among strategies on ${d} ` +
        `holding at least ${tvl(c.fundedFloor)}` +
        (top.slug === best.slug
          ? `.`
          : `. The highest rate on any row was ${apy(top.apy24h)} on ${proseName(top)}, which ` +
            `held ${tvl(top.tvl)}.`),
    },
    {
      q: `What is the TVL on ${d}?`,
      at: "assets",
      a:
        `The strategies tracked here hold ${tvl(c.totalTvl)} across ${c.count} vaults on ${d}. That ` +
        `is the value in these vaults, not the total value locked on ${d} as a whole, which public ` +
        `dashboards such as DefiLlama report across every protocol on the network.`,
    },
    {
      q: `Which assets earn the most on ${d}?`,
      at: "assets",
      a:
        listOf(
          assets
            .filter((a) => a.funded[0])
            .slice(0, 3)
            .map((a) => `${a.asset} at ${apy(a.funded[0].apy24h)}`),
        ) +
        (assets.some((a) => a.funded[0])
          ? ` were the best rates among strategies holding at least ${tvl(c.fundedFloor)}. `
          : `No strategy on ${d} held ${tvl(c.fundedFloor)} or more. `) +
        `Stablecoins usually pay more than ETH or BTC, because borrowers mostly want dollars.`,
    },
    {
      q: `Which protocols pay the highest yield on ${d}?`,
      at: "venue",
      a: topVenue
        ? `By median rate, ${listOf(
            [...vs]
              .sort((a, b) => b.medianApy - a.medianApy)
              .slice(0, 3)
              .map((v) => `${v.venue} at ${apy(v.medianApy)}`),
          )}. ${topVenue.venue} holds the most here, ${tvl(topVenue.tvl)} across ${topVenue.count} ` +
          `${plural(topVenue.count, "vault", "vaults")}.`
        : "",
    },
    {
      q: `What does a transaction on ${d} cost?`,
      at: "start",
      a: `${f.gasLine} The rates on this page are already net of the vault's fee; gas is paid on top.`,
    },
    {
      q: `How do I start earning yield on ${d}?`,
      at: "start",
      a:
        `${f.arriveLine} From there, pick a strategy from the ranking and enter it in the Harvest ` +
        `app; the vault compounds on its own and the position can be withdrawn at any time the ` +
        `market underneath has funds to pay out.`,
    },
    {
      q: `What fees do vaults on ${d} charge?`,
      at: "start",
      a:
        `A share of the yield, not of the balance. The strategy vaults on ${d} keep ${f.feeText} of ` +
        `the yield they harvest, read from the strategy contracts, and every APY shown is already ` +
        `after that fee. There is no fee to enter or leave a vault.`,
    },
    {
      q: `Why do rates on ${d} change every day?`,
      at: "stability",
      a:
        `A lending rate is set by how much of a market is borrowed, and borrowing demand moves ` +
        `with the market.` +
        (st.measuredCount
          ? ` ${st.steadyCount} of the ${st.measuredCount} strategies on ${d} with a month of ` +
            `readings had a 30-day swing under one point.`
          : ""),
    },
    {
      q: `Is yield on ${d} safe?`,
      at: "risk",
      a:
        `No yield is free of risk. Every strategy on ${d} carries smart-contract, oracle and ` +
        `liquidity risk on the vault and the market under it, plus the risks of ${d} itself. ` +
        `${small} of the ${c.count} strategies here held under ${tvl(c.fundedFloor)}, so their ` +
        `rates have not been tested by much liquidity.`,
    },
  ];
  if (f.chain === "HyperEVM") {
    list.push({
      q: "What are the best places to earn yield on HyperEVM?",
      at: "top",
      a:
        `Among the strategies tracked here, ${listOf(
          c.all.slice(0, 3).map((v) => `${proseName(v)} at ${apy(v.apy24h)}`),
        )} paid the most, and ${proseName(best)} paid ${apy(best.apy24h)} among those holding at ` +
        `least ${tvl(c.fundedFloor)}. Each row names the lending protocol it uses.`,
    });
  }
  return list.filter((x) => x.a);
}

export async function networkPageModel(chain: string) {
  const f = NETWORK_FACTS[chain];
  if (!f) return null;
  const history = loadHistoryFile();
  const c = buildHubCohort(
    (await getLiveVaults()).filter((v) => v.chain === chain),
    history,
  );
  if (!c.best) return null;
  const assets = byAsset(c);
  const vs = venues(c);
  const types = byType(c);
  const ev = evidence(c, history);
  const faqs = buildFaqs(f, c, assets, vs);
  const autopilotCount = c.all.filter(isAutopilot).length;
  const dustCount = c.all.filter((v) => v.tvl < DUST_TVL).length;
  return { f, c, history, assets, venues: vs, types, ev, faqs, autopilotCount, dustCount };
}

export type NetworkPageModel = NonNullable<Awaited<ReturnType<typeof networkPageModel>>>;
export const assetHubHref = (asset: string) => (ASSET_HUBS.has(asset) ? `/${asset.toLowerCase()}` : null);
