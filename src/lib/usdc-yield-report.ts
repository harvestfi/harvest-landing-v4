// Machine-readable editions of the USDC Yield Report: the JSON dataset and the
// Markdown page, built from the same data file as the HTML page
// (data/usdc-yield-report.json) and ranked the same way (realized 30-day rate,
// one-off share-price steps left out).
import fs from "node:fs";
import path from "node:path";
import { SITE_URL } from "@/lib/constants";

export const REPORT_SLUG = "usdc-yield-report-november-2026";
export const REPORT_PATH = `/research/${REPORT_SLUG}`;

type Apy = { d7?: number; d30?: number; d90?: number };
type Vault = {
  name: string;
  venue: string;
  chain: string;
  curator?: string;
  address: string;
  tvl_usd_now?: number;
  realized_apy: Apy;
  realized_apy_ex_step?: Apy;
  merkl?: { had_rewards_in_period?: boolean };
  merkl_tokens: string[];
  merkl_in_share_price: boolean;
  merkl_peak?: { apr: number; start: string; end: string; token?: string };
  rewardEligibility?: string;
  tier: "core" | "smaller" | "utilization" | "credit";
  structure?: string;
  exit?: string;
  utilRange?: string;
  rateSource?: string;
  series: [string, number | null][];
};
type Report = {
  period: { start: string; end: string; days: number };
  asOf: string;
  asOfIso: string;
  venues: string[];
  chains: string[];
  tvlFloorUsd: number;
  vaults: Vault[];
};

const load = (): Report =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "usdc-yield-report.json"), "utf8"));

const real = (v: Vault, k: keyof Apy) => v.realized_apy_ex_step?.[k] ?? v.realized_apy[k];
const pct = (x?: number | null) => (x == null || !Number.isFinite(x) ? "n/a" : `${x.toFixed(2)}%`);
const usd = (x?: number | null) =>
  x == null ? "n/a" : x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : `$${Math.round(x / 1e3)}K`;
const month = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const minusDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10);

const EXPLORER: Record<string, string> = {
  Ethereum: "https://etherscan.io/address/",
  Base: "https://basescan.org/address/",
  Arbitrum: "https://arbiscan.io/address/",
  Monad: "https://monadscan.com/address/",
};
const explorerUrl = (v: Vault) => (EXPLORER[v.chain] ?? EXPLORER.Ethereum) + v.address;

const TIER: Record<Vault["tier"], string> = {
  core: "large (over $10M)",
  smaller: "smaller (under $10M)",
  utilization: "utilization risk",
  credit: "credit vault (queued withdrawals)",
};

function derive() {
  const r = load();
  const all = [...r.vaults].sort((a, b) => (real(b, "d30") ?? -1) - (real(a, "d30") ?? -1));
  const core = all.filter((v) => v.tier === "core");
  const coreTvl = core.reduce((s, v) => s + (v.tvl_usd_now ?? 0), 0);
  const wAvg = (k: keyof Apy) =>
    core.reduce((s, v) => s + (v.tvl_usd_now ?? 0) * (real(v, k) ?? 0), 0) / (coreTvl || 1);
  return {
    r,
    all,
    core,
    coreTvl,
    avg30: wAvg("d30"),
    avg90: wAvg("d90"),
    start30: minusDays(r.period.end, 30),
    url: `${SITE_URL}${REPORT_PATH}`,
    title: `USDC Yield Report - ${month(r.asOfIso)} Ranking`,
  };
}

/** The dataset behind the report: every vault, its rates and its daily share price. */
export function reportJson() {
  const d = derive();
  const { r } = d;
  return {
    title: d.title,
    url: d.url,
    publisher: "Harvest Finance",
    edition: month(r.asOfIso),
    as_of: r.asOfIso,
    period: { rates_30d: { start: d.start30, end: r.period.end }, rates_90d: { start: r.period.start, end: r.period.end } },
    method:
      "Realized APY is the growth of each vault's on-chain share price over the window, annualized over 365 days, " +
      "read once a day at the last block at or before 00:00 UTC. It is after vault fees and before rewards paid outside the vault. " +
      "A one-off share-price step that is not recurring yield is left out.",
    networks: r.chains,
    platforms: r.venues,
    summary: {
      large_vault_floor_usd: r.tvlFloorUsd,
      large_vaults: d.core.length,
      large_vault_deposits_usd: Math.round(d.coreTvl),
      large_vault_average_apy_30d: +d.avg30.toFixed(2),
      large_vault_average_apy_90d: +d.avg90.toFixed(2),
      large_vault_range_apy_30d: [real(d.core[d.core.length - 1], "d30"), real(d.core[0], "d30")],
    },
    vaults: d.all.map((v, i) => ({
      rank_30d: i + 1,
      name: v.name,
      platform: v.venue,
      network: v.chain,
      address: v.address,
      explorer_url: explorerUrl(v),
      group: TIER[v.tier],
      deposits_usd: v.tvl_usd_now == null ? null : Math.round(v.tvl_usd_now),
      realized_apy: { d7: real(v, "d7") ?? null, d30: real(v, "d30") ?? null, d90: real(v, "d90") ?? null },
      utilization: v.utilRange ?? null,
      structure: v.structure ?? null,
      withdrawals: v.exit ?? (v.tier === "credit" ? "queued" : null),
      rewards: v.merkl?.had_rewards_in_period
        ? {
            tokens: v.merkl_tokens,
            peak_apr: v.merkl_peak?.apr ?? null,
            included_in_rate: v.merkl_in_share_price,
            eligibility: v.rewardEligibility ?? null,
          }
        : null,
      share_price_daily: v.series,
    })),
    disclaimer:
      "Not financial advice. Past rates say nothing certain about future rates. Every figure can be reproduced from the listed contract addresses.",
  };
}

/** The report as Markdown, for agents and anyone who wants the text without the page. */
export function reportMarkdown(): string {
  const d = derive();
  const { r, all, core } = d;
  const hi = core[0], lo = core[core.length - 1];
  const big = [...core].sort((a, b) => (b.tvl_usd_now ?? 0) - (a.tvl_usd_now ?? 0))[0];
  const until = day(r.period.end);
  const row = (v: Vault, i: number) =>
    `| ${i + 1} | ${v.name} | ${v.venue} | ${v.chain} | ${pct(real(v, "d30"))} | ${pct(real(v, "d90"))} | ${usd(v.tvl_usd_now)} | ${TIER[v.tier]} |`;
  const util = all.filter((v) => v.tier === "utilization");
  const lend = all.filter((v) => v.tier !== "credit");
  const credit = all.filter((v) => v.tier === "credit");
  const rewarded = all.filter((v) => v.merkl?.had_rewards_in_period);

  return [
    "---",
    `title: "${d.title}"`,
    `canonical: ${d.url}`,
    `publisher: Harvest Finance`,
    `as_of: ${r.asOfIso}`,
    `period_30d: ${d.start30} to ${r.period.end}`,
    `period_90d: ${r.period.start} to ${r.period.end}`,
    `data: ${d.url}.json`,
    "---",
    "",
    `# ${d.title}`,
    "",
    `Harvest Finance measured the ${all.length} most popular and best-performing USDC vaults on ${r.venues.join(", ")}, ` +
      `on ${r.chains.join(", ")}, from each vault's on-chain share price. Credit vaults with queued withdrawals are listed separately and kept out of the averages. All rates are realized over the 30 days to ${until} ` +
      `unless stated otherwise.`,
    "",
    "## Key findings",
    "",
    `- The average USDC lending rate across the ${core.length} largest vaults was ${pct(d.avg30)} a year over the 30 days to ${until}, weighted by deposits (${pct(d.avg90)} over 90 days).`,
    `- The best-paying large USDC vault was ${hi.name} (${hi.chain}, ${hi.venue}) at ${pct(real(hi, "d30"))}.`,
    `- The largest USDC market, ${big.name} with ${usd(big.tvl_usd_now)} in deposits, paid ${pct(real(big, "d30"))}.`,
    `- The lowest rate among large USDC vaults was ${pct(real(lo, "d30"))}, on ${lo.name} (${lo.chain}, ${lo.venue}).`,
    `- The highest rate among lending vaults was ${pct(real(lend[0], "d30"))} on ${lend[0].name} (${lend[0].chain}, ${lend[0].venue})` +
      (lend[0].tier === "utilization" ? ", a vault running at high utilization, where withdrawals can be delayed." : "."),
    "",
    `## All ${all.length} USDC vaults, ranked by realized 30-day rate`,
    "",
    "| # | Vault | Platform | Network | 30d realized | 90d realized | Deposits | Group |",
    "|---|---|---|---|---|---|---|---|",
    ...all.map(row),
    "",
    "## Vaults with utilization risk",
    "",
    "A lending vault's rate rises with utilization, the share of its deposits currently lent out. Near 100% the rate climbs steeply and little or no USDC is left to withdraw.",
    "",
    ...util.map((v) => `- ${v.name} (${v.chain}, ${v.venue}) paid ${pct(real(v, "d30"))}${v.rateSource ? `: it ${v.rateSource}` : "."}`),
    "",
    ...(credit.length
      ? [
          "## Credit vaults with withdrawal queues",
          "",
          "These vaults are loans to a single borrower or managed strategies, not pooled lending. None allows instant withdrawal, so they are kept out of the rankings and averages.",
          "",
          ...credit.map((v) => `- ${v.name} (${v.chain}, ${v.venue}) paid ${pct(real(v, "d30"))}${v.structure ? `: it is ${v.structure}` : ""}${v.exit ? `. Withdrawals: ${v.exit}` : ""}.`),
          "",
        ]
      : []),
    "## Rewards on top",
    "",
    `Reward campaigns ran on ${rewarded.length} of the ${all.length} vaults during the period. Rewards are not part of the rates above, except on Harvest vaults, which convert them back into USDC inside the vault.`,
    "",
    ...rewarded.map(
      (v) =>
        `- ${v.name}: ${v.merkl_tokens.join(", ") || "rewards"}` +
        (v.merkl_peak ? `, peak ${v.merkl_peak.apr}% APR` : "") +
        (v.rewardEligibility ? `, ${v.rewardEligibility}` : "") +
        (v.merkl_in_share_price ? " (already included in the vault's rate)" : ""),
    ),
    "",
    "## How it was measured",
    "",
    "For each day we took the last block at or before 00:00 UTC and read the vault's share price at that block: `convertToAssets` on ERC-4626 vaults (Morpho, Euler), `getPricePerFullShare` on Harvest vaults, and the reserve's normalized income on Aave v3. Credit vaults are read the same way, but their share price is interest accrued on a loan or a value reported by a manager. Realized APY is the growth of that value over the window, annualized over 365 days, after vault fees and before rewards paid outside the vault. A one-off share-price step that is not recurring yield is left out.",
    "",
    "Harvest Finance publishes this report and operates five of the vaults in it. They are measured the same way as every other vault.",
    "",
    "## Contract addresses",
    "",
    "| Vault | Platform | Network | Address |",
    "|---|---|---|---|",
    ...[...all]
      .sort((a, b) => a.venue.localeCompare(b.venue) || a.name.localeCompare(b.name))
      .map((v) => `| ${v.name} | ${v.venue} | ${v.chain} | \`${v.address}\` |`),
    "",
    "## Disclaimer",
    "",
    "Not financial advice. This report describes what USDC vaults paid in the past, which says nothing certain about what they will pay next. Every figure comes from open, on-chain data that anyone can read from the contract addresses above.",
    "",
  ].join("\n");
}

/** For the sitemap: the edition's path and the date its data was read. */
export function reportMeta() {
  const r = load();
  return { path: REPORT_PATH, asOfIso: r.asOfIso, label: `USDC Yield Report` };
}
