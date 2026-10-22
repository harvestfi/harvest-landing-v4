// Block explorer address URLs by chain, shared by the product page and its
// Markdown version.
export const CHAIN_EXPLORERS: Record<string, string> = {
  Ethereum: "https://etherscan.io/address/",
  Polygon: "https://polygonscan.com/address/",
  Arbitrum: "https://arbiscan.io/address/",
  Base: "https://basescan.org/address/",
  zkSync: "https://explorer.zksync.io/address/",
  HyperEVM: "https://hyperscan.xyz/address/",
};

export function explorerAddressUrl(chain: string, address: string | undefined | null): string | null {
  const base = CHAIN_EXPLORERS[chain];
  return base && address ? `${base}${address}` : null;
}
