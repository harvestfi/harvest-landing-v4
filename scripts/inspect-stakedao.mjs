#!/usr/bin/env node
/**
 * Dumps the raw upstream Harvest API entry for the three Stake
 * DAO OnlyBoost vaults so we can see what tokenNames / platform
 * / strategy / description fields look like.
 *
 * Sandboxed environments (like the assistant's) can't reach
 * api.harvest.finance, so run this locally:
 *   node scripts/inspect-stakedao.mjs
 *
 * Paste the output back into the chat - it gives ground truth
 * for the Curve pool composition we need to drive OnlyBoost
 * About/FAQ copy.
 */

const HARVEST_API = "https://api.harvest.finance/vaults?key=harvest-key";

const ONLYBOOST_VAULTS = [
  {
    label: "ETH OnlyBoost",
    address: "0x549fAd7794d331eA0E1675CD7e60cE6931914457",
  },
  {
    label: "WBTC OnlyBoost",
    address: "0x745CA7DBfE786C58D31D8E142E04308CD1F38f5f",
  },
  {
    label: "stETH OnlyBoost",
    address: "0xc27bFe32E0a934A12681c1b35ACf0DBa0E7460BA",
  },
];

function pickFields(v) {
  return {
    vaultAddress: v.vaultAddress,
    tokenAddress: v.tokenAddress,
    displayName: v.displayName,
    tokenNames: v.tokenNames,
    tokenSymbols: v.apyTokenSymbols,
    platform: v.platform,
    underlyingTokens: v.underlyingTokens,
    underlyingTokenSymbols: v.underlyingTokenSymbols,
    poolAddress: v.poolAddress,
    poolUrl: v.poolUrl,
    strategyAddress: v.strategyAddress,
    description: v.description,
    estimatedApy: v.estimatedApy,
    estimatedApyBreakdown: v.estimatedApyBreakdown,
    apyIconUrls: v.apyIconUrls,
    tags: v.tags,
    // Pull anything else that looks pool-related
    ...Object.fromEntries(
      Object.entries(v).filter(([k]) =>
        /pool|curve|underlying|symbol|composition/i.test(k),
      ),
    ),
  };
}

async function main() {
  const res = await fetch(HARVEST_API);
  if (!res.ok) {
    console.error(`Upstream returned ${res.status}`);
    process.exit(1);
  }
  const data = await res.json();
  // The upstream payload is keyed by chain; flatten to a single
  // array regardless of the exact shape.
  const all = [];
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
    } else if (typeof node === "object") {
      if (node.vaultAddress) all.push(node);
      else for (const v of Object.values(node)) walk(v);
    }
  }
  walk(data);
  console.error(`Upstream returned ${all.length} vault records.`);

  for (const { label, address } of ONLYBOOST_VAULTS) {
    const found = all.find(
      (v) => (v.vaultAddress || "").toLowerCase() === address.toLowerCase(),
    );
    console.log(`\n===== ${label} (${address}) =====`);
    if (!found) {
      console.log("  NOT FOUND in upstream payload.");
      continue;
    }
    console.log(JSON.stringify(pickFields(found), null, 2));
  }
}

main().catch((err) => {
  console.error("Inspection failed:", err);
  process.exit(1);
});
