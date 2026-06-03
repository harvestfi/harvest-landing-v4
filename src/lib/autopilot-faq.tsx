// FAQ items reserved for vaultType "Autopilot". Per the editorial
// spec: fixed 7-question list, Q1 expanded by default, Q3 has an
// inline link to /risk-framework (the existing risk page in the
// footer). Other vault types keep their existing FAQ list;
// Autocompounders get a parallel FAQ in lib/autocompounder-faq.

import type { ReactNode } from "react";
import Link from "next/link";
import type { YieldVault } from "./types";
import type { FullVaultHistory } from "./history-api";
import { formatAPY, formatTVL } from "./format";
import { protocolInsertFor } from "./autopilot-about";
import { getDisambiguatedDisplayName } from "./lp-pair";

export interface AutopilotFaqItem {
  question: string;
  // ReactNode for rendering. May embed inline links (Q3).
  answer: string | ReactNode;
  // Plain-text equivalent for JSON-LD FAQ schema. Always set so the
  // schema in <head> matches what's rendered on the page (Google
  // flags inconsistency when they drift).
  answerText: string;
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
  allVaults?: readonly YieldVault[],
): AutopilotFaqItem[] {
  // Single-asset Autopilots share a generic productName ("USDC
  // Autopilot") across deployments on every chain, which makes the
  // Q1/Q4/etc. copy read identically on every sibling page. When the
  // caller passes the cohort, the helper appends " on {chain}" for
  // products whose name collides, so the FAQ on each page reads
  // "USDC Autopilot on Base" vs "USDC Autopilot on Polygon".
  const productName = getDisambiguatedDisplayName(vault, allVaults);
  const apy24h = formatAPY(vault.apy24h);
  const apy30d = formatAPY(vault.apy30d);
  const tvl = formatTVL(vault.tvl);
  const protocolInsert = protocolInsertFor(vault.contractAddress);

  // 30-day APY window stats - powers Q5. Anchor to the latest indexed
  // reading (not wall-clock now) so the range / volatility match the
  // Strategy stability card Q5 points the reader to.
  const apyLatestTs = history.apyHistory.reduce(
    (m, p) => (Number.isFinite(p.timestamp) ? Math.max(m, p.timestamp) : m),
    0,
  );
  const thirtyDaysAgo = apyLatestTs - 30 * 86400;
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

  // "30-day" framing overstates the window on vaults with under a month
  // of indexed history; switch the FAQ copy to "since launch".
  const faqApyTs = history.apyHistory
    .filter((p) => p.apy >= 0)
    .map((p) => p.timestamp);
  const faqTrackedDays =
    faqApyTs.length >= 2
      ? Math.round((Math.max(...faqApyTs) - Math.min(...faqApyTs)) / 86400)
      : 0;
  const faqYoung = faqTrackedDays > 0 && faqTrackedDays < 30;
  const avgPhrase = faqYoung
    ? `an average of ${apy30d} since launch`
    : `a 30-day average of ${apy30d}`;
  const rangeWindow = faqYoung ? "Since launch" : "Over the last 30 days";
  const rangeRef = faqYoung ? "range since launch" : "30-day range";

  // Each Q has parallel answer (ReactNode for rendering) + answerText
  // (plain string for JSON-LD). For most Qs they're identical; Q3
  // has an inline link in `answer` and a flat string in answerText.
  const q1Text = `${productName} is showing a 24-hour APY of ${apy24h}, with ${avgPhrase}. Rates are variable and move with market conditions, liquidity, and the underlying protocols' incentives. The figures reflect the realised yield over the trailing window; they are not a forward guarantee.`;
  const q2Text =
    "The strategy uses an optimisation engine built by IPOR Labs AG that reallocates between sub-vaults multiple times a day. Allocation decisions factor in sustained rate trends, gas costs, and liquidity depth. Short-lived rate spikes are deliberately ignored when chasing them would cost more than they earn. Reallocations happen onchain within predefined boundaries.";
  const q3Text =
    "There are no withdrawal periods or lockups. If the underlying strategy holds enough liquidity to satisfy the request, exits are instant. During periods of liquidity stress in the underlying sub-vaults, withdrawal capacity can be limited until liquidity returns. See the risk page for details on how this works.";
  const q4Text = `The Autopilot sources yield from across several ${protocolInsert}. The income stream is a combination of lending interest paid by borrowers in those markets and protocol-level reward emissions where applicable. The mix shifts over time as the engine rebalances to the best-performing sources.`;
  // 0-safe percentage + require hi > 0 (see autocompounder-faq).
  const pct = (v: number) => `${v.toFixed(2)}%`;
  const q5Text =
    has30d && hi! >= 0.005
      ? `${rangeWindow}, this vault's APY has ranged from ${pct(lo!)} to ${pct(hi!)}, averaging ${pct(avg!)}, with measured volatility of ±${vol!.toFixed(2)}%. The Strategy stability section above shows where this falls on the scale from very volatile to very consistent.`
      : "There isn't yet enough 30-day APY history to score stability for this vault. The Strategy stability section above will populate once a meaningful window of records is available.";
  const q6Text =
    holderCount && holderCount > 0
      ? `The vault currently holds ${tvl} in TVL across ${holderCount} holders. The Historical statistics section above shows how this compares to the vault's ${rangeRef} and lifetime peak.`
      : `The vault currently holds ${tvl} in TVL. The Historical statistics section above shows how this compares to the vault's ${rangeRef} and lifetime peak.`;
  const q7Text =
    "Like any onchain yield strategy, this vault is exposed to smart contract risk in both the Harvest contracts and the underlying sub-vaults, market risk in the lending venues it routes to, and protocol-specific risks of the assets it interacts with. Harvest's core vault infrastructure was audited by Halborn in January 2025, and the Autopilot engine has been audited twice. Audits reduce but do not eliminate risk.";

  const items: AutopilotFaqItem[] = [
    {
      question: `What's the current APY for ${productName}?`,
      answer: q1Text,
      answerText: q1Text,
    },
    {
      question: "How does the Autopilot rebalance allocations?",
      answer: q2Text,
      answerText: q2Text,
    },
    {
      question: "Can I withdraw at any time?",
      answer: (
        <>
          There are no withdrawal periods or lockups. If the underlying
          strategy holds enough liquidity to satisfy the request, exits
          are instant. During periods of liquidity stress in the
          underlying sub-vaults, withdrawal capacity can be limited
          until liquidity returns. See{" "}
          <Link href="/risk-framework">the risk page</Link>{" "}
          for details on how this works.
        </>
      ),
      answerText: q3Text,
    },
    {
      question: "Where does the yield come from?",
      answer: q4Text,
      answerText: q4Text,
    },
    {
      question: "How stable has the APY been?",
      answer: q5Text,
      answerText: q5Text,
    },
    {
      question: "How much is currently in the vault?",
      answer: q6Text,
      answerText: q6Text,
    },
    {
      question: "What are the risks?",
      answer: q7Text,
      answerText: q7Text,
    },
  ];

  return items;
}
