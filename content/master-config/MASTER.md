# Harvest - Master Config
## Single-product-page methodology, cemented snapshot

> Snapshot: 2026-06-07, prod main @ 05fb1ee. This file is the concatenation of the numbered set 00-08; download the individual files for the modular version.


===============================================================

# 00 · Master Config — Quickstart & File Map

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. This pack is a point-in-time, authoritative record of the Harvest single-product-page generation engine — enough for a fresh AI or engineer to rebuild every section to identical, regression-free output.

## What this is
The product pages under `/[slug]` are **template-generated from indexed onchain data** (no free-form generation). This pack documents the data, the sections, the exact copy templates, the editorial/YMYL rules, the canonical-value discipline that keeps sections consistent, the full log of bugs we fixed, and the two build gates that prevent regression.

## Read order
- **Rebuilding from scratch:** 00 → 01 (data) → 02 (anatomy) → 03 (section specs) → 04 (editorial) → 05 (canonical) → 08 (SEO). Then 06 (regression log) + 07 (gates) for the guardrails.
- **"Just the rules":** 04 + 07.
- **"Why is the code shaped this way":** 06.

## The pack
| File | Contents |
|---|---|
| `00` | this — quickstart + file map |
| `01` | data model & sources (the 3 JSON files, loading, guards, freshness) |
| `02` | page anatomy (render order + component map + conditional matrix) |
| `03` | section specs (every section's exact templates + thresholds, per vault type) |
| `04` | editorial & YMYL rulebook |
| `05` | canonical values & cross-section consistency |
| `06` | regression log (every failure mode we fixed) |
| `07` | the gates (the two build-failing scanners) |
| `08` | SEO, structured data, indexing |
| `MASTER` | all of the above concatenated into one file |

## Repo file map
| Concern | Files |
|---|---|
| Route, metadata, JSON-LD | `src/app/[slug]/page.tsx`, `src/lib/jsonld.ts`, `src/lib/seo.ts` |
| Page body + vault-type dispatch | `src/components/product-page-body.tsx` |
| About | `src/lib/{autopilot,autocompounder,lp-pair}-about.ts` |
| Performance Overview + Yield trajectory | `src/lib/autopilot-sections.ts`; `src/components/vault-commentary.tsx`, `yield-trajectory.tsx` |
| Market benchmarking + Ecosystem | `src/components/market-sections.tsx` |
| Strategy stability | `src/components/vault-stability-card.tsx` |
| Long-term performance | `src/components/historical-narrative.tsx` |
| Historical statistics | `src/components/historical-stats.tsx` |
| Historical Data table | `src/components/vault-history-table.tsx` |
| FAQ | `src/lib/{autopilot,autocompounder,lp-pair}-faq.tsx`; `src/components/vault-faq.tsx` |
| Proximity buffer | `src/components/proximity-note.tsx` |
| Shared formatting / contextualisation | `src/lib/format.ts`, `src/lib/contextualize.ts` |
| Data + guards | `src/lib/data.ts`, `history-api.ts`, `freshness.ts`, `admin-rules.ts` |
| Canonical name / LP | `src/lib/lp-pair.ts` |
| Editorial rules (canonical) | `AGENTS.md` |
| Gates | `scripts/check-banned-words.mjs`, `scripts/check-page-consistency.mjs` |
| Data files | `data/vaults.json`, `data/history.json`, `data/holders.json` |

## Build pipeline
```
npm run build =
  build-network-tvl  →  next build (static export)  →  mv out public
  →  build-search-index  →  build-design-system
  →  check-banned-words  →  check-consistency
```
Both gates must pass or the build (and the deploy) fails. **Snapshot state: 0 violations / 0 findings across 156 product pages.**

## Rebuild-from-scratch recipe
1. **Data layer (01):** the three JSON files, the loaders + fallbacks, the quality guards (`sanitizeTvlSeries`, `isErraticTvl`, `hasSharePriceDiscontinuity`, `apy>=0`, `value>0`), and `freshness`.
2. **Dispatch (02):** route → `ProductPageBody` → vault-type variant (Autopilot / single-asset Autocompounder / LP-pair / OnlyBoost).
3. **Sections (03):** implement each section, honouring every threshold + suppression rule + the **canonical values (05)** so nothing contradicts.
4. **Voice + SEO (04, 08):** apply the editorial/YMYL rules and the structured-data framing.
5. **Gates (07):** port both scanners; run against your build; iterate to 0.
6. **Cross-check (06):** every regression-log entry is a trap a naive rebuild falls into — verify each failure mode is absent.

**Acceptance test:** doc 07's gates report 0 findings, and none of doc 06's failure modes are present.


===============================================================

# 01 · Data Model & Sources

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. Everything a product page renders derives from three committed JSON files plus the guards below. A standalone Node script can reproduce the entire surface offline from these files (which is exactly how the build and both gates run).

## The three sources

| File | Shape | Role |
|---|---|---|
| `data/vaults.json` | `YieldVault[]` | the listing (one row per vault) |
| `data/history.json` | `Record<contractAddress, FullVaultHistory>` | per-vault time series |
| `data/holders.json` | `Record<lowercasedAddress, number>` | holder counts |

### `YieldVault` (the listing row — fields used by pages)
```ts
{
  id, slug, asset, productName,
  protocol: { name, slug },
  vaultType,          // "Autopilot" | "Autocompounder" | LP-pair | ...
  apy24h, apy30d, tvl,
  description,        // the About intro is built from this + templates
  chain, category, riskLevel, launchDate,
  contractAddress, strategyAddress, tokenAddress, rewardTokens,
}
```

### `FullVaultHistory` (per-vault series)
```ts
{
  apyHistory:        { apy: number;        timestamp: number }[],
  tvlHistory:        { value: number;      timestamp: number }[],
  sharePriceHistory: { sharePrice: number; timestamp: number }[],
}
```
Each series is one reading per calendar day (last value of the day). Timestamps are unix seconds.

## Loading flow (`src/lib/data.ts`)

- **`getVaults()`** — cache → `loadVaultsFromFile()` (`data/vaults.json`) → fallback `fetchHarvestVaults()` (live API). Then **reconciled against history**:
  - `apy24h`: override **only if** `!(v.apy24h > 0)` (keep the listing value; use history-latest only when the API has none).
  - `apy30d`: `freshness(h).apyStale ? v.apy24h : deriveApyMetrics(h).apy30d` (when the APY feed is stale, use the spot value rather than a stale 30-day mean).
  - `tvl`: override **only if** `!(v.tvl > 0)` (last resort: latest TVL point).
- **`getVaultHistory(addr)`** — file cache (`data/history.json`, keyed by exact or lowercased address) → fallback `fetchFullVaultHistory()` (subgraph) → empty on any error.

### Derived metrics (`deriveApyMetrics`)
- `apy24h` = the latest valid (`apy >= 0`) reading.
- `apy30d` = mean of valid readings within 30 days of the latest timestamp, else `apy24h`.

### Freshness (`src/lib/freshness.ts`)
```
apyTs = max timestamp of apyHistory where apy >= 0
tvlTs = max timestamp of tvlHistory
spTs  = max timestamp of sharePriceHistory
freshestTs = max(apyTs, tvlTs, spTs)        // the honest "as of"
apyStale   = apyTs > 0 && (freshestTs - apyTs) > 21 days
```
**Every 30-day window on the page anchors to `freshestTs`, never to wall-clock `now`** — so a vault whose feed went stale stays internally consistent instead of dating its "30D" rows months ago.

## Data-quality guards (applied before any narrative reads the data)

| Guard | Rule | Effect |
|---|---|---|
| `sanitizeTvlSeries()` | strip an interior TVL point deviating ≥ 50× from **both** neighbours | run **once at load** in `loadHistoryFromFile()`; every consumer sees the cleaned series. First/last never dropped. |
| `isErraticTvl()` | `max > 50 × median(positive readings)` | suppress the peak/drawdown narrative (the "peak" would be noise) |
| `hasSharePriceDiscontinuity()` | any step implying > 5%/day (time-normalised) | suppress CAGR + "$1,000 at launch" lines (re-index artifact) |
| APY filters | `apy >= 0` everywhere; ceiling `apy <= 100` at load | drop negative/outlier readings |
| TVL positivity | `value > 0` for every TVL stat, narrative, peak, trough | a `$0`/null reading is a dropout, not data |

## Page-suppression gates → `robots: noindex` (`generateMetadata`)

A page is set to `noindex` when **any** of these is true (a thin/broken/empty page shouldn't be indexed as a YMYL finance result):

| Gate | Condition |
|---|---|
| `isBrokenLowTvlVault` | `0 < tvl < BROKEN_TVL_THRESHOLD` **and** ≥ `BROKEN_MIN_OBSERVATIONS` recent readings that are **all the identical APY** (flatlined) |
| `isStaleApyVault` | the most recent APY *change* is older than `STALE_APY_DAYS` (or the series is flat across ≥ that span) |
| `hasMissingMetrics` | `!(apy24h > 0)` **or** `!(tvl > 0)` |

(Thresholds `BROKEN_TVL_THRESHOLD`, `BROKEN_MIN_OBSERVATIONS`, `STALE_APY_DAYS` live in `src/lib/admin-rules.ts`.)

## Canonical values (see **05** for the full rationale)
- **Days tracked** = span of `apyHistory.filter(apy >= 0)`, computed once, reused by every section.
- **Current TVL** = `vault.tvl` (the listing value shown in the hero), never the history tail.
- **Current APY** = `vault.apy24h` (spot), distinct from the indexed daily series (see **06 · C**).


===============================================================

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


===============================================================

# 03 · Section Specs — exact templates, thresholds, gates

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. **Variable substitution only — do not paraphrase the templates.** Where the three vault types (Autopilot, Autocompounder [single-asset], LP-pair) share a template it is stated once; per-type deltas are called out. Conditional-rendering matrix is in **02**; canonical values in **05**.

Shared helpers (`src/lib/contextualize.ts`, `format.ts`):
- `depositRef(asset)` → `{ amount: 1000, label: "$1,000" }` for stable assets (USDC/USDT/DAI/PYUSD/…); `{ amount: 1, label: "1 ETH" }` / `"1 BTC"` for ETH/BTC.
- `apyToMonthly(apy, amount)` = `(apy/100) * amount / 12`. `fmtEarnings(v, asset)` → `~$X` (USD: 2dp <$10, $1 to $100, $5 increments >$100) or `~Y ETH/BTC` (4 sig figs).
- `formatAPY`, `formatTVL`. **Never** translate non-stable (ETH/BTC) yield to USD — there is no historical price feed.

---

## 1 · Title row & byline

**H1** = `getCanonicalDisplayName(vault)`: LP-pair → `{ASSET}/{COUNTERPART} {PLATFORM}`; OnlyBoost + single-asset + Autopilot → `productName`.

**Byline chips** (`{Network} · Harvest · [{Platform} ·] {Type}`):
| Type | Byline |
|---|---|
| Autopilot | `{Network} · Harvest · Autopilot` (no platform chip — collapses to "Autopilot") |
| Autocompounder (single-asset) | `{Network} · Harvest · {Platform} · Autocompounder` |
| Autocompounder (LP-pair / OnlyBoost) | `{Network} · Harvest · Autocompounder` (canonical name already states platform) |

Operator brand = `vault.protocol.name.replace(/\s*Finance\s*$/i, "")` → "Harvest", never "Harvest Finance". Network chip links to `/{network-slug}`.

---

## 2 · About (3 paragraphs)

Holder fragment (P3, all types): `0/null` → omit; `1` → "across 1 holder"; `>1` → "across {HOLDERS} holders".
P3 (all types): `Live since {INCEPTION}. Currently indexed at {TVL} TVL[ across {HOLDERS} holder(s)], with a {APY_24H} 24-hour APY and {APY_30D} across the trailing 30 days.` (Young vault: "{APY_30D} since launch" when window < 30d.)

**Autopilot** — `PROTOCOL_INSERT` keyed by contract address (fallback `"lending and yield venues"`; closes ", among others" unless single-venue):
- P1: `{PRODUCT_NAME} is a high-frequency rebalancing vault on {NETWORK} with {TICKER} as its underlying token, in which the yield is distributed. It sources yield from across several {PROTOCOL_INSERT} and actively reallocates liquidity to the best-performing sources, keeping users positioned to the optimal yield available at any given time.`
- P2 (constant): `Allocations are handled by an optimisation engine powered by IPOR Labs AG and executed transparently onchain, within predefined boundaries. The engine rebalances between sub-vaults based on sustained rate trends, gas costs, and liquidity depth, and ignores short rate spikes when chasing them would cost more than it earns.`
- ⚠️ "the optimal yield", never "the most optimal yield".

**Autocompounder (single-asset)** — `UNDERLYING_VENUE` keyed by address (fallback `"its underlying lending venue"`):
- P1: `{PRODUCT_NAME} is an autocompounder on {NETWORK} with {TICKER} as its underlying token, in which the yield is distributed. It earns yield from {VENUE} and automatically converts any claimed rewards into more {TICKER}, removing the manual claim and conversion steps a user would otherwise need to perform on their own.`
- P2 (`reward == ticker`): `Yield earned by the strategy is added back to the vault on a recurring basis. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all holders rather than borne by each user individually.`
- P2 (`reward != ticker`): `Rewards earned by the strategy ({REWARD}) are periodically converted into {TICKER} and added back to the vault. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all holders rather than borne by each user individually.`

**LP-pair** — `REWARD` = `rewardTokens[0]?.symbol` (fallback `"platform-native rewards"`):
- P1: `{DISPLAY_NAME} is an LP-token autocompounder on {NETWORK}, with {TICKER} paired with {COUNTERPART} in the underlying LP position. The strategy provides liquidity to the {TICKER}/{COUNTERPART} pool on {PLATFORM} and earns yield from both trading fees on the pair and {REWARD} emissions distributed to liquidity providers.`
- P2: `Any claimed {REWARD} rewards are automatically converted into more of the underlying LP position and added back to the vault, removing the manual claim and conversion steps a user would otherwise need to perform on their own. Autocompounding events run when economically feasible, anywhere from hourly to several days apart, with gas costs socialised across all holders rather than borne by each user individually.`

---

## 3 · Performance Overview (numbered fact list, shared across all types)

- **Line 01 — rank** (`ratio = rank/total`):
  - `ratio <= 0.25`: `This vault's {APY} APY ranks #{R} among the {N} {TICKER} vaults we monitor, placing it in the top quarter of the cohort.`
  - else: `This vault's {APY} APY ranks #{R} among the {N} {TICKER} vaults we monitor, with {ABOVE} strateg{y|ies} currently delivering higher APY.`
  - Suppressed on dead vaults (`tvl <= 1`) and hidden products.
- **Line 02 — 30d range** (render if `trailing.length >= 2` and `max >= 0.005`): `Over the past 30 days, APY has ranged from {LO} to {HI}, averaging {AVG}. At the {HI} high, {ref.label} would earn {fmtEarnings(earnHigh)} per month; at the {LO} low, {fmtEarnings(earnLow)}.` (Young vault: "Over the {N} days since launch".)
- **Line 03 — lifetime** (render if `lifetime.length >= 5`): `Over its tracked history, this vault's realized APY has averaged {AVG}, ranging from {LO} to {HI}.` (Stated on its own terms; **never** compared to `apy24h`.)
- **Line 04 — TVL change** (render if `tvlSorted >= 2` and baseline ≥ 7d old): both endpoints < $50K → `TVL stands at {CURRENT}, compared to {PAST} {30 days ago|at launch}.` (no %); `|pct| >= 1000%` → `TVL has {grown|fallen} from {PAST} to {CURRENT}.`; else → `TVL has {increased|decreased} {PCT}% over the past 30 days, from {PAST} to {CURRENT}.` ⚠️ The < $50K guard is **AND** (both endpoints), not OR. % is computed from `tvlCompareNum`-rounded endpoints so it reconciles with the displayed values.

> Non-autopilot vault types render the equivalent via `VaultCommentary` (`vault-commentary.tsx`) with the same rank/threshold logic.

---

## 4 · Market benchmarking (shared)

**Stats grid:** Asset average APY (funded-only mean) · This product APY (`apy24h`) · Market rank `#{R} / {N}` · vs. Average `{+/-}{pct}%`.

**Ranking-table layout:** Case A (rank 1–5) — contiguous top 5. Case B (rank 6+) — anchors `{1,2,3, rank-1, rank, rank+1, total}`, walk in order, insert a `…` separator row only when a gap > 1, fill the row when the gap is exactly 1. LP-pair rows use canonical name + `<LpBadge/>`.

**Closing paragraph:**
`Among the {N} {ASSET} strategies we currently monitor, this product ranks #{R}. Its {APY} yield runs {ABS_DELTA}% {higher|lower} than the cohort average of {AVG}. On a {ref.label} position, that's {deltaPhrase} per month {higher|lower} than the cohort average. {APY_SUMMARY} It currently holds {TVL} in TVL, ranking #{TVL_RANK} of {N} by TVL.`
- If product APY and average round equal: `…runs roughly in line with the cohort average of {AVG}.` (drop the per-month clause).
- `APY_SUMMARY`: `<=0.25` → "This product sits in the top quarter of the cohort by APY."; `0.25–0.75` → "{ABOVE} strateg{y|ies} in the cohort are currently delivering higher APY; {BELOW} are delivering lower."; `>0.75` → "{ABOVE} … delivering higher APY."
- Dead vault: drop superlative + per-deposit clause; keep factual rank + TVL standing.
- **Gates:** `bench.sign`, `bench.higher-count`, `bench.lower-count`, `rank.cross-section`.

---

## 5 · Ecosystem context (shared)

**Intro:** `On {NETWORK}, this product's yield runs {ABS_VS_NET}% {higher|lower} than the network average across the {ASSET} strategies we monitor. By APY it ranks #{R} of {N} in that set. Yields on {NETWORK} for {ASSET} have averaged {NET_AVG}% in our index.` (Equal-rounding → "runs roughly in line with the network average".) **Chart:** top 10 same-chain bars + network-average baseline; **legend:** top 6 (canonical name + `[LP]` for LP-pair).

**Closer:** rank 1 → `Currently the top-yielding {ASSET} opportunity on {NETWORK} across the {N} products we monitor.`; else → `By TVL, this product ranks #{TVL_R} of {N} {ASSET} strategies on {NETWORK} in our index.` (No "operated by / competes against" sentence.)

---

## 6 · Yield trajectory (shared) — the only section where `deposited` is allowed

Render if `sharePriceHistory.length >= 2`. `ageDays` = share-price span (= tracked days). `stable = isStable(asset)`.
- If `ageDays >= 30`:
  - stable: `$1,000 deposited 30 days ago would now be worth ~${USD30}, a {gain|loss} of ~${ABS_DELTA} over that period.`
  - non-stable: `1 {TICKER} deposited 30 days ago would now be ~{RATIO} {TICKER}.`
- Always (`ageDays >= 1`):
  - stable: `$1,000 deposited at launch ({ageDays} days ago) would now be worth ~${USD_INC}, a {gain|loss} of ~${ABS_INC_DELTA}.`
  - non-stable: `1 {TICKER} deposited at launch ({ageDays} days ago) would now be ~{RATIO_INC} {TICKER}.`
- ⚠️ **NEVER emit a "$1,000 deposited" line for non-stable assets.** The dollar values come from the **realized share-price ratio**, not average APY (see 06·C2); they are labelled "realized share-price gain/loss" deliberately. Suppressed when `hasSharePriceDiscontinuity`.
- **+ `ProximityNote`.**

---

## 7 · Strategy stability (shared)

Score from CoV = `stddev/mean` of the 30-day (freshness-anchored) APY window:
```
cv < 0.1          → round(100 - (cv/0.1)*10)            (90–100)
0.1 <= cv < 0.2   → round(89 - ((cv-0.1)/0.1)*19)       (70–89)
0.2 <= cv < 0.4   → round(69 - ((cv-0.2)/0.2)*29)       (40–69)
0.4 <= cv         → max(0, round(39 - ((min(cv,1)-0.4)/0.6)*39))   (0–39)
```
Label: `>=80` Very consistent · `>=60` Consistent · `>=40` Moderately variable · `>=20` Highly variable · `<20` Very volatile.
**Card not rendered** if `valid.length === 0` or `recent.length < 5` or `mean <= 0`. **Score suppressed** (stats grid still shows) when `trackedDays < 30 AND readingsIndexed < 14` → "Score not available — insufficient data…". Stats: Mean APY, Volatility ±{stddev}%, 30-day range, readings indexed.

---

## 8 · Long-term performance (shared; suppressed if `trackedDays < 30`)

- **Bullet 1 — CAGR** (`daySpan >= 30`, no share-price discontinuity): `Share price has compounded at an annualized rate of {CAGR}% over {DAYS} days, growing from {FIRST} to {LAST}.` If `daySpan < 90`: state realized **total return** instead of annualizing (`Share price has grown {X}% over {DAYS} days, from {FIRST} to {LAST}.`). If `daySpan >= 90`: append per-unit gain/loss (`This represents a gain of ~{G} {TICKER} per 1 {TICKER} supplied at launch.`). Never "minimal returns".
- **Bullet 2 — TVL drawdown** (`positive tvl >= 10`, `maxDrawdown >= 15%`, not erratic):
  - at-peak (`current >= 0.9*peak`): `TVL currently sits at {CURRENT}, at or near its historical peak.[ The vault has held this scale for the past {daysAtPeak} days.]`
  - past-peak: `TVL experienced a {PCT}% drawdown from its {PEAK} peak, bottoming at {TROUGH}[ over {DAYS_DOWN} days]. It currently stands at {CURRENT}, {PCT_VS_PEAK}% of the peak value.`
  - `formatDrawdownPct(pct, trough)`: trough `<= 0` → "100"; rounds-to-100 with positive trough → "99"; else `round(pct)`. Trough scan is **positives only** (a $0 dropout is not the trough). Drop " over N days" when `DAYS_DOWN` rounds to 0; render `PCT_VS_PEAK` as "<1" when current is a non-zero sub-percent.
  - **Gates:** `drawdown.zero-trough`, `drawdown.trough-above-current/peak`, `peak.direction`, `peak.current-above-peak`.
- **Bullet 3 — best/worst month** (`apyHistory >= 60`, `>= 3` months with `>= 5` readings): `Best performing month was {BEST_MONTH} at {BEST_AVG}% average APY; weakest was {WORST_MONTH} at {WORST_AVG}%.` If `totalDays >= 90 AND spread >= 5pp`: append `The spread between best and worst months represents {fmtEarnings} per {ref.label} per month.`

---

## 9 · Historical statistics

**APY narrative** (anchored to latest reading):
- `apyTrackedDays < 7`: `Tracked for {N} day(s). APY data is still accumulating; the first meaningful summary requires at least a week of readings.`
- `dataPoints >= 60 AND |changePct| > 10`: `Over the past {DAYS} days, this vault's APY has moved from an early average of {EARLY}% to a recent average of {RECENT}%, a {ABS_CHANGE}% {increase|decrease}. At the start of the window, {ref.label} would have earned {EARLY_EARN}/mo at then-current rates; at recent rates, {RECENT_EARN}/mo.` (early/late = first/last quarter means; ⚠️ `{DAYS}` is the day **span**, gate is on the reading **count**.)
- else: no APY paragraph.

**TVL narrative** (positives only; gated on lifetime `sorted.length >= 2`, NOT on the 30d stats object):
- `>= 10 AND current >= 0.8*peak` → **A:** `Total value locked currently sits at {CUR}, {up from|down from|little changed} {FIRST} at the start of tracking. The vault has been live for {DAYS} days.` (direction from actual `cur > first`; "little changed since the start of tracking" when both round equal — see 06·B1.)
- `>= 10` → **B:** `Total value locked currently sits at {CUR}, which is {PCT}% of its all-time peak of {PEAK} reached on {PEAK_DATE}.` (drop date clause if unparseable.)
- else → **fallback:** `Total value locked currently sits at {CUR}. The vault has been live for {DAYS} days.`

**Stats tables:** APY + TVL blocks (each splits to two columns when alone). "Current TVL" = `vault.tvl`. Lifetime-avg "(Nd)" = `apyTrackedDays`. Each row carries a `data-tooltip`.

---

## 10 · Historical Data table
Dedupe to one row per **UTC** calendar day (latest reading of the day); date display `en-US` with `timeZone: "UTC"` (must match the dedupe key — local-time caused phantom duplicate rows). Tabs: APY / TVL / Share Price. Lifetime summary: avg · high · low · data points. Real zeros render `0.00%` / `$0` / `0.0000`; the dash placeholder fires only for non-finite values.

---

## 11 · Strategy details
Label/value grid. **Autopilot drops the Strategy row** (would duplicate "Type: Autopilot"); Autocompounder + LP-pair keep `Strategy: {protocolName}`. Rows: Network · Type · Underlying · Rewards (if any) · Operator (trimmed) · Tracked for {trackedDays} days · Holders (if non-null) · Vault / Strategy / Underlying-token contracts (full-width, with copy + explorer link).

---

## 12 · FAQ (7 questions; `answerText` plain-string feeds JSON-LD `FAQPage`, must match the rendered answer)

Young-vault framing (`trackedDays > 0 && < 30`): `avgPhrase = "an average of {APY_30D} since launch"` (else "a 30-day average of {APY_30D}"); `rangeWindow = "Since launch"` (else "Over the last 30 days"); `rangeRef = "range since launch"` (else "30-day range").

**Q1 (all):** `{PRODUCT_NAME} is showing a 24-hour APY of {APY_24H}, with {avgPhrase}. Rates are variable and move with {market conditions, liquidity, and the underlying protocol(s)' incentives | trading volume on the {TICKER}/{COUNTERPART} pair, the {REWARD} emission schedule, and overall liquidity in the pool}. The figures reflect the realised yield over the trailing window; they are not a forward guarantee.`

**Q5 (all):** has 30d (`hi >= 0.005`): `{rangeWindow}, this vault's APY has ranged from {LO} to {HI}, averaging {AVG}, with measured volatility of ±{VOL}%. The Strategy stability section above shows where this falls on the scale from very volatile to very consistent.` else: `There isn't yet enough 30-day APY history to score stability for this vault. The Strategy stability section above will populate once a meaningful window of records is available.`

**Q6 (all):** holders > 0: `The vault currently holds {TVL} in TVL across {HOLDERS} holders. The Historical statistics section above shows how this compares to the vault's {rangeRef} and lifetime peak.` else: drop the "across … holders" clause.

**Per-type Q2 / Q3 / Q4 / Q7:**
- **Autopilot** — Q2 "How does the Autopilot rebalance allocations?": `The strategy uses an optimisation engine built by IPOR Labs AG that reallocates between sub-vaults multiple times a day. Allocation decisions factor in sustained rate trends, gas costs, and liquidity depth. Short-lived rate spikes are deliberately ignored when chasing them would cost more than they earn. Reallocations happen onchain within predefined boundaries.` · Q3 (→/risk-framework): "…During periods of liquidity stress in the underlying **sub-vaults**, withdrawal capacity can be limited until liquidity returns…" · Q4: `The Autopilot sources yield from across several {PROTOCOL_INSERT}. The income stream is a combination of lending interest paid by borrowers in those markets and protocol-level reward emissions where applicable. The mix shifts over time as the engine rebalances to the best-performing sources.` · Q7: "…smart contract risk in both the Harvest contracts and the underlying sub-vaults, market risk in the lending venues it routes to… **audited by Halborn in January 2025, and the Autopilot engine has been audited twice.** Audits reduce but do not eliminate risk."
- **Autocompounder (single-asset)** — Q2 "How does the autocompounding work?" (two variants on `reward == ticker`): holds positions in `{VENUE}`, recurring add-back / claims+converts `{REWARD}` into `{TICKER}`. · Q3: "underlying **venue**". · Q4 (two variants): interest from `{VENUE}` [+ reward emissions in `{REWARD}`]. · Q7: "…Harvest contracts and `{VENUE}`… **audited by Halborn in January 2025.**" (no engine mention).
- **LP-pair** — Q2: LP-add flow (`claims {REWARD} → converts in pair proportions → adds liquidity back`). · Q3: "underlying **pool**". · Q4: two sources — trading fees on the `{TICKER}/{COUNTERPART}` pool + `{REWARD}` emissions from `{PLATFORM}`. · Q7: adds **impermanent loss** in plain language ("when the two prices diverge, the LP position is worth less than holding the two tokens separately would have been … {REWARD} rewards partially offset this, but the offset is not guaranteed …") + Halborn.

---

## 13 · Other opportunities (6 cards)
Eligible: same asset, `apy24h > 0`, `tvl > 0`, not self. Ordering — **Autopilot/single-asset:** same-network same-type → same-network other-type → off-network same-type. **LP-pair:** same-network LP-pair → same-network single-asset → off-network LP-pair. Card: asset icon · canonical name + `[LP]` if applicable · chain · 24h APY · TVL.

## 14 · Footnote
`Latest data point: {Month D, YYYY} ({relative})` (max timestamp across all series) + `Harvest is an independent onchain yield index. Performance data reflects historical onchain activity and is not a forecast. See the methodology, risk framework, terms, and disclosures …`


===============================================================

# 04 · Editorial & YMYL Rulebook

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. The voice rules that keep the copy accurate, unfalsifiable, and safe under Google's YMYL (Your Money or Your Life) quality bar. `AGENTS.md` (repo root) is the canonical source; this restates it plus the YMYL layer. The mechanical parts are **enforced by the gates** (doc 07).

## 1 · No em dash
`—` (U+2014) is banned in **all user-facing content** — titles, headings, body, table cells, tooltips, FAQ, meta. Use a comma, period, colon, or `" - "` (spaced hyphen). Code comments and commit messages are exempt. **Gate:** banned-words `em dash`.

## 2 · Coverage & overstatement (unfalsifiability)
Any sentence comparing the product to a **population** (rankings, market/network averages, "the ecosystem", outperformance %, "X of Y strategies", "highest-yielding", "most established") must signal that the population is **what we track**, not the whole market.
- **Signal once per section**, not every sentence; then "the cohort", "that set", "them", "the network average" may be used unqualified.
- **Vary the phrasing:** "we monitor", "we follow", "we currently track", "in our index", "the strategies we monitor", "across the products we follow", "the cohort", "in that set". Don't stack "tracked tracked tracked".
- **Always ≥ 1 signal per comparison section** (so a reader landing on that section alone understands the population).
- **Exempt:** labels, table headers, pills, tile captions, tags (1–3 word UI strings) — may use "tracked" as a short qualifier without softening.
- **Not applied to:** general SEO/marketing meta ("Best DeFi yields"), nor factual single-vault statements (current APY, TVL, share price, days tracked).
- **Goal — unfalsifiability:** if someone produces a vault we don't index, the copy must still read as accurate.
- **Gate:** consistency `scope.missing-signal`.

## 3 · Observational, never forward-looking (the YMYL core)
- **Template substitution only** — "do not paraphrase". There is no free-form generation at render time, so a page **cannot hallucinate**; it can only mis-compute (caught by the consistency gate) or overstate (caught by rule 2).
- **Forbidden:** `will earn`, `you'll/you will earn`, `guaranteed return/yield`, `expected/projected/forecasted return`, `at this rate`, and any predictive/forecast framing.
- **Required framing:** "would earn", "realised yield", "realized share-price gain", "The figures reflect the realised yield over the trailing window; they are not a forward guarantee", "is not a forecast".
- **`risk-free` is allowed only in the debunking sense** — "No DeFi yield strategy is risk-free." (It is deliberately NOT in the blacklist.)
- **Gate:** banned-words forward-looking patterns.

## 4 · Tone, person, word choice
- Third-person, impersonal, numerate. **No promotional intensifiers** ("well above", "far higher", "notably ahead", "solidly outperforming").
- **No second-person possession** ("your funds / capital / earnings / deposit / balance / returns").
- **Neutral rank framing** — never "outperforming X%" or "competes against".
- **"Harvest"**, never "Harvest Finance", in prose (legal pages + copyright exempt).
- Prefer **"yield / gain / income stream"** over the noun "returns"; **"position / holdings / supply"** over "deposit / capital". (The word `deposited` is allowed *only* inside the Yield-trajectory section.)
- No "minimal/negligible/nominal returns" placeholders — always render a quantitative gain in the underlying unit.
- No "upward/downward trend" framing — state endpoints + delta neutrally.

## 5 · Proximity buffers
A muted micro-copy line sits under the dollar-figure analytics blocks (Performance Overview, Yield trajectory):
> Historical indexer data. Past onchain performance is not a predictive forecast.

Rendered by `ProximityNote` (`.pp-proximity-note`, `--uni-ink-3`). **One per block, not per number** — over-hedging (prefixing every figure with "hypothetical") reads as anxious and *hurts* Trustworthiness. The single page-level footnote + one local buffer per analytics section is the calibrated amount.

## 6 · Schema framing
`FinancialProduct` + `Dataset` JSON-LD descriptions name the engine and frame the site as an **analytics / indexer tool** ("… indexed by Harvest from onchain vault-contract events … not financial advice") to steer Google's classifier toward "data tool" and away from "financial advisory". See doc 08.

## 7 · Numbers are exempt from softening
Factual single-vault figures (current APY, TVL, share price, days tracked) are stated plainly. The coverage rule (2) applies to *comparisons*, not to a vault's own current facts.

---

### The one-line summary
**Observe, don't predict. Compare only against "what we track". State a vault's own numbers plainly. Never an em dash.** Everything mechanical in here is a build-failing gate — so the rules can't quietly erode as the product grows.


===============================================================

# 05 · Canonical Values & Cross-Section Consistency

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. Every value that appears in more than one place on the page has **exactly one source**. Recomputing the same concept two different ways is how contradictions ship (see **06 · D**). These are the single sources and the consistency rules built on them.

## Days tracked — one source, one formula
- **Source:** the span of `apyHistory.filter(p => p.apy >= 0)` → `round((maxTs − minTs) / 86400)`.
- Computed once in `product-page-body.tsx` (`trackedDays`) and recomputed **identically** (same formula, same `history` object) by every consumer.
- **Drives:** "Tracked for N days" (header + Strategy details), "live for N days", "compounded over N days" (CAGR), "deposited at launch (N days ago)", "Lifetime avg (Nd)".
- They **must all match**. **Gate:** `age.disagree` (hard-fail, ≥ 2-day mismatch).
- ⚠️ It is a **day span**, not the reading **count** ("Data points"). Conflating them was the "138d vs 371 days" contradiction.

## Current TVL — one source
- **Source:** `vault.tvl` (the listing value shown in the hero / app).
- **Used by:** "Current TVL" (grid), "currently sits at …", "It currently stands at …". Peak / trough / first stay from history.
- **Gate:** `tvl.current-disagree` (hard-fail; all renderings must be byte-identical, since all come from `formatTVL` of the same number).

## Current APY (spot) vs the indexed series — two different things, by design
- `vault.apy24h` = **spot** estimate from the listing feed → hero badge, FAQ "24-hour APY".
- `apyHistory` = the **indexer's** realized daily series → history table, best-day, 30D stats.
- They legitimately differ; **copy never equates them** (see 06 · C1). This is intentional, not a bug.

## 30-day windows — one anchor
- **Anchor:** `freshness(history).freshestTs` = max timestamp across APY / TVL / share-price (never wall-clock `now`).
- Shared by `HistoricalStats`, `VaultStabilityCard`, `buildPerformanceOverview`, `buildYieldTrajectory` → their "30D Low/High/Average/Best/Worst" figures agree, even on a vault whose feed went stale.

## Asset-cohort rank — one construction
- Filter `v.asset === vault.asset && v.apy24h > 0`; sort by `apy24h` desc; **self-include** the current vault (dedup by id) so vaults excluded from `getLiveVaults()` still rank honestly on their own page.
- Identical construction in Performance Overview and Market benchmarking.
- **Gates:** `rank.cross-section`, `rank.exceeds-total`, `rank.higher-count`.

## Cohort / network average — funded only
- Average over `!isLowLiquidityTvl(v.tvl)` (≥ $50K) strategies; **rank still spans every pool**; fall back to the full set only if none clear the threshold.
- This is why a "network average" can equal the only funded vault's own APY (e.g. ETH-on-Ethereum).

## Canonical display name — one function
- `getCanonicalDisplayName(vault)` (`src/lib/lp-pair.ts`): LP-pair → `{ASSET}/{COUNTERPART} {PLATFORM}`; OnlyBoost + single-asset → `productName`; defensive fallback to `productName` if the parse is empty.
- The same string flows through breadcrumb, H1, sticky header, About heading + intro, and FAQ Q1.

---

### The principle
If two sentences cite "the same thing", they must read it from the **same variable**, computed **once**. The gates exist to prove that holds on every build — but the discipline starts here, at the source.


===============================================================

# 06 · Regression Log — every failure mode we found and fixed

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. A point-in-time record of the actual failure modes this engine hit and how each is now prevented. Read alongside **07 — The Gates**: nearly every entry is backed by a deterministic check that fails the build if it recurs.

Each entry: **Symptom** (what rendered) → **Cause** → **Fix** (file) → **Guard** (what stops recurrence).

---

## A. TVL & drawdown

### A1 · "100% drawdown, bottoming at $0" on a live vault
- **Symptom:** "TVL experienced a 100% drawdown from its $225K peak, bottoming at $0 … currently stands at $123K" — a total-loss headline on a vault that is plainly operating.
- **Cause:** the drawdown scan walked the **raw** TVL series; a single non-positive (0 / null) indexer dropout became the trough.
- **Fix:** `historical-narrative.tsx` — scan `history.tvlHistory.filter(p => p.value > 0)` only. A $0/null snapshot is a dropout, not an empty vault. Mirrors the `value > 0` filter every sibling TVL stat already used.
- **Guard:** consistency gate `drawdown.zero-trough` (hard-fail).

### A2 · Drawdown % vs a non-zero trough ("reserve 100 for true zero")
- **Symptom:** a vault that fell from $746K to $169 rounded to "100% drawdown" — reads as "went to zero" when $169 remained.
- **Cause:** naive `Math.round(99.977) → 100`.
- **Fix:** `formatDrawdownPct(pct, trough)` returns "100" only when `trough <= 0`; otherwise clamps a rounds-to-100 down to "99". Everything else rounds honestly.
- **Guard:** consistency gate `drawdown.pct-mismatch` (review) + the zero-trough hard-fail.

### A3 · Micro-liquidity trough renders correctly ($63, not $0)
- **Behaviour (validated on USDC Alpha Delta V2, $64 TVL / $13K peak):** trough = the smallest **positive** post-peak reading ($63); `formatTVL($63) = "$63"`; drawdown clamps to 99% (non-zero trough); "$64 = <1% of $13K peak". Self-consistent under the hardest case.
- **Guard:** A1 filter + A2 clamp + the gate's trough≤current / zero-trough checks.

### A4 · Erratic TVL spikes manufacture a fake peak/drawdown
- **Cause:** a one-day index spike (e.g. $178K between two $100 readings) becomes the "all-time peak".
- **Fix:** `isErraticTvl(series)` — true when `max > 50 × median(positive readings)` — suppresses the entire peak/drawdown narrative and falls the Historical-statistics TVL paragraph back to its peak-free form.
- **Validated on:** ETH KPK Yield V2 (legacy, wild TVL) — drawdown bullet correctly suppressed.

### A5 · A single dust/zero round-trip poisons every TVL figure
- **Cause:** a $20 reading between $30K readings skews 30D low/high, "largest daily change", peak, drawdown.
- **Fix:** `sanitizeTvlSeries()` strips an interior point deviating ≥ 50× from **both** time-neighbours, applied **once at load** in `data.ts → loadHistoryFromFile()` so every consumer reads the cleaned series. First/last points never dropped (preserves the tracked-day span).

### A6 · "% of peak" / TVL-change % that don't reconcile with the displayed endpoints
- **Symptom:** "$1.37M → $1.14M, 21%" when the displayed endpoints compute to 16%.
- **Cause:** cross-rounding — % from full-precision values, endpoints macro-rounded.
- **Fix:** `tvlCompareNum()` rounds endpoints to the displayed precision; the % is computed from those, so "from $A to $B, X%" always reconciles.
- **Guard:** consistency gate `drawdown.pct-of-peak`, `peak.pct-of-peak` (review).

---

## B. Direction & narrative correctness

### B1 · "up from $2.0M" when the vault shrank
- **Symptom:** USDC 40 Acres ($1.96M → $1.86M) printed "currently sits at $1.9M, **up from** $2.0M".
- **Cause:** the near-peak narrative hardcoded "up from {first}". Its gate is only "current within 20% of peak", which does **not** imply growth since inception.
- **Fix:** `historical-stats.tsx` — derive the word from the actual `cur > first`; say "little changed since the start of tracking" when both endpoints round to the same display value.
- **Guard:** consistency gate `peak.direction` (hard-fail).

### B2 · Annualizing a short window overstates yield
- **Risk:** a 21.5% share-price gain over 87 days annualizes to ~126% CAGR while indexed APY reads ~10%.
- **Fix:** `historical-narrative.tsx` — only annualize when `daySpan >= 90`; under a quarter, state the **realized total return over the actual window** instead.

### B3 · A share-price re-index inflates CAGR / launch value
- **Cause:** a migration/re-index step (an impossible > 5%/day jump) in the share-price series.
- **Fix:** `hasSharePriceDiscontinuity()` (any step implying > 5%/day, time-normalised) suppresses the CAGR sentence and the "$1,000 at launch" line, which would otherwise contradict the indexed APY.

---

## C. Spot vs indexed — the two REJECTED "bugs"

> Two recurring external-audit claims that are **correct by design**, not bugs. Documented so they are never "fixed" into incorrectness.

### C1 · 24h badge (3.99%) ≠ today's indexed daily reading (11.64%)
The hero/FAQ "24h APY" is `vault.apy24h` — a **spot estimate from the listing feed**; the history table / best-day come from `apyHistory` — the **indexer**. Two different sources. The copy **never asserts they're equal** (`yield-trajectory.tsx:166-171`, `autopilot-sections.ts:324-331` deliberately avoid the comparison). "Fixing" it would mean hiding real data or overwriting the live badge.

### C2 · Trajectory "$1,000 → $1,004 (~$4)" vs 30D-average APY 7.22%
The $4 is the **realized share-price gain** (ground truth — what actually happened to the money). 7.22% is the **arithmetic mean of daily APY readings**, end-loaded by a late spike that hasn't compounded yet. They legitimately differ. `gainLossPhrase()` (`autopilot-sections.ts:73-89`) documents this and labels the figure "realized share-price gain" precisely so an automated `APY × principal × days/365` check can't misread it. Deriving the dollar figure from average APY would print a number no deposit ever had.

---

## D. Cross-section consistency (canonical values)

### D1 · Day-count drift (the "longevity contradiction")
- **Symptom:** "Tracked for 394 days" next to "compounded over 669 days" / "Lifetime avg (209d)".
- **Cause:** sections derived age from different series (APY span vs share-price span vs TVL span).
- **Fix:** every day-count — "Tracked for N", "live for N", "compounded over N", "deposited at launch (N days ago)", "Lifetime avg (Nd)" — derives from the **same** quantity: the span of `apyHistory.filter(apy >= 0)` on the **same** history object (`product-page-body.tsx` `trackedDays`, mirrored in every component).
- **Guard:** consistency gate `age.disagree` (hard-fail; ≥ 2-day mismatch).

### D2 · "Current TVL" disagreeing with the headline
- **Cause:** some sections read the history tail, others the listing value.
- **Fix:** "Current TVL" (grid), "currently sits at", "stands at" all use `vault.tvl` (the listing value in the hero/app); peak/trough/first stay from history.
- **Guard:** consistency gate `tvl.current-disagree` (hard-fail).

### D3 · 30-day windows drifting on stale feeds
- **Cause:** anchoring 30D windows to wall-clock `now` dated "30D Low/High/Best/Worst" months ago when a feed went stale.
- **Fix:** every 30D window anchors to `freshness(history).freshestTs` (max timestamp across APY/TVL/share-price). Shared by HistoricalStats, the stability card, Performance Overview, Yield trajectory.

### D4 · "#0 of N" rank on excluded vaults
- **Cause:** Aerodrome/LP-pair/stale/broken vaults are dropped from `getLiveVaults()`, so `findIndex` returned −1 → "#0".
- **Fix:** self-include the current vault in its own cohort (dedup by id) so its rank is always honest on its own page.
- **Guard:** consistency gate `rank.exceeds-total`, `rank.higher-count`, `rank.cross-section`.

---

## E. Population / overstatement (YMYL coverage)

### E1 · A ghost pool skews the cohort/network average
- **Risk:** a $4 pool at 51% APY drags the mean and makes funded products look worse.
- **Fix:** the average is over **funded** strategies only (`!isLowLiquidityTvl`, i.e. ≥ $50K); **rank still spans every pool**; fall back to the full set only if none clear the threshold. (This is why ETH KPK's "network average" can equal its own APY — it is the only funded ETH-on-Ethereum vault.)

### E2 · Superlatives / earnings projections on dead vaults
- **Fix:** `deadVault = !(vault.tvl > 1)` suppresses "top quarter", "top-yielding", and per-deposit earnings lines; the factual rank + TVL standing remain.

### E3 · Low-liquidity advisory
- **Fix:** `isLowLiquidityTvl` (< $50K) renders the "Low liquidity" note under Strategy stability (slippage + few-holders caveat). Validated on USDC Alpha Delta ($64).

### E4 · Unfalsifiable comparison framing (scope signal)
- **Rule (AGENTS.md):** any comparison to a population must signal the population is "what we track" ("we monitor", "in our index", "the cohort", "in that set"), once per section, varied phrasing.
- **Guard:** consistency gate `scope.missing-signal` (hard-fail).

### E5 · Forward-looking / deterministic language
- **Rule:** copy is strictly observational ("would earn", "realized share-price gain", "not a forward guarantee"); never predictive/guaranteed.
- **Guard:** banned-words forward-looking patterns (`will earn`, `guaranteed/expected/projected return`, `at this rate`). NB `risk-free` is intentionally allowed — the risk section legitimately says "No DeFi yield strategy is risk-free".

### E6 · Proximity buffers + analytics schema framing
- **Fix:** a muted per-section buffer ("Historical indexer data. Past onchain performance is not a predictive forecast.") under Performance Overview + Yield trajectory; `FinancialProduct`/`Dataset` JSON-LD descriptions frame the site as an analytics/indexer tool ("… not financial advice"), steering Google away from "advisory".

---

## F. Trust surfaces

### F1 · Halborn audit missing from the trust strip
- **Symptom:** the Halborn (Jan 2025) audit was referenced in every FAQ + the Disclosures/Security pages, but absent from the footer "Audited by" strip and the Security page audit-card list.
- **Fix:** added Halborn to both so the trust surfaces match the site's own substantiated claims.

---

### The meta-lesson
Most of these were not "the math was wrong" — the math engines were right. They were **a sentence asserting something the data didn't support** (a hardcoded "up from", a $0 dropout treated as real, a spot figure compared to an indexed one). The defence is therefore not "check the arithmetic" but **"make every sentence's claim reconcile with the data it cites and with every other sentence on the page"** — which is exactly what the gates in doc 07 enforce.


===============================================================

# 07 · The Gates — the self-enforcing safety net

> **Snapshot:** cemented 2026-06-07, prod `main` @ `05fb1ee`. Two deterministic scanners run at the end of `npm run build` (after the pages are emitted). They scan the **rendered** `public/<slug>.html`, so they catch a violation no matter which template produced it — and a violation **fails the deploy build**. This is what lets the project stop re-litigating the same class of bug.

## Build wiring
```
"build": "rm -rf public/_next && node scripts/build-network-tvl.mjs && next build
          && rm -rf public && mv out public
          && node scripts/build-search-index.mjs && node scripts/build-design-system.mjs
          && npm run check-banned-words && npm run check-consistency"
```
Both scanners exit non-zero on a violation → Vercel/CI build fails → nothing ships.

---

## A · `scripts/check-banned-words.mjs` — editorial + forward-looking

- **Scope:** `public/<slug>.html` for every slug in `data/vaults.json` (product pages only; home/hub/legal pages use a different register).
- **Method:** strip `<footer>` (the universal legal disclaimer, which legitimately uses banned words), then `<script>`/`<style>`, then tags → readable text. A **section-aware exemption** allows `deposited` inside `<section id="yield-trajectory">` (the "$1,000 deposited 30 days ago" template) and bans it everywhere else.
- **The blacklist** (each entry is a regex; scope `always` unless noted):

  | Rule | Pattern (gist) |
  |---|---|
  | yield-income noun | `returns? / returning` |
  | invest family | `invest / investing / invested / investment / investor(s)` |
  | deposit family | `deposit(s/ing)` — **exempt inside `#yield-trajectory`** |
  | depositor / re- | `depositor(s)`, `redeposit / reinvest` family |
  | capital | `capital` |
  | outperform | `outperform(s/ed/ing)`, `competes against / goes up against` |
  | brand | `Harvest Finance` (use plain "Harvest" in prose) |
  | recovery | `recovered` |
  | placeholders | `minimal / negligible / nominal returns` |
  | trend framing | `upward/downward trend`, `trending up/down` |
  | soft judgment | `well above / significantly below / far higher / notably ahead / solidly outperforming` |
  | 2nd-person possession | `your (funds\|capital\|deposit\|investment\|earnings\|balance\|returns)` |
  | **forward-looking (YMYL)** | `will/you'll earn` · `guaranteed return/yield/profit/apy` · `expected/projected/forecasted return/yield/...` · `at this rate` |
  | typography | `—` (em dash) |

- **`risk-free` is deliberately NOT banned** — the risk section legitimately says "No DeFi yield strategy is risk-free."
- **Allowlist:** documented false positives only (e.g. `liquidity returns` = verb usage), stripped before matching.

---

## B · `scripts/check-page-consistency.mjs` — numeric / structural + YMYL

- **Scope:** the same rendered pages; strips to text and **glues** the currency/percent boundaries that tag-stripping splits (`$ 1,004 ,` → `$1,004,`, `5.61 %` → `5.61%`) so the numeric patterns match the way a human reads the sentence.
- **Severities:**
  - **`contradiction`** — a sign / ordering / equality failure, true regardless of display rounding. **Must always be zero; hard-fails the build.**
  - **`review`** — a ratio mismatch within rounding noise. Surfaced, non-blocking (unless `--strict`).
- **The checks:**

  | Check | Asserts | Severity |
  |---|---|---|
  | `drawdown.zero-trough` | "bottoming at $0" never appears while current > 0 | contradiction |
  | `drawdown.trough-above-current` / `-above-peak` | trough ≤ current, trough ≤ peak | contradiction |
  | `drawdown.pct-mismatch` | stated drawdown % ≈ (peak−trough)/peak | review |
  | `drawdown.pct-of-peak` | "X% of peak" ≈ current/peak | review |
  | `peak.direction` | "up from"⟺current>first, "down from"⟺current<first | contradiction |
  | `peak.current-above-peak` | current ≤ cited all-time peak | contradiction |
  | `peak.pct-of-peak` | "X% of its all-time peak" ≈ current/peak | review |
  | `range.lo-hi` / `range.avg-outside` | in "ranged from LO to HI, averaging AVG": LO ≤ AVG ≤ HI ≤ ordering | contradiction |
  | `trend.direction` | "increase"⟺recent>early, "decrease"⟺recent<early | contradiction |
  | `trend.pct` | stated %Δ ≈ \|recent−early\|/early | review |
  | `deposit.sign` | "gain"⟺worth ≥ $1,000, "loss"⟺worth < $1,000 | contradiction |
  | `deposit.delta` | \|worth − 1000\| ≈ stated delta | review |
  | `rank.exceeds-total` | every "#N of M" has N ≤ M | contradiction |
  | `rank.higher-count` | "N strategies delivering higher APY" == rank − 1 | contradiction |
  | `rank.cross-section` | Market-rank stat == Performance-Overview rank/total | contradiction |
  | `tvl.current-disagree` | every "current TVL" rendering is byte-identical | contradiction |
  | `age.disagree` | every day-count is within 1 of "Tracked for N days" | contradiction |
  | `leak.null-or-nan` | no `$NaN` / `NaN%` / `undefined` / `Invalid Date` / `Infinity` | contradiction |
  | `scope.missing-signal` | a page that makes a population comparison carries a scope signal | contradiction |
  | `bench.higher-count` / `lower-count` | benchmarking "{above} higher; {below} lower" reconcile with rank/total | contradiction |
  | `bench.sign` | "vs. Average" stat sign matches "X% higher/lower than the cohort average" | contradiction |
  | `bench.magnitude` | "vs. Average" magnitude matches the closing % | review |

- **Helpers:** `parseMoney` (`$0`/`$119`/`$1,004`/`$85K`/`$1.9M`/`$2.0B` → number; thousands-comma only, never a trailing sentence comma), `parsePct` (`"<1"` → 0.5). Tolerances are display-aware: ±2 on integer percentages, **string-equality** for "current TVL" agreement (both come from `formatTVL` of the same value).
- **Run modes:** `node scripts/check-page-consistency.mjs` (report), `--json` (machine output), `--strict` (also fail on `review`).

---

## C · How to extend safely (when you add a section or template)
1. Author the template per the conventions in **03 — Section Specs** and **04 — Editorial & YMYL Rulebook**.
2. If the template emits a number that relates to another number on the page, **add a check**:
   - sign / ordering / equality relationship → `contradiction`;
   - ratio / magnitude relationship (subject to display rounding) → `review`.
3. If the template makes any population comparison, ensure a scope signal is present in the same section.
4. Verify against a clean build — `npm run build` must end with **both gates at 0 findings**. The current snapshot is `0 violations / 0 findings across 156 product pages`.

### Why scan rendered HTML, not source strings
A page is assembled from ~8 independent builders. Checking source string literals would miss contradictions that only emerge once the numbers are substituted and the sections sit side by side. Scanning the emitted HTML is the only place where "does sentence X agree with sentence Y and with the grid" is decidable — so that is where the gate lives.


===============================================================

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
