// Autopilot About-section copy generator. Used on /[slug] for any
// vault with vaultType === "Autopilot". Other vault types fall back
// to the existing inline copy in product-page-body.tsx.
//
// The wording itself is intentionally fixed - see the editorial
// rules in AGENTS.md (Autopilot About template). Variable
// substitution only, no paraphrasing.

import type { YieldVault } from "@/lib/types";
import type { FullVaultHistory } from "@/lib/history-api";
import { formatAPY, formatTVL } from "@/lib/format";

// Per-vault, hand-tuned protocol phrase. Closes with ", among
// others" unless the vault is locked to a single venue.
const PROTOCOL_INSERT_BY_ADDRESS: Record<string, string> = {
  "0xd6701905c59ee618dc36dc747506bce0a4ac760a":
    "Morpho markets, among others",
  "0x407d3d942d0911a2fea7e22417f81e27c02d6c6f":
    "Aave, Morpho, Euler and Fluid markets, among others",
};
const PROTOCOL_INSERT_FALLBACK = "lending and yield venues";

// Earliest timestamp on the indexed history. Derive month + year so
// the inception line reads like "Live since September 2025".
function inceptionDate(history: FullVaultHistory): string | null {
  const candidates = [
    ...history.tvlHistory.map((p) => p.timestamp),
    ...history.sharePriceHistory.map((p) => p.timestamp),
    ...history.apyHistory.map((p) => p.timestamp),
  ].filter((t) => Number.isFinite(t) && t > 0);
  if (candidates.length === 0) return null;
  const earliest = Math.min(...candidates);
  const d = new Date(earliest * 1000);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export interface AutopilotAbout {
  intro: string;
  engine: string;
  liveline: string;
}

export function buildAutopilotAbout(
  vault: YieldVault,
  history: FullVaultHistory,
  holderCount: number | null,
): AutopilotAbout {
  const ticker = vault.asset.toUpperCase();
  const network = vault.chain;
  const protocolInsert =
    PROTOCOL_INSERT_BY_ADDRESS[vault.contractAddress.toLowerCase()] ??
    PROTOCOL_INSERT_FALLBACK;
  const inception = inceptionDate(history);
  const apy24h = formatAPY(vault.apy24h);
  const apy30d = formatAPY(vault.apy30d);
  const tvl = formatTVL(vault.tvl);

  // Paragraph 1: positioning + yield sources.
  const intro =
    `${vault.productName} is a high-frequency rebalancing vault on ${network} ` +
    `with ${ticker} as its underlying token, in which the yield is distributed. ` +
    `It sources yield from across several ${protocolInsert} and actively ` +
    `reallocates liquidity to the best-performing sources, keeping users ` +
    `positioned to the most optimal yield available at any given time.`;

  // Paragraph 2: engine + execution. Constant string per the template.
  const engine =
    "Allocations are handled by an optimisation engine powered by IPOR Labs AG " +
    "and executed transparently onchain, within predefined boundaries. The engine " +
    "rebalances between sub-vaults based on sustained rate trends, gas costs, and " +
    "liquidity depth, and ignores short rate spikes when chasing them would cost " +
    "more than it earns.";

  // Paragraph 3: live stats. Inception + TVL + holders + 24h/30d APY.
  // Each piece can degrade independently when a value is missing so
  // the sentence still reads naturally.
  const parts: string[] = [];
  if (inception) parts.push(`Live since ${inception}.`);
  const indexedBits: string[] = [];
  if (vault.tvl > 0) indexedBits.push(`${tvl} TVL`);
  if (holderCount && holderCount > 0) {
    indexedBits.push(`${holderCount} holders`);
  }
  if (indexedBits.length > 0) {
    parts.push(`Currently indexed at ${indexedBits.join(" across ")}, `);
  }
  const apyBits: string[] = [];
  if (vault.apy24h > 0) apyBits.push(`a ${apy24h} 24-hour APY`);
  if (vault.apy30d > 0) apyBits.push(`${apy30d} across the trailing 30 days`);
  if (apyBits.length > 0) {
    // If the indexed line opened, join with "with"; otherwise stand
    // alone as a fresh sentence.
    if (parts.length > 0 && parts[parts.length - 1].endsWith(", ")) {
      parts[parts.length - 1] = `${parts[parts.length - 1]}with ${apyBits.join(" and ")}.`;
    } else {
      parts.push(`Currently showing ${apyBits.join(" and ")}.`);
    }
  } else if (parts.length > 0 && parts[parts.length - 1].endsWith(", ")) {
    // Trim the dangling ", " if the apy line never landed.
    parts[parts.length - 1] = parts[parts.length - 1].replace(/, $/, ".");
  }
  const liveline = parts.join(" ").trim();

  return { intro, engine, liveline };
}