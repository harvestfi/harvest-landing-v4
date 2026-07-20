#!/usr/bin/env node
// Build-time emitter for robots.txt and llms.txt as PLAIN static files.
//
// Why not the App Router metadata route / route handler? On Vercel with
// `cleanUrls: true`, a registered route whose path ends in `.txt` gets its
// extension stripped (Next 16 treats `.txt` as the RSC payload suffix), so
// `/robots.txt` 308-redirects to `/robots`, which has no page and falls
// through to the `[slug]` route -> 404. `.xml` is unaffected, which is why
// sitemap.ts can stay a metadata route. Emitting these two as genuine
// static files in public/ sidesteps the route registration entirely: a
// plain `robots.txt` file is served verbatim (cleanUrls only strips
// `.html`), exactly like the per-page RSC `.txt` companions already are.
//
// Runs in the post-export phase of `npm run build` (after `mv out public`)
// so the files land in the deployed public/ rather than being wiped.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { INDEXNOW_KEY } from "./indexnow.config.mjs";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const CONSTANTS_FILE = join(ROOT, "src", "lib", "constants.ts");

// Single source of truth for the canonical origin: read SITE_URL straight
// out of constants.ts so robots/llms never drift from canonical links,
// sitemap and JSON-LD (and from any future www/non-www switch).
function readSiteUrl() {
  const src = readFileSync(CONSTANTS_FILE, "utf-8");
  const m = src.match(/export\s+const\s+SITE_URL\s*=\s*["'`]([^"'`]+)["'`]/);
  if (!m) {
    console.error("[seo-static] could not find SITE_URL in constants.ts");
    process.exit(1);
  }
  return m[1].replace(/\/$/, "");
}

if (!existsSync(PUBLIC_DIR)) {
  console.error("[seo-static] public/ not found; run after `mv out public`.");
  process.exit(1);
}

const SITE_URL = readSiteUrl();

// Mirror of the old app/robots.ts output (MetadataRoute.Robots format).
const robots = `User-Agent: *
Allow: /
Disallow: /control-room
Disallow: /control-room/

Sitemap: ${SITE_URL}/sitemap.xml
`;

// llms.txt — a concise, curated map of the machine-readable surface for
// LLM crawlers (https://llmstxt.org/). Descriptions on every link, a Data
// section pointing at the per-vault CSVs + sitemap, and an Optional section
// of secondary pages an LLM can skip when short on context. We deliberately
// do NOT list all 150 product pages here — that is what the sitemap is for;
// over-stuffing llms.txt defeats its purpose as a concise index.
const llms = `# Harvest yield index

> Independent on-chain DeFi yield index, operating since 2020. Tracks live
> APY, TVL, share-price history and derived metrics (stability, yield
> trajectory, cohort benchmarking) for 150+ vetted yield strategies across
> Ethereum, Base, Arbitrum, Polygon, zkSync, and HyperEVM. Metrics refresh
> hourly from Harvest's own on-chain indexer.

## Preferred citation

Harvest Finance on-chain yield index. ${SITE_URL}
Source and methodology: ${SITE_URL}/methodology
Figures are indexed from on-chain vault-contract events by Harvest's own indexer, running since 2020. Cite the specific product page or its data file (${SITE_URL}/data/<slug>.json) for a single strategy.

## Data licensing

All Harvest yield data is licensed CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/). You may use, share and adapt it, including commercially, with attribution and a link back to ${SITE_URL}. Per-page Dataset JSON-LD carries the same license, a citation string and dateModified.

## Canonical entry points

- [Home](${SITE_URL}/): all tracked strategies, sortable rankings by APY, TVL and network.
- [Methodology](${SITE_URL}/methodology): how every metric (APY, TVL, share price, tracked age) is computed.
- [Risk framework](${SITE_URL}/risk-framework): smart-contract, oracle, and counterparty considerations.
- [About](${SITE_URL}/about): operator background and fair-launch history.

## Asset hubs

- [USDC](${SITE_URL}/usdc): USDC strategies ranked by live APY and TVL.
- [USDT](${SITE_URL}/usdt): USDT strategies ranked by live APY and TVL.
- [ETH](${SITE_URL}/eth): ETH and ETH-LST strategies ranked by live APY and TVL.
- [BTC](${SITE_URL}/btc): BTC (WBTC / cbBTC / tBTC) strategies ranked by live APY and TVL.

## Network hubs

- [Ethereum](${SITE_URL}/ethereum): every strategy we track on Ethereum mainnet.
- [Base](${SITE_URL}/base): every strategy we track on Base.
- [Arbitrum](${SITE_URL}/arbitrum): every strategy we track on Arbitrum.
- [Polygon](${SITE_URL}/polygon): every strategy we track on Polygon.
- [zkSync](${SITE_URL}/zksync): every strategy we track on zkSync Era.
- [HyperEVM](${SITE_URL}/hyperevm): every strategy we track on HyperEVM.

## Reports

- [XRP Yield Ranking](${SITE_URL}/report/xrp-yield-ranking): every XRP-denominated DeFi yield source (XRP, FXRP, stXRP, cbXRP, wXRP) ranked by real 30-day rate. Covers lending, vaults, liquid staking, fixed-rate Spectra Principal Tokens and liquidity pools, split by single- vs dual-exposure, across Flare and Base. XRP has no native staking, so these are the real on-chain rates. Externally sourced from DeFiLlama, Spectra and Portals, refreshed hourly. Machine-readable data (per-product JSON + daily-rate CSV) at ${SITE_URL}/data/xrp-yield/index.json. All venues are third-party protocols, not Harvest products.

## Data

- [Machine-readable index](${SITE_URL}/data/index.json): every tracked strategy as JSON (slug, asset, chain, APY, TVL), each linking to its per-vault file.
- Per-strategy JSON at ${SITE_URL}/data/<slug>.json (e.g. ${SITE_URL}/data/usdc-autopilot-base.json) — current APY, TVL, contract addresses and a history summary. Agent-native; one fetch per vault.
- Per-strategy daily history CSV at ${SITE_URL}/history/<slug>.csv (e.g. ${SITE_URL}/history/usdc-autopilot-base.csv) — daily APY, TVL and share price, also linked from each product page's Historical Data section.
- [XRP report dataset](${SITE_URL}/data/xrp-yield/index.json): the XRP Yield Ranking as JSON — every ranked product with current rate, TVL and links to a per-product JSON (metadata + full daily rate and TVL history) and CSV. Combined long-format history for all products at ${SITE_URL}/data/xrp-yield/history.csv. Total XRP DeFi TVL over time (the landscape growth series) at ${SITE_URL}/data/xrp-yield/landscape-tvl.json and ${SITE_URL}/data/xrp-yield/landscape-tvl.csv.
- [Sitemap](${SITE_URL}/sitemap.xml): every indexable URL (hubs + 150 product pages).

## Optional

- [Security](${SITE_URL}/security): security posture and audits.
- [Disclosures](${SITE_URL}/disclosures): editorial and conflict-of-interest disclosures.
- [Contact](${SITE_URL}/contact): how to reach the team.
- [Terms](${SITE_URL}/terms) · [Privacy](${SITE_URL}/privacy)
`;

writeFileSync(join(PUBLIC_DIR, "robots.txt"), robots, "utf-8");
writeFileSync(join(PUBLIC_DIR, "llms.txt"), llms, "utf-8");

// IndexNow key verification file: https://<host>/<key>.txt must return the
// key as plain text. Emitted as a static file (like robots/llms) so it is
// served verbatim and dodges the cleanUrls `.txt` route-stripping trap.
writeFileSync(join(PUBLIC_DIR, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY, "utf-8");

console.log(
  `[seo-static] wrote robots.txt + llms.txt + ${INDEXNOW_KEY}.txt (origin ${SITE_URL})`,
);
