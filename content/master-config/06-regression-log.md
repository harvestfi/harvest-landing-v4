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
