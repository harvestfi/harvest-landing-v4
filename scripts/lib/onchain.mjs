// Direct on-chain readers for the XRP yield report, replacing the DeFiLlama
// feed with values derived straight from public chain state (Base + Flare).
//
// Why: DeFiLlama's terms restrict commercial republishing, and for some venues
// its APY does not match what actually accrues on-chain. Raw chain state is
// nobody's proprietary dataset, covers Flare (which Portals does not), and is
// verifiable. All reads go through allowlisted JSON-RPC endpoints; the nodes
// are archive nodes, so the same reads at historical blocks reconstruct the
// daily series and the 30-day mean.
//
// No web3 library: we hand-encode calldata with hardcoded 4-byte selectors
// (verified on-chain) and decode 32-byte words directly. keccak is not needed.

const SECONDS_PER_YEAR = 31_536_000;

// Primary RPC first, explorer JSON-RPC as fallback. Both are archive + on the
// egress allowlist. Direct RPCs are faster for bulk/historical reads.
const CHAINS = {
  base: {
    id: 8453,
    rpcs: ["https://mainnet.base.org", "https://base.blockscout.com/api/eth-rpc"],
    blockSec: 2,
  },
  flare: {
    id: 14,
    rpcs: [
      "https://flare-api.flare.network/ext/C/rpc",
      "https://flare-explorer.flare.network/api/eth-rpc",
    ],
    blockSec: 1.155,
  },
};

// ---- low-level RPC -------------------------------------------------------

async function rpc(chain, method, params) {
  const c = CHAINS[chain];
  if (!c) throw new Error(`unknown chain ${chain}`);
  let lastErr;
  for (const url of c.rpcs) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (j.error) throw new Error(`${method}: ${j.error.message ?? JSON.stringify(j.error)}`);
        return j.result;
      } catch (e) {
        lastErr = e;
        await new Promise((res) => setTimeout(res, 250 * (attempt + 1)));
      }
    }
  }
  throw lastErr ?? new Error(`rpc ${method} failed`);
}

// eth_call at latest or a specific block (number or hex tag).
export async function ethCall(chain, to, data, block = "latest") {
  const tag = typeof block === "number" ? "0x" + block.toString(16) : block;
  return rpc(chain, "eth_call", [{ to, data }, tag]);
}

export async function blockNumber(chain) {
  return parseInt(await rpc(chain, "eth_blockNumber", []), 16);
}

// Uniswap-v3 / Aerodrome-CL / Algebra Swap event topic0 (all share it).
export const SWAP_TOPIC =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

// eth_getLogs over a wide range, chunked to each provider's window cap. The
// explorer JSON-RPC allows big windows (Flare ~100k); Base's public RPC caps at
// 10k blocks but never truncates results, so we chunk conservatively.
export async function getLogs(chain, address, topic0, fromBlock, toBlock) {
  const c = CHAINS[chain];
  // Flare: Blockscout endpoint (big windows). Base: primary RPC (10k windows).
  const url = chain === "flare" ? c.rpcs[1] : c.rpcs[0];
  const span = chain === "flare" ? 90_000 : 9_500;
  const out = [];
  for (let from = fromBlock; from <= toBlock; from += span + 1) {
    const to = Math.min(from + span, toBlock);
    const params = [
      {
        address,
        topics: topic0 ? [topic0] : [],
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
      },
    ];
    let logs;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params }),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error.message);
        logs = j.result;
        break;
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise((res) => setTimeout(res, 300 * (attempt + 1)));
      }
    }
    if (logs && logs.length) out.push(...logs);
  }
  return out;
}

async function blockTimestamp(chain, block) {
  const tag = typeof block === "number" ? "0x" + block.toString(16) : block;
  const b = await rpc(chain, "eth_getBlockByNumber", [tag, false]);
  return b ? parseInt(b.timestamp, 16) : null;
}

// Find the block whose timestamp is closest to `targetTs`, by seeding from the
// average block time then binary-searching a small window. Archive nodes make
// this exact; a few RPC calls per lookup.
export async function blockAtTimestamp(chain, targetTs) {
  const head = await blockNumber(chain);
  const headTs = await blockTimestamp(chain, head);
  if (headTs == null) throw new Error("no head timestamp");
  if (targetTs >= headTs) return head;
  const c = CHAINS[chain];
  let guess = Math.max(1, head - Math.floor((headTs - targetTs) / c.blockSec));
  // Bound a search window around the guess, then binary search.
  let lo = 1;
  let hi = head;
  // Tighten bounds using the guess to cut iterations.
  const gTs = await blockTimestamp(chain, guess);
  if (gTs != null) {
    if (gTs < targetTs) lo = guess;
    else hi = guess;
  }
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    const ts = await blockTimestamp(chain, mid);
    if (ts == null) break;
    if (ts < targetTs) lo = mid;
    else hi = mid;
  }
  return lo;
}

// UTC day (YYYY-MM-DD) -> approx block at 00:00Z of that day.
export function daysAgoTs(days) {
  const now = Math.floor(GENESIS_NOW() / 1000);
  return now - days * 86400;
}
// Date.now() is banned in workflow scripts but this is a plain build script;
// still, isolate it so tests can stub it.
function GENESIS_NOW() {
  return Date.now();
}

// ---- ABI encode / decode -------------------------------------------------

const strip = (h) => (h && h.startsWith("0x") ? h.slice(2) : h || "");
export const word = (hex, i) => "0x" + strip(hex).slice(i * 64, i * 64 + 64);
export const toBig = (hex) => {
  const s = strip(hex);
  return s ? BigInt("0x" + s) : 0n;
};
// signed 256-bit
export const toInt = (hex) => {
  const v = toBig(hex);
  return v >> 255n ? v - (1n << 256n) : v;
};
export const encUint = (v) => BigInt(v).toString(16).padStart(64, "0");
export const encAddr = (a) => strip(a).toLowerCase().padStart(64, "0");
export const encInt = (v) => {
  let b = BigInt(v);
  if (b < 0n) b += 1n << 256n;
  return b.toString(16).padStart(64, "0");
};
export const call = (sig4, ...args) => sig4 + args.join("");

// Common selectors (all verified on-chain by the research pass).
export const SEL = {
  // ERC20 / shared
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
  decimals: "0x313ce567",
  // Compound-fork cToken
  supplyRatePerTimestamp: "0xd3bd2c72",
  exchangeRateStored: "0x182df0f5",
  totalBorrows: "0x47bd3718",
  totalReserves: "0x8f840ddd",
  getCash: "0x3b1d21a2",
  comptroller: "0x5fe3b567",
  underlying: "0x6f307dc3",
  // oracle
  oracle: "0x7dc0d1d0",
  getUnderlyingPrice: "0xfc57d4df",
  getEtherPrice: "0xca7c4dba",
  // Kinetic rewards
  supplyRewardSpeeds: "0xcf9cfb61", // (uint8 rewardType, address market)
  // Moonwell rewards
  rewardDistributor: "0xacc2166a",
  getAllMarketConfigs: "0x7e218f90", // (address market)
  // ERC4626 / Morpho VaultV2
  totalAssets: "0x01e1d114",
  convertToAssets: "0x07a2d13a", // (uint256 shares)
  asset: "0x38d52e0f",
  // Flare FTSO
  getContractAddressByName: "0x82760fca", // registry (string)
  getFeedById: "0x93e9f806", // FtsoV2 (bytes21)
  getFeedByIdInWei: "0x59feadf6",
  // DEX / pool
  getReserves: "0x0902f1ac",
  slot0: "0x3850c7bd",
  liquidity: "0x1a686502",
  fee: "0xddca3f43",
  // Aerodrome
  getPool: "0x28af8d0b", // factory (address,address,int24)
  gauges: "0xb9a09fd5", // voter (address)
  rewardRate: "0x7b0a47ee",
  rewardRateByEpoch: "0x94af5b63", // (uint256 epochStart)
  // Chainlink
  latestRoundData: "0xfeaf968c",
};

// Convenience: eth_call returning a single uint256.
export async function callUint(chain, to, data, block = "latest") {
  return toBig(await ethCall(chain, to, data, block));
}

// APY from a Compound per-second supply rate (1e18-scaled), compounded.
export function ratePerSecToApy(ratePerSec1e18) {
  const r = Number(ratePerSec1e18) / 1e18;
  return (Math.pow(1 + r, SECONDS_PER_YEAR) - 1) * 100;
}

export { SECONDS_PER_YEAR, CHAINS };
