#!/usr/bin/env node
// POC: fetch ERC-20 holder count for a single vault from Base Blockscout.
// Run: node scripts/holders-poc.mjs
//
// Blockscout v2 returns the count as a string in the `holders` field of
// /api/v2/tokens/{address}; that field is what their UI renders, so it
// already accounts for zero-balance addresses (only positive holders).

const VAULT = {
  productName: "USDC 40 Acres",
  chain: "Base",
  address: "0xC777031D50F632083Be7080e51E390709062263E",
  blockscout: "https://base.blockscout.com",
};

const url = `${VAULT.blockscout}/api/v2/tokens/${VAULT.address}`;
const res = await fetch(url, { headers: { accept: "application/json" } });
if (!res.ok) {
  console.error(`HTTP ${res.status} from ${url}`);
  process.exit(1);
}
const data = await res.json();

console.log(`${VAULT.productName} (${VAULT.chain})`);
console.log(`  contract:  ${VAULT.address}`);
console.log(`  symbol:    ${data.symbol ?? "?"}`);
console.log(`  decimals:  ${data.decimals ?? "?"}`);
console.log(`  holders:   ${data.holders ?? "?"}`);
console.log(`  source:    ${url}`);
