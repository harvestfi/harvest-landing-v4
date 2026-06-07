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
