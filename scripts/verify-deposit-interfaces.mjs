#!/usr/bin/env node
// Reads each vault's deposit interface from chain state and writes
// data/deposit-interfaces.json, which the agent Markdown pages read to decide
// whether to print call-level deposit steps.
//
// Wrong steps can lose a user's funds, so steps are printed only for a vault
// whose interface was confirmed here. Anything that fails a check, or any RPC
// failure, comes out "unverified" and its page links the Harvest app instead.
//
//   erc4626        asset() == tokenAddress, decimals() readable,
//                  previewDeposit(1 token) > 0. maxDeposit(0x..dEaD) == 0
//                  records deposits as closed.
//   harvest-vault  underlying() == tokenAddress, getPricePerFullShare() and
//                  decimals() readable.
//
// Runs from a scheduled workflow, never inside the site build, so a build
// does not depend on RPC availability.
//
//   node scripts/verify-deposit-interfaces.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SEL, word, toBig, encUint, encAddr, call } from "./lib/onchain.mjs";

const ROOT = process.cwd();
const VAULTS = JSON.parse(readFileSync(join(ROOT, "data", "vaults.json"), "utf-8"));
const OUT = join(ROOT, "data", "deposit-interfaces.json");

// Endpoints this repo already reads from. Each must report the expected chain
// ID before anything it says is trusted.
const CHAINS = {
  Ethereum: { id: 1, rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.blockscout.com/api/eth-rpc"] },
  Base: { id: 8453, rpcs: ["https://mainnet.base.org", "https://base-rpc.publicnode.com", "https://base.blockscout.com/api/eth-rpc"] },
  Arbitrum: { id: 42161, rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"] },
  Polygon: { id: 137, rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon.blockscout.com/api/eth-rpc"] },
  zkSync: { id: 324, rpcs: ["https://mainnet.era.zksync.io"] },
  HyperEVM: { id: 999, rpcs: ["https://rpc.hyperliquid.xyz/evm"] },
};

const S = {
  ...SEL,
  previewDeposit: "0xef8b30f7", // previewDeposit(uint256)
  maxDeposit: "0x402d267d", // maxDeposit(address)
  getPricePerFullShare: "0x77c7b8fc",
  symbol: "0x95d89b41",
};
const DEAD = "0x000000000000000000000000000000000000dEaD";

async function post(url, method, params) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message ?? JSON.stringify(j.error));
  return j.result;
}

// Every endpoint that answers with the right chain ID, pinned to a block all
// of them have, or null when none does. Calls rotate across them, so one
// rate-limited node does not leave a whole chain unverified.
async function pickRpc(name) {
  const c = CHAINS[name];
  const ok = [];
  for (const url of c.rpcs) {
    try {
      const id = parseInt(await post(url, "eth_chainId", []), 16);
      if (id !== c.id) {
        console.error(`[deposit] ${name}: ${url} reports chain ${id}, expected ${c.id}; skipped`);
        continue;
      }
      ok.push({ url, head: parseInt(await post(url, "eth_blockNumber", []), 16) });
    } catch (e) {
      console.error(`[deposit] ${name}: ${url} unreachable (${e.message})`);
    }
  }
  if (!ok.length) return null;
  return { urls: ok.map((o) => o.url), block: Math.min(...ok.map((o) => o.head)) - 2, next: 0 };
}

// eth_call at the pinned block. Returns null on revert or empty data, so a
// missing function reads as "not this interface" rather than an error.
async function view(rpc, to, data) {
  const tries = 6;
  for (let attempt = 0; attempt < tries; attempt++) {
    const url = rpc.urls[rpc.next++ % rpc.urls.length];
    try {
      const out = await post(url, "eth_call", [{ to, data }, `0x${rpc.block.toString(16)}`]);
      return out && out !== "0x" ? out : null;
    } catch (e) {
      if (/revert|execution|invalid opcode/i.test(e.message)) return null;
      if (attempt === tries - 1) throw e;
      // 429 and transient errors: back off, then the next endpoint.
      await new Promise((r) => setTimeout(r, Math.min(8_000, 400 * 2 ** attempt)));
    }
  }
  return null;
}

const asAddr = (hex) => (hex && hex.length >= 66 ? `0x${hex.slice(-40)}`.toLowerCase() : null);
const asUint = (hex) => (hex ? toBig(word(hex, 0)) : null);
function asString(hex) {
  if (!hex) return null;
  try {
    const h = hex.slice(2);
    if (h.length === 64) return Buffer.from(h, "hex").toString("utf8").replace(/\0+$/, "") || null;
    const len = Number(BigInt(`0x${h.slice(64, 128)}`));
    return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8") || null;
  } catch {
    return null;
  }
}

async function check(rpc, v) {
  const vault = v.contractAddress.toLowerCase();
  const token = (v.tokenAddress ?? "").toLowerCase();
  const base = { slug: v.slug, chain: v.chain, chainId: CHAINS[v.chain]?.id ?? null, vault: v.contractAddress, vaultType: v.vaultType };
  if (!token) return { ...base, interface: "unverified", reason: "no tokenAddress in data" };

  const [assetHex, underlyingHex, shareDecHex, tokenDecHex, symbolHex] = await Promise.all([
    view(rpc, vault, S.asset),
    view(rpc, vault, S.underlying),
    view(rpc, vault, S.decimals),
    view(rpc, token, S.decimals),
    view(rpc, token, S.symbol),
  ]);
  const shareDecimals = shareDecHex ? Number(asUint(shareDecHex)) : null;
  const tokenDecimals = tokenDecHex ? Number(asUint(tokenDecHex)) : null;
  const facts = {
    depositToken: v.tokenAddress,
    depositTokenSymbol: asString(symbolHex),
    depositTokenDecimals: tokenDecimals,
    shareDecimals,
  };
  if (shareDecimals == null || tokenDecimals == null) {
    return { ...base, ...facts, interface: "unverified", reason: "decimals() unreadable on vault or deposit token" };
  }

  // ERC-4626 first for Autopilot, Harvest's own vault first for Autocompounder:
  // the page documents that path, and a Harvest vault can expose both.
  const tryErc4626 = async () => {
    if (asAddr(assetHex) !== token) return null;
    const preview = asUint(await view(rpc, vault, call(S.previewDeposit, encUint(10n ** BigInt(tokenDecimals)))));
    if (!(preview > 0n)) return null;
    const max = asUint(await view(rpc, vault, call(S.maxDeposit, encAddr(DEAD))));
    return { interface: "erc4626", depositsOpen: max == null ? null : max > 0n };
  };
  const tryHarvest = async () => {
    if (asAddr(underlyingHex) !== token) return null;
    const ppfs = asUint(await view(rpc, vault, S.getPricePerFullShare));
    if (!(ppfs > 0n)) return null;
    return { interface: "harvest-vault", depositsOpen: null };
  };
  const order = v.vaultType === "Autopilot" ? [tryErc4626, tryHarvest] : [tryHarvest, tryErc4626];
  for (const t of order) {
    const r = await t();
    if (r) return { ...base, ...facts, ...r, alsoErc4626: r.interface === "harvest-vault" ? (await tryErc4626()) !== null : undefined };
  }
  const why =
    assetHex || underlyingHex
      ? `asset()/underlying() returned ${asAddr(assetHex) ?? asAddr(underlyingHex)}, not tokenAddress ${token}`
      : "neither asset() nor underlying() answers";
  return { ...base, ...facts, interface: "unverified", reason: why };
}

const checkedAt = new Date().toISOString();
const results = [];
const chainInfo = {};
for (const name of Object.keys(CHAINS)) {
  const vaults = VAULTS.filter((v) => v.chain === name);
  const rpc = vaults.length ? await pickRpc(name) : null;
  chainInfo[name] = { chainId: CHAINS[name].id, rpcs: rpc?.urls ?? [], block: rpc?.block ?? null, vaults: vaults.length };
  for (let i = 0; i < vaults.length; i += 2) {
    const batch = vaults.slice(i, i + 2);
    const done = await Promise.all(
      batch.map(async (v) => {
        if (!rpc) return { slug: v.slug, chain: v.chain, chainId: CHAINS[name].id, vault: v.contractAddress, vaultType: v.vaultType, interface: "unverified", reason: `no ${name} RPC reachable with chain ID ${CHAINS[name].id}` };
        try {
          return await check(rpc, v);
        } catch (e) {
          return { slug: v.slug, chain: v.chain, chainId: CHAINS[name].id, vault: v.contractAddress, vaultType: v.vaultType, interface: "unverified", reason: `RPC error: ${e.message}` };
        }
      }),
    );
    for (const r of done) results.push({ ...r, checkedAt, checkedBlock: rpc?.block ?? null });
  }
}
// Vaults on a chain this script has no RPC for at all.
for (const v of VAULTS) {
  if (!CHAINS[v.chain]) results.push({ slug: v.slug, chain: v.chain, chainId: null, vault: v.contractAddress, vaultType: v.vaultType, interface: "unverified", reason: `no RPC configured for ${v.chain}`, checkedAt, checkedBlock: null });
}

results.sort((a, b) => a.slug.localeCompare(b.slug));
writeFileSync(OUT, JSON.stringify({ generatedAt: checkedAt, chains: chainInfo, vaults: results }, null, 2) + "\n");

const by = (k) => results.filter((r) => r.interface === k).length;
console.log(`[deposit] ${results.length} vaults: ${by("erc4626")} erc4626, ${by("harvest-vault")} harvest-vault, ${by("unverified")} unverified`);
const closed = results.filter((r) => r.depositsOpen === false);
if (closed.length) console.log(`[deposit] deposits closed (maxDeposit 0): ${closed.map((r) => r.slug).join(", ")}`);
for (const [name, c] of Object.entries(chainInfo)) {
  if (c.vaults) console.log(`[deposit] ${name.padEnd(9)} chain ${c.chainId}  ${c.rpcs.length ? `block ${c.block} via ${c.rpcs.join(", ")}` : "NO RPC"}  (${c.vaults} vaults)`);
}
const unverified = results.filter((r) => r.interface === "unverified");
if (unverified.length) {
  console.log("[deposit] unverified:");
  for (const r of unverified) console.log(`  ${r.slug}: ${r.reason}`);
}
