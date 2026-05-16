// "About" copy generator reserved for LP-pair Autocompounders
// (the third branch alongside Autopilot and single-asset
// Autocompounder). Signals dual-asset exposure ("paired with X")
// in paragraph 1 but does not editorialise on impermanent loss
// here; that's FAQ Q7's job.
//
// Variable substitution only. Do not paraphrase the template.

import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./history-api";
import { formatAPY, formatTVL } from "./format";
import { getLpPair, getCanonicalDisplayName } from "./lp-pair";

function inceptionDate(history: FullVaultHistory): string | null {
  const candidates = [
    ...history.tvlHistory.map((p) => p.timestamp),
    ...history.sharePriceHistory.map((p) => p.timestamp),
    ...history.apyHistory.map((p) => p.timestamp),
  ].filter((t) => Number.isFinite(t) && t > 0);
  if (candidates.length === 0) return null;
  const earliest = Math.min(...candidates);
  return new Date(earliest * 1000).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export interface LpPairAbout {
  intro: string;
  rewards: string;
  liveline: string;
}

export function buildLpPairAbout(
  vault: YieldVault,
  history: FullVaultHistory,
  holderCount: number | null,
): LpPairAbout | null {
  const pair = getLpPair(vault);
  if (!pair) return null;

  const ticker = vault.asset.toUpperCase();
  const counterpart = pair.counterpart;
  const platform = pair.platform;
  // Reward token defaults to "platform-native rewards" when the
  // upstream rewardTokens array is empty - keeps the sentence
  // legible without leaking nulls.
  const reward = pair.rewardToken || "platform-native rewards";
  const network = vault.chain;
  const inception = inceptionDate(history);

  // Use the canonical "ETH/VVV Aerodrome" form here (not the bare
  // database "ETH Aerodrome"), so the About paragraph identifies the
  // specific pair the visitor is looking at. The ProductPageBody
  // splitter parses on " is an " - this template keeps that token.
  const displayName = getCanonicalDisplayName(vault);
  const intro =
    `${displayName} is an LP-token autocompounder on ${network}, ` +
    `with ${ticker} paired with ${counterpart} in the underlying LP ` +
    `position. The strategy provides liquidity to the ${ticker}/${counterpart} ` +
    `pool on ${platform} and earns yield from both trading fees on ` +
    `the pair and ${reward} emissions distributed to liquidity providers.`;

  const rewards =
    `Any claimed ${reward} rewards are automatically converted into more ` +
    `of the underlying LP position and added back to the vault, removing ` +
    `the manual claim and conversion steps a user would otherwise need to ` +
    `perform on their own. Autocompounding events run when economically ` +
    `feasible, anywhere from hourly to several days apart, with gas costs ` +
    `socialised across all holders rather than borne by each user ` +
    `individually.`;

  // Paragraph 3: same shape as Autopilot/Autocompounder liveline.
  const apy24h = formatAPY(vault.apy24h);
  const apy30d = formatAPY(vault.apy30d);
  const tvl = formatTVL(vault.tvl);
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
      parts[parts.length - 1] =
        `${parts[parts.length - 1]}with ${apyBits.join(" and ")}.`;
    } else {
      parts.push(`Currently showing ${apyBits.join(" and ")}.`);
    }
  } else if (parts.length > 0 && parts[parts.length - 1].endsWith(", ")) {
    parts[parts.length - 1] = parts[parts.length - 1].replace(/, $/, ".");
  }
  const liveline = parts.join(" ").trim();

  return { intro, rewards, liveline };
}
