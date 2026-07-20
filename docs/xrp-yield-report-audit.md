# Harvest — XRP Yield Ranking report: full page audit

> A complete front-to-back snapshot of the page at `/report/xrp-yield-ranking`, prepared so an external reviewer (human or AI) can audit content, SEO, structured data, internal linking, the machine-readable data layer, and the front/back-end architecture. Everything below is extracted from the built static HTML and the source pipeline.

- **URL:** https://harvest.finance/report/xrp-yield-ranking
- **Data snapshot (dateModified):** 2026-07-19T18:02:03.882Z
- **Tracked products:** 14 · **Networks:** Base, Flare · **Median 30d rate:** 2.42% · **Incentivized:** 8/14 · **Total TVL:** $101.0M
- **Framework:** Next.js (App Router) static export (`output: "export"`), self-hosted on Vercel. Page is a React Server Component; interactive pieces are client components.

---

## 1. SEO metadata (rendered `<head>`)

| Field | Value |
|---|---|
| Title tag | Best XRP Yield: 14 DeFi Products Ranked by Real APY \| Harvest |
| Meta description | Where to earn yield on XRP, ranked by real rates. 14 curated XRP-denominated DeFi products across 2 networks, median 2.42%: lending, vaults, fixed-rate Principal Tokens and liquidity pools for XRP, FXRP, stXRP and cbXRP. XRP has no native staking, so these are the real onchain rates. Refreshed hourly from DeFiLlama, Spectra and Portals. |
| Canonical | https://harvest.finance/report/xrp-yield-ranking |
| Robots | index, follow |
| og:title | Best XRP Yield: 14 DeFi Products Ranked by Real APY |
| og:description | Where to earn yield on XRP, ranked by real rates. 14 curated XRP-denominated DeFi products across 2 networks, median 2.42%: lending, vaults, fixed-rate Principal Tokens and liquidity pools for XRP, FXRP, stXRP and cbXRP. XRP has no native staking, so these are the real onchain rates. Refreshed hourly from DeFiLlama, Spectra and Portals. |
| og:type | article |
| og:url | https://harvest.finance/report/xrp-yield-ranking |
| og:site_name | Harvest |
| og:image | https://harvest.finance/report/xrp-yield-ranking/opengraph-image?d2315f86ee8d07d5 |
| og:image:width | 1200 |
| og:image:height | 630 |
| twitter:card | summary_large_image |
| twitter:title | Best XRP Yield: 14 DeFi Products Ranked by Real APY |
| twitter:image | https://harvest.finance/report/xrp-yield-ranking/twitter-image?8173c42c2227b9ce |

**Notes on meta strategy**
- Title front-loads the high-intent query *best xrp yield* while keeping the product count + *APY*. ~58 chars incl. ` | Harvest`.
- Description is keyword-dense but readable: *XRP, FXRP, stXRP, cbXRP*, product types, network count, median rate, freshness, and the differentiator (*XRP has no native staking*).
- Canonical is self-referential. Robots = index,follow.
- Custom 1200×630 OG/Twitter card generated at build via Next `opengraph-image.tsx` (`next/og` ImageResponse) with live Products / Networks / Median-rate stats. Twitter card = `summary_large_image`.

---

## 2. Structured data (JSON-LD)

The page emits **8 JSON-LD nodes**. `Organization` + `WebSite` are injected site-wide from the root layout; the rest are page-specific. Full serialized nodes below.

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
  "dateModified": "2026-07-19T18:02:03.882Z",
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
  "dateModified": "2026-07-19T18:02:03.882Z",
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
  "dateModified": "2026-07-19T18:02:03.882Z",
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

**Structured-data notes**
- `Dataset` carries `distribution` (DataDownload: application/json + text/csv), `license` CC-BY-4.0, `isAccessibleForFree`, `creator`/`publisher` = Harvest, `isBasedOn` = DeFiLlama + Spectra, `dateModified` = live snapshot. This is the key AI/answer-engine + Google-Dataset signal.
- `Article` adds `datePublished` + `dateModified` + `author`/`publisher` for freshness + E-E-A-T; `WebPage` adds `isBasedOn` = methodology + publisher.
- `FAQPage` mirrors the on-page accordion (10 Q&A). `ItemList` enumerates the ranked products as plain name+url ListItems (deliberately NOT FinancialProduct, since the venues are third-party, not Harvest products).
- `BreadcrumbList` = Harvest › Report › XRP Yield Ranking.

---

## 3. Ranking data (the 14 tracked products)

Live rate/TVL hydrated hourly per product from its own source. `30d APY` = 30-day mean where a history exists, else current spot / fixed rate.

| # | Asset | Detail | Platform | Network | Type | 30d APY | TVL | Incentivized | History pts |
|--:|---|---|---|---|---|--:|--:|:--:|--:|
| 1 | cbXRP / WETH | Permissionless pool | Aerodrome | Base | Liquidity pool | 13.78% | $338k | yes | 90 |
| 2 | cbXRP / cbBTC | Permissionless pool | Aerodrome | Base | Liquidity pool | 4.23% | $338k | no | 90 |
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

Emitted at build by `scripts/build-xrp-history.mjs` into `public/data/xrp-yield/`, and surfaced three ways: a visible **Data** section on the page, the `Dataset` JSON-LD `distribution`, and `llms.txt`.

| File | Content |
|---|---|
| `/data/xrp-yield/index.json` | Catalogue: every product w/ current 30d APY, TVL, links to its JSON + CSV; license, disclaimer, `combinedHistoryCsv`. |
| `/data/xrp-yield/<slug>.json` | Per product: asset/detail/platform/chain/type, `rate` (basis + current + 30d-mean), `tvlUsd`, `range90dPercent`, incentivized, `dailyHistory[]` (date+apyPercent), `dataAsOf`, license, disclaimer. |
| `/data/xrp-yield/<slug>.csv` | Per product daily rate series `date,apy_percent` (only products with ≥2 history points → 8 of 14). |
| `/data/xrp-yield/history.csv` | All products, long format `slug,asset,platform,chain,date,apy_percent`. |
| `/llms.txt` | Lists the report + the dataset index + combined CSV under `## Reports` and `## Data`. |

**Known limitation (flag for reviewer):** CSVs are **daily APY only**. DeFiLlama publishes daily APY history; TVL is a **live snapshot** carried in each product JSON (`tvlUsd`), not a daily series. Spectra/Portals products may have no daily history at all (JSON still carries current rate + TVL).

---

## 4a. Data freshness & regeneration (how the report stays current)

**The whole surface — rendered HTML, every chart, every stat, the JSON/CSV downloads, and the JSON-LD `dateModified` — is regenerated from one source file, `data/xrp-yield.json`, on every deploy.** There is nothing to update by hand and no cache that outlives a push. This is the mechanic that keeps the page fresh for readers, search engines and AI crawlers.

**The pipeline, end to end:**

1. **Scheduled fetch (GitHub Actions) rewrites `data/xrp-yield.json` and pushes to `main`.** Two crons feed it:
   - `.github/workflows/update-data.yml` — **hourly** (`0 * * * *`). Runs `scripts/fetch-xrp-yield.mjs`, refreshing live rate + TVL for every allowlisted venue (DeFiLlama, Spectra, Portals). Commits `data/xrp-yield.json`.
   - `.github/workflows/update-xrp-data.yml` — **daily** (`0 6 * * *`). Runs the full enrichment chain so the heavier data points also move each day: `fetch-xrp-yield` → `apply-xrp-overrides` → `backfill-xrp-tvl-history` (TVL/APY/pps history to inception) → `build-xrp-landscape` (total-TVL growth series) → `fetch-xrp-holders` (holder counts + concentration) → `fetch-xrp-trading` (Spectra stXRP trading activity **and each maturity's PT max-fixed-rate history** for the overlay chart). Each step is `continue-on-error` so one flaky API never blocks the date advancing.
2. **The push to `main` triggers a Vercel build.** `vercel.json` builds **only** on `main` (`ignoreCommand`). Because the site is `output: "export"`, `npm run build` does `next build` → `mv out public`, **then** runs `scripts/build-xrp-history.mjs`, which regenerates all of `public/data/xrp-yield/*` (index.json, per-product JSON + CSV, `history.csv`, `landscape-tvl.{json,csv}`) from the fresh `data/xrp-yield.json`. So the committed `public/` in the repo is a throwaway artifact — Vercel rebuilds it from source every deploy; the served copy is never the stale committed one.
3. **The page reads `data/xrp-yield.json` at build time** (server component, `loadData()`). All derived copy, tables, the landscape/trading/overlay charts, and the JSON-LD `dateModified` (`Article`, `WebPage`, `Dataset`) recompute from it — so text and structured data can never drift from the numbers.

**"Last updated / As of" dates** come from `freshestTs` = the max of `data.generatedAt` and each enrichment pass's timestamp (landscape, holders, trading), so the visible date reflects the most recent refresh across *all* data points, and feeds `dateModified` in the schema for crawler freshness signals.

**Net effect:** rates/TVL are at most ~1h old; holders, landscape, trading and the PT overlay at most ~24h old; and the machine-readable JSON/CSV downloads are rebuilt in lock-step with the page on the same deploy — no separate export job to fall behind. If a reviewer ever sees the downloads lag the page, the cause is a failed Vercel deploy, not a missing regeneration step.

---

## 5. Internal & external linking

**Links INTO the page (inbound internal):**
- **Footer → Resources → "XRP Yield Report"** — site-wide, so every page (homepage, asset hubs, all ~156 product pages) links here. Primary internal-PageRank path.
- `sitemap.xml` (static export) and `llms.txt` both list the URL.

**Links OUT of the page (internal, contextual):**
- Method section → `/usdc`, `/eth`, `/btc`, `/methodology` (dofollow internal).
- Right-rail "In this report" TOC + inline "On this page" nav → in-page `#anchor` jump links.
- Data section → `/data/xrp-yield/index.json`, `/data/xrp-yield/history.csv`, `/llms.txt`.

**External (outbound to venues):**
- Every venue "Open →" / ranking "Open" routes through a leave-site confirmation modal (`DiscoverButton`), then opens the destination in a new tab with `rel="noopener noreferrer nofollow"` and `?ref=harvest.finance` attribution.
- Consequence: **no dofollow link equity leaks** to third-party venues; outbound is nofollow by design.

---

## 6. Full rendered page content (visible text, in DOM order)

> Extracted from the built HTML. Visual order differs from DOM order (sections are re-ordered via CSS `order` — see §7). This is the raw indexable text.

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
As of July 19, 2026 this report tracks 14 XRP products across 2 networks , Base and Flare . Rates span 0.18% to 13.78% , with a median of 2.42% across the 14 with a live rate.
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
1 cbXRP / WETH Permissionless pool Base · Aerodrome 13.78% Pool Aerodrome Base $338k Open →
2 cbXRP / cbBTC Permissionless pool Base · Aerodrome 4.23% Pool Aerodrome Base $338k Open →
3 stXRP / FXRP Permissionless pool Flare · SparkDEX 1.37% Pool SparkDEX Flare $5.8M Open →
Rates and TVL from DeFiLlama, Spectra and Portals, as of July 19, 2026 , refreshed hourly. Each row links to the platform’s own site.
Summary
## XRP yield right now
As of July 19, 2026 , the top vault or lending rate is 2.71% on FXRP at Superform , while dual-exposure liquidity pools reach 13.78% on cbXRP / WETH at Aerodrome . Fixed-rate Principal Tokens sit near 3.73% , locked to maturity . The median across the 14 rated products is 2.42% .
Weighing how much capital sits on each platform against the rate it pays, Spectra and Upshift hold the largest, most active positions on the page: Spectra with $20.1M across 5 products at an average 2.91% , and Upshift with $45.1M at 1.02% .
Charts
## 30-day rate history
How the rate has moved over the last 30 days for a selection of the larger venues, from DeFiLlama’s daily record. Useful for telling a steady rate apart from one riding a short-lived incentive spike.
cbXRP / WETH Aerodrome $338k TVL 13.78% 30d APY
Jun 20 Jul 19
cbXRP / cbBTC Aerodrome $338k TVL 4.23% 30d APY
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

**Rendering**
- **Page:** `src/app/report/xrp-yield-ranking/page.tsx` — React **Server Component**, statically prerendered (`output: "export"`). Reads only `data/xrp-yield.json` (isolated from the main vault pipeline: no Supabase, no `vaults.json`).
- **Client components (islands):**
  - `report-toc.tsx` — sticky right-rail "In this report" tree with `IntersectionObserver` scroll-spy (active section highlight).
  - `report-chart.tsx` — interactive daily-rate **bar chart** (solid flagship-yellow `#ffb936` bars, dotted grid, hover scrubbing updates the header value/date). SVG, `viewBox` 0..680×200.
  - `copy-address-button.tsx` — copy-to-clipboard for the wrapped-token contract addresses (blended inside the address pill).
  - `discover-button.tsx` — outbound "Open →" with the leave-site confirmation modal + analytics + `?ref=` attribution.
  - `home-hero-preview.tsx` — the tilted product-card preview in the hero (reused from the homepage), fed the featured product (stXRP PT · Aug 2026) with its **real** daily-rate history driving the bars.

**Layout & CSS**
- Styles: `src/app/_styles/report.css` (~1,450 lines), all scoped under `.rp-page`. Reuses the homepage shell (`.uni-home-*`) and the global hub-table classes (`.hub-*`); adds report-specific pieces.
- **Docs-style two-column layout** (Base-docs inspired): content column + sticky "In this report" rail (`.rp-doc` grid `minmax(0,1fr) 248px`, 64px gap). Rail hidden ≤1080px; replaced by an inline "On this page" 50/50 grid with gold `→` jump arrows.
- **Section order is visual-only via flex `order`** on `.rp-doc-main > section` (DOM stays Overview-first for SEO). Visual order: `1` XRP yield right now (summary) → `2` The ranking → `3` Overview → `4` 30-day rate history → `5` Where yield comes from → `6` PT max fixed rate → `7` Wrapped forms of XRP → `8` Can you stake XRP? → `9` CeFi vs DeFi → `10` Key risks → `11` Venues in depth → `12` FAQ → `13` Data & downloads → `14` Method & scope.
- **Type system:** Inter (variable, `--font-inter`) for body/headings enabling intermediate weights (450/650); Inter Tight for the logo; JetBrains Mono for addresses/eyebrow meta. Navy-toned palette (`--rp-heading #1a2440`, `--rp-body #3d465f`), gold eyebrows (`#ffb936`), dark-mode token overrides via `prefers-color-scheme` + `[data-theme]`.
- **Colored "eyebrow" pre-headings** above each `<h2>` (Report, Live rates, Summary, Charts, Guide, Tokens, Explainer, Compare, Risk, Reference, FAQ, Data, Method).
- **Lean Uniswap-style ranking tables**: no outer frame/row hairlines; a subtle header bar + whitespace; standardized cell fonts; only the 30d APY column is bold.

**Responsive / mobile (≤640px)**
- Body type reduced ~40% vs the enlarged desktop sizes; headlines a further ~30%; every text rule carries an explicit proportional line-height (no oversized leading).
- Ranking collapses to **# · Product (icon + name + detail + network·platform sub-line) · 30d APY · arrow**; position number sized down so it doesn't overpower the icon.
- Hero: 3 overlapping token marks (XRP/FXRP/stXRP) centered above the headline; text centered.
- Contents becomes a 50/50 grid; section spacing ~15% tighter; venue cards stack (full-width description, then full-width facts grid).

---

## 8. Back-end / data pipeline

**Single source of truth (allowlist):** `data/xrp-venues.json` — the exact 14 products the report shows, each with `slug`, `asset` (clean headline), `detail`, `symbol`, `platform`, `entity`, `chain`, `productType`, `exposure`, `url`, and a `source` descriptor.

**Hydrator:** `scripts/fetch-xrp-yield.mjs` (+ `scripts/fetch-spectra.mjs`) pulls live rate/TVL/history per product by `source.kind`:
- `defillama` → `yields.llama.fi/pools` (by poolId) + `/chart/<pool>` for daily history (`{d, apy}`, capped 90d) and the 90-day range.
- `spectra-pt` / `spectra-pool` / `spectra-metavault` → `api.spectra.finance` (fixed-rate PT max rate + daily history; pool/metavault APY + TVL).
- `portals` → `api.portals.fi` current APY (optional `PORTALS_API_KEY`; `staticApy`/`staticTvl` fallback).
- `none` → no feed (rate shown as n/a).
- Writes **`data/xrp-yield.json`** (committed; refreshed hourly by an external cron). This is the only file the page reads.

**Data sources / attribution:** DeFiLlama, Spectra, Portals. All venues are third-party protocols; none are Harvest products (stated repeatedly on-page + in schema disclaimers).

**Provenance notes for reviewer:**
- Portals history (`/v2/tokens/history`) and holders (`/v2/tokens/holders`) endpoints are **Pioneer-tier (403 on the free key)** → the report does not use per-wallet holder counts; "popularity" is framed via TVL × rate instead.
- The "capital-weighted average rate" in the FAQ and the "Spectra + Upshift lead" popularity line are **derived at render time** from `data/xrp-yield.json` (not hardcoded).

---

## 9. Build chain (`package.json` → `build`)

```
rm -rf public/_next
&& node scripts/build-network-tvl.mjs
&& next build                       # static export → out/
&& rm -rf public && mv out public
&& node scripts/build-seo-static.mjs   # robots.txt + llms.txt (+ IndexNow key)
&& node scripts/build-data-json.mjs    # per-vault JSON (site-wide)
&& node scripts/build-sales-surfaces.mjs
&& node scripts/build-search-index.mjs
&& node scripts/build-design-system.mjs
&& node scripts/build-master-config.mjs
&& node scripts/build-history-csv.mjs      # per-vault history CSV (site-wide)
&& node scripts/build-xrp-history.mjs      # ← XRP report: per-product JSON/CSV + index + combined CSV
&& npm run check-banned-words              # gate: banned marketing words
&& npm run check-consistency               # gate: cross-page consistency
```

Both gates must pass for the build to succeed.

---

## 10. File inventory (what to review)

| File | Role |
|---|---|
| `src/app/report/xrp-yield-ranking/page.tsx` | The page (server component): content, JSON-LD, ranking, FAQ, hero, Data section, `generateMetadata` (title/desc/OG). |
| `src/app/report/xrp-yield-ranking/venue-notes.ts` | Editorial "Venues in depth" reference + wrapped-token glossary (hand-authored, qualitative). |
| `src/app/report/xrp-yield-ranking/opengraph-image.tsx` / `twitter-image.tsx` | Custom OG/Twitter card (next/og). |
| `src/app/_styles/report.css` | All report styling (~1,450 lines). |
| `src/components/report/{report-toc,report-chart,discover-button}.tsx` | Client islands. |
| `src/components/{copy-address-button,home-hero-preview,token-icons,footer}.tsx` | Shared components (footer carries the site-wide inbound link). |
| `src/lib/jsonld.ts` | Schema builders: `articleSchema`, `reportWebPageSchema`, `reportDatasetSchema`, `reportItemListSchema`, `faqPageSchema`, `breadcrumbSchema`. |
| `src/lib/og-template.tsx` | Shared OG renderer (`ogImageResponse`). |
| `data/xrp-venues.json` | Allowlist (source of truth). |
| `data/xrp-yield.json` | Hydrated live snapshot the page reads. |
| `scripts/fetch-xrp-yield.mjs`, `scripts/fetch-spectra.mjs` | Data hydrator. |
| `scripts/build-xrp-history.mjs` | Machine-readable export emitter. |
| `scripts/build-seo-static.mjs` | robots.txt + llms.txt. |

---

## 11. SEO signal summary & open gaps

**On-page signals present**
- Static, fast, fully-crawlable HTML; self-referential canonical; index,follow.
- Keyword-rich title (intent-first) + meta description; keyword-aligned H1 (`XRP Yield Ranking: Where XRP Actually Earns`) and section H2/H3s.
- Rich structured data: WebPage, **Article** (datePublished + dateModified + author), **Dataset** (+DataDownload distribution, CC-BY-4.0), FAQPage (10 Q&A), ItemList, BreadcrumbList; site-wide Organization + WebSite.
- Freshness: visible "Last updated", hourly refresh, `dateModified` in schema.
- Unique, data-driven, non-templated long-form content (~3,000+ words) with an entity-rich glossary + venue directory.
- Machine-readable data + `llms.txt` + Dataset distribution → AI/answer-engine discoverability.
- Custom OG/Twitter card.
- Site-wide inbound internal link (footer).

**Deliberate choices**
- Outbound venue links are **nofollow** (leave-site modal) — no equity leak, appropriate for third-party YMYL destinations.
- Section DOM order is Overview-first (SEO) while visual order leads with the summary/ranking (UX) — decoupled via CSS `order`.

**Open gaps / candidate next work (for reviewer to weigh)**
1. **Off-page/backlinks** — the decisive factor for a competitive head term; no external backlinks yet. Candidates: pitch the CC-BY dataset + an embeddable ranking widget to Flare ecosystem / DeFi media / aggregators.
2. **Topical cluster** — no supporting spoke pages yet ("How to earn yield on XRP" guide, "Can you stake XRP?" standalone, "FXRP explained", "cbXRP vs FXRP") to build entity authority and feed internal links.
3. **Programmatic long-tail** — `/xrp-yield/flare`, `/xrp-yield/base`, `/fxrp-yield` not built (would need unique per-page data to avoid thin content).
4. **Daily TVL history** — CSVs are daily APY only; daily TVL not tracked upstream in the current pipeline.
5. **Author/reviewer byline** — Article `author` is the Organization; a named author/"reviewed by" block would strengthen E-E-A-T.
6. **Contextual inbound links** — only the footer links in so far; in-content links from the homepage hero/asset hubs would pass more weight than the footer.

