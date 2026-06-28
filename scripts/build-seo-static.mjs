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

// Mirror of the old app/llms.txt/route.ts body.
const llms = `# Harvest yield index

> Independent on-chain DeFi yield index. Tracks live APY, TVL, and share-price history for vetted yield strategies across Ethereum, Base, Arbitrum, Polygon, zkSync, and HyperEVM.

## Canonical entry points

- [Home](${SITE_URL}/): all tracked strategies, sortable rankings.
- [Methodology](${SITE_URL}/methodology): how every metric is computed.
- [Risk framework](${SITE_URL}/risk-framework): smart-contract, oracle, and counterparty considerations.
- [About](${SITE_URL}/about): operator background, fair-launch history.

## Asset hubs

- [USDC](${SITE_URL}/usdc)
- [USDT](${SITE_URL}/usdt)
- [ETH](${SITE_URL}/eth)
- [BTC](${SITE_URL}/btc)

## Network hubs

- [Ethereum](${SITE_URL}/ethereum)
- [Base](${SITE_URL}/base)
- [Arbitrum](${SITE_URL}/arbitrum)
- [Polygon](${SITE_URL}/polygon)
- [zkSync](${SITE_URL}/zksync)
- [HyperEVM](${SITE_URL}/hyperevm)

## Sitemap

- ${SITE_URL}/sitemap.xml
`;

writeFileSync(join(PUBLIC_DIR, "robots.txt"), robots, "utf-8");
writeFileSync(join(PUBLIC_DIR, "llms.txt"), llms, "utf-8");

console.log(`[seo-static] wrote robots.txt + llms.txt (origin ${SITE_URL})`);
