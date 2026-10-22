// Markdown versions of the ranking and product pages, for AI agents.
//
// Every figure comes from the loaders the HTML pages use (getLiveVaults, the
// shared hub-rows selectors, buildUsdcCohort, the About builders), formatted
// with the same helpers, so a Markdown page and its HTML page cannot disagree.
// The only additions are on-chain facts: chain IDs, token addresses and
// decimals, and the deposit interface, all read from
// data/deposit-interfaces.json, which scripts/verify-deposit-interfaces.mjs
// writes from chain state. Call-level deposit steps are printed only for a
// vault whose interface that script verified.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { YieldVault } from "./types";
import {
  getLiveVaults,
  getVaultHistory,
  getHoldersMap,
  loadHistoryFile,
  type FullVaultHistory,
} from "./data";
import { getCanonicalSlugs } from "./canonical-vaults";
import { homeRows, assetHubRows, networkHubRows, platformHubRows } from "./hub-rows";
import { buildUsdcCohort, proseName } from "./usdc-hub";
import { strategyTypeOf, isL2 } from "./eth-hub";
import {
  ethPageModel,
  networkSentence,
  stakingReferenceText,
  stakingSourceUrl,
  venueLead,
  venueLine,
  SINGULAR,
  TYPE_BLURB,
  HARVEST_FEE_TEXT,
  ETH_HUB_H1,
  ETH_RISKS,
  ETH_RISKS_LEAD,
  STAKING_LEAD,
} from "./eth-hub-copy";
import { getPlatform } from "./platforms";
import { NETWORKS } from "./networks";
import { assetHubH1, networkHubH1, platformHubH1 } from "./seo";
import { productMetaDescription } from "./product-meta";
import { getCanonicalDisplayName, getLpPair } from "./lp-pair";
import { formatAPY, formatTVL, stripChainSuffix } from "./format";
import { harvestAppUrl } from "./harvest-app";
import { explorerAddressUrl } from "./explorers";
import { SITE_URL } from "./constants";
import { buildAutopilotAbout } from "./autopilot-about";
import { buildAutocompounderAbout } from "./autocompounder-about";
import { buildLpPairAbout } from "./lp-pair-about";
import { trackedDays } from "./vault-age";
import { freshness } from "./freshness";
import { hasDatasetDownload, historyCsvHref } from "./jsonld";
import { isLowLiquidityTvl, LOW_LIQUIDITY_TVL_THRESHOLD } from "./admin-rules";

// ------------------------------------------------------------------ inputs

export interface DepositInterface {
  slug: string;
  chain: string;
  chainId: number | null;
  vault: string;
  vaultType: string;
  interface: "erc4626" | "harvest-vault" | "unverified";
  reason?: string;
  depositToken?: string;
  depositTokenSymbol?: string | null;
  depositTokenDecimals?: number | null;
  shareDecimals?: number | null;
  depositsOpen?: boolean | null;
  alsoErc4626?: boolean;
  checkedAt: string;
  checkedBlock: number | null;
}

interface DepositFile {
  generatedAt: string;
  chains: Record<string, { chainId: number; rpcs: string[]; block: number | null; vaults: number }>;
  vaults: DepositInterface[];
}

let _deposit: DepositFile | null | undefined;
function depositFile(): DepositFile | null {
  if (_deposit !== undefined) return _deposit;
  const p = join(process.cwd(), "data", "deposit-interfaces.json");
  _deposit = existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as DepositFile) : null;
  return _deposit;
}

function depositFor(v: YieldVault): DepositInterface | null {
  const f = depositFile();
  const d = f?.vaults.find((x) => x.slug === v.slug) ?? null;
  // A record for a different contract than the page's vault is not evidence
  // about this vault.
  return d && d.vault.toLowerCase() === v.contractAddress.toLowerCase() ? d : null;
}

// ------------------------------------------------------------------- scope

export interface AgentPage {
  /** Output file name, e.g. "usdc.md", "index.md". */
  file: string;
  /** Canonical HTML URL the file mirrors. */
  canonical: string;
  kind: "home" | "asset" | "platform" | "network" | "product" | "agents";
  key: string;
}

const ASSET_HUBS = ["USDC", "USDT", "ETH", "BTC"] as const;
const PLATFORM_HUBS = ["aave", "morpho"] as const;

/**
 * Products with a Markdown page: live (in the rankings, not hidden), and the
 * canonical vault of their asset/protocol/network group.
 */
export async function productScope(): Promise<YieldVault[]> {
  const [live, canonical] = await Promise.all([getLiveVaults(), getCanonicalSlugs()]);
  return live.filter((v) => canonical.has(v.slug));
}

export async function agentPages(): Promise<AgentPage[]> {
  const pages: AgentPage[] = [
    { file: "index.md", canonical: `${SITE_URL}/`, kind: "home", key: "home" },
    { file: "agents.md", canonical: `${SITE_URL}/agents.md`, kind: "agents", key: "agents" },
    ...ASSET_HUBS.map((a) => ({
      file: `${a.toLowerCase()}.md`,
      canonical: `${SITE_URL}/${a.toLowerCase()}`,
      kind: "asset" as const,
      key: a,
    })),
    ...PLATFORM_HUBS.map((p) => ({ file: `${p}.md`, canonical: `${SITE_URL}/${p}`, kind: "platform" as const, key: p })),
    ...NETWORKS.map((n) => ({ file: `${n.slug}.md`, canonical: `${SITE_URL}/${n.slug}`, kind: "network" as const, key: n.slug })),
  ];
  for (const v of await productScope()) {
    pages.push({ file: `${v.slug}.md`, canonical: `${SITE_URL}/${v.slug}`, kind: "product", key: v.slug });
  }
  return pages;
}

export async function renderAgentPage(file: string): Promise<string | null> {
  const page = (await agentPages()).find((p) => p.file === file);
  if (!page) return null;
  switch (page.kind) {
    case "home":
      return homeMd(page);
    case "agents":
      return agentsMd();
    case "asset":
      return assetMd(page);
    case "platform":
      return platformMd(page);
    case "network":
      return networkMd(page);
    case "product":
      return productMd(page);
  }
}

// ----------------------------------------------------------------- helpers

const cell = (s: string | number | null | undefined) =>
  s == null || s === "" ? "-" : String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

function tsIso(sec: number | null | undefined): string | null {
  return sec && Number.isFinite(sec) && sec > 0 ? new Date(sec * 1000).toISOString() : null;
}

async function asOfFor(vaults: YieldVault[]): Promise<string> {
  let newest = 0;
  for (const v of vaults) {
    const ts = freshness(await getVaultHistory(v.contractAddress)).freshestTs ?? 0;
    if (ts > newest) newest = ts;
  }
  return tsIso(newest) ?? new Date().toISOString();
}

function frontMatter(page: AgentPage, title: string, asOf: string): string {
  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    `canonical: ${page.canonical}`,
    `data_as_of: ${asOf}`,
    "source: Harvest on-chain yield index",
    "---",
    "",
  ].join("\n");
}

function citation(path: string): string {
  return `Harvest on-chain yield index, harvest.finance${path}`;
}

const RISK_URL = `${SITE_URL}/risk-framework`;
const METHODOLOGY_URL = `${SITE_URL}/methodology`;

function agentNotes(path: string, asOf: string, fees = "see the Harvest app."): string {
  return [
    "## Notes for AI agents",
    "",
    `- Figures are as of ${asOf}. APYs are variable and historical, not a promise of future returns.`,
    "- Before any transaction: confirm the chain ID, read the addresses on-chain, and get the user's explicit confirmation of the amount, the vault and the network. Never act without it.",
    "- Approve only the exact deposit amount, never an unlimited allowance.",
    `- Risks include smart-contract, strategy and underlying-protocol risk: ${RISK_URL}`,
    `- Fees: ${fees}`,
    "- Not financial advice.",
    `- Cite as: ${citation(path)}`,
    "",
  ].join("\n");
}

async function rankingTable(rows: YieldVault[]): Promise<string> {
  const products = new Set((await productScope()).map((v) => v.slug));
  const out = [
    "| # | Strategy | Protocol | Network | APY 24h | APY 30d | TVL | Markdown | Page |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  rows.forEach((v, i) => {
    out.push(
      `| ${i + 1} | ${cell(getCanonicalDisplayName(v))} | ${cell(stripChainSuffix(v.category, v.chain))} | ${cell(v.chain)} | ${formatAPY(v.apy24h)} | ${formatAPY(v.apy30d)} | ${formatTVL(v.tvl)} | ${
        products.has(v.slug) ? `[${v.slug}.md](${SITE_URL}/${v.slug}.md)` : "-"
      } | ${SITE_URL}/${v.slug} |`,
    );
  });
  return out.join("\n") + "\n";
}

function methodologyNote(): string {
  return `Ranked by 24-hour APY, highest first. APY 30d is the trailing 30-day average; for a strategy tracked under 30 days it is the average of the days tracked. APY and TVL come from Harvest's indexer, refreshed several times a day. Methodology: ${METHODOLOGY_URL}\n`;
}

async function hubMd(page: AgentPage, title: string, rows: YieldVault[], empty: string, path: string): Promise<string> {
  const asOf = await asOfFor(rows);
  return [
    frontMatter(page, title, asOf),
    `# ${title}`,
    "",
    rows.length ? `${rows.length} strategies, as ranked on ${page.canonical}.` : empty,
    "",
    rows.length ? await rankingTable(rows) : "",
    methodologyNote(),
    agentNotes(path, asOf),
  ].join("\n");
}

// ------------------------------------------------------------------- pages

async function homeMd(page: AgentPage): Promise<string> {
  const rows = homeRows(await getLiveVaults());
  return hubMd(page, "Best USDC, USDT, ETH, Bitcoin yields, and more.", rows, "No strategies indexed yet.", "/");
}

async function assetMd(page: AgentPage): Promise<string> {
  if (page.key === "ETH") {
    const md = await ethMd(page);
    if (md) return md;
  }
  const live = await getLiveVaults();
  const asset = page.key;
  const rows =
    asset === "USDC"
      ? buildUsdcCohort(live.filter((v) => v.asset === "USDC"), loadHistoryFile()).all
      : assetHubRows(live, asset);
  return hubMd(page, assetHubH1(asset), rows, `No ${asset} strategies indexed yet.`, `/${asset.toLowerCase()}`);
}

// /eth carries an answer, findings, per-network picks, strategy types, the
// staking comparison, risks and an FAQ above its ranking, so its Markdown page
// does too, from the same model (eth-hub-copy.ts) and in the page's order. The
// ranking table is the page's full index, row for row.
async function ethMd(page: AgentPage): Promise<string | null> {
  const m = await ethPageModel();
  if (!m) return null;
  const { c } = m;
  const title = ETH_HUB_H1;
  const asOf = c.asOfIso;
  const link = (part: string | { text: string; href: string }) =>
    typeof part === "string" ? part : `[${part.text}](${part.href})`;
  const out: string[] = [
    frontMatter(page, title, asOf),
    `# ${title}`,
    "",
    "## Summary",
    "",
    // Same opening as the HTML page: the top rate first, then the best above
    // the floor.
    m.heroAnswer,
    "",
    ...m.findings.map((f) => `- ${f}`),
    "",
    `Every rate is the APY of a Harvest vault built on the named protocol, after Harvest's fee on harvested yield (${HARVEST_FEE_TEXT}). Autopilot is Harvest's own allocator. Liquid staking tokens such as stETH and rETH are not ranked.`,
    "",
    "## Ranking",
    "",
    `${c.count} strategies, as ranked on ${page.canonical}. Strategies holding under ${formatTVL(LOW_LIQUIDITY_TVL_THRESHOLD)} are included; the headline figures above use that floor.`,
    "",
    await rankingTable(c.all),
    methodologyNote(),
    "## Where to earn ETH yield by network",
    "",
  ];
  for (const n of m.nets) {
    out.push(`### ETH yield on ${n.chain} (${isL2(n.chain) ? "layer 2" : "mainnet"})`, "");
    out.push(`${n.count} ${n.count === 1 ? "strategy" : "strategies"}, ${formatTVL(n.tvl)} tracked. ${networkSentence(n, c)}`, "");
    for (const v of n.picks) {
      out.push(`- ${proseName(v)}: ${formatAPY(v.apy24h)} APY, ${SINGULAR[strategyTypeOf(v)]}, ${formatTVL(v.tvl)} (${SITE_URL}/${v.slug})`);
    }
    if (n.picks.length) out.push("");
  }
  out.push("## Strategy types", "");
  for (const t of m.types) {
    out.push(
      `- ${t.label}: ${t.count} ${t.count === 1 ? "strategy" : "strategies"}, median ${formatAPY(t.medianApy)}, ${formatTVL(t.tvl)} tracked` +
        (t.bestFunded ? `; best funded ${proseName(t.bestFunded)} at ${formatAPY(t.bestFunded.apy24h)}.` : ".") +
        ` ${TYPE_BLURB[t.type]}`,
    );
  }
  out.push("", "## ETH yield versus staking", "", STAKING_LEAD, "");
  if (m.staking) {
    out.push(`${stakingReferenceText(c, m.staking)} Source: ${stakingSourceUrl(m.staking)}`, "");
  }
  out.push("## ETH yield by protocol", "", venueLead(m.venues), "");
  for (const v of m.venues) out.push(`- ${venueLine(v)}`);
  out.push("", "## Risks on every ETH yield strategy", "", ETH_RISKS_LEAD, "");
  for (const r of ETH_RISKS) out.push(`- **${r.title}**${r.parts.map(link).join("")}`);
  out.push("", `More: ${RISK_URL}`, "", "## Questions and answers", "");
  for (const f of m.faqs) out.push(`### ${f.q}`, "", f.a, "");
  out.push(agentNotes("/eth", asOf, `${HARVEST_FEE_TEXT} of harvested yield, already deducted from every APY shown.`));
  return out.join("\n");
}

async function platformMd(page: AgentPage): Promise<string> {
  const platform = getPlatform(page.key)!;
  const rows = platformHubRows(await getLiveVaults(), platform);
  return hubMd(page, platformHubH1(platform.display), rows, `No ${platform.display} strategies indexed yet.`, `/${page.key}`);
}

async function networkMd(page: AgentPage): Promise<string> {
  const n = NETWORKS.find((x) => x.slug === page.key)!;
  const rows = networkHubRows(await getLiveVaults(), n.chain);
  return hubMd(page, networkHubH1(n.display), rows, `No ${n.display} strategies indexed yet.`, `/${n.slug}`);
}

async function productMd(page: AgentPage): Promise<string> {
  const v = (await productScope()).find((x) => x.slug === page.key)!;
  const history: FullVaultHistory = await getVaultHistory(v.contractAddress);
  const holders = (await getHoldersMap())[v.contractAddress.toLowerCase()] ?? null;
  const days = trackedDays(history);
  const asOf = tsIso(freshness(history).freshestTs) ?? new Date().toISOString();
  const name = getCanonicalDisplayName(v);
  const lp = getLpPair(v);
  const d = depositFor(v);
  const app = harvestAppUrl(v.chain, v.contractAddress);
  const path = `/${v.slug}`;

  const about = lp
    ? buildLpPairAbout(v, history, holders)
    : v.vaultType === "Autopilot"
      ? (() => {
          const a = buildAutopilotAbout(v, history, holders);
          return { intro: a.intro, rewards: a.engine, liveline: a.liveline };
        })()
      : buildAutocompounderAbout(v, history, holders);

  const rewardSymbols = v.rewardTokens?.length ? [...new Set(v.rewardTokens.map((r) => r.symbol))].join(", ") : null;
  const figures: [string, string][] = [
    // Labels match the product page sidebar, which scripts/check-markdown.mjs
    // compares these values against.
    ["24h APY", formatAPY(v.apy24h)],
    // Under 30 days of history the figure is the mean of the days tracked,
    // and the page labels it accordingly.
    [days > 0 && days < 30 ? "Avg APY" : "30d avg APY", formatAPY(v.apy30d)],
    ["TVL", formatTVL(v.tvl)],
    ["Holders", holders !== null ? holders.toLocaleString("en-US") : "-"],
    ["Tracked for", days > 0 ? `${days} days` : "-"],
    ...(rewardSymbols ? [["Reward tokens", rewardSymbols] as [string, string]] : []),
  ];

  const chainId = d?.chainId ?? null;
  const contracts: [string, string][] = [
    ["Network", chainId ? `${v.chain} (chain ID ${chainId})` : v.chain],
    [
      "Vault (share token)",
      `\`${v.contractAddress}\`${explorerAddressUrl(v.chain, v.contractAddress) ? ` ${explorerAddressUrl(v.chain, v.contractAddress)}` : ""}${d?.shareDecimals != null ? `, ${d.shareDecimals} decimals` : ""}`,
    ],
    ...(v.tokenAddress
      ? [
          [
            "Deposit token",
            `${d?.depositTokenSymbol ? `${d.depositTokenSymbol} ` : ""}\`${v.tokenAddress}\`${explorerAddressUrl(v.chain, v.tokenAddress) ? ` ${explorerAddressUrl(v.chain, v.tokenAddress)}` : ""}${d?.depositTokenDecimals != null ? `, ${d.depositTokenDecimals} decimals` : ""}`,
          ] as [string, string],
        ]
      : []),
    ...(v.strategyAddress ? [["Strategy", `\`${v.strategyAddress}\``] as [string, string]] : []),
    ["Vault type", v.vaultType],
    ["Deposit interface", interfaceLabel(d)],
    ["Harvest app", app],
  ];

  const lines = [
    frontMatter(page, name, asOf),
    `# ${name}`,
    "",
    `> ${productMetaDescription(v)}`,
    "",
    "## Overview",
    "",
    ...(about ? [about.intro, "", about.rewards, "", ...(about.liveline ? [about.liveline, ""] : [])] : []),
    "## Key figures",
    "",
    "| Metric | Value |",
    "|---|---|",
    ...figures.map(([k, val]) => `| ${k} | ${cell(val)} |`),
    "",
    ...(isLowLiquidityTvl(v.tvl)
      ? [
          `This strategy currently holds ${formatTVL(v.tvl)}, below our ${formatTVL(LOW_LIQUIDITY_TVL_THRESHOLD)} liquidity mark. Thin liquidity can mean higher slippage on entry and exit, and the headline yield can be skewed by a small number of holders.`,
          "",
        ]
      : []),
    "## Contracts",
    "",
    "| Field | Value |",
    "|---|---|",
    ...contracts.map(([k, val]) => `| ${k} | ${cell(val)} |`),
    "",
    ...depositSections(v, d, app, lp ? `${v.asset}/${lp.counterpart}` : null, lp?.platform ?? null),
    "## Risks",
    "",
    "- Smart-contract, strategy and underlying-protocol risk apply to every strategy.",
    ...(lp ? ["- This vault holds a liquidity-pool position in two tokens, so its value moves with both."] : []),
    `- Risk framework: ${RISK_URL}`,
    "",
    "## Data",
    "",
    `- Page: ${SITE_URL}${path}`,
    `- JSON: ${SITE_URL}/data/${v.slug}.json`,
    ...(hasDatasetDownload(history) ? [`- History (CSV): ${SITE_URL}${historyCsvHref(v.slug)}`] : []),
    "",
    agentNotes(path, asOf),
  ];
  return lines.join("\n");
}

function interfaceLabel(d: DepositInterface | null): string {
  if (!d || d.interface === "unverified") return "not verified on-chain";
  const date = d.checkedAt.slice(0, 10);
  const what = d.interface === "erc4626" ? "ERC-4626" : "Harvest vault";
  return `${what}, verified at block ${d.checkedBlock} on ${date}`;
}

function depositSections(
  v: YieldVault,
  d: DepositInterface | null,
  app: string,
  lpPair: string | null,
  lpPlatform: string | null,
): string[] {
  const out: string[] = ["## How to deposit", ""];
  if (!d || d.interface === "unverified") {
    out.push(
      "Call-level steps are not listed: this vault's deposit interface has not been verified on-chain. Deposit through the Harvest app:",
      "",
      app,
      "",
      "## How to withdraw",
      "",
      `Withdraw through the Harvest app: ${app}`,
      "",
    );
    return out;
  }
  const dec = d.depositTokenDecimals;
  const sym = d.depositTokenSymbol ?? "the deposit token";
  const lpLine = lpPair
    ? [`The deposit token is the ${lpPair} liquidity-pool token on ${lpPlatform}. The user must already hold that LP token; it is obtained on ${lpPlatform}, not through this vault.`, ""]
    : [];
  if (d.interface === "erc4626") {
    if (d.depositsOpen === false) {
      out.push(`\`maxDeposit\` returned 0 at block ${d.checkedBlock}: this vault is not accepting deposits.`, "");
    } else {
      out.push(
        ...lpLine,
        `1. On the vault, confirm \`asset()\` returns ${sym} \`${d.depositToken}\`.`,
        `2. Optionally call \`previewDeposit(uint256 assets)\` to see the shares a deposit would mint. Amounts are in ${sym} units (${dec} decimals).`,
        `3. On ${sym}, call \`approve(address spender, uint256 amount)\` with spender = the vault and amount = exactly the deposit.`,
        "4. On the vault, call `deposit(uint256 assets, address receiver)`. The vault mints its share token to `receiver`.",
        "",
      );
    }
    out.push(
      "## How to withdraw",
      "",
      "- `redeem(uint256 shares, address receiver, address owner)` burns shares and returns the deposit token.",
      "- `withdraw(uint256 assets, address receiver, address owner)` returns an exact amount of the deposit token.",
      `- \`previewRedeem(uint256 shares)\` shows the deposit token a redemption returns. Shares use ${d.shareDecimals} decimals.`,
      "",
    );
    return out;
  }
  out.push(
    ...lpLine,
    `1. On the vault, confirm \`underlying()\` returns ${sym} \`${d.depositToken}\`.`,
    `2. On ${sym}, call \`approve(address spender, uint256 amount)\` with spender = the vault and amount = exactly the deposit, in ${sym} units (${dec} decimals).`,
    "3. On the vault, call `deposit(uint256 amount)`. The vault mints its share token (fToken) to the caller.",
    "",
    `Rewards may require staking in the Harvest app: ${app}`,
    "",
    "## How to withdraw",
    "",
    `- On the vault, call \`withdraw(uint256 numberOfShares)\`. Shares use ${d.shareDecimals} decimals.`,
    "- `getPricePerFullShare()` reports the value of one share in the deposit token.",
    "",
  );
  return out;
}

function agentsMd(): string {
  const f = depositFile();
  const chains = NETWORKS.map((n) => {
    const c = f?.chains?.[n.chain];
    return `| ${n.display} | ${c?.chainId ?? "-"} | ${c?.rpcs?.length ? "yes" : "not yet"} |`;
  });
  const asOf = f?.generatedAt ?? new Date().toISOString();
  return [
    "---",
    'title: "Harvest for AI agents"',
    `canonical: ${SITE_URL}/agents.md`,
    `data_as_of: ${asOf}`,
    "source: Harvest on-chain yield index",
    "---",
    "",
    "# Harvest for AI agents",
    "",
    "Harvest is an on-chain DeFi yield index. It ranks yield strategies by live APY and TVL, read from vault contracts by Harvest's own indexer, and links each strategy to the Harvest app.",
    "",
    "## Files",
    "",
    "Every ranking and product page has a Markdown version at the same path with `.md` added. Each carries the same figures as the page, plus contract addresses, chain IDs and token decimals.",
    "",
    `- Home ranking: ${SITE_URL}/index.md`,
    `- Asset rankings: ${ASSET_HUBS.map((a) => `${SITE_URL}/${a.toLowerCase()}.md`).join(", ")}`,
    `- Platform rankings: ${PLATFORM_HUBS.map((p) => `${SITE_URL}/${p}.md`).join(", ")}`,
    `- Network rankings: ${NETWORKS.map((n) => `${SITE_URL}/${n.slug}.md`).join(", ")}`,
    `- One product: ${SITE_URL}/<slug>.md, linked from every ranking`,
    `- Machine-readable data: ${SITE_URL}/data/<slug>.json per product, ${SITE_URL}/data/index.json for all`,
    "",
    "## Chain IDs",
    "",
    "Checked against `eth_chainId` by the daily interface check.",
    "",
    "| Network | Chain ID | Checked |",
    "|---|---|---|",
    ...chains,
    "",
    "## Vault interfaces",
    "",
    "A product page lists call-level deposit steps only when its vault's interface was verified on-chain. Follow call-level steps only when the page marks the interface as verified; otherwise use the Harvest app link on that page.",
    "",
    "**ERC-4626** (Autopilot vaults):",
    "",
    "```",
    "function asset() view returns (address)",
    "function decimals() view returns (uint8)",
    "function previewDeposit(uint256 assets) view returns (uint256)",
    "function maxDeposit(address receiver) view returns (uint256)",
    "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
    "function previewRedeem(uint256 shares) view returns (uint256)",
    "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
    "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
    "```",
    "",
    "**Harvest vault** (Autocompounder vaults):",
    "",
    "```",
    "function underlying() view returns (address)",
    "function decimals() view returns (uint8)",
    "function getPricePerFullShare() view returns (uint256)",
    "function deposit(uint256 amount)",
    "function withdraw(uint256 numberOfShares)",
    "```",
    "",
    "Verified means: the vault's `asset()` (ERC-4626) or `underlying()` (Harvest vault) returns the page's deposit token, `decimals()` reads on the vault and the token, and `previewDeposit` or `getPricePerFullShare` returns a positive value, at the block shown on the page.",
    "",
    agentNotes("/agents.md", asOf),
  ].join("\n");
}
