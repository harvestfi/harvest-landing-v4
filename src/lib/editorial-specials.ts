// Each asset hub's own comparison for the editorial layout: the fifth pattern,
// one quick answer and one takeaway. ETH against staking, BTC by wrapper,
// USDT against USDC, USDC against the wider market.
import { apy, tvl, proseName } from "./usdc-hub";
import { type HubCohort } from "./long-hub";
import { aprToApy } from "./eth-hub-copy";
import type { StakingReference } from "./eth-hub";
import type { EdSpecial } from "./editorial-hub";
import type { Wrapper } from "./btc-hub-copy";
import type { UsdcComparison } from "./usdt-hub-copy";

const NUM = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const Num = (n: number) => NUM[n] ?? String(n);

export function ethSpecial(c: HubCohort, s: StakingReference | null): EdSpecial {
  if (!s || !c.best) return { quick: null, pattern: null, takeaway: null };
  const rate = aprToApy(s.aprAverage);
  const r = `${rate.toFixed(2)}%`;
  const n = c.top10.length;
  const k = c.top10.filter((v) => v.apy24h > rate).length;
  const lo = c.top10[n - 1];
  const best = c.best;
  return {
    quick: {
      q: "Is ETH lending better than staking?",
      a:
        (k === n
          ? `All top ${n} ETH lending rates beat`
          : k === 0
            ? `None of the top ${n} ETH lending rates beat`
            : `${Num(k)} of the top ${n} ETH lending rates beat`) +
        ` Lido stETH staking at ${r} APY after its fee.`,
    },
    pattern: {
      title:
        k === n
          ? `Every top ${n} ETH lending rate beats staking`
          : k === 0
            ? `Staking pays more than every top ${n} ETH lending rate`
            : `${Num(k)} of the top ${n} ETH lending rates beat staking`,
      body:
        `Lido stETH staking pays ${r} APY after its fee, while the lowest rate in the top ${n} ` +
        `is ${apy(lo.apy24h)}. ` +
        (best.apy24h > rate
          ? `The best funded strategy, ${proseName(best)}, pays ${apy(best.apy24h)}, ` +
            `${(best.apy24h - rate).toFixed(2)} points above staking, so the case for lending over ` +
            `staking rests on the funded strategies near the top.`
          : `The best funded strategy, ${proseName(best)}, pays ${apy(best.apy24h)}, below ` +
            `staking, so the higher lending rates sit on small vaults.`),
    },
    takeaway: {
      k: "Staking benchmark",
      strong: `${r} APY`,
      rest: "from Lido stETH staking, after its fee.",
    },
  };
}

export function btcSpecial(c: HubCohort, ws: Wrapper[]): EdSpecial {
  if (ws.length < 2) return { quick: null, pattern: null, takeaway: null };
  const [hi, lo] = [...ws].sort((a, b) => b.medianApy - a.medianApy);
  const wb = ws.find((w) => w.token === "WBTC") ?? ws[0];
  const cb = ws.find((w) => w.token === "cbBTC") ?? ws[1];
  return {
    quick: {
      q: "Which pays more, WBTC or cbBTC?",
      a:
        `On median, ${hi.token} paid ${apy(hi.medianApy)} across ${hi.count} strategies against ` +
        `${apy(lo.medianApy)} for ${lo.token}. The two differ first in who ` +
        `holds the Bitcoin behind them.`,
    },
    pattern: {
      title: `${hi.token} pays more than ${lo.token} on median`,
      body:
        `The ${hi.count} ${hi.token} strategies paid a median of ${apy(hi.medianApy)} and the ` +
        `${lo.count} ${lo.token} strategies ${apy(lo.medianApy)}. The rate gap comes from how much ` +
        `borrowers want each token on each network, and the choice between them is a choice of ` +
        `custodian first: WBTC rests on a group of regulated custodians, cbBTC on Coinbase.`,
      table: {
        head: ["Wrapper", "Median APY", "Best funded", "Networks", "Strategies", "Tracked"],
        rows: ws.map((w) => ({
          lead: { title: w.token, token: w.token },
          cells: [
            apy(w.medianApy),
            w.bestFunded ? { strong: apy(w.bestFunded.apy24h) } : { strong: "None", dim: true },
            w.chains.join(", "),
            String(w.count),
            tvl(w.tvl),
          ],
        })),
        caption: "BTC strategies by wrapped token. Median APY across every strategy holding the token.",
      },
    },
    takeaway: {
      k: "WBTC vs cbBTC",
      strong: `${apy(wb.medianApy)} vs ${apy(cb.medianApy)}`,
      rest: "median 24-hour APY, WBTC first.",
    },
  };
}

export function usdtSpecial(c: HubCohort, cmp: UsdcComparison): EdSpecial {
  if (!cmp.pairs.length) return { quick: null, pattern: null, takeaway: null };
  const n = cmp.pairs.length;
  const k = cmp.usdtAhead;
  return {
    quick: {
      q: "Does USDT pay more than USDC?",
      a:
        `On the same pooled market and network, USDT paid more in ${k} of ${n} cases, ` +
        `with a median of ${apy(cmp.pairUsdtMedian)} against ` +
        `${apy(cmp.pairUsdcMedian)} for USDC.`,
    },
    pattern: {
      title:
        Math.abs(cmp.pairUsdtMedian - cmp.pairUsdcMedian) < 0.5
          ? "On the same market, USDT and USDC pay about the same"
          : cmp.pairUsdtMedian > cmp.pairUsdcMedian
            ? "On the same market, USDT pays more than USDC"
            : "On the same market, USDC pays more than USDT",
      body:
        `Across the ${n} pooled markets that list both stablecoins on the same network, USDT paid ` +
        `more in ${k} and USDC in ${n - k}, with medians of ${apy(cmp.pairUsdtMedian)} and ` +
        `${apy(cmp.pairUsdcMedian)}. A pooled market pays every supplier the same rate, so a ` +
        `small USDT vault there earns what the market pays, and the pair is a fair test of the ` +
        `two coins.`,
      table: {
        head: ["Market", "Network", "USDT APY", "USDC APY", "USDT vault"],
        rows: cmp.pairs.map((p) => ({
          lead: { title: p.venue, href: `/${p.usdtSlug}` },
          cells: [p.chain, apy(p.usdt), apy(p.usdc), tvl(p.usdtTvl)],
        })),
        caption: "Pooled markets that list both stablecoins on the same network. Curated Morpho vaults are left out.",
      },
    },
    takeaway: {
      k: "USDT vs USDC",
      strong: `${apy(cmp.pairUsdtMedian)} vs ${apy(cmp.pairUsdcMedian)}`,
      rest: "median on the pooled markets that list both.",
    },
  };
}

export function usdcSpecial(c: HubCohort): EdSpecial {
  const b = c.benchmark;
  const r = c.rewards;
  return {
    quick: b
      ? {
          q: "How does this compare with the wider USDC market?",
          a:
            `The largest USDC product we measure outside this ranking, ${b.largestName}, paid ` +
            `${apy(b.largestApy)} holding ${tvl(b.largestTvl)}, against a median of ` +
            `${apy(c.medianApy)} here.`,
        }
      : null,
    pattern: {
      title:
        Math.abs(r.usdcOnlyMedian - r.withRewardMedian) < 0.5
          ? "Reward tokens barely move the USDC median"
          : r.withRewardMedian > r.usdcOnlyMedian
            ? "Reward tokens lift the USDC rate"
            : "Interest-only USDC strategies pay more on median",
      body:
        `${r.usdcOnly.length} of the ${c.count} USDC strategies earn lending interest alone and ` +
        `${r.withReward.length} add a reward token the strategy harvests and sells. Their medians ` +
        `are ${apy(r.usdcOnlyMedian)} and ${apy(r.withRewardMedian)}.` +
        (b
          ? ` For scale, ${b.largestName} paid ${apy(b.largestApy)} on ${tvl(b.largestTvl)}, ` +
            `which is what a much deeper market pays.`
          : ``),
      table: {
        head: ["Rate source", "Reward tokens", "Strategies", "Median APY"],
        rows: [
          {
            lead: { title: "Lending interest only" },
            cells: ["None", String(r.usdcOnly.length), apy(r.usdcOnlyMedian)],
          },
          {
            lead: { title: "Interest plus a reward token" },
            cells: [r.tokens.slice(0, 4).map((t) => t.symbol).join(", "), String(r.withReward.length), apy(r.withRewardMedian)],
          },
        ],
        caption: "USDC strategies by what their rate is made of.",
      },
    },
    takeaway: b
      ? {
          k: "Wider market",
          strong: `${apy(b.largestApy)} APY`,
          rest: `on ${b.largestName}, holding ${tvl(b.largestTvl)}.`,
        }
      : null,
  };
}
