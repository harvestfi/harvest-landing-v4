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
