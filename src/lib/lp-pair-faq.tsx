// FAQ items reserved for LP-pair Autocompounders. Q2, Q4, Q7
// differ substantially from the single-asset Autocompounder FAQ:
// Q2 explains the LP-add flow (rewards split into both pair
// assets), Q4 explains the dual-source nature of LP yield
// (fees + emissions), Q7 introduces impermanent loss in plain
// language. Halborn audit reference is preserved; no mention of
// an Autopilot engine because none exists here.

import type { ReactNode } from "react";
import Link from "next/link";
import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./history-api";
import { formatAPY, formatTVL } from "./format";
import { getLpPair } from "./lp-pair";

export interface LpPairFaqItem {
  question: string;
  answer: string | ReactNode;
  answerText: string; // plain-string parallel for JSON-LD schema
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

export function buildLpPairFaqItems(
  vault: YieldVault,
  history: FullVaultHistory,
  holderCount: number | null,
): LpPairFaqItem[] | null {
  const pair = getLpPair(vault);
  if (!pair) return null;

  const productName = vault.productName;
  const ticker = vault.asset.toUpperCase();
  const counterpart = pair.counterpart;
  const platform = pair.platform;
  const reward = pair.rewardToken || "platform-native rewards";
  const apy24h = formatAPY(vault.apy24h);
  const apy30d = formatAPY(vault.apy30d);
  const tvl = formatTVL(vault.tvl);

  // 30-day APY window stats for Q5.
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

  const q1Text = `${productName} is showing a 24-hour APY of ${apy24h}, with a 30-day average of ${apy30d}. Rates are variable and move with trading volume on the ${ticker}/${counterpart} pair, the ${reward} emission schedule, and overall liquidity in the pool. The figures reflect the realised yield over the trailing window; they are not a forward guarantee.`;
  const q2Text = `The strategy holds an LP position in the ${ticker}/${counterpart} pool on ${platform} and periodically claims any ${reward} rewards that accrue. Those rewards are then converted in the proportions needed to add liquidity back into the same pool, increasing the size of the LP position held by the vault and the value of each depositor's share. The process repeats automatically; depositors are not required to claim, swap, or add liquidity themselves. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all depositors.`;
  const q3Text =
    "There are no withdrawal periods or lockups. If the underlying pool holds enough liquidity to satisfy the request, exits are instant. During periods of low pool liquidity, withdrawal capacity can be limited until liquidity returns. See the risk page for details on how this works.";
  const q4Text = `Yield comes from two sources. First, trading fees on the ${ticker}/${counterpart} pool on ${platform}: every swap between the two assets pays a fee, a share of which accrues to liquidity providers. Second, ${reward} emissions distributed by ${platform} to incentivise liquidity in the pool, which the strategy claims and adds back into the position. Both move with conditions: trading fees scale with volume, and emissions scale with the platform's emission schedule.`;
  const q5Text = has30d
    ? `Over the last 30 days, this vault's APY has ranged from ${formatAPY(lo!)} to ${formatAPY(hi!)}, averaging ${formatAPY(avg!)}, with measured volatility of ±${vol!.toFixed(2)}%. The Strategy stability section above shows where this falls on the scale from very volatile to very consistent.`
    : "There isn't yet enough 30-day APY history to score stability for this vault. The Strategy stability section above will populate once a meaningful window of records is available.";
  const q6Text =
    holderCount && holderCount > 0
      ? `The vault currently holds ${tvl} in TVL across ${holderCount} holders. The Historical statistics section above shows how this compares to the vault's 30-day range and lifetime peak.`
      : `The vault currently holds ${tvl} in TVL. The Historical statistics section above shows how this compares to the vault's 30-day range and lifetime peak.`;
  const q7Text = `Like any onchain yield strategy, this vault is exposed to smart contract risk in both the Harvest contracts and the underlying ${platform} pool, and protocol-specific risks of the assets it holds. Because the position holds both ${ticker} and ${counterpart}, the value of a deposit also moves with the relative price of the two assets in the pair: when the two prices diverge, the LP position is worth less than holding the two tokens separately would have been. This is commonly referred to as impermanent loss. ${reward} rewards partially offset this, but the offset is not guaranteed and depends on emission rates and the magnitude of price divergence. Harvest's core vault infrastructure was audited by Halborn in January 2025. Audits reduce but do not eliminate risk.`;

  return [
    { question: `What's the current APY for ${productName}?`, answer: q1Text, answerText: q1Text },
    { question: "How does the autocompounding work?", answer: q2Text, answerText: q2Text },
    {
      question: "Can I withdraw at any time?",
      answer: (
        <>
          There are no withdrawal periods or lockups. If the underlying
          pool holds enough liquidity to satisfy the request, exits
          are instant. During periods of low pool liquidity,
          withdrawal capacity can be limited until liquidity returns.
          See <Link href="/risk-framework">the risk page</Link> for
          details on how this works.
        </>
      ),
      answerText: q3Text,
    },
    { question: "Where does the yield come from?", answer: q4Text, answerText: q4Text },
    { question: "How stable has the APY been?", answer: q5Text, answerText: q5Text },
    { question: "How much capital is currently in the vault?", answer: q6Text, answerText: q6Text },
    { question: "What are the risks?", answer: q7Text, answerText: q7Text },
  ];
}
