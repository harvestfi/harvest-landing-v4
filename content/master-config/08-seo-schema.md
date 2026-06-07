# 08 · SEO, Structured Data & Indexing

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. How each page presents to crawlers, and the indexing gates. The framing goal is consistent with doc 04: signal "objective onchain data / analytics tool", not "financial advisor".

## JSON-LD (`src/lib/jsonld.ts`, emitted in `<head>`)

### `FinancialProduct`
- `name` = `productName`; `url`; `inLanguage: "en"`; `category`; `feesAndCommissionsSpecification: "N/A"`.
- `description` = `${vault.description} Historical onchain yield analytics for ${productName} on ${chain}, indexed by Harvest. Informational data tool, not financial advice.`
- `provider` **and** `brand` = Harvest (the operator publishing the page); `seller` = the underlying venue (`getProtocolLabel(vault)`, e.g. Aave / Morpho / Aerodrome). *Splitting provider from seller stops Google reading the venue as the owner of the index page.*
- `interestRate` = `QuantitativeValue { value: apy30d/100 (4dp), unitText: "PERCENT" }` — only when `apy30d > 0`.

### `Dataset` (only if `apyHistory ≥ 30` or `tvlHistory ≥ 30` points)
- `name` = `"{productName} historical APY, TVL and share-price data"`.
- `description` = point counts + `… for the {productName} vault on {chain}, indexed by Harvest from onchain vault-contract events. Historical analytics for research, not financial advice.`
- `temporalCoverage` = `startDate/endDate`; `keywords` = [asset, chain, protocol, category, "DeFi", "yield", "APY", "TVL"]; `license` = CC-BY-4.0; `isAccessibleForFree: true`; `distribution` = `DataDownload` pointing at `#history`.

### Others
- `BreadcrumbList` — from `productPageCrumbs(vault)`; the **last item has no `item` URL** (per Google spec).
- `FAQPage` — `mainEntity[].name` + `acceptedAnswer.text` come from the FAQ builders' **`answerText`** plain-string field, **never** the rendered ReactNode (schema and visible text must match).
- `Article` / `ItemList` — used on hub pages.

## Titles & descriptions (`generateMetadata`)
- **Autopilot / single-asset Autocompounder:** `productPageTitle(vault, isUniqueCombo)` + `productPageDescription(vault, trackedDays)`. The disambiguator slot drops when the asset+protocol+chain combo is unique in the index.
- **LP-pair:** `<title>` = `{ASSET}/{COUNTERPART} {PLATFORM} Yield on {CHAIN} | Harvest`; `<description>` = `Autocompounding LP yield on the {ASSET}/{COUNTERPART} pair on {PLATFORM} ({CHAIN}). {REWARD} rewards are claimed and added back to the position automatically. Tracked continuously by Harvest.`
- OpenGraph `article:modified_time` = latest history timestamp.

## Indexing gates → `robots: noindex`
Set in `generateMetadata` when **any** is true (don't let a thin/broken/empty page get indexed as a YMYL finance result):

| Gate | Condition (see 01 for exact logic) |
|---|---|
| `isBrokenLowTvlVault` | `0 < tvl < BROKEN_TVL_THRESHOLD` and recent APY is flatlined (all identical) |
| `isStaleApyVault` | last APY change older than `STALE_APY_DAYS` (or flat across that span) |
| `hasMissingMetrics` | `!(apy24h > 0)` or `!(tvl > 0)` |

## Why the analytics framing matters
Google's YMYL/E-E-A-T raters suppress sites that read as automated, inaccurate **financial advice**. Naming the data engine, the source (onchain vault-contract events), the "as of" timestamp, and "not financial advice" — across both the visible copy (doc 04) and the structured data here — categorises the platform as a **technical data/analytics product**. Combined with the consistency + forward-looking gates, this is the protective shield: accurate, sourced, internally consistent, non-predictive.
