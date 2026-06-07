# 02 · Page Anatomy — sections, render order, components

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. The skeleton: what renders, in what order, from which component. Section-level copy templates live in **03 · Section Specs**.

## Entry point
`src/app/[slug]/page.tsx` — a static-export server component. It loads `getVaultBySlug`, `getVaultHistory`, `getLiveVaults`, `getHoldersMap`; emits `<head>` metadata + JSON-LD; renders `<ProductPageBody vault=… />` (`src/components/product-page-body.tsx`), which does the rest.

## Render order (19 blocks + footer)

| # | Block | Component / builder |
|---|---|---|
| 1 | Sticky header | `ProductStickyHeader` (asset · name · `apy24h` · `tvl` · CTA) |
| 2 | Breadcrumb | `productPageCrumbs` (Home › {Asset} Ranking › {name}) |
| 3 | Title row | H1 `getCanonicalDisplayName` · short address · byline chips |
| 4 | Detail grid | `OverviewChart` (left) + sidebar KPIs (right) |
| 5 | Jump nav | inline |
| 6 | About | `buildAutopilotAbout` / `buildAutocompounderAbout` / `buildLpPairAbout` |
| 7 | Performance Overview | `AutopilotPerformanceOverviewBlock`→`buildPerformanceOverview` (autopilot/autocompounder) or `VaultCommentary` (others) · **+ `ProximityNote`** |
| 8 | Market benchmarking | `MarketBenchmark` (`market-sections.tsx`) |
| 9 | Ecosystem context | `EcosystemContext` (`market-sections.tsx`) |
| 10 | Yield trajectory | `AutopilotYieldTrajectoryBlock`→`buildYieldTrajectory` or `YieldTrajectory` · **+ `ProximityNote`** |
| 11 | Strategy stability | `VaultStabilityCard` |
| 12 | Long-term performance | `HistoricalNarrative` — **suppressed if `trackedDays < 30`** |
| 13 | Historical statistics | `HistoricalStats` |
| 14 | Historical Data table | `VaultHistoryTable` |
| 15 | Strategy details | inline grid — **Strategy row dropped for Autopilot** |
| 16 | FAQ | `VaultFaq` + `buildAutopilotFaqItems` / `…Autocompounder…` / `…LpPair…` |
| 17 | Other opportunities | `SimilarVaults` |
| 18 | Bottom links | explorer + Harvest app |
| 19 | Footnote | `ProductPageFootnote` (last-updated + disclosure) |
| — | Footer (site-wide) | `footer.tsx` — "Audited by" strip incl. **Halborn** |

## Vault-type dispatch
- **Autopilot** (`vaultType === "Autopilot"`): autopilot builders; no Strategy-details Strategy row; no byline platform chip.
- **Autocompounder** (`vaultType === "Autocompounder"`): three sub-variants —
  - *single-asset* (`underlyingLogos.length <= 1`),
  - *LP-pair* (`underlyingLogos.length > 1`) → canonical `{ASSET}/{COUNTERPART} {PLATFORM}`, `[LP]` badge in rankings, impermanent-loss FAQ,
  - *OnlyBoost* exception (`productName` includes "onlyboost") → keep `productName`, still `[LP]` badge.
  - `getCanonicalDisplayName(vault)` (`src/lib/lp-pair.ts`) resolves the name; defensive fallback to `productName` if counterpart/platform parse empty.

## ProximityNote placement
`<ProximityNote />` is rendered **inside** the Performance Overview and Yield-trajectory section components (after the fact list), so it appears only when the block has content — never orphaned. Component `src/components/proximity-note.tsx`; style `.pp-proximity-note` (`--uni-ink-3`).

## Conditional-rendering matrix (shared across all types)

| Condition | Effect |
|---|---|
| `holderCount === 0` | About P3 skips the "across N holders" fragment |
| `holderCount === 1` | About P3 renders singular "1 holder" |
| `trackedDays < 7` | Historical-stats APY paragraph → "still accumulating" notice |
| `trackedDays < 30` | Long-term performance → suppressed entirely |
| `trackedDays < 30 && readingsIndexed < 14` | Stability score/meter → suppressed; stats grid still renders |
| `sharePriceHistory.length < 2` | Yield trajectory → suppressed |
| `positive TVL points < 10` | Historical-stats TVL paragraph → fallback (current + days) |
| `TVL 30d both endpoints < $50K` | Performance Overview line 4 suppresses the percentage |
| `vaultType === "Autopilot"` | Strategy-details Strategy row + byline platform chip dropped |
| `isLpPairVault(vault)` | Canonical name expansion; platform chip dropped; `[LP]` badge in rankings |
| `productName` includes "onlyboost" | Canonical expansion skipped (uses `productName`); `[LP]` badge still shown |
