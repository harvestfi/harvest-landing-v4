# Harvest — XRP Yield Ranking report: full page audit

> Complete front-to-back snapshot of `/report/xrp-yield-ranking`, for external (human or AI) review of content, SEO, structured data, internal linking, the machine-readable data layer, and the front/back-end architecture. Extracted from the built static HTML + the source pipeline. **Regenerated to include the latest work (see the Changelog at the end).**

- **URL:** https://harvest.finance/report/xrp-yield-ranking
- **Data snapshot (dateModified):** 2026-07-19T19:09:53.763Z
- **Tracked products:** 14 · **Networks:** Base, Flare · **Median 30d rate:** 2.42% · **Incentivized:** 8/14 · **Total TVL:** $100.9M
- **Framework:** Next.js (App Router) static export (`output: "export"`). Page is a React Server Component; interactive pieces are client components.

---

## 1. SEO metadata (rendered `<head>`)

| Field | Value |
|---|---|
| Title tag | Best XRP Yield 2026: List of 10+ DeFi Products ranked by APY \| Harvest |
| Meta description | Where to earn yield on XRP, ranked by top rates. Over 10 XRP-denominated yield sources across 2 networks. Discover vaults, lending markets, Principal Tokens, and liquidity pools for XRP, FXRP, stXRP, and cbXRP. |
| Canonical | https://harvest.finance/report/xrp-yield-ranking |
| Robots | index, follow |
| og:title | Best XRP Yield 2026: List of 10+ DeFi Products ranked by APY |
| og:description | Where to earn yield on XRP, ranked by top rates. Over 10 XRP-denominated yield sources across 2 networks. Discover vaults, lending markets, Principal Tokens, and liquidity pools for XRP, FXRP, stXRP, and cbXRP. |
| og:type | article |
| og:url | https://harvest.finance/report/xrp-yield-ranking |
| og:image | https://harvest.finance/report/xrp-yield-ranking/opengraph-image?d2315f86ee8d07d5 |
| og:image:width | 1200 |
| og:image:height | 630 |
| twitter:card | summary_large_image |
| twitter:title | Best XRP Yield 2026: List of 10+ DeFi Products ranked by APY |
| twitter:description | Where to earn yield on XRP, ranked by top rates. Over 10 XRP-denominated yield sources across 2 networks. Discover vaults, lending markets, Principal Tokens, and liquidity pools for XRP, FXRP, stXRP, and cbXRP. |
| twitter:image | https://harvest.finance/report/xrp-yield-ranking/twitter-image?8173c42c2227b9ce |

**Notes**
- Title is intent-first (*best xrp yield*), year-stamped (*2026*), list-shaped (*10+ … ranked by APY*).
- The **same** title + description are emitted across page title, canonical, Open Graph **and** Twitter (explicit `twitter:title`/`twitter:description`), so the shared snippet is identical everywhere.
- `10+` / `Over 10` are evergreen; the network count is live-derived. Canonical self-referential; robots = index,follow.
- Custom **1200×630 OG/Twitter card** via `opengraph-image.tsx` (`next/og`) with live Products / Networks / Median-rate stats; footer label + image URL + canonical all resolve to `harvest.finance` (via `SITE_URL`).

---

## 2. Structured data (JSON-LD)

**8 nodes.** `Organization` + `WebSite` are site-wide (root layout); the rest are page-specific.

### Organization

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Harvest",
  "url": "https://harvest.finance",
  "logo": "https://harvest.finance/icon.png",
  "description": "Compare every DeFi yield strategy we track, across Ethereum, Base, Arbitrum and more. Live APY for USDC, USDT, ETH and Bitcoin, refreshed hourly.",
  "foundingDate": "2020",
  "slogan": "Independent onchain DeFi yield index",
  "areaServed": "Worldwide",
  "knowsAbout": [
    "DeFi yield",
    "yield aggregation",
    "autocompounding vaults",
    "APY",
    "TVL",
    "stablecoin yield",
    "USDC yield",
    "USDT yield",
    "ETH yield",
    "Bitcoin yield",
    "Ethereum",
    "Base",
    "Arbitrum",
    "Polygon",
    "zkSync",
    "HyperEVM"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "url": "https://harvest.finance/contact"
  },
  "sameAs": [
    "https://app.harvest.finance/",
    "https://x.com/harvest_finance",
    "https://harvestfinance.medium.com/",
    "https://discord.gg/xHXe3tYjPY",
    "https://github.com/harvestfi",
    "https://docs.harvest.finance/",
    "https://defillama.com/protocol/harvest-finance",
    "https://www.coingecko.com/en/coins/harvest-finance"
  ]
}
```

### WebSite

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Harvest",
  "url": "https://harvest.finance",
  "description": "Compare every DeFi yield strategy we track, across Ethereum, Base, Arbitrum and more. Live APY for USDC, USDT, ETH and Bitcoin, refreshed hourly.",
  "publisher": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://harvest.finance/?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

### BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Harvest",
      "item": "https://harvest.finance"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Report"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "XRP Yield Ranking"
    }
  ]
}
```

### WebPage

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "XRP Yield Ranking",
  "url": "https://harvest.finance/report/xrp-yield-ranking",
  "description": "Where to earn yield on XRP, ranked by real 30-day rates across 14 DeFi venues.",
  "dateModified": "2026-07-19T19:09:53.763Z",
  "isBasedOn": "https://harvest.finance/methodology",
  "publisher": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  }
}
```

### Article

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "XRP Yield Ranking: Where XRP Actually Earns",
  "description": "Where to earn yield on XRP across 14 DeFi products (XRP, FXRP, stXRP and cbXRP) on 2 networks, ranked by real 30-day rate. Lending, vaults, fixed-rate Principal Tokens and liquidity pools; XRP has no native staking, so these are the real onchain rates. Informational research, refreshed hourly.",
  "url": "https://harvest.finance/report/xrp-yield-ranking",
  "datePublished": "2026-07-01T00:00:00Z",
  "dateModified": "2026-07-19T19:09:53.763Z",
  "author": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  }
}
```

### Dataset

```json
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "XRP DeFi yield ranking dataset",
  "description": "Rate, TVL and 90-day range for 14 curated XRP-denominated DeFi products (lending, vaults, liquid staking, fixed-rate Principal Tokens and liquidity pools) across 2 networks, refreshed hourly. Sourced from the DeFiLlama, Spectra and Portals APIs; informational research, not financial advice.",
  "url": "https://harvest.finance/report/xrp-yield-ranking",
  "creator": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Harvest",
    "url": "https://harvest.finance"
  },
  "dateModified": "2026-07-19T19:09:53.763Z",
  "isBasedOn": [
    "https://defillama.com",
    "https://spectra.finance"
  ],
  "size": "14 venues",
  "keywords": [
    "XRP",
    "FXRP",
    "stXRP",
    "cbXRP",
    "DeFi",
    "yield",
    "APY",
    "TVL",
    "Principal Token"
  ],
  "isAccessibleForFree": true,
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "distribution": [
    {
      "@type": "DataDownload",
      "encodingFormat": "application/json",
      "contentUrl": "https://harvest.finance/data/xrp-yield/index.json"
    },
    {
      "@type": "DataDownload",
      "encodingFormat": "text/csv",
      "contentUrl": "https://harvest.finance/data/xrp-yield/history.csv"
    }
  ]
}
```

### ItemList

```json
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "url": "https://harvest.finance/report/xrp-yield-ranking",
  "numberOfItems": 14,
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "cbXRP / WETH on Aerodrome",
      "url": "https://aerodrome.finance/connect?to=%2Fdeposit%3Ftoken0%3D0x4200000000000000000000000000000000000006%26token1%3D0xcb585250f852C6c6bf90434AB21A00f02833a4af%26type%3D100%26chain0%3D8453%26chain1%3D8453%26factory%3D0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "cbXRP / cbBTC on Aerodrome",
      "url": "https://aerodrome.finance/connect?to=%2Fdeposit%3Ftoken0%3D0xcb585250f852C6c6bf90434AB21A00f02833a4af%26token1%3D0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf%26type%3D100%26chain0%3D8453%26chain1%3D8453%26factory%3D0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "stXRP on Spectra",
      "url": "https://app.spectra.finance/fixed-rate/flare:0x22ebdb0a469a9f7ba4a287ea3c1c420762d98db9"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "stXRP on Spectra",
      "url": "https://app.spectra.finance/fixed-rate/flare:0x966d1f376457a3aca5fbc2a6be985f6e5e7708eb"
    },
    {
      "@type": "ListItem",
      "position": 5,
      "name": "FXRP on Superform",
      "url": "https://app.superform.xyz/vault/14_0x34f90dfa0f1b2f691ee3a3a87954f8d282193c16"
    },
    {
      "@type": "ListItem",
      "position": 6,
      "name": "FXRP on Spectra",
      "url": "https://app.spectra.finance/metavaults/flare:0x0c4f32c53d4b91a019c7c9d8da14af140295eef6"
    },
    {
      "@type": "ListItem",
      "position": 7,
      "name": "stXRP on Spectra",
      "url": "https://app.spectra.finance/pools/flare:0x966d1f376457a3aca5fbc2a6be985f6e5e7708eb"
    },
    {
      "@type": "ListItem",
      "position": 8,
      "name": "stXRP on Spectra",
      "url": "https://app.spectra.finance/pools/flare:0x22ebdb0a469a9f7ba4a287ea3c1c420762d98db9"
    },
    {
      "@type": "ListItem",
      "position": 9,
      "name": "FXRP on Mystic Finance",
      "url": "https://app.mysticfinance.xyz/vault?vaultAddress=0x53184adabf312b490bf1ebcfdc896feff6019a14&chainId=14"
    },
    {
      "@type": "ListItem",
      "position": 10,
      "name": "FXRP on Upshift",
      "url": "https://app.upshift.finance/pools/14/0x373D7d201C8134D4a2f7b5c63560da217e3dEA28"
    },
    {
      "@type": "ListItem",
      "position": 11,
      "name": "stXRP / FXRP on SparkDEX",
      "url": "https://sparkdex.ai/pool/v4/add"
    },
    {
      "@type": "ListItem",
      "position": 12,
      "name": "FXRP on Kinetic",
      "url": "https://app.kinetic.market/market"
    },
    {
      "@type": "ListItem",
      "position": 13,
      "name": "FXRP on Upshift",
      "url": "https://app.upshift.finance/pools/14/0x2439D4bb753A0f3777d4C9011AFacc475ba6B951"
    },
    {
      "@type": "ListItem",
      "position": 14,
      "name": "cbXRP on Moonwell",
      "url": "https://moonwell.fi/markets/supply/base/cbxrp"
    }
  ]
}
```

### FAQPage

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can you stake XRP?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. XRP is not a proof-of-stake asset and has no native staking or validator rewards. The rates people call XRP staking actually come from lending XRP, providing liquidity, or holding a liquid staking token such as stXRP that stakes wrapped XRP on the holder's behalf."
      }
    },
    {
      "@type": "Question",
      "name": "Does XRP have staking rewards?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. XRP has no native staking or validator rewards, so there is no protocol staking rate. What is marketed as XRP staking rewards is really lending interest, liquidity-pool fees, or the yield on a liquid staking token such as stXRP that stakes wrapped XRP behind the scenes. Each is a market rate with its own risk, not an inflation reward."
      }
    },
    {
      "@type": "Question",
      "name": "How do you earn interest on XRP?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You move XRP onto a smart-contract chain as a wrapped token such as FXRP or cbXRP, then put it to work: supply it to a lending market to earn borrower interest, deposit it in a curated vault, hold a fixed-rate Principal Token, or add it to a liquidity pool for swap fees. The rate depends on the venue and the wrapper; this report ranks the main options by their real 30-day rate."
      }
    },
    {
      "@type": "Question",
      "name": "What is the best XRP yield right now?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "It depends on risk appetite, but the deepest and most active XRP yield sits with the venues highlighted above: Spectra's staked-XRP Principal Tokens and MetaVault, averaging about 2.91%, and the Clearstar Labs earnXRP vault on Upshift, the single largest at $36.5M. As a benchmark, the capital-weighted average across the 14 tracked products is about 1.65%. Two-asset pools post higher headline rates but add impermanent loss and usually lean on incentives, so the ranking sorts every venue by its real 30-day average."
      }
    },
    {
      "@type": "Question",
      "name": "What are FXRP, stXRP and cbXRP?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "They are wrapped forms of XRP. FXRP is XRP bridged trustlessly onto Flare through the FAssets system; cbXRP is Coinbase-custodied wrapped XRP on Base; stXRP is Firelight's liquid staking token for FXRP. The choice of wrapper changes the trust model and the risk."
      }
    },
    {
      "@type": "Question",
      "name": "FXRP vs cbXRP: what is the difference?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Both are wrapped XRP, but the trust model differs. FXRP is minted trustlessly on Flare through the FAssets system, over-collateralized by independent agents while the real XRP stays on the XRP Ledger. cbXRP is Coinbase-custodied wrapped XRP on Base, backed 1:1 by XRP that Coinbase holds, with published proof of reserves. FXRP leans on onchain collateral; cbXRP leans on a single custodian."
      }
    },
    {
      "@type": "Question",
      "name": "Is earning yield on XRP safe?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No DeFi yield is risk-free. On top of ordinary market risk, XRP yield adds bridge or custody risk on the wrapper, smart-contract and oracle risk on each venue, impermanent loss in pools, and reliance on incentive tokens that can fade. This page is informational research only."
      }
    },
    {
      "@type": "Question",
      "name": "What is impermanent loss in an XRP liquidity pool?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "It is the gap between simply holding two tokens and supplying them to a pool. When the two prices drift apart, the pool rebalances against the position, so it can end up worth less than holding, even after the fees and rewards it earned."
      }
    },
    {
      "@type": "Question",
      "name": "CeFi vs DeFi XRP yield, which is better?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Neither is strictly better. Centralized Earn programs are simpler and sometimes pay more, but custody is given up and counterparty risk is taken on. DeFi keeps positions onchain and verifiable with self-custody, but adds smart-contract and bridge risk. This report tracks the DeFi side."
      }
    },
    {
      "@type": "Question",
      "name": "What is the highest APY for XRP?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The highest numbers here are almost always two-asset liquidity pools boosted by reward emissions, which is why they also carry impermanent loss and tend to fade. A steadier single-sided rate on a deep, long-running venue is often the more durable choice. The 30-day figure is the better guide than the spot number."
      }
    }
  ]
}
```

**Notes**
- `Article` (headline = H1, `datePublished` 2026-07-01, `dateModified` = live snapshot, author/publisher = Harvest) sits alongside `WebPage` for freshness + E-E-A-T.
- `Dataset` carries `distribution` (DataDownload JSON + CSV), CC-BY-4.0, `isAccessibleForFree`, sources (DeFiLlama + Spectra), `dateModified`.
- `FAQPage` mirrors the 10-item accordion. `ItemList` = ranked products as plain name+url (not FinancialProduct — venues are third-party). `BreadcrumbList` = Harvest › Report › XRP Yield Ranking.

---

## 3. Ranking data (14 tracked products)

| # | Asset | Detail | Platform | Network | Type | 30d APY | TVL | Incentivized | History pts |
|--:|---|---|---|---|---|--:|--:|:--:|--:|
| 1 | cbXRP / WETH | Permissionless pool | Aerodrome | Base | Liquidity pool | 13.86% | $343k | yes | 90 |
| 2 | cbXRP / cbBTC | Permissionless pool | Aerodrome | Base | Liquidity pool | 4.22% | $353k | no | 90 |
| 3 | stXRP | PT · Aug 2026 | Spectra | Flare | Fixed-Rate | 3.73% | $4.2M | no | 48 |
| 4 | stXRP | PT · Nov 2026 | Spectra | Flare | Fixed-Rate | 3.62% | $2.6M | no | 48 |
| 5 | FXRP | bizFXRP · Bizantine Labs | Superform | Flare | Vault | 2.71% | $295k | no | 0 |
| 6 | FXRP | MetaVault · Gami Labs | Spectra | Flare | Vault | 2.61% | $6.4M | yes | 0 |
| 7 | stXRP | Pool · Nov 2026 | Spectra | Flare | Liquidity pool | 2.42% | $2.6M | yes | 0 |
| 8 | stXRP | Pool · Aug 2026 | Spectra | Flare | Liquidity pool | 2.15% | $4.2M | yes | 0 |
| 9 | FXRP | Vault · Clearstar | Mystic Finance | Flare | Vault | 1.91% | $3.7M | yes | 90 |
| 10 | FXRP | earnXRP · Clearstar | Upshift | Flare | Vault | 1.61% | $36.5M | no | 0 |
| 11 | stXRP / FXRP | Permissionless pool | SparkDEX | Flare | Liquidity pool | 1.37% | $5.8M | yes | 90 |
| 12 | FXRP | Lending market | Kinetic | Flare | Lending market | 1.02% | $23.5M | yes | 90 |
| 13 | FXRP | MXRPY · Monarq | Upshift | Flare | Vault | 0.43% | $8.6M | no | 0 |
| 14 | cbXRP | Lending market | Moonwell | Base | Lending market | 0.18% | $1.8M | yes | 90 |

---

## 4. Machine-readable data layer (AI-crawl surface)

Emitted at build by `scripts/build-xrp-history.mjs` into `public/data/xrp-yield/`, surfaced four ways: a **visible "Machine-readable data" section** on the page (two dataset buttons + a per-product JSON/CSV grid), the `Dataset` JSON-LD `distribution`, `llms.txt`, and the Article/WebPage schema.

| File | Content |
|---|---|
| `/data/xrp-yield/index.json` | Catalogue: every product w/ current 30d APY, TVL, links to its JSON + CSV; license, disclaimer, `combinedHistoryCsv`. |
| `/data/xrp-yield/<slug>.json` | Per product: metadata, `rate` (basis + current + 30d-mean), `tvlUsd`, `range90dPercent`, incentivized, `dailyHistory[]`, `dataAsOf`, license. |
| `/data/xrp-yield/<slug>.csv` | Per-product daily rate `date,apy_percent` (8 of 14 with history). |
| `/data/xrp-yield/history.csv` | All products, long format `slug,asset,platform,chain,date,apy_percent`. |
| `/llms.txt` | Lists the report + dataset index + combined CSV. |

**Limitation:** CSVs are **daily APY only** — DeFiLlama publishes daily APY; TVL is a **live snapshot** in each product JSON (`tvlUsd`), not a daily series.

---

## 5. Internal & external linking

**Inbound:** Footer → Resources → **"XRP Yield Ranking"** — site-wide (every page). Primary internal-PageRank path, keyword-aligned anchor. Also in `sitemap.xml` + `llms.txt`.

**Outbound-internal:** Method → `/usdc`, `/eth`, `/btc`, `/methodology`; TOC/"On this page" → in-page anchors; Data section → JSON/CSV files + `/llms.txt`.

**External (venues):** every "Open →" routes through a leave-site modal (`DiscoverButton`) → new tab, `rel="noopener noreferrer nofollow"` + `?ref=harvest.finance`. Outbound is **nofollow** by design.

---

## 6. Full rendered page content (visible text, DOM order)

> Visual order differs (sections re-ordered via CSS `order` — see §7). Raw indexable text:

```text
View ↗
### stXRP
Flare · Spectra · PT · Aug 2026
3.73% 30-day average rate
1M 3M 1Y ALL
TVL Rate Share price
# XRP Yield Ranking: Where XRP Actually Earns
The clearest way to earn yield on XRP, ranked by real rates. This report follows 14 curated XRP products, from lending and vaults to fixed-rate Principal Tokens and liquidity pools, ranked by rate and split by exposure.
Last updated July 19, 2026
Explore the ranking ↓
Report
## Overview
Earning yield on XRP is quietly growing into one of the more active corners of DeFi. XRP is not a proof-of-stake asset, so there is no native staking rate to claim.
The XRP Ledger’s native AMM already pays trading fees on-ledger, and on-ledger lending is starting to arrive. The deeper and more varied rates live on smart-contract chains.
There, XRP is held as a wrapped token such as FXRP or cbXRP, or a staked form like stXRP, and supplied to a lending market, a vault, a fixed-rate Principal Token, or a liquidity pool. This page follows a curated set of these products and ranks them by rate.
As of July 19, 2026 this report tracks 14 XRP products across 2 networks , Base and Flare . Rates span 0.18% to 13.86% , with a median of 2.42% across the 14 with a live rate.
8 of the 14 lean on reward-token incentives for the bulk of their rate, so those tend to ease off once a rewards program winds down.
On this page The ranking 30-day rate history Where yield comes from Wrapped forms of XRP Can you stake XRP? CeFi vs DeFi Risks Venues in depth FAQ Method Live rates
## The ranking
The curated XRP products, ranked by rate and split by exposure. Single-exposure positions sit on one side of the market; dual-exposure positions pair an XRP token with a second asset. The Type column names each product.
### Single-exposure XRP yield
11 one-sided positions with no second asset: lending markets, curated vaults, liquid staking, fixed-rate Principal Tokens and stXRP pools. Sorted by rate.
# Product 30d APY Type Platform Network TVL
1 stXRP PT · Aug 2026 Flare · Spectra 3.73% Fixed-Rate PT Spectra Flare $4.2M Open →
2 stXRP PT · Nov 2026 Flare · Spectra 3.62% Fixed-Rate PT Spectra Flare $2.6M Open →
3 FXRP bizFXRP · Bizantine Labs Flare · Superform 2.71% Vault Superform Flare $295k Open →
4 FXRP MetaVault · Gami Labs Flare · Spectra 2.61% Vault Spectra Flare $6.4M Open →
5 stXRP Pool · Nov 2026 Flare · Spectra 2.42% Pool Spectra Flare $2.6M Open →
6 stXRP Pool · Aug 2026 Flare · Spectra 2.15% Pool Spectra Flare $4.2M Open →
7 FXRP Vault · Clearstar Flare · Mystic Finance 1.91% Vault Mystic Finance Flare $3.7M Open →
8 FXRP earnXRP · Clearstar Flare · Upshift 1.61% Vault Upshift Flare $36.5M Open →
9 FXRP Lending market Flare · Kinetic 1.02% Lending Kinetic Flare $23.5M Open →
10 FXRP MXRPY · Monarq Flare · Upshift 0.43% Vault Upshift Flare $8.6M Open →
11 cbXRP Lending market Base · Moonwell 0.18% Lending Moonwell Base $1.8M Open →
### Dual-exposure XRP pools
3 two-asset liquidity pools that pair an XRP token with something else and earn swap fees plus rewards. Higher headline rates, with impermanent loss to manage. Sorted by rate.
# Product 30d APY Type Platform Network TVL
1 cbXRP / WETH Permissionless pool Base · Aerodrome 13.86% Pool Aerodrome Base $343k Open →
2 cbXRP / cbBTC Permissionless pool Base · Aerodrome 4.22% Pool Aerodrome Base $353k Open →
3 stXRP / FXRP Permissionless pool Flare · SparkDEX 1.37% Pool SparkDEX Flare $5.8M Open →
Rates and TVL from DeFiLlama, Spectra and Portals, as of July 19, 2026 , refreshed hourly. Each row links to the platform’s own site.
Summary
## XRP yield right now
As of July 19, 2026 , the top vault or lending rate is 2.71% on FXRP at Superform , while dual-exposure liquidity pools reach 13.86% on cbXRP / WETH at Aerodrome . Fixed-rate Principal Tokens sit near 3.73% , locked to maturity . The median across the 14 rated products is 2.42% .
Weighing how much capital sits on each platform against the rate it pays, Spectra and Upshift hold the largest, most active positions on the page: Spectra with $20.0M across 5 products at an average 2.91% , and Upshift with $45.1M at 1.02% .
Charts
## 30-day rate history
How the rate has moved over the last 30 days for a selection of the larger venues, from DeFiLlama’s daily record. Useful for telling a steady rate apart from one riding a short-lived incentive spike.
cbXRP / WETH Aerodrome $343k TVL 13.86% 30d APY
Jun 20 Jul 19
cbXRP / cbBTC Aerodrome $353k TVL 4.22% 30d APY
Jun 20 Jul 19
FXRP Mystic Finance $3.7M TVL 1.91% 30d APY
Jun 20 Jul 19
stXRP / FXRP SparkDEX $5.8M TVL 1.37% 30d APY
Jun 20 Jul 19
FXRP Kinetic $23.5M TVL 1.02% 30d APY
Jun 20 Jul 19
cbXRP Moonwell $1.8M TVL 0.18% 30d APY
Jun 20 Jul 19
Daily APY from DeFiLlama, last 30 days, as of July 19, 2026 .
Fixed rate
## PT max fixed rate, daily
The locked-in fixed rate on each staked-XRP Principal Token, tracked day by day since the market opened, straight from Spectra. A PT secures this rate to maturity, so the line is the full record of what each maturity has offered.
stXRP $4.2M TVL 4.15% max fixed
May 27 Jul 19
stXRP $2.6M TVL 3.71% max fixed
May 26 Jul 19
Both maturities opened near 6.00% and have eased into the low single digits since, a gentle downtrend as early demand settled. The top fixed rate now sits around 3.73% , still competitive with the single-sided field, and the two Spectra pools together hold $6.8M in liquidity.
Guide
## Where XRP yield comes from
The rates on this page all trace back to one of a few simple sources. Knowing which source is behind a number makes it much easier to tell a steady, organic rate from one that is mostly short-term rewards.
### Lending
Wrapped XRP supplied to a money market such as Kinetic on Flare or Moonwell on Base earns the interest borrowers pay on their loans.
It is single-sided, so there is no second asset to track, and on Flare the base rate is often topped up with rFLR reward tokens. This is the closest thing XRP has to a plain savings rate.
### Vaults and liquid staking
Vaults and liquid-staking tokens do the work automatically. A curated vault such as Spectra, Upshift, Mystic or Superform, or a staking token like Firelight’s stXRP, takes the wrapped XRP and runs a strategy with it.
The results compound into a single token managed by a curator, and the rate blends whatever the strategy earns with any reward incentives on top.
### Liquidity provision
Pairing an XRP token with another asset in a pool on SparkDEX or Aerodrome earns a share of the swap fees, usually with extra reward tokens layered on.
The headline rates are the highest on the page, with one trade-off: if the two tokens drift apart in price the position can suffer impermanent loss, so these pools reward active management.
### Fixed-rate Principal Tokens
Spectra adds one more mechanism that is unique on this list: the Principal Token, or PT. A PT for staked XRP trades at a discount today and redeems one-for-one for the underlying at a set maturity date.
The gap between that discounted price and the full redemption value is a fixed rate locked in up front, so unlike everything else here the number does not drift day to day.
It is single-sided with no impermanent loss; the trade-off is that the position runs to maturity, and an early exit takes whatever the market will pay. Spectra publishes each PT’s current max fixed rate, which is the figure this report tracks.
### How the ranking is sorted
Venues are sorted by the 30-day average rate rather than today’s spot number, so a single big day of rewards cannot flatter a venue to the top. The tables are split by exposure, and a Type column names each product so like compares with like.
Every venue on this page is an external protocol tracked for research. None are Harvest products. This page is informational only, and past rates are no promise of what a venue pays next.
Tokens
## The wrapped forms of XRP
Beyond the XRP Ledger’s own native AMM, every rate on this page starts with XRP moved onto a smart-contract chain in a wrapped form.
The wrapper matters as much as the venue: some are trustless and collateral-backed, others rest on a single custodian. These are the four forms that appear most across the venues here.
FXRP Flare
XRP bridged onto Flare through the FAssets system. It is a 1:1, over-collateralized ERC-20 minted by independent agents who post collateral (roughly 1.3x) while the real XRP stays on the XRP Ledger, verified on-chain rather than held by one custodian. FXRP went live on Flare mainnet on 24 September 2025 and is the base asset behind nearly all Flare XRP yield.
0xad552a648c74d49e10027ab8a618a3ad4901c5be
stXRP Flare
Firelight's liquid staking token, minted 1:1 from FXRP. Its yield is designed to come from DeFi insurance, where other protocols pay cover fees that flow back to stXRP holders, rather than from token inflation. Firelight was incubated by Sentora, and stXRP is used across SparkDEX and Spectra.
0x4c18ff3c89632c3dd62e796c0afa5c07c4c1b2b3
cbXRP Base
Coinbase Wrapped XRP, an ERC-20 on Base backed 1:1 by XRP held in Coinbase custody, with published proof of reserves. It launched in June 2025 and is the XRP form used across Base venues like Aerodrome and Moonwell. Backing is custodial, so it rests on Coinbase rather than an on-chain collateral system.
0xcb585250f852c6c6bf90434ab21a00f02833a4af
wXRP Solana
Wrapped XRP on Solana, issued and custodied by Hex Trust and bridged through LayerZero, backed 1:1 by native XRP in segregated custody. It is the XRP form behind Solana pools on Raydium, Jupiter and elsewhere.
6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2
Explainer
## Can you stake XRP?
Short answer: no. XRP is not a proof-of-stake asset, and the XRP Ledger has no validator staking and no native staking rewards.
So an advertised “XRP staking” rate is really describing something else. Every rate on this page comes from putting XRP to work in a market.
The label usually covers one of three mechanisms: lending XRP and earning the interest borrowers pay; supplying it to a liquidity pool and earning swap fees; or holding a liquid staking token such as stXRP, where a protocol stakes the wrapped XRP behind the scenes.
The XRP Ledger’s native AMM also pays trading fees on-ledger. None are native staking, and each carries its own risk, which is why every venue here is labelled by what it actually does.
Compare
## CeFi vs DeFi XRP yield
XRP can also earn through centralized “Earn” programs on exchanges and lenders. They are worth understanding, because they compete for the same searches and make a different trade-off.
Centralized programs are simple: XRP is held on the platform, which pays a rate, sometimes higher than DeFi thanks to promotional or token incentives. The trade-off is custody.
The XRP sits with the provider, which introduces solvency and counterparty risk, and the rate can change or be pulled at will.
This report focuses on DeFi instead, because the positions are onchain and verifiable: the contract, the collateral and the real rate are all visible, and self-custody is usually retained.
There the trade-off is smart-contract and bridge risk rather than counterparty risk. Neither is strictly safer; they fail in different ways.
Risk
## Key risks
Every rate on this page carries risk. These are the main ones that sit behind the numbers.
- **Bridge and wrapper risk**: Every wrapped XRP depends on whatever issues it. FXRP relies on Flare’s FAssets agents and collateral, cbXRP on Coinbase custody, wXRP on Hex Trust and LayerZero. If a bridge or issuer fails or de-pegs, the wrapped token can trade below the XRP it represents.
- **Impermanent loss**: Liquidity pools pair XRP with a second asset. If the two prices move apart, the position can be worth less than simply holding, which can outweigh the fees and rewards it earned.
- **Incentive dependency**: 8 of the 14 venues here lean on reward-token emissions, mostly rFLR on Flare, for the bulk of their rate. Emissions are temporary by design, so those headline numbers tend to fall once a program tapers.
- **Curator and manager risk**: Vaults are actively run by curators such as Clearstar, Gami Labs, Byzantine Labs and Monarq. Depositors rely on their allocation choices and controls on top of the underlying contracts.
- **Smart-contract and oracle risk**: All of this is code. A bug, an exploit, or a bad price feed can cause loss even when the strategy itself is sound. Audits reduce this risk but never remove it.
This page is informational only. It does not constitute financial advice. Past rates are no promise of future ones, and no DeFi yield is risk-free.
Reference
## XRP yield venues, explained
A rate is only as good as what pays it. We looked into each venue in the ranking: what it actually is, where the yield comes from, who curates or manages it, and what points, incentives and backing sit behind it. Grouped by network, starting with Flare, where most XRP yield now lives.
### Flare
Flare is where most XRP yield now lives. Its FAssets system turns XRP into FXRP without a single custodian, and a full DeFi stack has grown on top: lending markets, DEXes, liquid staking, and curated vaults. Almost everything here also stacks rFLR, Flare's reward token, on top of its base rate, so read the headline number as base yield plus time-limited emissions.
FXRP Lending Market Kinetic Open →
Kinetic is a Compound and Aave style money market on Flare, built by Rome Blockchain Labs, the team behind BENQI and Moonwell. XRP holders supply FXRP to earn interest or borrow stablecoins against it without selling, and it is one of the largest single homes for FXRP in Flare DeFi.
The base rate is what borrowers pay. On top of it, suppliers collect rFLR from Flare's FAssets Incentive Program plus FXRP supply incentives, so the headline blends real borrow demand with emissions that taper over time.
Type Lending Market
Network Flare
Yield source Borrow interest, plus rFLR and FXRP supply incentives
Wrapped asset FXRP (Flare FAssets)
Team Rome Blockchain Labs (BENQI, Moonwell)
Token JOULE, stakes to Kii for interest rebates and governance
Audits Coinspect, Zellic and Watchpug, plus a Code4rena contest and Immunefi bounty
Flare XRP Yield Prime Spectra Open →
Spectra, formerly APWine, is a fixed-rate and yield-tokenization protocol. It splits a yield-bearing token into a Principal Token and a Yield Token with a set maturity, so one side can lock a fixed rate to expiry while the other takes leveraged, variable exposure to the floating yield.
Flare XRP Yield Prime is a MetaVault on Spectra curated by Gami Labs. It takes FXRP or stXRP and keeps the liquidity positioned across Spectra's staked-XRP fixed-term pools, auto-rolling into the next pool at maturity and compounding as it goes. The underlying yield is Firelight staking rewards on stXRP plus swap fees and rFLR.
Type MetaVault
Network Flare
Yield source stXRP staking rewards, PT/YT swap fees and rFLR
Curator Gami Labs
Wrapped asset FXRP, staked to stXRP via Firelight
Incentives rFLR and SPECTRA emissions
Audits Pashov Audit Group and Code4rena
stXRP / FXRP SparkDEX Open →
SparkDEX is the leading DEX on Flare, spanning concentrated-liquidity pools (v3.1 and a v4 built on Algebra) and a perps venue. The stXRP / FXRP pool pairs Firelight's staked XRP with wrapped XRP, so both legs track XRP and the pair stays tight.
LPs earn swap fees plus rFLR from Flare's emissions program, which vests over roughly 12 months. Because both sides are XRP-denominated, impermanent loss is limited compared with a pool against an unrelated asset. On the v4 app the two tokens are entered by hand into the add-liquidity form.
Type Pool
Network Flare
Yield source Swap fees plus rFLR emissions
Wrapped assets stXRP (Firelight) and FXRP (Flare FAssets)
Token SPRK, stakes to xSPRK for fee sharing
Audits Protofire (v3, perps, token)
Backing Independent, IDO launch via TrustSwap, no VC round
XRP Vault (csXRP) Mystic Finance Open →
Mystic Finance is the front end for Morpho-powered lending on Flare. Supplying FXRP into its Clearstar-curated vault mints csXRP, a share token that represents the deposited FXRP plus the interest it earns as the curator allocates it across Morpho markets.
The yield is borrow interest from those markets, net of a fee (documented at 5 to 20 percent of interest) split between Mystic and the curator. Because a curator actively moves the money, depositors rely on that allocation as well as the underlying contracts.
Type Vault
Network Flare
Yield source Borrow interest from Morpho lending markets
Curator Clearstar, backed by Clearsight Investments AG, a Swiss manager near $1B AUM
Wrapped asset FXRP, wrapped again as the csXRP vault share
Built on Morpho
Audits Mystic's own vault contracts audited by Hacken (Dec 2024)
earnXRP and MXRPY vaults Upshift Open →
Upshift, a spinout of the onchain prime brokerage August, runs curated, professionally managed vaults. On Flare it powers two FXRP vaults: earnXRP, curated by Clearstar, and MXRPY, managed by Monarq Asset Management.
Instead of one fixed source, curators spread FXRP across active strategies: carry trades, staking, cover underwriting through Firelight and concentrated liquidity for earnXRP; options, funding-rate arbitrage and onchain XRPFi for MXRPY. You hold a vault receipt token redeemable back to FXRP, with a multi-day withdrawal window or instant redemption for a fee.
Type Vault
Network Flare
Yield source Active multi-strategy: carry, staking, LP, options and basis
Curators Clearstar (earnXRP), Monarq Asset Management (MXRPY)
Wrapped asset FXRP (Flare FAssets)
Points Upshift Points program
Backers Dragonfly Capital, Hack VC, 6th Man Ventures, Robot Ventures
Audits ChainSecurity, Zellic, Sigma Prime and Hacken (per Upshift)
bizFXRP Vault Superform Open →
Superform is a cross-chain yield marketplace. Its Flare vault, bizFXRP, is an institutional-grade strategy curated by Byzantine Labs that routes FXRP into Flare's XRP lending markets, tracked as an ERC-1155 SuperPosition.
The base yield is lending interest, actively reallocated by the curator. Superform layers its own Points program on top, roughly one point per $100 held per hour, with multipliers and NFT boosts.
Type Vault
Network Flare
Yield source Flare XRP lending interest
Curator Byzantine Labs
Wrapped asset FXRP (Flare FAssets)
Points Superform Rewards (Points)
Backers Seed led by Polychain, strategic round led by VanEck Ventures
Audits V2 Core reviewed by Spearbit (Cantina)
### Base
On Base, XRP arrives as cbXRP, Coinbase's 1:1 custodied wrapper. The yield comes from the same two places as everywhere else: swap fees on a DEX, or lending interest on a money market.
cbXRP / cbBTC and cbXRP / WETH Aerodrome Open →
Aerodrome is the main ve(3,3) DEX on Base, built by the Velodrome team. Its Slipstream pools are Uniswap v3 style concentrated liquidity, and XRP comes in as Coinbase Wrapped XRP.
The cbXRP / cbBTC and cbXRP / WETH pools pay swap fees plus AERO emissions that veAERO voters steer to each pool every week. Rates move with vote weight and campaigns, and concentrated liquidity carries impermanent loss if the two sides drift apart.
Type Pool
Network Base
Yield source Swap fees plus AERO emissions
Wrapped asset cbXRP (Coinbase, 1:1 custody)
Built by The Velodrome team
Audits Forked from audited Velodrome v2; cbXRP contract by OpenZeppelin
cbXRP Lending Moonwell Open →
Moonwell was the first lending app on Base to list cbXRP. Supply cbXRP to earn borrow interest, with WELL incentives layered on top in some markets. It is a straightforward, single-sided way to earn on XRP with no second asset to manage.
Type Lending Market
Network Base
Yield source Borrow interest, plus WELL incentives
Wrapped asset cbXRP (Coinbase, 1:1 custody)
FAQ
## XRP yield, answered
**Q: Can you stake XRP? ** No. XRP is not a proof-of-stake asset and has no native staking or validator rewards. The rates people call XRP staking actually come from lending XRP, providing liquidity, or holding a liquid staking token such as stXRP that stakes wrapped XRP on the holder's behalf.
**Q: Does XRP have staking rewards? ** No. XRP has no native staking or validator rewards, so there is no protocol staking rate. What is marketed as XRP staking rewards is really lending interest, liquidity-pool fees, or the yield on a liquid staking token such as stXRP that stakes wrapped XRP behind the scenes. Each is a market rate with its own risk, not an inflation reward.
**Q: How do you earn interest on XRP? ** You move XRP onto a smart-contract chain as a wrapped token such as FXRP or cbXRP, then put it to work: supply it to a lending market to earn borrower interest, deposit it in a curated vault, hold a fixed-rate Principal Token, or add it to a liquidity pool for swap fees. The rate depends on the venue and the wrapper; this report ranks the main options by their real 30-day rate.
**Q: What is the best XRP yield right now? ** It depends on risk appetite, but the deepest and most active XRP yield sits with the venues highlighted above: Spectra's staked-XRP Principal Tokens and MetaVault, averaging about 2.91%, and the Clearstar Labs earnXRP vault on Upshift, the single largest at $36.5M. As a benchmark, the capital-weighted average across the 14 tracked products is about 1.65%. Two-asset pools post higher headline rates but add impermanent loss and usually lean on incentives, so the ranking sorts every venue by its real 30-day average.
**Q: What are FXRP, stXRP and cbXRP? ** They are wrapped forms of XRP. FXRP is XRP bridged trustlessly onto Flare through the FAssets system; cbXRP is Coinbase-custodied wrapped XRP on Base; stXRP is Firelight's liquid staking token for FXRP. The choice of wrapper changes the trust model and the risk.
**Q: FXRP vs cbXRP: what is the difference? ** Both are wrapped XRP, but the trust model differs. FXRP is minted trustlessly on Flare through the FAssets system, over-collateralized by independent agents while the real XRP stays on the XRP Ledger. cbXRP is Coinbase-custodied wrapped XRP on Base, backed 1:1 by XRP that Coinbase holds, with published proof of reserves. FXRP leans on onchain collateral; cbXRP leans on a single custodian.
**Q: Is earning yield on XRP safe? ** No DeFi yield is risk-free. On top of ordinary market risk, XRP yield adds bridge or custody risk on the wrapper, smart-contract and oracle risk on each venue, impermanent loss in pools, and reliance on incentive tokens that can fade. This page is informational research only.
**Q: What is impermanent loss in an XRP liquidity pool? ** It is the gap between simply holding two tokens and supplying them to a pool. When the two prices drift apart, the pool rebalances against the position, so it can end up worth less than holding, even after the fees and rewards it earned.
**Q: CeFi vs DeFi XRP yield, which is better? ** Neither is strictly better. Centralized Earn programs are simpler and sometimes pay more, but custody is given up and counterparty risk is taken on. DeFi keeps positions onchain and verifiable with self-custody, but adds smart-contract and bridge risk. This report tracks the DeFi side.
**Q: What is the highest APY for XRP? ** The highest numbers here are almost always two-asset liquidity pools boosted by reward emissions, which is why they also carry impermanent loss and tend to fade. A steadier single-sided rate on a deep, long-running venue is often the more durable choice. The 30-day figure is the better guide than the spot number.
Data
## Machine-readable data
Every product on this page is published as clean, downloadable data for research and AI agents, licensed CC-BY-4.0. Each JSON carries the current rate and TVL plus its full daily rate history; each CSV is that daily rate series.
Full dataset · JSON All products, daily rates · CSV
cbXRP / WETH Permissionless pool · Aerodrome JSON CSV
cbXRP / cbBTC Permissionless pool · Aerodrome JSON CSV
stXRP PT · Aug 2026 · Spectra JSON CSV
stXRP PT · Nov 2026 · Spectra JSON CSV
FXRP bizFXRP · Bizantine Labs · Superform JSON
FXRP MetaVault · Gami Labs · Spectra JSON
stXRP Pool · Nov 2026 · Spectra JSON
stXRP Pool · Aug 2026 · Spectra JSON
FXRP Vault · Clearstar · Mystic Finance JSON CSV
FXRP earnXRP · Clearstar · Upshift JSON
stXRP / FXRP Permissionless pool · SparkDEX JSON CSV
FXRP Lending market · Kinetic JSON CSV
FXRP MXRPY · Monarq · Upshift JSON
cbXRP Lending market · Moonwell JSON CSV
The full catalogue lives in index.json , and history.csv holds every product’s daily rate in one file. The same files are declared in this page’s Dataset metadata and in llms.txt .
Method
## Method & scope
- **Inclusion**: A defined set of 14 XRP-denominated products, whether XRP itself or a wrapped variant such as FXRP, stXRP or cbXRP, across lending, vaults, liquid staking, fixed-rate Principal Tokens and liquidity pools. RLUSD, Ripple’s dollar stablecoin, is out of scope because it is not XRP-denominated. Each product’s rate and TVL are pulled live from its own source: DeFiLlama where a pool is tracked, the Spectra API for Principal Tokens, pools and MetaVaults, and the Portals API for products the others do not cover.
- **Ranking**: By 30-day average rate where a history is available, so short-lived emission spikes don’t decide the order; the 90-day range is shown alongside.
- **Freshness**: Refreshed hourly from the DeFiLlama, Spectra and Portals APIs; this page reflects the July 19, 2026 snapshot.
- **What this is not**: The figures are informational only and are not an endorsement or financial advice. Our own coverage is USDC , ETH and BTC strategies, indexed with the same methodology used on every product page (see Methodology ).
In this report
XRP yield right now
The ranking
Single-exposure
Dual-exposure
Overview
30-day rate history
Where yield comes from
Lending
Vaults & liquid staking
Liquidity provision
Fixed-rate PTs
How the ranking is sorted
PT max fixed rate
Wrapped forms of XRP
Can you stake XRP?
CeFi vs DeFi
Key risks
Venues in depth
FAQ
Data & downloads
Method & scope
```
---

## 7. Front-end architecture

**Rendering** — `src/app/report/xrp-yield-ranking/page.tsx` is a React **Server Component**, statically prerendered. Reads only `data/xrp-yield.json` (isolated: no Supabase, no `vaults.json`). Client islands:
- `report-toc.tsx` — sticky "In this report" rail, `IntersectionObserver` scroll-spy.
- `report-chart.tsx` — interactive daily-rate bar chart, **solid flagship-yellow `#ffb936` bars** (no gradient), dotted grid, hover scrubbing.
- `copy-address-button.tsx` — copy the wrapped-token contract addresses (blended inside the address pill).
- `discover-button.tsx` — outbound "Open →" + leave-site modal + `report-tracking.ts` analytics + `?ref=`.
- `home-hero-preview.tsx` — the hero product card, fed the featured stXRP PT · Aug 2026 with its **real** daily history driving the bars.

**Layout & CSS** — `src/app/_styles/report.css` (~1,500 lines), scoped under `.rp-page`; reuses the homepage shell (`.uni-home-*`) + global hub-table classes (`.hub-*`).
- Docs-style two-column layout (content + sticky rail; rail hidden ≤1080px → inline "On this page" **50/50 grid with gold `→` jump arrows**).
- Section order is visual-only via flex `order` (DOM stays Overview-first for SEO). Visual order: `1` XRP yield right now → `2` The ranking → `3` Overview → `4` 30-day rate history → `5` Where yield comes from → `6` PT max fixed rate → `7` Wrapped forms of XRP → `8` Can you stake XRP? → `9` CeFi vs DeFi → `10` Key risks → `11` Venues in depth → `12` FAQ → `13` **Data & downloads** → `14` Method & scope.
- Hero: a **3-mark overlapping token cluster** (XRP/FXRP/stXRP), left-aligned above the H1 (centered on mobile); a **bold** "Last updated" freshness line.
- Type: Inter (variable) body/headings; navy palette (`--rp-heading #1a2440`, `--rp-body #3d465f`); gold eyebrows; dark-mode via `prefers-color-scheme` + `[data-theme]`.
- Lean Uniswap-style ranking tables; only the 30d APY column is bold (`.hub-cell.hub-apy` specificity so it isn't clobbered by `.hub-num`).

**Responsive (≤640px)** — body ~40% smaller than desktop, headlines a further ~30%, every text rule has an explicit proportional line-height. Ranking collapses to **# · Product · 30d APY · arrow** (position number sized down); section spacing ~15% tighter; venue cards stack (full-width description, then full-width facts grid); "Open →" pinned top-right.

---

## 8. Back-end / data pipeline

**Allowlist (source of truth):** `data/xrp-venues.json` — the exact 14 products, each with `slug/asset/detail/symbol/platform/entity/chain/productType/exposure/url/source`.

**Hydrator:** `scripts/fetch-xrp-yield.mjs` (+ `fetch-spectra.mjs`, `apply-xrp-overrides.mjs`) pulls live rate/TVL/history per `source.kind`:
- `defillama` → `yields.llama.fi/pools` + `/chart` (daily `{d,apy}`, 90d range).
- `spectra-pt` / `spectra-pool` / `spectra-metavault` → `api.spectra.finance`.
- `portals` → `api.portals.fi` (optional `PORTALS_API_KEY`; static fallback).
- `none` → no feed.
- Writes **`data/xrp-yield.json`** (committed; refreshed hourly by cron). The only file the page reads.

**Provenance notes:** Portals history/holders endpoints are Pioneer-tier (403 on the free key) → no per-wallet holder counts; "popularity" is framed via **TVL-weighted rate** (also backs the "best XRP yield" FAQ) — all derived at render time.

---

## 9. Build chain (`package.json` → `build`)

```
rm -rf public/_next
&& node scripts/build-network-tvl.mjs
&& next build                          # static export → out/
&& rm -rf public && mv out public
&& node scripts/build-seo-static.mjs   # robots.txt + llms.txt (+ IndexNow key)
&& node scripts/build-data-json.mjs
&& node scripts/build-search-index.mjs
&& node scripts/build-design-system.mjs
&& node scripts/build-master-config.mjs
&& node scripts/build-history-csv.mjs
&& node scripts/build-xrp-history.mjs      # ← XRP report: per-product JSON/CSV + index + combined
&& npm run check-banned-words              # gate
&& npm run check-consistency               # gate
```

Both gates must pass. (Note: this is the harvestfi-based build chain; the maderaz fork additionally runs `build-sales-surfaces.mjs`, which is out of scope for this report.)

---

## 10. File inventory

| File | Role |
|---|---|
| `src/app/report/xrp-yield-ranking/page.tsx` | Page: content, JSON-LD, ranking, FAQ, hero, Data section, `generateMetadata`. |
| `…/venue-notes.ts` | Editorial "Venues in depth" + wrapped-token glossary. |
| `…/opengraph-image.tsx` / `twitter-image.tsx` | Custom OG/Twitter card (next/og). |
| `src/app/_styles/report.css` | All report styling (~1,500 lines). |
| `src/components/report/{report-toc,report-chart,discover-button}.tsx` | Client islands. |
| `src/components/{copy-address-button,home-hero-preview,token-icons,footer}.tsx` | Shared (footer = site-wide inbound link; token-icons = XRP-family fallback). |
| `src/lib/jsonld.ts` | `articleSchema`, `reportWebPageSchema`, `reportDatasetSchema`, `reportItemListSchema`, `faqPageSchema`, `breadcrumbSchema`. |
| `src/lib/og-template.tsx` | Shared OG renderer (`ogImageResponse`, extended with a `fonts` param). |
| `src/lib/report-tracking.ts` | Outbound-click attribution (writes `report_outbound_clicks`). |
| `data/xrp-venues.json` / `data/xrp-yield.json` | Allowlist / hydrated snapshot. |
| `scripts/fetch-xrp-yield.mjs`, `fetch-spectra.mjs`, `apply-xrp-overrides.mjs` | Data hydrator. |
| `scripts/build-xrp-history.mjs` | Machine-readable export emitter. |
| `scripts/build-seo-static.mjs` | robots.txt + llms.txt (XRP entries). |
| `supabase/report_outbound_clicks.sql` | DB table for outbound-click tracking. |

---

## 11. SEO signal summary & open gaps

**Present** — static/fast/crawlable HTML; self-referential canonical; keyword-rich intent-first title + description consistent across OG/Twitter; keyword-aligned H1 + section headings; rich structured data (WebPage, **Article**, **Dataset** +DataDownload, FAQPage×10, ItemList, BreadcrumbList) + site-wide Organization/WebSite; freshness (visible bold "Last updated", hourly refresh, `dateModified`); unique long-form content (~3,000+ words) + entity-rich glossary/venue directory; machine-readable data + `llms.txt` + Dataset distribution; custom OG card; **site-wide inbound footer link**.

**Deliberate** — outbound venue links are **nofollow** (leave-site modal); DOM order Overview-first (SEO) while visual order leads with summary/ranking (UX), decoupled via CSS `order`.

**Open gaps (next tier)** — 1) **off-page/backlinks** (the decisive factor; pitch the CC-BY dataset + an embeddable widget); 2) **topical cluster** of supporting guides all linking here; 3) **programmatic long-tail** (`/xrp-yield/flare`, `/fxrp-yield`) with unique per-page data; 4) **daily TVL** history not tracked upstream; 5) **named author/reviewer** byline for stronger E-E-A-T; 6) **contextual in-content inbound links** (homepage/hubs) beyond the footer.

---

## 12. Changelog — work reflected in this snapshot

Newest first:

- **SEO meta refresh** — title → *"Best XRP Yield 2026: List of 10+ DeFi Products ranked by APY"*; new description; same copy applied tight across page/OG/Twitter.
- **Footer link** — site-wide inbound link (Resources → "XRP Yield Ranking").
- **Article JSON-LD** added (datePublished + dateModified + author); **+3 FAQ** entries → 10 total ("Does XRP have staking rewards?", "How do you earn interest on XRP?", "FXRP vs cbXRP").
- **Custom OG/Twitter card** (`opengraph-image.tsx`) with live stats.
- **"Machine-readable data" section** (per-product JSON + CSV downloads) + `build-xrp-history.mjs` export + Dataset `distribution` + llms.txt.
- **Hero** — 3-mark overlapping token cluster, left-aligned; bold "Last updated"; hero card mirrors the stXRP PT · Aug 2026 opportunity with its real rate history.
- **Charts** — solid flagship-yellow bars (no gradient), mobile + desktop.
- **"Best XRP yield" FAQ** — data-backed (TVL-weighted average) naming Spectra venues + the Clearstar Labs earnXRP vault on Upshift.
- **"XRP yield right now"** — TVL×rate popularity read (Spectra & Upshift lead); tip box removed.
- **Prose** — platform names woven into sentences (no parentheses); "hand-curated" → "defined set"; growing-sector wording.
- **Typography** — navy palette, variable Inter, +20% desktop scale; mobile ~40% smaller + fixed line-heights; 30d APY column bolded; ranking truncation fixed.
- **Layout** — Base-docs two-column + sticky rail; lean tables; blended copy-inside-address; venue cards stacked; balanced source-note padding; mobile 50/50 TOC with `→` arrows; **"All but Direct"** filter added to the admin Live Feed (separate surface, not this page).
- **Scope trim** — canonical 14-product allowlist; Enosys/csXRP-as-wrapped removed; de-caveated for SEO.
