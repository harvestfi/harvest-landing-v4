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
