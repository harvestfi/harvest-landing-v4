// "About" copy generator reserved for vaultType "Autocompounder".
// Autocompounders sit on a single underlying venue and add value
// by automating the claim + convert + redeposit cycle. The copy
// must reflect that: no IPOR Labs, no rebalancing engine, no
// "rotating set of venues" framing. Curators belong to the
// underlying venue, never to the Autocompounder itself.
//
// Variable substitution only. Do not paraphrase the template.

import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./history-api";
import { formatAPY, formatTVL } from "./format";

// Per-vault, hand-tuned phrase that names the underlying venue.
// Keyed by lowercase contract address; add new entries here when
// new Autocompounders launch.
export const UNDERLYING_VENUE_BY_ADDRESS: Record<string, string> = {
  "0x6d84799f874918a7762625805d68cf3181d8d5f2":
    "the Alpha Core V2 Morpho vault curated by kpk",
};
export const UNDERLYING_VENUE_FALLBACK = "its underlying lending venue";

export function underlyingVenueFor(addr: string): string {
  return (
    UNDERLYING_VENUE_BY_ADDRESS[addr.toLowerCase()] ??
    UNDERLYING_VENUE_FALLBACK
  );
}

// Reward-token symbol(s). The spec wants the first listed token
// when there's just one; "X and other reward tokens" when more.
// Falls back to "rewards" if the vault data doesn't surface any.
export function rewardTokenLabel(vault: YieldVault): string {
  const tokens = (vault.rewardTokens ?? [])
    .map((t) => t?.symbol?.trim())
    .filter((s): s is string => Boolean(s));
  if (tokens.length === 0) return "rewards";
  if (tokens.length === 1) return tokens[0];
  return `${tokens[0]} and other reward tokens`;
}

// Inception date derived from the earliest history timestamp,
// formatted Month YYYY. Mirrors the Autopilot About helper.
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

export interface AutocompounderAbout {
  intro: string; // paragraph 1 (with product name as the leading word)
  rewards: string; // paragraph 2
  liveline: string; // paragraph 3
}

export function buildAutocompounderAbout(
  vault: YieldVault,
  history: FullVaultHistory,
  holderCount: number | null,
): AutocompounderAbout {
  const ticker = vault.asset.toUpperCase();
  const network = vault.chain;
  const venue = underlyingVenueFor(vault.contractAddress);
  const reward = rewardTokenLabel(vault);
  const rewardSameAsTicker = reward.toUpperCase() === ticker;
  const inception = inceptionDate(history);
  const apy24h = formatAPY(vault.apy24h);
  const apy30d = formatAPY(vault.apy30d);
  const tvl = formatTVL(vault.tvl);

  // Paragraph 1: positioning + underlying venue + automation
  // value-add. Closes by emphasising that the Autocompounder
  // removes manual steps a user would otherwise perform.
  const intro =
    `${vault.productName} is an autocompounder on ${network} with ` +
    `${ticker} as its underlying token, in which the yield is ` +
    `distributed. It earns yield from ${venue} and automatically ` +
    `converts any claimed rewards into more ${ticker}, removing the ` +
    `manual claim and conversion steps a user would otherwise need to ` +
    `perform on their own.`;

  // Paragraph 2: rewards mechanic. Replaced with simpler version
  // when the reward token IS the underlying token (avoids the
  // awkward "USDC is converted into USDC" phrasing).
  const rewards = rewardSameAsTicker
    ? "Yield earned by the strategy is added back to the vault on a recurring basis. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all holders rather than borne by each user individually."
    : `Rewards earned by the strategy (${reward}) are periodically converted into ${ticker} and added back to the vault. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all holders rather than borne by each user individually.`;

  // Paragraph 3: live stats. Same shape as Autopilot - each piece
  // degrades independently if a value is missing.
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
    if (parts.length > 0 && parts[parts.length - 1].endsWith(", ")) {
      parts[parts.length - 1] = `${parts[parts.length - 1]}with ${apyBits.join(" and ")}.`;
    } else {
      parts.push(`Currently showing ${apyBits.join(" and ")}.`);
    }
  } else if (parts.length > 0 && parts[parts.length - 1].endsWith(", ")) {
    parts[parts.length - 1] = parts[parts.length - 1].replace(/, $/, ".");
  }
  const liveline = parts.join(" ").trim();

  return { intro, rewards, liveline };
}
