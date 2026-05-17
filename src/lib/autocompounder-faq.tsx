// FAQ items reserved for vaultType "Autocompounder". Q2, Q4, Q7
// differ from the Autopilot FAQ: no IPOR Labs, no sub-vaults, no
// rebalancing engine, no Autopilot engine audits. Curators stay
// attributed to the underlying venue, not the Autocompounder.

import type { ReactNode } from "react";
import Link from "next/link";
import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./history-api";
import { formatAPY, formatTVL } from "./format";
import { underlyingVenueFor, rewardTokenLabel } from "./autocompounder-about";
import { getDisambiguatedDisplayName } from "./lp-pair";

export interface AutocompounderFaqItem {
  question: string;
  answer: string | ReactNode;
  // Plain-text equivalent for JSON-LD FAQ schema. Always set so the
  // schema in <head> matches what's rendered on the page.
  answerText: string;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

export function buildAutocompounderFaqItems(
  vault: YieldVault,
  history: FullVaultHistory,
  holderCount: number | null,
  allVaults?: readonly YieldVault[],
): AutocompounderFaqItem[] {
  // Same disambiguation as the Autopilot FAQ: when the database
  // productName collides across sibling deployments, the helper
  // appends " on {chain}" so each page's FAQ reads uniquely.
  const productName = getDisambiguatedDisplayName(vault, allVaults);
  const ticker = vault.asset.toUpperCase();
  const apy24h = formatAPY(vault.apy24h);
  const apy30d = formatAPY(vault.apy30d);
  const tvl = formatTVL(vault.tvl);
  const venue = underlyingVenueFor(vault.contractAddress);
  const reward = rewardTokenLabel(vault);
  const rewardSameAsTicker = reward.toUpperCase() === ticker;

  // 30-day APY window stats power Q5.
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - 30 * 86400;
  const trailing = history.apyHistory
    .filter(
      (p) => p.timestamp >= thirtyDaysAgo && Number.isFinite(p.apy) && p.apy >= 0,
    )
    .map((p) => p.apy);
  const has30d = trailing.length >= 2;
  const lo = has30d ? Math.min(...trailing) : null;
  const hi = has30d ? Math.max(...trailing) : null;
  const avg = has30d
    ? trailing.reduce((s, v) => s + v, 0) / trailing.length
    : null;
  const vol = has30d ? stddev(trailing) : null;

  // Parallel answer + answerText so the schema in <head> matches
  // what the page actually renders. Q1 uses singular "protocol's"
  // (one underlying venue) and Q3 uses singular "underlying venue"
  // - both differ from the Autopilot wording on purpose.
  const q1Text = `${productName} is showing a 24-hour APY of ${apy24h}, with a 30-day average of ${apy30d}. Rates are variable and move with market conditions, liquidity, and the underlying protocol's incentives. The figures reflect the realised yield over the trailing window; they are not a forward guarantee.`;
  const q2Text = rewardSameAsTicker
    ? `The strategy holds positions in ${venue} and the yield that accrues is added back to the vault on a recurring basis, increasing the value of each holder's share. The process repeats automatically; holders are not required to claim or add anything back themselves. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all holders.`
    : `The strategy holds positions in ${venue} and periodically claims any rewards that accrue. Those rewards (${reward}) are then converted into more ${ticker} and added back to the vault, increasing the value of each holder's share. The process repeats automatically; holders are not required to claim, swap, or add anything back themselves. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all holders.`;
  const q3Text =
    "There are no withdrawal periods or lockups. If the underlying strategy holds enough liquidity to satisfy the request, exits are instant. During periods of liquidity stress in the underlying venue, withdrawal capacity can be limited until liquidity returns. See the risk page for details on how this works.";
  const q4Text = rewardSameAsTicker
    ? `Yield is sourced from ${venue}. The income stream is interest paid by the underlying market, added back to the vault on a recurring basis. The rate moves with the underlying venue's utilisation.`
    : `Yield is sourced from ${venue}. The income stream is a combination of interest paid by the underlying market and reward emissions in ${reward}, which the strategy claims and converts back into ${ticker} on a recurring basis. The rate moves with the underlying venue's utilisation and incentive schedule.`;
  const q5Text = has30d
    ? `Over the last 30 days, this vault's APY has ranged from ${formatAPY(lo!)} to ${formatAPY(hi!)}, averaging ${formatAPY(avg!)}, with measured volatility of ±${vol!.toFixed(2)}%. The Strategy stability section above shows where this falls on the scale from very volatile to very consistent.`
    : "There isn't yet enough 30-day APY history to score stability for this vault. The Strategy stability section above will populate once a meaningful window of records is available.";
  const q6Text =
    holderCount && holderCount > 0
      ? `The vault currently holds ${tvl} in TVL across ${holderCount} holders. The Historical statistics section above shows how this compares to the vault's 30-day range and lifetime peak.`
      : `The vault currently holds ${tvl} in TVL. The Historical statistics section above shows how this compares to the vault's 30-day range and lifetime peak.`;
  // No reference to an Autopilot engine in Q7 because there isn't
  // one here. Halborn audit stays - it covers Harvest's core
  // vault infrastructure that Autocompounders use too.
  const q7Text = `Like any onchain yield strategy, this vault is exposed to smart contract risk in both the Harvest contracts and ${venue}, market risk in the underlying venue it routes to, and protocol-specific risks of the assets it interacts with. Harvest's core vault infrastructure was audited by Halborn in January 2025. Audits reduce but do not eliminate risk.`;

  return [
    { question: `What's the current APY for ${productName}?`, answer: q1Text, answerText: q1Text },
    { question: "How does the autocompounding work?", answer: q2Text, answerText: q2Text },
    {
      question: "Can I withdraw at any time?",
      answer: (
        <>
          There are no withdrawal periods or lockups. If the underlying
          strategy holds enough liquidity to satisfy the request, exits
          are instant. During periods of liquidity stress in the
          underlying venue, withdrawal capacity can be limited until
          liquidity returns. See{" "}
          <Link href="/risk-framework">the risk page</Link> for details
          on how this works.
        </>
      ),
      answerText: q3Text,
    },
    { question: "Where does the yield come from?", answer: q4Text, answerText: q4Text },
    { question: "How stable has the APY been?", answer: q5Text, answerText: q5Text },
    { question: "How much is currently in the vault?", answer: q6Text, answerText: q6Text },
    { question: "What are the risks?", answer: q7Text, answerText: q7Text },
  ];
}
