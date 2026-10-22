#!/usr/bin/env node
// ETH staking reference rate for /eth: Lido stETH APR, read on-chain.
//
// /eth ranks lending and vault strategies, and readers keep asking how those
// compare with staking. The answer needs a staking figure with a source and a
// date, so this reads one straight from Lido's contract rather than quoting an
// aggregator: every daily oracle report emits TokenRebased on the stETH token
// with the total pooled ETH and total shares before and after the report. The
// change in ETH per share over the report's timeElapsed is the APR stETH
// holders received, after Lido's fee (the fee is minted as new shares, so it
// is already out of the post-report share rate). This is the formula in Lido's
// own APR documentation, and the 7-report mean is the figure Lido's site
// shows as its 7-day average.
//
// Writes data/eth-staking-reference.json only when a new report landed, so
// the commit guard in the workflow stays quiet otherwise. Refuses to write
// anything it cannot verify: too few reports, or an APR outside a sane band,
// leaves the previous file in place and exits non-zero.
//
//   node scripts/fetch-eth-staking-reference.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "data", "eth-staking-reference.json");

const STETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
// keccak256("TokenRebased(uint256,uint256,uint256,uint256,uint256,uint256,uint256)")
const TOKEN_REBASED = "0xff08c3ef606d198e316ef5b822193c489965899eb4e3c248cea1a4626c3eda50";

const RPCS = (process.env.RPC_ETHEREUM ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .concat([
    "https://ethereum-rpc.publicnode.com",
    "https://eth.drpc.org",
    "https://1rpc.io/eth",
    "https://eth.merkle.io",
    "https://rpc.mevblocker.io",
  ]);

const SECONDS_PER_YEAR = 365n * 24n * 3600n;
const WINDOW = 7;
// ~7,200 blocks a day; nine days covers seven daily reports with room for a
// late or skipped one.
const LOOKBACK_BLOCKS = 9 * 7200;
const CHUNK = 2000;

async function rpc(method, params) {
  const errors = [];
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(20_000),
      });
      const text = await res.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${res.status}, not JSON`);
      }
      if (j.error) throw new Error(j.error.message);
      return j.result;
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }
  throw new Error(`${method} failed on every RPC:\n  ${errors.join("\n  ")}`);
}

const word = (data, i) => BigInt("0x" + data.slice(2 + i * 64, 2 + (i + 1) * 64));

/** APR in percent, Lido's formula, at 1e27 precision. */
function aprOf(log) {
  const timeElapsed = word(log.data, 0);
  const preShares = word(log.data, 1);
  const preEther = word(log.data, 2);
  const postShares = word(log.data, 3);
  const postEther = word(log.data, 4);
  const E27 = 10n ** 27n;
  const pre = (preEther * E27) / preShares;
  const post = (postEther * E27) / postShares;
  // percent with 6 decimals
  const scaled = (SECONDS_PER_YEAR * (post - pre) * 100_000_000n) / (pre * timeElapsed);
  return { apr: Number(scaled) / 1e6, timeElapsed: Number(timeElapsed) };
}

const latest = parseInt(await rpc("eth_blockNumber", []), 16);
const logs = [];
for (let from = latest - LOOKBACK_BLOCKS; from <= latest; from += CHUNK) {
  const to = Math.min(from + CHUNK - 1, latest);
  const got = await rpc("eth_getLogs", [
    {
      address: STETH,
      topics: [TOKEN_REBASED],
      fromBlock: "0x" + from.toString(16),
      toBlock: "0x" + to.toString(16),
    },
  ]);
  logs.push(...got);
}

const reports = logs
  .map((l) => ({
    reportTimestamp: Number(BigInt(l.topics[1])),
    block: parseInt(l.blockNumber, 16),
    tx: l.transactionHash,
    ...aprOf(l),
  }))
  .sort((a, b) => a.reportTimestamp - b.reportTimestamp)
  .slice(-WINDOW);

if (reports.length < 5) {
  console.error(`[staking] only ${reports.length} Lido reports in the last ${LOOKBACK_BLOCKS} blocks; not writing.`);
  process.exit(1);
}
const bad = reports.find((r) => !(r.apr > -5 && r.apr < 20));
if (bad) {
  console.error(`[staking] report ${bad.tx} gives ${bad.apr}% APR, outside the sane band; not writing.`);
  process.exit(1);
}

const round = (n) => Math.round(n * 10_000) / 10_000;
const iso = (s) => new Date(s * 1000).toISOString();
const out = {
  name: "Lido stETH APR",
  source: "Lido stETH TokenRebased events on Ethereum mainnet",
  contract: STETH,
  method:
    "Change in pooled ETH per stETH share across each daily oracle report, annualised over the report's timeElapsed (Lido's documented APR formula). Net of Lido's fee.",
  aprAverage: round(reports.reduce((s, r) => s + r.apr, 0) / reports.length),
  aprLatest: round(reports[reports.length - 1].apr),
  reportCount: reports.length,
  fromIso: iso(reports[0].reportTimestamp),
  asOfIso: iso(reports[reports.length - 1].reportTimestamp),
  reports: reports.map((r) => ({ ...r, apr: round(r.apr), reportIso: iso(r.reportTimestamp) })),
};

if (existsSync(OUT)) {
  const prev = JSON.parse(readFileSync(OUT, "utf-8"));
  if (prev.reports?.at(-1)?.tx === out.reports.at(-1).tx) {
    console.log(`[staking] no new Lido report since ${prev.asOfIso}; unchanged.`);
    process.exit(0);
  }
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(
  `[staking] stETH APR ${out.aprAverage}% (mean of ${out.reportCount} reports to ${out.asOfIso}), latest ${out.aprLatest}%`,
);
console.log(JSON.stringify(out));
