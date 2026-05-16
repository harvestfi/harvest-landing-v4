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

export interface AutocompounderFaqItem {
  question: string;
  answer: string | ReactNode;
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
): AutocompounderFaqItem[] {
  const productName = vault.productName;
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

  return [
    {
      question: `What's the current APY for ${productName}?`,
      // Singular "protocol's" - one underlying venue, unlike the
      // Autopilot version which is plural.
      answer: `${productName} is showing a 24-hour APY of ${apy24h}, with a 30-day average of ${apy30d}. Rates are variable and move with market conditions, liquidity, and the underlying protocol's incentives. The figures reflect the realised yield over the trailing window; they are not a forward guarantee.`,
    },
    {
      question: "How does the autocompounding work?",
      answer: rewardSameAsTicker
        ? `The strategy holds positions in ${venue} and the yield that accrues is added back to the vault on a recurring basis, increasing the value of each depositor's share. The process repeats automatically; depositors are not required to claim or redeposit anything themselves. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all depositors.`
        : `The strategy holds positions in ${venue} and periodically claims any rewards that accrue. Those rewards (${reward}) are then converted into more ${ticker} and added back to the vault, increasing the value of each depositor's share. The process repeats automatically; depositors are not required to claim, swap, or redeposit anything themselves. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all depositors.`,
    },
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
    },
    {
      question: "Where does the yield come from?",
      answer: rewardSameAsTicker
        ? `Yield is sourced from ${venue}. Returns come from interest paid by the underlying market, added back to the vault on a recurring basis. The rate moves with the underlying venue's utilisation.`
        : `Yield is sourced from ${venue}. Returns come from a combination of interest paid by the underlying market and reward emissions in ${reward}, which the strategy claims and converts back into ${ticker} on a recurring basis. The rate moves with the underlying venue's utilisation and incentive schedule.`,
    },
    {
      question: "How stable has the APY been?",
      answer: has30d
        ? `Over the last 30 days, this vault's APY has ranged from ${formatAPY(lo!)} to ${formatAPY(hi!)}, averaging ${formatAPY(avg!)}, with measured volatility of ±${vol!.toFixed(2)}%. The Strategy stability section above shows where this falls on the scale from very volatile to very consistent.`
        : "There isn't yet enough 30-day APY history to score stability for this vault. The Strategy stability section above will populate once a meaningful window of records is available.",
    },
    {
      question: "How much capital is currently in the vault?",
      answer:
        holderCount && holderCount > 0
          ? `The vault currently holds ${tvl} in TVL across ${holderCount} holders. The Historical statistics section above shows how this compares to the vault's 30-day range and lifetime peak.`
          : `The vault currently holds ${tvl} in TVL. The Historical statistics section above shows how this compares to the vault's 30-day range and lifetime peak.`,
    },
    {
      question: "What are the risks?",
      // Autocompounder version: no reference to the Autopilot
      // engine audits because there is no Autopilot engine here.
      // Halborn audit stays - it covers Harvest's core vault
      // infrastructure, which Autocompounders also use.
      answer: `Like any onchain yield strategy, this vault is exposed to smart contract risk in both the Harvest contracts and ${venue}, market risk in the underlying venue it routes to, and protocol-specific risks of the assets it interacts with. Harvest's core vault infrastructure was audited by Halborn in January 2025. Audits reduce but do not eliminate risk.`,
    },
  ];
}
