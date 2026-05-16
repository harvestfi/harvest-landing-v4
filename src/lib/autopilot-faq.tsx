// FAQ items reserved for vaultType "Autopilot" or "Autocompounder".
// Per the editorial spec: fixed 7-question list, Q1 expanded by
// default, Q3 has an inline link to /risk. Other vault types keep
// their existing FAQ list.

import type { ReactNode } from "react";
import Link from "next/link";
import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./history-api";
import { formatAPY, formatTVL } from "./format";
import { protocolInsertFor } from "./autopilot-about";

export interface AutopilotFaqItem {
  question: string;
  answer: string | ReactNode;
}

// Population sigma over a sample. Used for "measured volatility"
// in the stability FAQ - matches the volatility figure in the
// Strategy stability card so the two surfaces agree.
function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

export function buildAutopilotFaqItems(
  vault: YieldVault,
  history: FullVaultHistory,
  holderCount: number | null,
): AutopilotFaqItem[] {
  const productName = vault.productName;
  const apy24h = formatAPY(vault.apy24h);
  const apy30d = formatAPY(vault.apy30d);
  const tvl = formatTVL(vault.tvl);
  const protocolInsert = protocolInsertFor(vault.contractAddress);

  // 30-day APY window stats - powers Q5.
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

  const items: AutopilotFaqItem[] = [
    {
      question: `What's the current APY for ${productName}?`,
      answer: `${productName} is showing a 24-hour APY of ${apy24h}, with a 30-day average of ${apy30d}. Rates are variable and move with market conditions, liquidity, and the underlying protocols' incentives. The figures reflect the realised yield over the trailing window; they are not a forward guarantee.`,
    },
    {
      question: "How does the Autopilot rebalance allocations?",
      answer:
        "The strategy uses an optimisation engine built by IPOR Labs AG that reallocates between sub-vaults multiple times a day. Allocation decisions factor in sustained rate trends, gas costs, and liquidity depth. Short-lived rate spikes are deliberately ignored when chasing them would cost more than they earn. Reallocations happen onchain within predefined boundaries.",
    },
    {
      question: "Can I withdraw at any time?",
      answer: (
        <>
          There are no withdrawal periods or lockups. If the underlying
          strategy holds enough liquidity to satisfy the request, exits
          are instant. During periods of liquidity stress in the
          underlying sub-vaults, withdrawal capacity can be limited
          until liquidity returns. See <Link href="/risk">the risk page</Link>{" "}
          for details on how this works.
        </>
      ),
    },
    {
      question: "Where does the yield come from?",
      answer: `The Autopilot sources yield from across several ${protocolInsert}. Returns come from a combination of lending interest paid by borrowers in those markets and protocol-level reward emissions where applicable. The mix shifts over time as the engine rebalances to the best-performing sources.`,
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
      answer:
        "Like any onchain yield strategy, this vault is exposed to smart contract risk in both the Harvest contracts and the underlying sub-vaults, market risk in the lending venues it routes to, and protocol-specific risks of the assets it interacts with. Harvest's core vault infrastructure was audited by Halborn in January 2025, and the Autopilot engine has been audited twice. Audits reduce but do not eliminate risk.",
    },
  ];

  return items;
}
